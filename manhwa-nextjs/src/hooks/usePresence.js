'use client';

import { useEffect, useRef, useState } from 'react';

const EMPTY_PRESENCE = { users: [], anonymous: 0, total: 0 };

function getAnonymousId() {
  try {
    const storageKey = 'manhwa_presence_anon_id';
    const existing = window.localStorage.getItem(storageKey);
    if (existing) return existing.slice(0, 64);
    const generated = crypto.randomUUID();
    window.localStorage.setItem(storageKey, generated);
    return generated;
  } catch {
    try {
      return crypto.randomUUID();
    } catch {
      return `anon_${Date.now()}_${Math.random().toString(36).slice(2)}`.slice(0, 64);
    }
  }
}

export function usePresence(manhwa, chapter) {
  const [data, setData] = useState(EMPTY_PRESENCE);
  const [isConnected, setIsConnected] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const socketRef = useRef(null);

  useEffect(() => {
    const presenceUrl = process.env.NEXT_PUBLIC_PRESENCE_URL;
    if (!manhwa || chapter === undefined || chapter === null || !presenceUrl) {
      setData(EMPTY_PRESENCE);
      setIsConnected(false);
      return undefined;
    }

    let socket = null;
    let retryTimer = null;
    let closedByCleanup = false;
    const anonId = getAnonymousId();

    const connect = async () => {
      try {
        const tokenResponse = await fetch('/api/presence/token', { cache: 'no-store', credentials: 'include' });
        const tokenBody = tokenResponse.ok ? await tokenResponse.json() : {};
        if (closedByCleanup) return;
        const hasToken = Boolean(tokenBody?.token);
        setIsAnonymous(!hasToken);

        const url = new URL(presenceUrl);
        if (tokenBody?.token) url.searchParams.set('token', tokenBody.token);
        socket = new WebSocket(url.toString());
        socketRef.current = socket;

        socket.onopen = () => {
          setIsConnected(true);
          socket.send(JSON.stringify({ type: 'join', manhwa, chapter: String(chapter), anonId }));
        };

        socket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message?.type !== 'presence' || !Array.isArray(message.users)) return;
            const users = message.users.filter((item) => item && item.id && item.username).slice(0, 30);
            const anonymous = Number.isFinite(message.anonymous) ? Math.max(0, message.anonymous) : 0;
            setData({
              users,
              anonymous,
              total: Number.isFinite(message.total) ? Math.max(0, message.total) : users.length + anonymous,
            });
          } catch {
            // Ignorar mensajes ajenos o mal formados.
          }
        };

        socket.onclose = () => {
          if (socketRef.current === socket) socketRef.current = null;
          setIsConnected(false);
          if (!closedByCleanup) retryTimer = setTimeout(connect, 3000);
        };

        socket.onerror = () => socket.close();
      } catch {
        setIsConnected(false);
        if (!closedByCleanup) retryTimer = setTimeout(connect, 3000);
      }
    };

    connect();
    return () => {
      closedByCleanup = true;
      clearTimeout(retryTimer);
      socketRef.current = null;
      socket?.close();
      setIsConnected(false);
      setData(EMPTY_PRESENCE);
    };
  }, [manhwa, chapter]);

  return { ...data, isConnected, isAnonymous };
}
