"use client";

import React, { useState, useCallback } from 'react';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { IconHeart, IconCheck, IconShieldCheck, IconSparkles } from '@tabler/icons-react';
import { endpoint } from '../config';
import classes from './Donacion.module.css';

const PRESET_AMOUNTS = [3, 5, 10, 20];
const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;


export default function Donacion() {
  const [amount, setAmount]         = useState(5);
  const [custom, setCustom]         = useState('');
  const [status, setStatus]         = useState(null);
  const [message, setMessage]       = useState('');
  const [processing, setProcessing] = useState(false);

  const finalAmount = custom ? parseFloat(custom) : amount;
  const validAmount = finalAmount >= 1 && finalAmount <= 1000;

  const handleCustomChange = (e) => {
    const val = e.target.value;
    if (val === '' || /^\d{0,4}(\.\d{0,2})?$/.test(val)) {
      setCustom(val);
    }
  };

  const createOrder = useCallback(async () => {
    setProcessing(true);
    setStatus(null);
    try {
      const res = await fetch(endpoint('donations', 'create-order'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: finalAmount, currency: 'USD' }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      return data.orderID;
    } catch (err) {
      setStatus('error');
      setMessage(err.message || 'No se pudo iniciar el pago');
      setProcessing(false);
      throw err;
    }
  }, [finalAmount]);

  const onApprove = useCallback(async (data) => {
    try {
      const res = await fetch(endpoint('donations', `capture/${data.orderID}`), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.message);
      setStatus('success');
      setMessage(result.message || '¡Gracias por tu donación!');
    } catch (err) {
      setStatus('error');
      setMessage(err.message || 'No se pudo completar el pago');
    } finally {
      setProcessing(false);
    }
  }, []);

  const onError = useCallback(() => {
    setStatus('error');
    setMessage('Ocurrió un error con PayPal. Intenta de nuevo.');
    setProcessing(false);
  }, []);

  const onCancel = useCallback(() => {
    setProcessing(false);
  }, []);

  if (status === 'success') {
    return (
      <div className={classes.root}>
        <div className={classes.successState}>
          <div className={classes.successRing}>
            <div className={classes.successIcon}>
              <IconCheck size={28} stroke={2.5} />
            </div>
          </div>
          <h3 className={classes.successTitle}>¡Gracias por tu apoyo!</h3>
          <p className={classes.successMsg}>{message}</p>
          <p className={classes.successSub}>Tu donación ayuda a mantener la IA y los servidores de Manhwa Imperial.</p>
          <button className={classes.resetBtn} onClick={() => { setStatus(null); setMessage(''); }}>
            Hacer otra donación
          </button>
        </div>
      </div>
    );
  }

  return (
    <PayPalScriptProvider options={{ clientId: PAYPAL_CLIENT_ID, currency: 'USD', intent: 'capture' }}>
      <div className={classes.root}>

        {/* Header decorativo */}
        <div className={classes.heroSection}>
          <div className={classes.heroGlow} />
          <div className={classes.heroIconWrap}>
            <IconHeart size={22} className={classes.heroHeart} />
          </div>
          <div className={classes.heroText}>
            <span className={classes.heroLabel}>
              <IconSparkles size={12} />
              Apoya el proyecto
            </span>
            <p className={classes.heroDesc}>
              Manhwa Imperial es gratis para todos. Tu donación mantiene la IA, el servidor y que sigamos creciendo.
            </p>
          </div>
        </div>

        {/* Selector de monto */}
        <div className={classes.section}>
          <p className={classes.sectionLabel}>Elige el monto</p>
          <div className={classes.amounts}>
            {PRESET_AMOUNTS.map((val) => (
              <button
                key={val}
                type="button"
                className={`${classes.amountBtn} ${!custom && amount === val ? classes.amountBtnActive : ''}`}
                onClick={() => { setAmount(val); setCustom(''); }}
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
              min="1"
              max="1000"
            />
            <span className={classes.currencyBadge}>USD</span>
          </div>

          {custom && !validAmount && (
            <p className={classes.hint}>
              {finalAmount < 1 ? 'Mínimo $1 USD' : 'Máximo $1000 USD'}
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

        {/* Métodos de pago */}
        {validAmount && (
          <div className={classes.paypalSection}>

            {/* layout vertical: muestra botón PayPal + botón tarjeta juntos */}
            <PayPalButtons
              style={{ layout: 'vertical', color: 'gold', shape: 'pill', label: 'donate', height: 44 }}
              disabled={processing}
              createOrder={createOrder}
              onApprove={onApprove}
              onError={onError}
              onCancel={onCancel}
            />

          </div>
        )}

        {/* Footer */}
        <div className={classes.footer}>
          <IconShieldCheck size={13} className={classes.footerIcon} />
          <span>Pago seguro con cifrado SSL · Procesado por PayPal</span>
        </div>

      </div>
    </PayPalScriptProvider>
  );
}
