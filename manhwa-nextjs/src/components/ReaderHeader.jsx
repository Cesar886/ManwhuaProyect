"use client";

/**
 * PROPS:
 * @param {string} chapterNum - Número del capítulo actual (ej: "107")
 * @param {string} slug - Slug del manhwa para navegación back
 * @param {string} name - Nombre del manhwa (opcional, para accesibilidad)
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { IconArrowLeft, IconMaximize, IconMinimize } from '@tabler/icons-react';
import Image from 'next/image';
import { useAuth } from '../contexts/AuthContext';
import styles from './ReaderHeader.module.css';

// ===============================================
// AVATAR DE INICIALES (sin dependencia de Mantine)
// ===============================================
const AVATAR_COLORS = ['#3b82f6', '#ef4444', '#06b6d4', '#6366f1', '#ec4899', '#8b5cf6'];

function UserInitialsAvatar({ name }) {
  const initials = name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';

  const colorIndex = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % AVATAR_COLORS.length;

  return (
    <div style={{
      width: 32,
      height: 32,
      borderRadius: '50%',
      backgroundColor: AVATAR_COLORS[colorIndex],
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontSize: 13,
      fontWeight: 600,
      border: '2px solid rgba(102, 126, 234, 0.3)',
      cursor: 'pointer',
      userSelect: 'none',
      flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

// ===============================================
// CONSTANTES DE CONFIGURACIÓN
// ===============================================
const SCROLL_THRESHOLD = 30;         // Threshold: comenzar a ocultar después de 30px
const SCROLL_UP_THRESHOLD = 250;     // Píxeles de scroll hacia arriba necesarios para mostrar el header
const INACTIVITY_TIMEOUT = 3000;      // Auto-hide después de 3 segundos
const INITIAL_HIDE_DELAY = 2000;      // Ocultar header inicial después de 2 segundos
const MOBILE_BREAKPOINT = 768;        // Breakpoint mobile vs desktop

export default function ReaderHeader({ slug, chapterNum, seriesBasePath = '/manhwa', lang = 'es' }) {
  const router = useRouter();
  const { user } = useAuth();

  // ===============================================
  // ESTADOS
  // ===============================================
  const [isVisible, setIsVisible] = useState(true);           // Visibilidad del header
  const [isInitial, setIsInitial] = useState(true);           // Estado inicial para animación
  const [isMobile, setIsMobile] = useState(false);            // Detección de mobile

  // ===============================================
  // REFERENCIAS
  // ===============================================
  const lastScrollY = useRef(0);                              // Última posición de scroll
  const scrollUpAccumulated = useRef(0);                       // Píxeles acumulados de scroll hacia arriba
  const inactivityTimer = useRef(null);                       // Timer de inactividad
  const isUserInteracting = useRef(false);                    // Si el usuario está interactuando
  const headerRef = useRef(null);
  const leftRef = useRef(null);
  const rightRef = useRef(null);

  // ===============================================
  // DETECCIÓN DE DISPOSITIVO MOBILE
  // ===============================================
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    // Check inicial
    checkMobile();

    // Listener para cambios de tamaño
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // ===============================================
  // RESET DEL TIMER DE INACTIVIDAD
  // - Auto-hide después de 1.5 segundos de inactividad
  // - Se aplica tanto en mobile como desktop para lectura inmersiva
  // - Se reinicia con cada interacción del usuario
  // ===============================================
  const resetInactivityTimer = useCallback(() => {
    // Aplicar auto-hide por inactividad en todos los dispositivos

    // Limpiar timer existente si hay uno
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }

    // Iniciar nuevo timer de 0.8 segundos
    inactivityTimer.current = setTimeout(() => {
      if (!isUserInteracting.current) {
        setIsVisible(false);
      }
    }, INACTIVITY_TIMEOUT);
  }, []);

  // ===============================================
  // HANDLER DE SCROLL - Ocultar al bajar, mostrar al subir
  // ===============================================
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const delta = lastScrollY.current - currentScrollY;

      if (currentScrollY < SCROLL_THRESHOLD) {
        setIsVisible(true);
        scrollUpAccumulated.current = 0;
      } else if (currentScrollY > lastScrollY.current) {
        // Scroll hacia abajo → ocultar y resetear acumulador
        setIsVisible(false);
        scrollUpAccumulated.current = 0;
      } else if (delta > 0) {
        // Scroll hacia arriba → acumular y mostrar solo si supera el umbral
        scrollUpAccumulated.current += delta;
        if (scrollUpAccumulated.current >= SCROLL_UP_THRESHOLD) {
          setIsVisible(true);
        }
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // ===============================================
  // HANDLER DE TAP EN MOBILE - DESHABILITADO
  // El header ahora permanece visible todo el tiempo
  // ===============================================
  // (Código removido para mantener header siempre visible)

  // ===============================================
  // REMOVER ANIMACIÓN INICIAL DESPUÉS DE MONTAR
  // ===============================================
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitial(false);
    }, 500);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  // ===============================================
  // LIMPIAR TIMERS AL DESMONTAR
  // ===============================================
  useEffect(() => {
    return () => {
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
      }
    };
  }, []);

  // ===============================================
  // TIMER DE INACTIVIDAD - DESHABILITADO
  // El header ahora permanece visible todo el tiempo
  // ===============================================
  // (Código removido para mantener header siempre visible)

  // ===============================================
  // HANDLER PARA BOTÓN BACK
  // - Vuelve a la página de detalles del manhwa
  // - Si hay callback personalizado (onBack), lo usa
  // - Si no, navega a /manhwa/{slug}
  // - Si no hay slug, navega hacia atrás en el historial
  // ===============================================
  const handleBack = useCallback((e) => {
    e.stopPropagation();

    router.push(`${seriesBasePath}/${slug}`);

  }, [slug, router, seriesBasePath]);

  // Fullscreen state y toggle (usa Fullscreen API a nivel de documento)
  const [isFullscreenLocal, setIsFullscreenLocal] = useState(false);

  const toggleFullscreenLocal = useCallback(async (e) => {
    e?.stopPropagation?.();
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.();
      setIsFullscreenLocal(true);
    } else {
      await document.exitFullscreen?.();
      setIsFullscreenLocal(false);
    }
  }, []);

  // Escuchar cambios de fullscreen para mantener el estado en sync
  useEffect(() => {
    const onFsChange = () => setIsFullscreenLocal(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Medir anchos de las secciones izquierda/derecha y exponer como variables CSS
  useEffect(() => {
    const updateWidths = () => {
      try {
        const leftW = leftRef.current?.offsetWidth || 0;
        const rightW = rightRef.current?.offsetWidth || 0;
        if (headerRef.current) {
          headerRef.current.style.setProperty('--left-width', `${leftW}px`);
          headerRef.current.style.setProperty('--right-width', `${rightW}px`);
        }
      } catch (e) {
        // ignore
      }
    };

    updateWidths();

    const ro = new ResizeObserver(updateWidths);
    if (leftRef.current) ro.observe(leftRef.current);
    if (rightRef.current) ro.observe(rightRef.current);
    window.addEventListener('resize', updateWidths);

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(updateWidths).catch(() => { });
    }

    return () => {
      window.removeEventListener('resize', updateWidths);
      try {
        if (leftRef.current) ro.unobserve(leftRef.current);
        if (rightRef.current) ro.unobserve(rightRef.current);
        ro.disconnect();
      } catch (e) { }
    };
  }, []);

  // ===============================================
  // PREVENIR QUE INTERACCIONES CON EL HEADER
  // ACTIVEN EL TAP TOGGLE
  // - Evita que clicks/taps en el header lo oculten
  // - Marca temporalmente que el usuario está interactuando
  // ===============================================
  const handleHeaderInteraction = useCallback((e) => {
    e.stopPropagation();
    isUserInteracting.current = true;

    // Reset después de un breve delay
    setTimeout(() => {
      isUserInteracting.current = false;
    }, 100);
  }, []);

  // ===============================================
  // RENDER DEL COMPONENTE
  // ===============================================
  return (
    <header
      ref={headerRef}
      className={`
        ${styles.readerHeader}
        ${!isVisible ? styles.hidden : ''}
        ${isInitial ? styles.initial : ''}
      `.trim()}
      onClick={handleHeaderInteraction}
      onTouchStart={handleHeaderInteraction}
    >
      {/* =========================================
          LADO IZQUIERDO: Navegación y Logo
          - Botón back con flecha ←
          - Separador visual
          - Logo + Nombre de la página
          ========================================= */}
      <div className={styles.leftSection} ref={leftRef}>
        {/* Botón de volver atrás */}
        <button
          className={styles.backButton}
          onClick={handleBack}
          aria-label={lang === 'en' ? 'Back to chapter list' : 'Volver a la lista de capítulos'}
          title={lang === 'en' ? 'Back' : 'Volver'}
        >
          <IconArrowLeft size={18} />
        </button>

        {/* Separador visual */}
        <div className={styles.separator} aria-hidden="true" />

        {/* Logo y Nombre de la Página */}
        <div className={styles.logoContainer}>
          <Image
            src="/logo.png"
            alt={lang === 'en' ? 'Manhwa Imperial logo - English manhwa reader' : 'Logo de Manhwa Imperial - Lector de manhwas en español'}
            width={32}
            height={32}
            className={styles.logoImg}
            priority
          />
          <span className={styles.siteName}>Manhwa Imperial</span>
        </div>
      </div>

      {/* =========================================
          LADO DERECHO: Botón pantalla completa
          ========================================= */}
      <div className={styles.rightSection} ref={rightRef}>
        <button
          className={styles.fullscreenButton}
          onClick={toggleFullscreenLocal}
          aria-label={isFullscreenLocal
            ? (lang === 'en' ? 'Exit fullscreen' : 'Salir de pantalla completa')
            : (lang === 'en' ? 'Fullscreen' : 'Pantalla completa')}
          title={isFullscreenLocal
            ? (lang === 'en' ? 'Exit fullscreen' : 'Salir de pantalla completa')
            : (lang === 'en' ? 'Fullscreen' : 'Pantalla completa')}
        >
          {isFullscreenLocal
            ? <IconMinimize size={18} />
            : <IconMaximize size={18} />
          }
        </button>
      </div>
    </header>
  );
}
