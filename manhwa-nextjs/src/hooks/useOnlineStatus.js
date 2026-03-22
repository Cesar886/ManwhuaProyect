'use client'

import { useState, useEffect, useSyncExternalStore } from 'react'

function subscribe(callback) {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

function getSnapshot() {
  return navigator.onLine
}

function getServerSnapshot() {
  return true
}

/**
 * Hook que detecta si el usuario tiene conexión a internet.
 * Usa useSyncExternalStore para evitar tearing en concurrent mode.
 */
export function useOnlineStatus() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
