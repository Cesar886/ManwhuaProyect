"use client";

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { PayPalScriptProvider, PayPalButtons, FUNDING, usePayPalScriptReducer } from '@paypal/react-paypal-js';
import { IconHeart, IconCheck, IconShieldCheck, IconSparkles, IconLoader2, IconWifiOff } from '@tabler/icons-react';
import { endpoint } from '../config';
import classes from './Donacion.module.css';

const PRESET_AMOUNTS = [3, 5, 10, 20];
const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

// Timeouts del frontend — deben ser mayores al peor caso del backend.
// Backend: token(15s) + request(15s) + retry(15s) + verify(15s) = 60s peor caso.
const CREATE_TIMEOUT = 25_000;  // crear orden: 1 round-trip a PayPal
const CAPTURE_TIMEOUT = 50_000; // capturar: puede reintentar + verificar estado

/**
 * fetch con timeout + manejo de errores de red y JSON.
 * Nunca muestra errores técnicos feos al usuario.
 */
async function safeFetch(url, options, timeout = CREATE_TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let res;
  try {
    res = await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('El servidor tardó demasiado en responder. Intenta de nuevo.');
    }
    throw new Error('No se pudo conectar al servidor. Verifica tu conexión a internet.');
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      res.ok ? 'Respuesta inválida del servidor' : `Error del servidor (${res.status})`
    );
  }
  if (!res.ok || !data.success) {
    throw new Error(data.message || `Error del servidor (${res.status})`);
  }
  return data;
}

/**
 * Wrapper interno: muestra el botón PayPal o un aviso si el SDK no cargó.
 * usePayPalScriptReducer solo funciona dentro de PayPalScriptProvider.
 */
function PayPalButtonsWrapper({ processing, disabled, createOrder, onApprove, onError, onCancel, finalAmount }) {
  const [{ isPending, isRejected }] = usePayPalScriptReducer();

  if (isRejected) {
    return (
      <div className={classes.sdkError}>
        <IconWifiOff size={18} />
        <span>No se pudo cargar PayPal. Desactiva tu bloqueador de anuncios o intenta en otro navegador.</span>
      </div>
    );
  }

  if (isPending) {
    return (
      <div className={classes.processingOverlay}>
        <IconLoader2 size={24} className={classes.spinner} />
        <span>Cargando PayPal...</span>
      </div>
    );
  }

  return (
    <PayPalButtons
      key={finalAmount}
      fundingSource={FUNDING.PAYPAL}
      style={{ layout: 'vertical', color: 'gold', shape: 'pill', label: 'donate', height: 44 }}
      disabled={disabled || processing}
      createOrder={createOrder}
      onApprove={onApprove}
      onError={onError}
      onCancel={onCancel}
    />
  );
}

