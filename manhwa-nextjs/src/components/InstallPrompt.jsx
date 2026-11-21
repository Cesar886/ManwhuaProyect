'use client';

import { useEffect, useState } from 'react';
import styles from './InstallPrompt.module.css';

const VISITS_KEY = 'mi-install-visits';
const SESSION_KEY = 'mi-install-visit-counted';
const DISMISSED_KEY = 'mi-install-dismissed-until';
const CHAPTER_PREFIX = 'chapter_read_';
const DISMISS_FOR_MS = 14 * 24 * 60 * 60 * 1000;

function getReadChapterCount() {
  let count = 0;
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(CHAPTER_PREFIX)) continue;
      const value = localStorage.getItem(key);
      if (value && JSON.parse(value)?.read) count += 1;
    }
  } catch {
    return 0;
  }
  return count;
}

function isInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches
    || navigator.standalone === true;
}

function getPlatform() {
  const userAgent = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOS) {
    const isSafari = /Safari/.test(userAgent) && !/(CriOS|FxiOS|EdgiOS|OPiOS)/.test(userAgent);
    return isSafari ? 'ios-safari' : 'ios-other';
  }
  return /Android/i.test(userAgent) ? 'android' : 'other';
}

function ShareIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none">
      <path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5M5 11v9h14v-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function InstallPrompt() {
  const [platform, setPlatform] = useState(null);
  const [qualified, setQualified] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [promptDismissed, setPromptDismissed] = useState(false);

  useEffect(() => {
    const device = getPlatform();
    setPlatform(device);
    setInstalled(isInstalled());
    try {
      const installedUntil = Number(localStorage.getItem(DISMISSED_KEY)) || 0;
      setDismissed(installedUntil > Date.now());
      if (!sessionStorage.getItem(SESSION_KEY)) {
        sessionStorage.setItem(SESSION_KEY, '1');
        const visits = (Number(localStorage.getItem(VISITS_KEY)) || 0) + 1;
        localStorage.setItem(VISITS_KEY, String(visits));
      }
      const visits = Number(localStorage.getItem(VISITS_KEY)) || 0;
      setQualified(visits >= 2 || getReadChapterCount() >= 2);
    } catch {
      setQualified(getReadChapterCount() >= 2);
    }

    const handleBeforeInstall = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setModalOpen(false);
      setInstallPrompt(null);
    };
    const displayMode = window.matchMedia('(display-mode: standalone)');
    const handleDisplayMode = () => setInstalled(isInstalled());

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);
    displayMode.addEventListener?.('change', handleDisplayMode);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
      displayMode.removeEventListener?.('change', handleDisplayMode);
    };
  }, []);

  useEffect(() => {
    if (!modalOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setModalOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [modalOpen]);

  const closePrompt = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now() + DISMISS_FOR_MS));
    } catch {
      // The banner stays dismissed for the current page view.
    }
    setDismissed(true);
    setModalOpen(false);
  };

  const runInstall = async () => {
    if (!installPrompt) return;
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallPrompt(null);
      if (choice?.outcome === 'accepted') setModalOpen(false);
      else setPromptDismissed(true);
    } catch (error) {
      console.error('No se pudo abrir el diálogo de instalación del navegador.', error);
      setInstallPrompt(null);
      setPromptDismissed(true);
    }
  };

  if (!platform || !qualified || dismissed || installed) return null;

  let instructions;
  if (platform === 'ios-safari') {
    instructions = (
      <>
        <p>Instala Manhwa Imperial en tu iPhone en unos pasos:</p>
        <ol>
          <li>Toca <strong>Compartir</strong> <ShareIcon /> en Safari.</li>
          <li>Desliza y elige <strong>Añadir a pantalla de inicio</strong>.</li>
          <li>Toca <strong>Añadir</strong> para terminar.</li>
        </ol>
      </>
    );
  } else if (platform === 'ios-other') {
    instructions = <p>Abre esta página en Safari y toca <strong>Compartir → Añadir a pantalla de inicio</strong>.</p>;
  } else if (platform === 'android' && installPrompt && !promptDismissed) {
    instructions = <p>Instala la app para abrir Manhwa Imperial desde tu pantalla de inicio.</p>;
  } else if (platform === 'android') {
    instructions = (
      <p>En Chrome, toca <strong>⋮ → Instalar aplicación</strong> o <strong>Añadir a pantalla de inicio</strong>.</p>
    );
  } else {
    instructions = <p>Usa el menú de instalación de tu navegador para añadir Manhwa Imperial a tu pantalla de inicio.</p>;
  }

  return (
    <>
      <section className={styles.banner} aria-label="Instalar Manhwa Imperial">
        <div>
          <strong>Lee Manhwa Imperial como una app</strong>
          <p>Instálala en tu pantalla de inicio para volver más rápido.</p>
        </div>
        <button type="button" onClick={() => setModalOpen(true)}>Instalar app</button>
        <button className={styles.dismiss} type="button" aria-label="Cerrar aviso de instalación" onClick={closePrompt}>×</button>
      </section>

      {modalOpen && (
        <div className={styles.overlay} onMouseDown={(event) => {
          if (event.target === event.currentTarget) setModalOpen(false);
        }}>
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="install-title">
            <button className={styles.close} type="button" aria-label="Cerrar" onClick={() => setModalOpen(false)}>×</button>
            <h2 id="install-title">Instalar Manhwa Imperial</h2>
            {instructions}
            {platform === 'android' && installPrompt && !promptDismissed && (
              <button className={styles.installAction} type="button" onClick={runInstall}>Instalar app</button>
            )}
            <button className={styles.later} type="button" onClick={() => setModalOpen(false)}>Ahora no</button>
          </section>
        </div>
      )}
    </>
  );
}
