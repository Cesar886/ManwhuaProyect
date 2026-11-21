'use client';

import { useEffect, useState } from 'react';
import styles from './PushNotificationButton.module.css';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

function applicationServerKey(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(window.atob(base64), (character) => character.charCodeAt(0));
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

export default function PushNotificationButton({ slug, lang = 'es' }) {
  const [canSubscribe, setCanSubscribe] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const isEnglish = lang === 'en';

  useEffect(() => {
    let active = true;
    const userAgent = navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/.test(userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const followKey = `mi-push-follow-${slug}`;

    if (isIOS && !isStandalone()) {
      setMessage(isEnglish
        ? 'On iPhone, install this app on your Home Screen first (iOS 16.4+).'
        : 'En iPhone, instala primero la app en tu pantalla de inicio (iOS 16.4 o posterior).');
      return () => { active = false; };
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setMessage(isEnglish ? 'Push notifications are not supported in this browser.' : 'Este navegador no admite notificaciones push.');
      return () => { active = false; };
    }

    if (!VAPID_PUBLIC_KEY) {
      setMessage(isEnglish ? 'Push notifications are not configured yet.' : 'Las notificaciones todavía no están configuradas.');
      return () => { active = false; };
    }

    navigator.serviceWorker.ready
      .then(async (registration) => {
        if (!active) return;
        const subscription = await registration.pushManager.getSubscription();
        if (!active) return;
        setSubscribed(Boolean(subscription && localStorage.getItem(followKey) === '1'));
        setCanSubscribe(true);
      })
      .catch((error) => {
        console.error('No se pudo preparar la suscripción a notificaciones.', error);
        if (active) setMessage(isEnglish ? 'Could not prepare notifications. Try again later.' : 'No se pudieron preparar las notificaciones. Inténtalo más tarde.');
      });

    return () => { active = false; };
  }, [slug, isEnglish]);

  const toggleSubscription = async () => {
    if (busy) return;
    setBusy(true);
    setMessage('');
    const followKey = `mi-push-follow-${slug}`;

    try {
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (subscribed && subscription) {
        const response = await fetch('/api/push/unsubscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint, slug }),
        });
        if (!response.ok) throw new Error('No se pudo cancelar el aviso de esta serie.');
        try {
          localStorage.removeItem(followKey);
        } catch (error) {
          console.error('No se pudo actualizar el estado local de notificaciones.', error);
        }
        setSubscribed(false);
        setMessage(isEnglish ? 'Notifications turned off for this series.' : 'Avisos desactivados para este manhwa.');
        return;
      }

      if (Notification.permission === 'denied') {
        setMessage(isEnglish ? 'Notifications are blocked in your browser settings.' : 'Las notificaciones están bloqueadas en los ajustes del navegador.');
        return;
      }

      const permission = Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission();
      if (permission !== 'granted') {
        setMessage(isEnglish ? 'Allow notifications to receive new chapter alerts.' : 'Permite las notificaciones para recibir avisos de capítulos nuevos.');
        return;
      }

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey(VAPID_PUBLIC_KEY),
        });
      }

      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON(), slug }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || 'No se pudo guardar la suscripción.');
      }

      try {
        localStorage.setItem(followKey, '1');
      } catch (error) {
        console.error('No se pudo guardar el estado local de notificaciones.', error);
      }
      setSubscribed(true);
      setMessage(isEnglish ? 'You will be notified when a new chapter is published.' : 'Te avisaremos cuando se publique un capítulo nuevo.');
    } catch (error) {
      console.error('Error al gestionar las notificaciones push.', error);
      setMessage(error instanceof Error ? error.message : (isEnglish ? 'Could not update notifications.' : 'No se pudieron actualizar las notificaciones.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      {canSubscribe && (
        <button className={styles.button} type="button" onClick={toggleSubscription} disabled={busy}>
          {busy ? '…' : subscribed
            ? (isEnglish ? 'Stop chapter alerts' : 'Dejar de avisarme')
            : (isEnglish ? 'Notify me about new chapters' : 'Avisarme de capítulos nuevos')}
        </button>
      )}
      {message && <p className={styles.message} role="status">{message}</p>}
    </div>
  );
}