export default function Donacion() {
  const [amount, setAmount]         = useState(5);
  const [custom, setCustom]         = useState('');
  const [status, setStatus]         = useState(null); // null | 'error' | 'success'
  const [message, setMessage]       = useState('');
  const [processing, setProcessing] = useState(false);

  // Ref para evitar setState en componente desmontado (ej: usuario cierra el modal durante el pago)
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const safeSet = useCallback((setter, value) => {
    if (mountedRef.current) setter(value);
  }, []);

  const finalAmount = custom ? parseFloat(custom) : amount;
  const validAmount = !isNaN(finalAmount) && finalAmount >= 1 && finalAmount <= 1000;

  // Memoizar options para evitar que PayPalScriptProvider recargue el SDK en cada render
  const paypalOptions = useMemo(() => ({
    clientId: PAYPAL_CLIENT_ID,
    currency: 'USD',
    intent: 'capture',
  }), []);

  const handleCustomChange = (e) => {
    if (processing) return;
    const val = e.target.value;
    if (val === '' || /^\d{0,4}(\.\d{0,2})?$/.test(val)) {
      setCustom(val);
    }
  };

  const handlePresetClick = useCallback((val) => {
    if (processing) return;
    setAmount(val);
    setCustom('');
  }, [processing]);

  const handleReset = useCallback(() => {
    setStatus(null);
    setMessage('');
  }, []);

  const createOrder = useCallback(async () => {
    safeSet(setProcessing, true);
    safeSet(setStatus, null);
    try {
      const data = await safeFetch(
        endpoint('donations', 'create-order'),
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: finalAmount }),
        },
        CREATE_TIMEOUT,
      );
      if (!data.orderID) {
        throw new Error('No se recibió el ID de la orden de PayPal');
      }
      return data.orderID;
    } catch (err) {
      safeSet(setStatus, 'error');
      safeSet(setMessage, err.message || 'No se pudo iniciar el pago');
      safeSet(setProcessing, false);
      throw err;
    }
  }, [finalAmount, safeSet]);

  const onApprove = useCallback(async (data) => {
    if (!data?.orderID) {
      safeSet(setStatus, 'error');
      safeSet(setMessage, 'PayPal no devolvió un ID de orden válido.');
      safeSet(setProcessing, false);
      return;
    }
    try {
      // Timeout mayor: el backend puede necesitar reintentar + verificar estado
      const result = await safeFetch(
        endpoint('donations', `capture/${data.orderID}`),
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        },
        CAPTURE_TIMEOUT,
      );
      safeSet(setStatus, 'success');
      safeSet(setMessage, result.message || '¡Gracias por tu donación!');
    } catch (err) {
      safeSet(setStatus, 'error');
      safeSet(setMessage, err.message || 'No se pudo completar el pago');
    } finally {
      safeSet(setProcessing, false);
    }
  }, [safeSet]);

  const onError = useCallback(() => {
    safeSet(setStatus, 'error');
    safeSet(setMessage, 'Ocurrió un error con PayPal. Intenta de nuevo.');
    safeSet(setProcessing, false);
  }, [safeSet]);

  const onCancel = useCallback(() => {
    safeSet(setProcessing, false);
  }, [safeSet]);

  if (!PAYPAL_CLIENT_ID) {
    return (
      <div className={classes.root}>
        <div className={classes.errorBanner}>
          <span className={classes.errorDot} />
          El sistema de donaciones no está disponible en este momento. Intenta más tarde.
        </div>
      </div>
    );
  }

  // PayPalScriptProvider envuelve TODO para que el SDK no se recargue entre estados
  return (
    <PayPalScriptProvider options={paypalOptions}>
      <div className={classes.root}>

        {status === 'success' ? (
          /* ─── Estado de éxito ─── */
          <div className={classes.successState}>
            <div className={classes.successRing}>
              <div className={classes.successIcon}>
                <IconCheck size={28} stroke={2.5} />
              </div>
            </div>
            <h3 className={classes.successTitle}>¡Gracias por tu apoyo!</h3>
            <p className={classes.successMsg}>{message}</p>
            <p className={classes.successSub}>Tu donación ayuda a mantener la IA y los servidores de Manhwa Imperial.</p>
            <button className={classes.resetBtn} onClick={handleReset}>
              Hacer otra donación
            </button>
          </div>
        ) : (
          /* ─── Formulario de donación ─── */
          <>
            {/* Header decorativo */}
            <div className={classes.heroSection}>
              <div className={classes.heroGlow} />
              <div className={classes.heroRow}>
                <div className={classes.heroIconWrap}>
                  <IconHeart size={22} className={classes.heroHeart} />
                </div>
                <span className={classes.heroLabel}>
                  <IconSparkles size={12} />
                  Apoya el proyecto
                </span>
              </div>
              <p className={classes.heroDesc}>
                Manhwa Imperial es gratis para todos. Tu donación mantiene la IA, el servidor y que sigamos creciendo.
              </p>
            </div>

            {/* Selector de monto */}
            <div className={`${classes.section} ${processing ? classes.sectionDisabled : ''}`}>
              <p className={classes.sectionLabel}>Elige el monto</p>
              <div className={classes.amounts}>
                {PRESET_AMOUNTS.map((val) => (
                  <button
                    key={val}
                    type="button"
                    disabled={processing}
                    className={`${classes.amountBtn} ${!custom && amount === val ? classes.amountBtnActive : ''}`}
                    onClick={() => handlePresetClick(val)}
                  >
                    <span className={classes.amountDollar}>$</span>{val}
                  </button>
                ))}
              </div>

              <div className={`${classes.customRow} ${custom ? classes.customRowFocused : ''}`}>
                <span className={classes.currencySign}>$</span>
                <input
                  type="number"
                  className={classes.customInput}
                  placeholder="Otro monto..."
                  value={custom}
                  onChange={handleCustomChange}
                  disabled={processing}
                  min="1"
                  max="1000"
                />
                <span className={classes.currencyBadge}>USD</span>
              </div>

              {custom && !validAmount && (
                <p className={classes.hint}>
                  {isNaN(finalAmount) || finalAmount < 1 ? 'Mínimo $1 USD' : 'Máximo $1000 USD'}
                </p>
              )}
            </div>

            {/* Error */}
            {status === 'error' && (
              <div className={classes.errorBanner}>
                <span className={classes.errorDot} />
                {message}
              </div>
            )}

            {/* Monto seleccionado */}
            {validAmount && (
              <div className={classes.selectedAmount}>
                Vas a donar <strong>${finalAmount.toFixed(2)} USD</strong>
              </div>
            )}

            {/* Métodos de pago */}
            {validAmount && (
              <div className={classes.paypalSection}>
                {processing && (
                  <div className={classes.processingOverlay}>
                    <IconLoader2 size={24} className={classes.spinner} />
                    <span>Procesando pago...</span>
                  </div>
                )}

                <PayPalButtonsWrapper
                  processing={processing}
                  disabled={!validAmount}
                  createOrder={createOrder}
                  onApprove={onApprove}
                  onError={onError}
                  onCancel={onCancel}
                  finalAmount={finalAmount}
                />
              </div>
            )}

            {/* Footer */}
            <div className={classes.footer}>
              <IconShieldCheck size={13} className={classes.footerIcon} />
              <span>Pago seguro con cifrado SSL · Procesado por PayPal</span>
            </div>
          </>
        )}

      </div>
    </PayPalScriptProvider>
  );
}
