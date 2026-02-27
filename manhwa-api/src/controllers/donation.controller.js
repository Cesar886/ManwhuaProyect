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

/**
 * Obtiene un token de acceso de PayPal usando Client Credentials.
 * El token dura ~9 horas; para simplicidad se obtiene en cada request.
 */
async function getPayPalToken() {
  const response = await axios.post(
    `${PAYPAL_BASE_URL}/v1/oauth2/token`,
    'grant_type=client_credentials',
    {
      auth: { username: CLIENT_ID, password: SECRET },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }
  );
  return response.data.access_token;
}

/**
 * POST /api/donations/create-order
 * Body: { amount: "5.00", currency: "USD" }
 */
exports.createOrder = async (req, res) => {
  try {
    const amount   = parseFloat(req.body.amount) || 5;
    const currency = req.body.currency || 'USD';

    if (amount < 1 || amount > 1000) {
      return res.status(400).json({ success: false, message: 'Monto inválido (1–1000)' });
    }

    const token = await getPayPalToken();

    const order = await axios.post(
      `${PAYPAL_BASE_URL}/v2/checkout/orders`,
      {
        intent: 'CAPTURE',
        purchase_units: [
          {
            description: 'Donación a Manhwa Imperial',
            amount: {
              currency_code: currency,
              value: amount.toFixed(2),
            },
          },
        ],
        application_context: {
          brand_name: 'Manhwa Imperial',
          user_action: 'PAY_NOW',
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    logger.info(`Donación creada: orderID=${order.data.id} amount=${amount} ${currency}`);

    return res.json({ success: true, orderID: order.data.id });
  } catch (error) {
    const paypalError = error.response?.data;
    logger.error('Error creando orden PayPal:', {
      status: error.response?.status,
      message: paypalError?.message,
      details: paypalError?.details,
      raw: paypalError,
    });
    return res.status(500).json({ success: false, message: 'No se pudo crear la orden de pago' });
  }
};

/**
 * POST /api/donations/capture/:orderID
 * Captura el pago después de que el usuario aprueba en PayPal.
 */
exports.captureOrder = async (req, res) => {
  try {
    const { orderID } = req.params;

    if (!orderID || typeof orderID !== 'string' || !/^[A-Z0-9]{10,20}$/i.test(orderID)) {
      return res.status(400).json({ success: false, message: 'orderID inválido' });
    }

    const token = await getPayPalToken();

    const capture = await axios.post(
      `${PAYPAL_BASE_URL}/v2/checkout/orders/${orderID}/capture`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data   = capture.data;
    const status = data.status; // COMPLETED

    if (status !== 'COMPLETED') {
      logger.warn(`Captura PayPal no completada: ${status} orderID=${orderID}`);
      return res.status(400).json({ success: false, message: `Estado inesperado: ${status}` });
    }

    const unit   = data.purchase_units?.[0];
    const amount = unit?.payments?.captures?.[0]?.amount;

    logger.info(`Donación completada: orderID=${orderID} amount=${amount?.value} ${amount?.currency_code}`);

    return res.json({
      success: true,
      message: '¡Gracias por tu donación!',
      details: {
        orderID,
        amount: amount?.value,
        currency: amount?.currency_code,
        status,
      },
    });
  } catch (error) {
    const paypalError = error.response?.data;
    logger.error('Error capturando orden PayPal:', {
      status: error.response?.status,
      message: paypalError?.message,
      details: paypalError?.details,
      raw: paypalError,
    });
    return res.status(500).json({ success: false, message: 'No se pudo completar el pago' });
  }
};
