/**
 * Donation Controller - PayPal Integration
 * Flow: Frontend crea orden → Backend obtiene token → crea orden en PayPal → devuelve orderID
 *       Frontend abre PayPal → usuario aprueba → Frontend llama capture → Backend verifica con PayPal
 */
const axios = require('axios');
const logger = require('../utils/logger');

// Usar PAYPAL_ENV para controlar el entorno de PayPal independientemente de NODE_ENV.
// En producción o cuando PAYPAL_ENV=production usa la API real, si no usa sandbox.
const PAYPAL_BASE_URL = process.env.PAYPAL_ENV === 'production'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

logger.info(`PayPal usando entorno: ${process.env.PAYPAL_ENV || 'sandbox'} → ${PAYPAL_BASE_URL}`);

const CLIENT_ID = process.env.CLIENT_ID_PAYPAL;
const SECRET    = process.env.SECRET_KEY_PAYPAL;

if (!CLIENT_ID || !SECRET) {
  logger.error('FALTAN CREDENCIALES DE PAYPAL: CLIENT_ID_PAYPAL y/o SECRET_KEY_PAYPAL no están definidos');
}

// Timeout para llamadas a PayPal (15s)
const PAYPAL_TIMEOUT = 15_000;

// ═══════════════════════════════════════════════════════════════
// TOKEN MANAGEMENT
// ═══════════════════════════════════════════════════════════════

let cachedToken = null;
let tokenExpiresAt = 0;
let tokenPromise = null;

function invalidateToken() {
  cachedToken = null;
  tokenExpiresAt = 0;
  tokenPromise = null;
}

/**
 * Obtiene token de PayPal con cache + promise-lock.
 * N requests concurrentes → 1 sola llamada a PayPal.
 */
async function getPayPalToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  if (tokenPromise) return tokenPromise;

  tokenPromise = (async () => {
    try {
      if (!CLIENT_ID || !SECRET) {
        throw new Error('Credenciales de PayPal no configuradas');
      }

      const response = await axios.post(
        `${PAYPAL_BASE_URL}/v1/oauth2/token`,
        'grant_type=client_credentials',
        {
          auth: { username: CLIENT_ID, password: SECRET },
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: PAYPAL_TIMEOUT,
        }
      );

      cachedToken = response.data.access_token;
      const expiresInMs = (response.data.expires_in - 1800) * 1000;
      tokenExpiresAt = Date.now() + expiresInMs;

      logger.info('Token de PayPal renovado');
      return cachedToken;
    } catch (err) {
      // Si falla el token, invalidar para que el próximo request lo reintente
      invalidateToken();
      throw err;
    } finally {
      tokenPromise = null;
    }
  })();

  return tokenPromise;
}

// ═══════════════════════════════════════════════════════════════
// PAYPAL REQUEST HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Ejecuta una llamada a PayPal con retry en 401 (token expirado).
 * NO retries en 5xx para captures (peligroso: podría duplicar cobros).
 */
async function paypalRequest(method, url, data = {}) {
  const attempt = async () => {
    const token = await getPayPalToken();
    return axios({
      method,
      url,
      data,
      timeout: PAYPAL_TIMEOUT,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
  };

  try {
    return await attempt();
  } catch (error) {
    if (error.response?.status === 401) {
      logger.warn('Token de PayPal rechazado (401), renovando...');
      invalidateToken();
      return await attempt();
    }
    throw error;
  }
}

/**
 * Consulta el estado de una orden en PayPal.
 * Útil para verificar si un capture que hizo timeout realmente se procesó.
 */
async function getOrderStatus(orderID) {
  try {
    const resp = await paypalRequest('get', `${PAYPAL_BASE_URL}/v2/checkout/orders/${orderID}`);
    return resp.data;
  } catch {
    return null;
  }
}

/** Extrae monto de una orden PayPal completada */
function extractAmount(orderData) {
  const unit = orderData?.purchase_units?.[0];
  return unit?.payments?.captures?.[0]?.amount;
}

/** Redondea a 2 decimales sin errores de floating point */
function roundAmount(n) {
  return (Math.round(n * 100) / 100).toFixed(2);
}

/** IP real del request (Cloudflare, nginx, directo) */
function getClientIP(req) {
  return req.headers['cf-connecting-ip']
    || req.headers['x-real-ip']
    || req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.ip
    || 'unknown';
}

/** Mensaje de error legible según el tipo de fallo */
function userErrorMsg(error, context) {
  if (error.code === 'ECONNABORTED') {
    return 'PayPal no respondió a tiempo. Intenta de nuevo.';
  }
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    return 'No se pudo conectar con PayPal. Intenta de nuevo en unos minutos.';
  }
  if (error.message === 'Credenciales de PayPal no configuradas') {
    return 'El sistema de pagos no está configurado. Contacta al administrador.';
  }
  return context === 'create'
    ? 'No se pudo crear la orden de pago'
    : 'No se pudo completar el pago';
}

// ═══════════════════════════════════════════════════════════════
// ROUTE HANDLERS
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/donations/create-order
 * Body: { amount: 5 }
 */
exports.createOrder = async (req, res) => {
  const ip = getClientIP(req);

  try {
    const rawAmount = req.body?.amount;
    const amount    = parseFloat(rawAmount);
    const currency  = 'USD';

    if (!Number.isFinite(amount) || amount < 1 || amount > 1000) {
      return res.status(400).json({ success: false, message: 'Monto inválido (1–1000 USD)' });
    }

    const value = roundAmount(amount);

    const order = await paypalRequest('post', `${PAYPAL_BASE_URL}/v2/checkout/orders`, {
      intent: 'CAPTURE',
      purchase_units: [
        {
          description: 'Donación a Manhwa Imperial',
          amount: { currency_code: currency, value },
        },
      ],
      application_context: {
        brand_name: 'Manhwa Imperial',
        user_action: 'PAY_NOW',
      },
    });

    if (!order.data?.id) {
      logger.error('PayPal no devolvió orderID en la respuesta', { ip, data: order.data });
      return res.status(500).json({ success: false, message: 'Respuesta inesperada de PayPal' });
    }

    logger.info(`Donación creada: orderID=${order.data.id} amount=${value} ${currency} ip=${ip}`);

    return res.json({ success: true, orderID: order.data.id });
  } catch (error) {
    const paypalError = error.response?.data;
    logger.error('Error creando orden PayPal:', {
      ip,
      code: error.code,
      status: error.response?.status,
      message: paypalError?.message,
      details: paypalError?.details,
    });
    return res.status(500).json({ success: false, message: userErrorMsg(error, 'create') });
  }
};

/**
 * POST /api/donations/capture/:orderID
 * Captura el pago después de que el usuario aprueba en PayPal.
 *
 * IMPORTANTE: si el capture falla por timeout o error de red, verificamos
 * el estado de la orden antes de devolver error. El dinero PUEDE haberse
 * cobrado aunque no hayamos recibido confirmación.
 */
exports.captureOrder = async (req, res) => {
  const ip = getClientIP(req);
  const { orderID } = req.params;

  if (!orderID || typeof orderID !== 'string' || !/^[A-Z0-9]{10,25}$/i.test(orderID)) {
    return res.status(400).json({ success: false, message: 'orderID inválido' });
  }

  /** Helper: respuesta de éxito consistente */
  const successResponse = (orderData) => {
    const amt = extractAmount(orderData);
    logger.info(`Donación completada: orderID=${orderID} amount=${amt?.value} ${amt?.currency_code} ip=${ip}`);
    return res.json({
      success: true,
      message: '¡Gracias por tu donación!',
      details: {
        orderID,
        amount: amt?.value,
        currency: amt?.currency_code,
        status: 'COMPLETED',
      },
    });
  };

  try {
    let capture;
    try {
      capture = await paypalRequest('post', `${PAYPAL_BASE_URL}/v2/checkout/orders/${orderID}/capture`);
    } catch (captureError) {
      const errStatus = captureError.response?.status;
      const errIssue  = captureError.response?.data?.details?.[0]?.issue;

      // ORDER_ALREADY_CAPTURED: capture duplicado (retry del navegador, doble click)
      // La donación SÍ se procesó — verificamos y devolvemos éxito
      if (errStatus === 422 && errIssue === 'ORDER_ALREADY_CAPTURED') {
        logger.info(`Capture duplicado (ya capturado): orderID=${orderID} ip=${ip}`);
        const orderData = await getOrderStatus(orderID);
        if (orderData?.status === 'COMPLETED') {
          return successResponse(orderData);
        }
      }

      // TIMEOUT o ERROR DE RED: el dinero PUEDE haberse cobrado
      // Verificamos el estado de la orden antes de devolver error
      if (captureError.code === 'ECONNABORTED' || captureError.code === 'ECONNRESET' || !captureError.response) {
        logger.warn(`Capture timeout/red, verificando orden: orderID=${orderID} code=${captureError.code} ip=${ip}`);
        const orderData = await getOrderStatus(orderID);
        if (orderData?.status === 'COMPLETED') {
          logger.info(`Orden verificada como COMPLETED post-timeout: orderID=${orderID} ip=${ip}`);
          return successResponse(orderData);
        }
        // No se completó — devolvemos error pero con mensaje que reconoce la incertidumbre
        logger.error(`Capture falló y orden no completada: orderID=${orderID} status=${orderData?.status} ip=${ip}`);
        return res.status(500).json({
          success: false,
          message: 'Hubo un problema al confirmar el pago. Si se realizó el cobro, tu donación fue registrada. Intenta de nuevo si no ves el cargo.',
        });
      }

      throw captureError;
    }

    // Capture exitoso
    const data   = capture.data;
    const status = data.status;

    if (status !== 'COMPLETED') {
      logger.warn(`Captura PayPal no completada: ${status} orderID=${orderID} ip=${ip}`);
      return res.status(400).json({ success: false, message: `Estado inesperado: ${status}` });
    }

    return successResponse(data);
  } catch (error) {
    const paypalError = error.response?.data;
    logger.error('Error capturando orden PayPal:', {
      ip,
      orderID,
      code: error.code,
      status: error.response?.status,
      message: paypalError?.message,
      details: paypalError?.details,
    });
    return res.status(500).json({ success: false, message: userErrorMsg(error, 'capture') });
  }
};
