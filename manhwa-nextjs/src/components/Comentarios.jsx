"use client";

import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import logger from '../utils/logger'
import { Group, Text, Avatar, Button, Menu, ActionIcon, Modal, Checkbox, Textarea, Loader, Badge, Stack, Card, TextInput, Tooltip } from '@mantine/core'
import { IconMessage, IconSend, IconCheck, IconAlertCircle, IconThumbUp, IconThumbDown, IconEye, IconEyeOff, IconDotsVertical, IconChartBar, IconPlus, IconX, IconSparkles, IconTrendingUp, IconHistory, IconChevronLeft, IconChevronRight, IconChevronsLeft, IconChevronsRight } from '@tabler/icons-react'
import api from '../api/client'
import { endpoint } from '../config'
import { getRequestComments as apiGetRequestComments } from '../api/requests'
import UserBadges from './UserBadges'

// Componente de Paginación personalizado para evitar conflictos con Next.js 15
function CustomPagination({ value, onChange, total, size = "sm" }) {
  const getVisiblePages = () => {
    const pages = [];
    const showPages = 5;
    let start = Math.max(1, value - Math.floor(showPages / 2));
    let end = Math.min(total, start + showPages - 1);
    
    if (end - start + 1 < showPages) {
      start = Math.max(1, end - showPages + 1);
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  const btnSize = size === "sm" ? 32 : 36;

  const buttonStyle = (isActive) => ({
    minWidth: btnSize,
    height: btnSize,
    borderRadius: '50%',
    border: isActive ? 'none' : '1px solid var(--border-color-subtle)',
    cursor: 'pointer',
    fontWeight: isActive ? 600 : 400,
    fontSize: size === "sm" ? '0.8rem' : '0.9rem',
    backgroundColor: isActive ? 'rgb(var(--accent-cyan))' : 'transparent',
    color: isActive ? 'white' : 'var(--text-color)',
    boxShadow: isActive ? '0 2px 8px var(--accent-cyan-0-3)' : 'none',
    transition: 'all 0.2s ease',
  });

  const navButtonStyle = (disabled) => ({
    minWidth: btnSize,
    height: btnSize,
    borderRadius: '50%',
    border: '1px solid var(--border-color-subtle)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    backgroundColor: 'transparent',
    color: disabled ? 'var(--mantine-color-gray-6)' : 'var(--text-color)',
    opacity: disabled ? 0.5 : 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  });

  return (
    <Group gap={4}>
      <button
        style={navButtonStyle(value === 1)}
        onClick={() => value > 1 && onChange(1)}
        disabled={value === 1}
        aria-label="Primera página"
      >
        <IconChevronsLeft size={16} />
      </button>
      <button
        style={navButtonStyle(value === 1)}
        onClick={() => value > 1 && onChange(value - 1)}
        disabled={value === 1}
        aria-label="Página anterior"
      >
        <IconChevronLeft size={16} />
      </button>
      
      {getVisiblePages().map((page) => (
        <button
          key={page}
          style={buttonStyle(page === value)}
          onClick={() => onChange(page)}
          aria-label={`Página ${page}`}
          aria-current={page === value ? 'page' : undefined}
        >
          {page}
        </button>
      ))}
      
      <button
        style={navButtonStyle(value === total)}
        onClick={() => value < total && onChange(value + 1)}
        disabled={value === total}
        aria-label="Página siguiente"
      >
        <IconChevronRight size={16} />
      </button>
      <button
        style={navButtonStyle(value === total)}
        onClick={() => value < total && onChange(total)}
        disabled={value === total}
        aria-label="Última página"
      >
        <IconChevronsRight size={16} />
      </button>
    </Group>
  );
}

// Formatea fechas de forma relativa en español (hace X / en X)
const formatTimeAgo = (input) => {
  try {
    const date = new Date(input)
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
    if (Math.abs(seconds) < 5) return 'ahora'

    const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })
    const thresholds = [
      { unit: 'year', seconds: 31536000 },
      { unit: 'month', seconds: 2592000 },
      { unit: 'week', seconds: 604800 },
      { unit: 'day', seconds: 86400 },
      { unit: 'hour', seconds: 3600 },
      { unit: 'minute', seconds: 60 },
      { unit: 'second', seconds: 1 }
    ]

    for (const t of thresholds) {
      if (Math.abs(seconds) >= t.seconds) {
        const value = Math.round(seconds / t.seconds)
        return rtf.format(-value, t.unit)
      }
    }

    return ''
  } catch {
    return ''
  }
}

/**
 * Construye el author para el optimistic update usando la respuesta del servidor.
 * Si el servidor devuelve author con badge stats, los usa; si no, cae al fallback del user.
 */
const buildOptimisticAuthor = (createdAuthor, fallbackUser) => {
  const base = createdAuthor || {}
  return {
    id: base.id ?? fallbackUser?.id ?? null,
    username: base.username ?? fallbackUser?.username ?? null,
    displayName: base.displayName ?? fallbackUser?.displayName ?? fallbackUser?.username ?? null,
    avatarUrl: base.avatarUrl ?? fallbackUser?.avatarUrl ?? null,
    role: base.role ?? fallbackUser?.role ?? null,
    streak: base.streak ?? 0,
    totalChapters: base.totalChapters ?? 0,
    comments: base.comments ?? 0,
    nightReads: base.nightReads ?? 0,
    maxChaptersPerHour: base.maxChaptersPerHour ?? 0,
  }
}

// Normalizar objeto de comentario recibido desde la API
const normalizeApiComment = (c) => {
  if (!c || typeof c !== 'object') return c
  const id = c.id ?? c._id ?? null
  const likesCount = (typeof c.likesCount !== 'undefined') ? c.likesCount : (typeof c.likes !== 'undefined' ? c.likes : (c.likes_count ?? 0))
  const dislikesCount = (typeof c.dislikesCount !== 'undefined') ? c.dislikesCount : (typeof c.dislikes !== 'undefined' ? c.dislikes : (c.dislikes_count ?? 0))
  const replies = Array.isArray(c.replies) ? c.replies.map(normalizeApiComment) : c.replies
  const author = c.author || (c.username || c.user ? {
    username: c.username || (c.user && c.user.username),
    displayName: c.displayName || c.display_name || (c.user && c.user.displayName),
    id: c.userId || c.user_id || (c.user && c.user.id)
  } : null)

  return {
    ...c,
    id,
    likesCount: Number(likesCount || 0),
    dislikesCount: Number(dislikesCount || 0),
    replies,
    author
  }
}
// Ordenamiento con "Boost Temporal":
// - Comentarios con edad < BOOST_MINUTES permanecen arriba (ordenados por fecha)
// - Después de la ventana, orden por score (likes - dislikes), luego likes, luego fecha
const hybridSortComments = (arr, BOOST_MINUTES = 10) => {
  if (!Array.isArray(arr)) return arr
  const BOOST_MS = Number(BOOST_MINUTES || 10) * 60 * 1000
  const now = Date.now()
  const getLikes = (x) => Number(x?.likesCount || x?.likes || 0)
  const getDislikes = (x) => Number(x?.dislikesCount || x?.dislikes || 0)
  const score = (x) => (getLikes(x) - getDislikes(x))
  const getCreatedAt = (x) => {
    const t = x && (x.createdAt || x.created_at || x.created_at_time)
    const n = new Date(t || 0).getTime()
    return Number.isFinite(n) ? n : 0
  }

  const isBoosted = (x) => {
    try {
      const ta = getCreatedAt(x)
      if (!ta) return false
      return (now - ta) < BOOST_MS
    } catch { return false }
  }

  const cmp = (a, b) => {
    const aBoost = isBoosted(a)
    const bBoost = isBoosted(b)
    if (aBoost && bBoost) {
      // ambos en ventana: ordenar por fecha reciente
      const ta = getCreatedAt(a)
      const tb = getCreatedAt(b)
      return tb - ta
    }
    if (aBoost && !bBoost) return -1
    if (!aBoost && bBoost) return 1

    // fuera de la ventana: ordenar por score, luego likes, luego fecha
    const sa = score(a)
    const sb = score(b)
    if (sa !== sb) return sb - sa
    const la = getLikes(a)
    const lb = getLikes(b)
    if (la !== lb) return lb - la
    const ta = getCreatedAt(a)
    const tb = getCreatedAt(b)
    return tb - ta
  }

  const recurse = (list) => {
    return (list || []).slice().sort(cmp).map(item => {
      const next = { ...(item || {}) }
      if (Array.isArray(next.replies)) next.replies = recurse(next.replies)
      return next
    })
  }

  return recurse(arr)
}


export default function Comentarios({ detailRequest, openLogin, user, maxReplyDepth = 2, boostMinutes = 10, username }) {
  const [commentText, setCommentText] = useState('')
  const [commentSubmitting, setCommentSubmitting] = useState(false)
  const [commentSuccess, setCommentSuccess] = useState(false)
  const commentInputRef = useRef(null)
  const commentsContainerRef = useRef(null)
  const processedCommentIdsRef = useRef(new Set())
  // Evitar envíos duplicados por doble click o reintentos simultáneos
  const pendingPostsRef = useRef(new Set())
  const maybeSortComments = (arr) => {
    try {
      if (!Array.isArray(arr)) return arr
      return hybridSortComments(arr, Number(boostMinutes || 10))
    } catch {
      return arr
    }
  }
  const replyInputRefs = useRef({})
  const [detailComments, setDetailComments] = useState([])
  const [detailCommentsPage, setDetailCommentsPage] = useState(1)
  const [detailCommentsLoading, setDetailCommentsLoading] = useState(false)
  const [detailCommentsPagination, setDetailCommentsPagination] = useState(null)
  const [commentFilter, setCommentFilter] = useState('newest') // 'newest', 'popular', 'oldest'
  const [isSpoilerMode, setIsSpoilerMode] = useState(false)
  const [isPollMode, setIsPollMode] = useState(false)
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState(['', ''])
  const [userPollVotes, setUserPollVotes] = useState({})
  const [revealedComments, setRevealedComments] = useState({})
  const [expandedComments, setExpandedComments] = useState({})
  const [replyingTo, setReplyingTo] = useState(null)
  // estado para cajas de respuesta por comentario (texto, abierto, submitting, etc.)
  const [replyBoxes, setReplyBoxes] = useState({})
  // state para inputs exclusivos de respuesta por comentario
  const [repliesVisible, setRepliesVisible] = useState({})
  const [mentionExists, setMentionExists] = useState({})

  // Nuevo: configuraciones para hilos anidados y paginado de replies
  const MAX_REPLY_DEPTH = typeof maxReplyDepth === 'number' ? maxReplyDepth : 2 // profundidad tras la cual se colapsa automáticamente
  const REPLIES_PAGE_LIMIT = 5
  const [repliesCollapsedByDepth, setRepliesCollapsedByDepth] = useState({})
  const [replyPages, setReplyPages] = useState({}) // { [commentId]: { page, totalPages, limit } }
  const [repliesLoadingState, setRepliesLoadingState] = useState({}) // { [commentId]: boolean }
  const repliesCacheRef = useRef({}) // caché de respuestas ya cargadas

  // Nuevo: estado para autocompletado de menciones (main y por reply box)
  const [mentionSuggestions, setMentionSuggestions] = useState({}) // { key: { visible, items, query } }
  const mentionDebounceRef = useRef(null)
  // Debounce refs para reducir llamadas a `sendTyping` por onChange
  const typingDebounceRef = useRef({})
  // Caché local para resultados y checks en vuelo: {'user': true|false|'pending'}
  const mentionCacheRef = useRef({})
  // Map de promesas en vuelo para dedupe: { [username]: Promise<boolean> }
  const mentionInFlightRef = useRef({})
  // Indicador de escritura (BroadcastChannel)
  const TYPING_TIMEOUT_MS = 4000
  const typingChannelRef = useRef(null)
  const clientIdRef = useRef(null)
  const lastTypingEmitRef = useRef(0)
  const typingMapRef = useRef(new Map()) // Map<clientId, { ts, user, requestId }>
  const [typingCount, setTypingCount] = useState(0)
  // Inicializar BroadcastChannel / storage listeners y helpers

  useEffect(() => {
    try {
      // client id por sesión
      let cid = null
      try { cid = sessionStorage.getItem('manhwa_comments_clientId') } catch { cid = null }
      if (!cid) {
        cid = `${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`
        try { sessionStorage.setItem('manhwa_comments_clientId', cid) } catch { /* noop */ }
      }
      clientIdRef.current = cid
    } catch { /* noop */ }

    try {
      if (typeof BroadcastChannel !== 'undefined') {
        typingChannelRef.current = new BroadcastChannel('manhwa-typing')
        typingChannelRef.current.onmessage = (ev) => {
          try { const msg = ev.data; if (msg && msg.type === 'typing') handleIncomingTyping(msg) } catch { /* noop */ }
        }
      } else {
        // No BroadcastChannel available — skipping cross-tab typing fallback.
      }
    } catch { /* noop */ }

    const tick = setInterval(() => { try { pruneTyping() } catch { /* noop */ } }, 1000)
    return () => {
      try { if (typingChannelRef.current && typeof typingChannelRef.current.close === 'function') typingChannelRef.current.close() } catch { /* noop */ }
      clearInterval(tick)
    }
  }, [])

  // limpiar timeouts de debounce al desmontar
  useEffect(() => {
    return () => {
      try {
        const d = typingDebounceRef.current || {}
        Object.keys(d).forEach(k => { try { clearTimeout(d[k]) } catch { /* noop */ } })
      } catch { /* noop */ }
    }
  }, [])

  const handleIncomingTyping = (msg) => {
    try {
      if (!msg || !msg.clientId) return
      typingMapRef.current.set(String(msg.clientId), { ts: msg.ts || Date.now(), user: msg.user || null, requestId: String(msg.requestId || '') })
      pruneTyping()
    } catch { /* noop */ }
  }

  const pruneTyping = () => {
    try {
      const now = Date.now()
      for (const [k, v] of Array.from(typingMapRef.current.entries())) {
        if (!v || (now - (v.ts || 0) > TYPING_TIMEOUT_MS)) typingMapRef.current.delete(k)
      }
      const reqId = detailRequest && detailRequest.id ? String(detailRequest.id) : null
      let count = 0
      for (const [k, v] of typingMapRef.current.entries()) {
        if (!k) continue
        if (k === clientIdRef.current) continue
        if (reqId && String(v.requestId) !== reqId) continue
        count += 1
      }
      setTypingCount(count)
    } catch { /* noop */ }
  }

  const sendTyping = (scopeRequestId) => {
    try {
      const reqId = detailRequest && detailRequest.id ? String(detailRequest.id) : (scopeRequestId ? String(scopeRequestId) : null)
      if (!reqId) return
      const now = Date.now()
      // throttle typing emits to at most once every 2500ms to avoid spamming the server
      if (now - (lastTypingEmitRef.current || 0) < 2500) return
      lastTypingEmitRef.current = now
      const msg = { type: 'typing', requestId: reqId, clientId: clientIdRef.current || String(Math.random()), user: user ? (user.displayName || user.username) : null, ts: now }
      try {
        if (typingChannelRef.current && typeof typingChannelRef.current.postMessage === 'function') {
          typingChannelRef.current.postMessage(msg)
        } else {
          // BroadcastChannel not available — skipping fallback.
        }
      } catch { /* noop */ }
      // Enviar al servidor para que retransmita por SSE (permitir que otras pestañas, incluso privadas, reciban el evento)
      try {
        try {
          fetch(endpoint('comments', 'typing'), {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(msg)
          }).catch(() => { })
        } catch { /* noop */ }
      } catch { /* noop */ }
      typingMapRef.current.set(String(msg.clientId), { ts: now, user: msg.user, requestId: msg.requestId })
      pruneTyping()
    } catch { /* noop */ }
  }
  // Reacciones locales (optimistic UI): 'like' | 'dislike' | undefined
  const [userReactions, setUserReactions] = useState({})
  // estado derivado para re-render cuando hay reacciones pendientes
  const [_pendingReactionsState, setPendingReactionsState] = useState({})
  // Cola local para persistir reacciones de forma rate-limited
  const pendingReactionsRef = useRef(new Map()) // Map<cid, { action, attempts }>

  // Registrar scroll del usuario para no interferir con ajustes automáticos
  useEffect(() => {
    const handler = () => { try { lastUserScrollRef.current = Date.now() } catch { /* noop */ } }
    try {
      window.addEventListener('scroll', handler, { passive: true })
    } catch { window.addEventListener('scroll', handler) }
    const c = commentsContainerRef.current
    if (c && c.addEventListener) {
      try { c.addEventListener('scroll', handler, { passive: true }) } catch { c.addEventListener('scroll', handler) }
    }
    return () => {
      try { window.removeEventListener('scroll', handler) } catch { /* noop */ }
      if (c && c.removeEventListener) try { c.removeEventListener('scroll', handler) } catch { /* noop */ }
    }
  }, [])
  const reactionProcessorRunningRef = useRef(false)
  // Refs para animación FLIP de reordenamiento
  const commentNodesRef = useRef({})
  const positionsRef = useRef({})
  const FLIP_ANIM_MS = 300
  const lastUserScrollRef = useRef(0)
  const [showNewCommentBtn, setShowNewCommentBtn] = useState(false)
  const latestIncomingCommentRef = useRef(null)

  useLayoutEffect(() => {
    try {
      const nodes = commentNodesRef.current || {}
      const newPositions = {}
      Object.keys(nodes).forEach(id => {
        const el = nodes[id]
        if (!el) return
        const r = el.getBoundingClientRect()
        newPositions[id] = r.top
      })

      const prevPositions = positionsRef.current || {}
      // elegir comentario "leído" en base a la posición previa (centro de viewport)
      let preserveId = null
      try {
        const center = (window.innerHeight || document.documentElement.clientHeight) / 2
        let best = { id: null, diff: Infinity }
        Object.keys(prevPositions).forEach(id => {
          const p = prevPositions[id]
          if (typeof p === 'number') {
            const d = Math.abs(p - center)
            if (d < best.diff) { best = { id, diff: d } }
          }
        })
        preserveId = best.id
      } catch { preserveId = null }

      // aplicar FLIP a cada elemento
      Object.keys(newPositions).forEach(id => {
        const el = nodes[id]
        const prev = prevPositions[id]
        const now = newPositions[id]
        if (typeof prev !== 'undefined' && el && prev !== now) {
          const delta = prev - now
          if (delta) {
            el.style.transition = `transform ${FLIP_ANIM_MS}ms ease`
            el.style.transform = `translateY(${delta}px)`
            // forzar reflow
            void el.offsetHeight
            el.style.transform = ''
            const cleanup = () => {
              try { el.style.transition = ''; el.style.transform = '' } catch { /* noop */ }
              el.removeEventListener('transitionend', cleanup)
            }
            el.addEventListener('transitionend', cleanup)
          }
        }
      })

      // Ajustar scroll para mantener el elemento "preservado" en la misma posición visual
      try {
        const now = newPositions[preserveId]
        const prev = prevPositions[preserveId]
        const recentScroll = Date.now() - (lastUserScrollRef.current || 0)
        // no interferir si el usuario acaba de scrollear
        if (preserveId && typeof now === 'number' && typeof prev === 'number' && recentScroll > 300) {
          const scrollDelta = now - prev
          if (Math.abs(scrollDelta) > 2) {
            // preferir scroll del contenedor si existe, sino window
            const sc = commentsContainerRef.current && commentsContainerRef.current.scrollTop !== undefined ? commentsContainerRef.current : window
            if (sc && sc === window) {
              window.scrollBy(0, scrollDelta)
            } else if (sc && sc.scrollBy) {
              sc.scrollBy(0, scrollDelta)
            } else if (sc && typeof sc.scrollTop !== 'undefined') {
              sc.scrollTop = sc.scrollTop + scrollDelta
            }
          }
        }
      } catch { /* noop */ }

      positionsRef.current = newPositions
    } catch { /* noop */ }
  }, [detailComments])

  const queueReaction = (cid, action) => {
    try {
      const key = String(cid)
      const cur = pendingReactionsRef.current.get(key) || { action: null, attempts: 0 }
      // Guardar la última intención para este comentario (evita enviar acciones obsoletas)
      pendingReactionsRef.current.set(key, { action, attempts: cur.attempts || 0 })
      // marcar en estado para que UI refleje que está pendiente
      try { setPendingReactionsState(prev => ({ ...(prev || {}), [key]: true })) } catch { /* noop */ }
      // arrancar el procesador si no está corriendo
      if (!reactionProcessorRunningRef.current) processPendingReactions()
    } catch { /* noop */ }
  }

  const processPendingReactions = async () => {
    if (reactionProcessorRunningRef.current) return
    reactionProcessorRunningRef.current = true
    try {
      while (pendingReactionsRef.current.size > 0) {
        // tomar la primera entrada (Map mantiene inserción; OK para round-robin simple)
        const firstKey = pendingReactionsRef.current.keys().next().value
        if (!firstKey) break
        const item = pendingReactionsRef.current.get(firstKey)
        if (!item) { pendingReactionsRef.current.delete(firstKey); continue }
        const cid = firstKey
        const action = item.action
        // enviar sólo si hay una acción válida
        if (!action) { pendingReactionsRef.current.delete(cid); continue }

        try {
          if (action === 'like') {
            const res = await api.post('comments', `${cid}/like`)
            const data = (res && res.data) || res || null
            const likes = data?.data?.likesCount ?? data?.likesCount ?? null
            const dislikes = data?.data?.dislikesCount ?? data?.dislikesCount ?? null
            if (likes !== null || dislikes !== null) {
              setDetailComments(prevComments => maybeSortComments((prevComments || []).map(c => {
                if (!c) return c
                if (String(c.id ?? c._id) !== cid) return c
                return { ...c, likesCount: (likes !== null ? likes : c.likesCount), dislikesCount: (dislikes !== null ? dislikes : c.dislikesCount) }
              })))
            }
            // confirmado, quitar de la cola
            pendingReactionsRef.current.delete(cid)
            try { setPendingReactionsState(prev => { const n = { ...(prev || {}) }; delete n[cid]; return n }) } catch { /* noop */ }
          } else if (action === 'dislike') {
            const res = await api.post('comments', `${cid}/dislike`)
            const data = (res && res.data) || res || null
            const likes = data?.data?.likesCount ?? data?.likesCount ?? null
            const dislikes = data?.data?.dislikesCount ?? data?.dislikesCount ?? null
            if (likes !== null || dislikes !== null) {
              setDetailComments(prevComments => maybeSortComments((prevComments || []).map(c => {
                if (!c) return c
                if (String(c.id ?? c._id) !== cid) return c
                return { ...c, likesCount: (likes !== null ? likes : c.likesCount), dislikesCount: (dislikes !== null ? dislikes : c.dislikesCount) }
              })))
            }
            pendingReactionsRef.current.delete(cid)
            try { setPendingReactionsState(prev => { const n = { ...(prev || {}) }; delete n[cid]; return n }) } catch { /* noop */ }
          } else if (action === 'remove') {
            const res = await api.del('comments', `${cid}/vote`)
            const data = (res && res.data) || res || null
            const likes = data?.data?.likesCount ?? data?.likesCount ?? null
            const dislikes = data?.data?.dislikesCount ?? data?.dislikesCount ?? null
            if (likes !== null || dislikes !== null) {
              setDetailComments(prevComments => maybeSortComments((prevComments || []).map(c => {
                if (!c) return c
                if (String(c.id ?? c._id) !== cid) return c
                return { ...c, likesCount: (likes !== null ? likes : c.likesCount), dislikesCount: (dislikes !== null ? dislikes : c.dislikesCount) }
              })))
            }
            pendingReactionsRef.current.delete(cid)
            try { setPendingReactionsState(prev => { const n = { ...(prev || {}) }; delete n[cid]; return n }) } catch { /* noop */ }
          } else {
            pendingReactionsRef.current.delete(cid)
          }
        } catch (err) {
          // manejar 401 -> abrir login y vaciar cola para no seguir enviando
          if (err && err.status === 401) {
            try { openLogin() } catch { /* noop */ }
            pendingReactionsRef.current.clear()
            break
          }
          // En caso de 429 o fallo temporal, incrementar intentos y reintentar después
          const attempts = (item.attempts || 0) + 1
          if (attempts >= 5) {
            // dar por perdido tras varios intentos y eliminar la entrada
            console.warn('No se pudo persistir reacción tras varios intentos', cid, action, err)
            pendingReactionsRef.current.delete(cid)
            try { setPendingReactionsState(prev => { const n = { ...(prev || {}) }; delete n[cid]; return n }) } catch { /* noop */ }
          } else {
            pendingReactionsRef.current.set(cid, { action: item.action, attempts })
            // esperar un backoff antes de reintentar
            const waitMs = Math.min(2000 * attempts, 8000)
            await new Promise(r => setTimeout(r, waitMs))
          }
        }

        // pequeño throttle entre requests para evitar ráfagas
        await new Promise(r => setTimeout(r, 180))
      }
    } finally {
      reactionProcessorRunningRef.current = false
    }
  }

  // Intentar vaciar la cola al salir de la página (mejor esfuerzo)
  useEffect(() => {
    const flushOnUnload = () => {
      try {
        // Intentar iniciar el procesador (no se puede await en beforeunload), es best-effort
        if (pendingReactionsRef.current && pendingReactionsRef.current.size > 0) {
          try { processPendingReactions() } catch { /* noop */ }
        }
      } catch { /* noop */ }
    }
    window.addEventListener('beforeunload', flushOnUnload)
    return () => window.removeEventListener('beforeunload', flushOnUnload)
  }, [])

  const toggleReveal = (id) => {
    setRevealedComments(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const toggleReplies = async (id) => {
    const isCurrentlyVisible = repliesVisible[id]

    setRepliesVisible(prev => {
      const next = { ...prev, [id]: !prev[id] }
      return next
    })

    // Si se est\u00e1 abriendo y no hay respuestas cargadas, cargarlas
    if (!isCurrentlyVisible) {
      const hasReplies = (detailComments || []).some(c =>
        String(c.id ?? c._id) === String(id) &&
        Array.isArray(c.replies) &&
        c.replies.length > 0
      )

      if (!hasReplies) {
        try {
          await fetchRepliesPage(id, 1)
          // Scroll suave al comentario despu\u00e9s de cargar
          setTimeout(() => {
            try {
              const node = commentNodesRef.current[String(id)]
              if (node) node.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
            } catch { /* noop */ }
          }, 150)
        } catch { /* noop */ }
      }
    }
  }

  const commentIsSpoiler = (c) => {
    return !!(c && (c.isSpoiler || c.spoiler || c.is_spoiler || c.spoiler_flag))
  }

  const checkUsernameExists = async (username) => {
    try {
      if (!username) return
      const key = String(username).toLowerCase()
      // If we have a cached boolean result, update state and return it
      const cache = mentionCacheRef.current || {}
      if (typeof cache[key] !== 'undefined') {
        try { setMentionExists(prev => ({ ...prev, [key]: !!cache[key] })) } catch { /* noop */ }
        return cache[key]
      }

      // If a check for this username is already in flight, return the same Promise
      const inflight = mentionInFlightRef.current || {}
      if (inflight[key]) return inflight[key]

      // Create and store the in-flight promise
      const p = (async () => {
        try {
          const res = await api.get('users', `check-username?username=${encodeURIComponent(key)}`)
          const available = res && res.data && typeof res.data.available !== 'undefined' ? res.data.available : (res && res.available)
          const exists = available === false
          // store result in cache and state
          mentionCacheRef.current = { ...(mentionCacheRef.current || {}), [key]: !!exists }
          try { setMentionExists(prev => ({ ...prev, [key]: !!exists })) } catch { /* noop */ }
          return !!exists
        } catch {
          // On error, mark as not existing to avoid retry storms
          try {
            mentionCacheRef.current = { ...(mentionCacheRef.current || {}), [key]: false }
            setMentionExists(prev => ({ ...prev, [key]: false }))
          } catch { /* noop */ }
          return false
        } finally {
          try { if (mentionInFlightRef.current) delete mentionInFlightRef.current[key] } catch { /* noop */ }
        }
      })()

      mentionInFlightRef.current = { ...(mentionInFlightRef.current || {}), [key]: p }
      return p
    } catch {
      // Shouldn't happen, but swallow and mark as non-existent
      try {
        const k = String(username).toLowerCase()
        mentionCacheRef.current = { ...(mentionCacheRef.current || {}), [k]: false }
        setMentionExists(prev => ({ ...prev, [k]: false }))
      } catch { /* noop */ }
    }
  }

  // Estado y helpers para editar comentario
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingComment, setEditingComment] = useState(null)
  const [editText, setEditText] = useState('')
  const [editIsSpoiler, setEditIsSpoiler] = useState(false)
  const [editSubmitting, setEditSubmitting] = useState(false)

  const openEditModal = (comment) => {
    if (!comment) return
    setEditingComment(comment)
    setEditText(comment.content || '')
    setEditIsSpoiler(!!comment.isSpoiler)
    setEditModalOpen(true)
  }

  // legacy: replaced by `canEditComment` / `canDeleteComment`

  const hasAdminRole = () => {
    try {
      if (!user) return false
      const role = String(user.role || '').toLowerCase()
      if (role === 'admin' || role === 'superadmin' || role === 'super-admin' || role === 'super_admin') return true
      if (Array.isArray(user.roles) && user.roles.some(r => {
        const rr = String(r || '').toLowerCase()
        return rr === 'admin' || rr === 'superadmin' || rr === 'super-admin' || rr === 'super_admin'
      })) return true
      return false
    } catch { return false }
  }

  const canEditComment = (comment) => {
    try {
      if (!user || !comment) return false
      // Allow admins to edit any comment
      if (hasAdminRole()) return true
      const uid = String(user.id || user._id || user.userId || '')
      const authorId = String(comment.author?.id ?? comment.author?.userId ?? comment.author?._id ?? comment.id ?? '')
      return uid && authorId && uid === authorId
    } catch { return false }
  }

  const canDeleteComment = (comment) => {
    try {
      if (!comment) return false
      if (hasAdminRole()) return true
      return canEditComment(comment)
    } catch { return false }
  }

  const updateCommentInState = (updated) => {
    if (!updated || !updated.id) return
    setDetailComments(prev => {
      if (!Array.isArray(prev)) return prev
      // Try update top-level
      let found = false
      const next = prev.map(c => {
        if (!c) return c
        if (String(c.id ?? c._id) === String(updated.id)) {
          found = true
          return { ...c, ...updated }
        }
        // update inside replies
        if (Array.isArray(c.replies)) {
          const rnext = c.replies.map(r => (String(r.id) === String(updated.id) ? { ...r, ...updated } : r))
          return { ...c, replies: rnext }
        }
        return c
      })
      if (found) return next
      return prev
    })
  }

  const removeCommentFromState = (id) => {
    if (!id) return
    setDetailComments(prev => {
      if (!Array.isArray(prev)) return prev
      // remove top-level
      const filtered = prev.filter(c => String(c.id ?? c._id) !== String(id))
      // also remove from replies
      return filtered.map(c => {
        if (!Array.isArray(c.replies)) return c
        return { ...c, replies: c.replies.filter(r => String(r.id) !== String(id)) }
      })
    })
  }

  const handleSaveEdit = async () => {
    if (!editingComment) return
    if (!canEditComment(editingComment)) {
      alert('No tienes permiso para editar este comentario.')
      setEditModalOpen(false)
      setEditingComment(null)
      return
    }
    const id = String(editingComment.id || editingComment._id || editingComment._id)
    if (!id) return
    if ((String(editText || '').trim().length) < 1) return
    setEditSubmitting(true)
    try {
      const payload = { content: String(editText || '').trim(), isSpoiler: !!editIsSpoiler }
      const res = await api.put('comments', String(id), payload)
      const updated = (res && res.data && res.data.comment) ? res.data.comment : (res && res.comment) || null
      if (updated) {
        updateCommentInState(updated)
      } else {
        // fallback: update local optimistic
        updateCommentInState({ id, content: payload.content, isSpoiler: payload.isSpoiler })
      }
      setEditModalOpen(false)
      setEditingComment(null)
    } catch (err) {
      if (err && err.status === 401) { openLogin(); return }
      console.warn('Error editando comentario', err)
    } finally {
      setEditSubmitting(false)
    }
  }

  const handleDeleteComment = async (id) => {
    if (!id) return
    // find comment object to validate permission
    const target = (detailComments || []).find(c => String(c.id ?? c._id) === String(id)) || null
    if (target && !canDeleteComment(target)) {
      alert('No tienes permiso para eliminar este comentario.')
      return
    }
    if (!window.confirm('¿Eliminar este comentario? Esta acción no se puede deshacer.')) return
    // Optimistic remove
    const prev = detailComments
    removeCommentFromState(id)
    try {
      await api.del('comments', String(id))
    } catch (err) {
      // revertir en error
      try { setDetailComments(prev) } catch { /* noop */ }
      if (err && err.status === 401) { openLogin(); return }
      console.warn('Error eliminando comentario', err)
    }
  }

  // When comments change, pre-check mentioned usernames (top-level and replies)
  useEffect(() => {
    try {
      const names = new Set()
      const addFromText = (text) => {
        if (!text || typeof text !== 'string') return
        const re = /@([a-zA-Z0-9_.-]+)/g
        let m
        while ((m = re.exec(text)) !== null) {
          if (m[1]) names.add(m[1].toLowerCase())
        }
      }
      (detailComments || []).forEach(c => {
        addFromText(c.content)
        if (Array.isArray(c.replies)) c.replies.forEach(r => addFromText(r.content))
      })
      names.forEach(n => {
        // call checkUsernameExists which dedupes via in-flight map and cache
        try { checkUsernameExists(n) } catch { /* noop */ }
      })
    } catch { /* noop */ }
  }, [detailComments])

  const renderContentWithMentions = (text, topLevelId) => {
    if (!text) return null
    const parts = []
    let lastIndex = 0
    const re = /@([a-zA-Z0-9_.-]+)/g
    let m
    let idx = 0
    while ((m = re.exec(text)) !== null) {
      const start = m.index
      const before = text.slice(lastIndex, start)
      if (before) parts.push(<Text key={`t-${topLevelId}-${idx++}`} component="span" style={{ color: 'var(--text-color)' }}>{before}</Text>)
      const uname = m[1]
      const key = String(uname).toLowerCase()
      const exists = mentionExists[key]
      if (exists) {
        parts.push(
          <Text
            key={`m-${topLevelId}-${idx++}`}
            component="a"
            href={`/users/${encodeURIComponent(uname)}`}
            style={{ color: 'rgb(var(--accent-cyan))', cursor: 'pointer', textDecoration: 'none' }}
          >
            @{uname}
          </Text>
        )
      } else {
        parts.push(<Text key={`m-${topLevelId}-${idx++}`} component="span" style={{ color: 'var(--text-color)' }}>@{uname}</Text>)
      }
      lastIndex = re.lastIndex
    }
    const rest = text.slice(lastIndex)
    if (rest) parts.push(<Text key={`t-${topLevelId}-${idx++}`} component="span" style={{ color: 'var(--text-color)' }}>{rest}</Text>)
    return <span>{parts}</span>
  }

  // Renderizar contenido con truncado para comentarios largos
  const renderTruncatedContent = (text, commentId, maxLength = 400) => {
    if (!text) return null
    const isExpanded = expandedComments[commentId]
    const needsTruncation = text.length > maxLength

    if (!needsTruncation) {
      return renderContentWithMentions(text, commentId)
    }

    const displayText = isExpanded ? text : text.slice(0, maxLength)

    return (
      <>
        {renderContentWithMentions(displayText, commentId)}
        {!isExpanded && <span style={{ color: 'var(--dimmed-text)' }}>...</span>}
        <div style={{ marginTop: 8 }}>
          <Button
            variant="subtle"
            size="xs"
            onClick={() => setExpandedComments(prev => ({ ...prev, [commentId]: !prev[commentId] }))}
            styles={{
              root: {
                color: 'rgb(var(--accent-cyan))',
                padding: '4px 8px',
                height: 'auto',
                fontSize: '12px',
                fontWeight: 600
              }
            }}
          >
            {isExpanded ? 'Ver menos' : 'Ver más'}
          </Button>
        </div>
      </>
    )
  }

  // Dedupe comments by `id` to avoid duplicate React keys
  const dedupeComments = (arr) => {
    if (!Array.isArray(arr)) return []
    const seen = new Set()
    const out = []
    for (const c of arr) {
      const id = c && (c.id ?? c._id ?? null)
      if (id == null) {
        out.push(c)
        continue
      }
      const sid = String(id)
      if (!seen.has(sid)) {
        seen.add(sid)
        out.push(c)
      }
    }
    return out
  }

  // Validación de longitud de comentario
  const MIN_COMMENT_LENGTH = 5
  const MAX_COMMENT_LENGTH = 1000
  const trimmedLength = commentText.trim().length
  const isTooShort = trimmedLength > 0 && trimmedLength < MIN_COMMENT_LENGTH
  const isTooLong = trimmedLength > MAX_COMMENT_LENGTH

  // Validar si la encuesta está completa (solo si el modo está activo)
  const isPollComplete = isPollMode && pollQuestion.trim().length > 0 && pollOptions.filter(opt => opt.trim().length > 0).length >= 2

  // Validar si el comentario de texto es válido
  const isTextValid = trimmedLength >= MIN_COMMENT_LENGTH && trimmedLength <= MAX_COMMENT_LENGTH

  // Permitir enviar si:
  // 1) El comentario de texto es válido, O
  // 2) La encuesta está completa (con o sin texto)
  const canSubmit = isTextValid || isPollComplete

  const fetchRequestComments = async (id, page = 1, limit = 50) => {
    setDetailCommentsLoading(true)
    try {
      const res = await apiGetRequestComments(id, { page, limit })
      if (res && res.data) {
        const comments = res.data.comments || []
        const deduped = dedupeComments(comments)
        const normalized = deduped.map(normalizeApiComment)
        setDetailComments(maybeSortComments(normalized))
        // cargar respuestas si existen
        setTimeout(() => { loadRepliesForComments(normalized) }, 60)
        // Si el usuario está logueado, intentar obtener sus reacciones para esta request
        try { if (user) fetchMyReactions(id).catch(() => { }) } catch { /* noop */ }
        // Cargar votos de encuestas
        try { loadPollVotes(normalized) } catch { /* noop */ }
        setDetailCommentsPagination(res.data.pagination || null)
        // inicializar estado de visibilidad de respuestas (visibles si hay 4 o menos, ocultas si hay 5+)
        setRepliesVisible(prev => {
          const next = { ...prev }
          comments.forEach(c => {
            const rc = c.repliesCount || c.replies_count || (Array.isArray(c.replies) ? c.replies.length : 0)
            if (rc > 0 && typeof next[c.id] === 'undefined') {
              next[c.id] = rc < 5
            }
          })
          return next
        })
        // Ensure spoilers are hidden by default unless user already revealed them
        setRevealedComments(prev => {
          const next = { ...prev }
          comments.forEach(c => {
            if (commentIsSpoiler(c) && typeof next[c.id] === 'undefined') next[c.id] = false
          })
          return next
        })
      } else if (Array.isArray(res)) {
        const deduped = dedupeComments(res)
        const normalized = deduped.map(normalizeApiComment)
        setDetailComments(maybeSortComments(normalized))
        setTimeout(() => { loadRepliesForComments(normalized) }, 60)
        try { loadPollVotes(normalized) } catch { /* noop */ }
        setDetailCommentsPagination(null)
        setRepliesVisible(prev => {
          const next = { ...prev }
          res.forEach(c => {
            const rc = c.repliesCount || c.replies_count || (Array.isArray(c.replies) ? c.replies.length : 0)
            if (rc > 0 && typeof next[c.id] === 'undefined') {
              next[c.id] = rc < 5
            }
          })
          return next
        })
        setRevealedComments(prev => {
          const next = { ...prev }
          res.forEach(c => {
            if (commentIsSpoiler(c) && typeof next[c.id] === 'undefined') next[c.id] = false
          })
          return next
        })
      }
    } catch {
      console.warn('Error cargando comentarios')
    } finally {
      setDetailCommentsLoading(false)
    }
  }

  // Obtener las reacciones del usuario logueado para los comentarios de esta request
  const fetchMyReactions = async (requestId) => {
    try {
      if (!user || !requestId) return
      const res = await api.get('comments', `my-reactions?targetType=request&targetId=${requestId}`)
      const data = (res && res.data) || res || null
      if (!data) return
      const mapping = {}
      if (Array.isArray(data.reactions)) {
        data.reactions.forEach(r => {
          if (r && r.commentId && r.reaction) mapping[String(r.commentId)] = r.reaction
        })
      } else if (Array.isArray(data)) {
        data.forEach(r => { if (r && r.commentId && r.reaction) mapping[String(r.commentId)] = r.reaction })
      } else if (data.reactions && typeof data.reactions === 'object') {
        Object.keys(data.reactions).forEach(k => { mapping[String(k)] = data.reactions[k] })
      }
      setUserReactions(mapping)
    } catch { /* noop */ }
  }

  // Cargar votos de encuestas para los comentarios
  const loadPollVotes = async (comments) => {
    try {
      const commentsWithPolls = []
      const processComment = (c) => {
        if (c.poll && c.poll.options) {
          commentsWithPolls.push(c)
        }
        if (Array.isArray(c.replies)) {
          c.replies.forEach(processComment)
        }
      }
      comments.forEach(processComment)

      if (commentsWithPolls.length === 0) return

      // Los datos de encuestas ahora vienen completos del backend
      const newUserVotes = {}

      for (const comment of commentsWithPolls) {
        try {
          const cid = String(comment.id ?? comment._id)

          // Si el backend indica que el usuario votó, guardar su voto
          if (comment.poll.user_voted && comment.poll.user_voted_option_id) {
            newUserVotes[cid] = comment.poll.user_voted_option_id
          }
        } catch {
          // Ignorar errores individuales
        }
      }

      setUserPollVotes(prev => ({ ...prev, ...newUserVotes }))
    } catch {
      /* noop */
    }
  }

  // Prefijar mención @username en el textarea y enfocarlo al responder
  const handleReply = (author, parentId, replyId = null) => {
    try {
      if (!author || !parentId) return
      const uname = author.username || author.displayName || ''
      if (!uname) return
      // abrir caja de respuesta específica para este comentario
      setReplyBoxes(prev => {
        const cur = prev[parentId] || { open: false, text: '' }
        // Si ya está abierto y hacemos click de nuevo, mantenerlo abierto pero actualizar el target
        const shouldOpen = !cur.open || cur.open
        // asegurarse de que haya un espacio al final cuando se abre
        let nextText = `@${uname} `
        if (shouldOpen) {
          if (!nextText.endsWith(' ')) nextText = nextText + ' '
        }
        return {
          ...prev,
          [parentId]: {
            ...cur,
            open: true,
            text: nextText,
            replyTargetId: replyId || null
          }
        }
      })
      // enfocar el textarea de respuesta y colocar el cursor al final
      setTimeout(() => {
        try {
          const el = replyInputRefs.current[parentId]
          if (el && typeof el.focus === 'function') {
            el.focus()
            try {
              const val = (el.value != null) ? el.value : (el.textContent != null ? el.textContent : '')
              const len = String(val).length
              if (typeof el.setSelectionRange === 'function') {
                el.setSelectionRange(len, len)
              } else if (typeof el.selectionStart !== 'undefined') {
                el.selectionStart = el.selectionEnd = len
              }
            } catch { /* noop */ }
          }
        } catch { /* noop */ }
      }, 140)
    } catch { /* noop */ }
  }

  // Detectar token de mención en inputs de reply al escribir
  const setReplyBoxTextWithMention = (parentId, text) => {
    setReplyBoxes(prev => ({ ...(prev || {}), [parentId]: { ...(prev[parentId] || {}), text } }))
    checkForMentionToken(text, parentId)
    // Debounced sendTyping to avoid one request per keystroke
    try {
      const k = String(parentId || 'main')
      if (typingDebounceRef.current[k]) clearTimeout(typingDebounceRef.current[k])
      typingDebounceRef.current[k] = setTimeout(() => {
        try { sendTyping() } catch { /* noop */ }
        try { delete typingDebounceRef.current[k] } catch { /* noop */ }
      }, 700)
    } catch { /* noop */ }
  }

  const cancelReplyBox = (parentId) => setReplyBoxes(prev => ({ ...(prev || {}), [parentId]: { ...(prev[parentId] || {}), open: false, replyTargetId: null } }))

  // devuelve longitud del contenido real excluyendo menciones iniciales como "@user "
  const contentLengthExcludingMentions = (txt) => {
    try {
      const s = String(txt || '').trim()
      // quitar una o varias menciones al inicio: @user1 @user2 ...
      const without = s.replace(/^(?:@[A-Za-z0-9_]+\s*)+/, '').trim()
      return without.length
    } catch { return 0 }
  }

  const handleSubmitReply = async (parentId) => {
    const box = replyBoxes[parentId] || {}
    const text = String((box.text || '')).trim()
    if (!text) return
    // evitar envíos duplicados si ya está en submitting
    if (box.submitting) return
    // dedupe por parentId + contenido
    const postKey = `${String(parentId)}::${String(text)}`
    if (pendingPostsRef.current.has(postKey)) return
    // asegurar que hay contenido real aparte de menciones iniciales
    if (contentLengthExcludingMentions(text) < MIN_COMMENT_LENGTH) return
    if (!detailRequest || !detailRequest.id) return
    setReplyBoxes(prev => ({ ...(prev || {}), [parentId]: { ...(prev[parentId] || {}), submitting: true } }))
    pendingPostsRef.current.add(postKey)
    try {
      const payload = { targetType: 'request', targetId: detailRequest.id, content: text, isSpoiler: !!box.isSpoiler }
      // If a specific reply target is set (replying to a reply), use that id as parentId
      if (box.replyTargetId) payload.parentId = box.replyTargetId
      else if (parentId) payload.parentId = parentId
      const res = await api.post('comments', '', payload)
      const created = res && res.data && res.data.comment ? res.data.comment : (res && res.comment) || null

      let newComment = null
      if (created) {
        const createdId = String(created.id ?? created._id ?? '')
        try { if (createdId) processedCommentIdsRef.current.add(createdId) } catch { /* noop */ }
        newComment = {
          id: created.id ?? created._id,
          content: created.content,
          author: buildOptimisticAuthor(created.author, user),
          createdAt: created.createdAt || new Date().toISOString(),
          isSpoiler: !!created.isSpoiler,
          likesCount: 0
        }
      }

      // Decide the actual parent id to attach this reply to: prefer backend's created.parentId, then payload, then caller parentId
      const actualParentId = (created && (created.parentId || created.parent_id)) || payload.parentId || parentId
      if (newComment && actualParentId) {
        setDetailComments(prev => {
          const nowList = prev || []

          // Función recursiva para verificar si un comentario existe en cualquier nivel
          const existsInTree = (comments) => {
            for (const cc of comments) {
              if (!cc) continue
              if (String(cc.id ?? cc._id) === String(newComment.id ?? newComment._id)) return true
              if (Array.isArray(cc.replies) && existsInTree(cc.replies)) return true
            }
            return false
          }

          // If this comment already exists (e.g. inserted by SSE), skip inserting to avoid duplicates
          if (existsInTree(nowList)) return prev

          // Función recursiva para buscar e insertar en cualquier nivel de profundidad
          const insertIntoTree = (comments) => {
            for (let i = 0; i < comments.length; i++) {
              const c = comments[i]
              if (!c) continue
              const cid = String(c.id ?? c._id)

              // Si encontramos el parent en este nivel, insertar aquí
              if (cid === String(actualParentId)) {
                const nextReplies = Array.isArray(c.replies) ? c.replies.slice() : []
                nextReplies.push(newComment)
                comments[i] = { ...c, replies: nextReplies }
                return true
              }

              // Si este comentario tiene respuestas, buscar recursivamente
              if (Array.isArray(c.replies) && c.replies.length > 0) {
                const repliesCopy = c.replies.slice()
                if (insertIntoTree(repliesCopy)) {
                  comments[i] = { ...c, replies: repliesCopy }
                  return true
                }
              }
            }
            return false
          }

          const resultList = nowList.slice()
          const inserted = insertIntoTree(resultList)

          // Si no se insertó, devolver estado anterior (se recargará después)
          return inserted ? resultList : nowList
        })
        try { processedCommentIdsRef.current.add(String(newComment.id ?? newComment._id ?? '')) } catch { /* noop */ }
        // ensure replies are visible so the newly posted reply is shown
        try { setRepliesVisible(prev => ({ ...prev, [String(actualParentId)]: true })) } catch { /* noop */ }
      }

      // Fallback: si tras un pequeño retraso la respuesta no aparece en el estado local,
      // forzar recarga completa de comentarios para sincronizar (maneja casos donde
      // las replies del padre no estaban cargadas y no pudimos insertar localmente).
      if (created) {
        setTimeout(async () => {
          try {
            // Función recursiva para buscar en todo el árbol
            const existsInTree = (comments) => {
              for (const cc of comments) {
                if (!cc) continue
                if (String(cc.id ?? cc._id) === String(created.id ?? created._id)) return true
                if (Array.isArray(cc.replies) && existsInTree(cc.replies)) return true
              }
              return false
            }

            const existsNow = existsInTree(detailComments || [])
            if (!existsNow && detailRequest && detailRequest.id) {
              // Intentar resolver el top-level parent del parentId (si fue reply a una reply)
              try {
                const rootId = await resolveRootParentId(payload.parentId)
                if (rootId) {
                  await fetchRepliesPage(rootId, 1)
                  try { setRepliesVisible(prev => ({ ...prev, [String(rootId)]: true })) } catch { /* noop */ }
                  return
                }
              } catch { /* noop */ }
              // si no pudimos resolver, recargar lista completa como último recurso
              fetchRequestComments(detailRequest.id, 1, detailCommentsPagination?.limit || 50).catch(() => { })
            }
          } catch { /* noop */ }
        }, 300)
      }

      // limpiar caja
      setReplyBoxes(prev => ({ ...(prev || {}), [parentId]: { ...(prev[parentId] || {}), text: '', open: false, submitting: false, success: true, replyTargetId: null } }))
      setTimeout(() => setReplyBoxes(prev => ({ ...(prev || {}), [parentId]: { ...(prev[parentId] || {}), success: false } })), 1400)
    } catch (err) {
      if (err && err.status === 401) { openLogin(); return }
      console.warn('Error enviando respuesta', err)
    } finally {
      setReplyBoxes(prev => ({ ...(prev || {}), [parentId]: { ...(prev[parentId] || {}), submitting: false } }))
      pendingPostsRef.current.delete(postKey)
    }
  }

  // Obtener respuestas de un comentario desde el backend
  const fetchCommentReplies = async (commentId, page = 1, limit = 10) => {
    try {
      const qs = `?page=${page}&limit=${limit}`
      const res = await api.get('comments', `${commentId}/replies${qs}`)
      let replies = []
      if (res && res.data && Array.isArray(res.data.replies)) replies = res.data.replies
      else if (res && Array.isArray(res.replies)) replies = res.replies
      if (!Array.isArray(replies)) return []
      return replies.map(normalizeApiComment)
    } catch {
      // ignore errors for replies
      return []
    }
  }

  // Resolver el id del top-level parent (root) dado un parentId que puede apuntar a una reply
  const resolveRootParentId = async (parentId) => {
    try {
      if (!parentId) return null
      let pid = String(parentId)
      // evitar loops infinitos - limitar profundidad
      for (let i = 0; i < 6; i++) {
        try {
          const res = await api.get('comments', pid)
          const comment = (res && res.data && res.data.comment) ? res.data.comment : (res && res.comment) || null
          if (!comment) return pid
          const p = comment.parentId ?? comment.parent_id ?? null
          if (!p) {
            // este comentario es top-level
            return String(comment.id ?? comment._id ?? pid)
          }
          // subir un nivel
          pid = String(p)
        } catch {
          return null
        }
      }
      return null
    } catch { return null }
  }

  // Cargar respuestas para los comentarios que tienen repliesCount > 0
  const loadRepliesForComments = async (comments) => {
    if (!Array.isArray(comments) || comments.length === 0) return
    const withReplies = comments.slice()
    await Promise.all(withReplies.map(async (c, idx) => {
      try {
        const rc = c.repliesCount || c.replies_count || 0
        if (rc && rc > 0) {
          // cargar sólo la primera página para habilitar paginado
          const limit = Math.min(rc, REPLIES_PAGE_LIMIT)
          const replies = await fetchCommentReplies(c.id ?? c._id, 1, limit)
          withReplies[idx] = { ...c, replies }
          setReplyPages(prev => ({ ...(prev || {}), [String(c.id ?? c._id)]: { page: 1, totalPages: Math.max(1, Math.ceil(rc / REPLIES_PAGE_LIMIT)), limit: REPLIES_PAGE_LIMIT } }))
        }
      } catch { /* noop */ }
    }))
    setDetailComments(prev => {
      // merge replies into current comments preserving order
      const byId = new Map((prev || []).map(x => [String(x.id ?? x._id), x]))
      for (const c of withReplies) {
        const key = String(c.id ?? c._id)
        if (byId.has(key)) {
          byId.set(key, { ...byId.get(key), replies: c.replies })
        }
      }
      return maybeSortComments(Array.from(byId.values()))
    })
    // asegurar que las respuestas se muestran si hay 4 o menos, se ocultan si hay 5+
    setRepliesVisible(prev => {
      const next = { ...prev };
      (comments || []).forEach(c => {
        const key = String(c.id ?? c._id)
        const rc = c.repliesCount || c.replies_count || (Array.isArray(c.replies) ? c.replies.length : 0)
        if (rc > 0 && typeof next[key] === 'undefined') {
          next[key] = rc < 5
        }
      })
      return next
    })
  }

  // Buscar sugerencias de usuario para autocompletado de menciones
  const fetchUserSuggestions = async (q) => {
    if (!q || String(q).trim().length === 0) return []
    try {
      const res = await api.get('users', `search?query=${encodeURIComponent(q)}`)
      // aceptar varias posibles formas de respuesta
      const users = (res && res.data && res.data.users) || res.users || res.data || []
      if (!Array.isArray(users)) return []
      return users.map(u => ({ value: u.username || u.displayName || u.id, label: u.displayName || u.username }))
    } catch {
      return []
    }
  }

  // Reemplazar la mención parcial por la sugerencia seleccionada
  const applyMentionSuggestion = (username, target) => {
    try {
      if (target === 'main') {
        // reemplazar última @token en commentText
        setCommentText(prev => {
          const s = String(prev || '')
          return s.replace(/@([A-Za-z0-9_.-]*)$/, `@${username} `)
        })
      } else {
        // target es id de comentario
        setReplyBoxes(prev => ({ ...(prev || {}), [target]: { ...(prev[target] || {}), text: String((prev[target] && prev[target].text) || '').replace(/@([A-Za-z0-9_.-]*)$/, `@${username} `) } }))
      }
      // ocultar sugerencias
      setMentionSuggestions(prev => ({ ...(prev || {}), [String(target)]: { visible: false, items: [], query: '' } }))
    } catch { /* noop */ }
  }

  // Revisar si hay un token de mención al final del texto y buscar sugerencias
  // Debounced check for mention token to reduce API calls
  const checkForMentionToken = (text, target = 'main') => {
    try {
      if (mentionDebounceRef.current) clearTimeout(mentionDebounceRef.current)
      mentionDebounceRef.current = setTimeout(async () => {
        try {
          const m = String(text || '').match(/@([A-Za-z0-9_.-]{1,})$/)
          if (!m) {
            setMentionSuggestions(prev => ({ ...(prev || {}), [String(target)]: { visible: false, items: [], query: '' } }))
            return
          }
          const q = m[1]
          setMentionSuggestions(prev => ({ ...(prev || {}), [String(target)]: { visible: true, items: prev?.[String(target)]?.items || [], query: q } }))
          const items = await fetchUserSuggestions(q)
          setMentionSuggestions(prev => ({ ...(prev || {}), [String(target)]: { visible: items && items.length > 0, items, query: q } }))
        } catch { /* noop */ }
      }, 220)
    } catch { /* noop */ }
  }

  // Obtener página específica de replies para un comentario y anexar al state
  const fetchRepliesPage = async (commentId, page = 1, forceRefresh = false) => {
    const cacheKey = `${commentId}_${page}`

    // Verificar caché
    if (!forceRefresh && repliesCacheRef.current[cacheKey]) {
      return repliesCacheRef.current[cacheKey]
    }

    // Evitar peticiones duplicadas
    if (repliesLoadingState[String(commentId)]) return

    try {
      setRepliesLoadingState(prev => ({ ...prev, [String(commentId)]: true }))
      const limit = REPLIES_PAGE_LIMIT
      const replies = await fetchCommentReplies(commentId, page, limit)
      if (!Array.isArray(replies)) return

      // Guardar en caché
      repliesCacheRef.current[cacheKey] = replies

      setDetailComments(prev => {
        return (prev || []).map(c => {
          if (!c) return c
          if (String(c.id ?? c._id) === String(commentId)) {
            const nextReplies = Array.isArray(c.replies) ? c.replies.slice() : []
            // si page === 1 sustituimos, si >1 concatenamos
            if (page === 1) return { ...c, replies: maybeSortComments(replies) }
            return { ...c, replies: maybeSortComments([...nextReplies, ...replies]) }
          }
          return c
        })
      })
      setReplyPages(prev => ({ ...(prev || {}), [String(commentId)]: { ...(prev && prev[String(commentId)]), page } }))
      return replies
    } catch { /* noop */ } finally {
      setRepliesLoadingState(prev => ({ ...prev, [String(commentId)]: false }))
    }
  }

  // Renderizado recursivo de replies con colapso por profundidad
  const renderRepliesRecursive = (replies, parentId, depth = 1) => {
    if (!Array.isArray(replies) || replies.length === 0) return null
    const collapsed = depth > MAX_REPLY_DEPTH && (repliesCollapsedByDepth[String(parentId)] !== false)
    if (collapsed) {
      return (
        <div style={{ marginLeft: 16 + (depth * 24), marginTop: 8 }}>
          <Button
            size="xs"
            variant="outline"
            onClick={() => setRepliesCollapsedByDepth(prev => ({ ...(prev || {}), [String(parentId)]: false }))}
            styles={{
              root: {
                borderColor: 'rgba(var(--accent-cyan), 0.3)',
                color: 'rgb(var(--accent-cyan))',
                '&:hover': {
                  backgroundColor: 'rgba(var(--accent-cyan), 0.08)',
                  borderColor: 'rgb(var(--accent-cyan))'
                }
              }
            }}
          >
            <IconMessage size={14} style={{ marginRight: 4 }} />
            Mostrar hilo completo ({replies.length})
          </Button>
        </div>
      )
    }

    // Sangría progresiva: cada nivel tiene más indentación (reducida para mejor uso del espacio)
    const indentation = 12 + (depth * 20)

    return (
      <div style={{ marginLeft: indentation, marginTop: 20 }}>
        {replies.map(r => (
          <div key={r.id} ref={(el) => { try { if (el) commentNodesRef.current[String(r.id)] = el; else delete commentNodesRef.current[String(r.id)]; } catch { /* noop */ } }} style={{ willChange: 'transform', marginTop: 18, marginBottom: 10, position: 'relative' }}>
            <UserBadges
              userStats={{
                streak: r.author?.streak || 0,
                totalChapters: r.author?.totalChapters || 0,
                comments: r.author?.comments || 0,
                nightReads: r.author?.nightReads || 0,
                maxChaptersPerHour: r.author?.maxChaptersPerHour || 0,
              }}
              maxBadges={3}
              size="compact"
              showTooltip={true}
            />
            <Card p={8} radius="md" style={{
              background: 'rgba(0,0,0,0.02)',
              border: '1px solid var(--border-color-subtle)',
              borderLeft: `3px solid rgba(var(--accent-cyan), ${Math.max(0.2, 0.7 - depth * 0.12)})`,
              position: 'relative',
            }}>
              {/* Acción: menú pegado arriba a la derecha en replies */}
              <div style={{ position: 'absolute', top: 6, right: 6, zIndex: 5 }}>
                <Menu withinPortal position="bottom-end" placement="end" withArrow>
                  <Menu.Target>
                    <ActionIcon size="xs" aria-label="Opciones" variant="subtle">
                      <IconDotsVertical size={14} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    {(canEditComment(r) || canDeleteComment(r)) ? (
                      <>
                        {canEditComment(r) && <Menu.Item onClick={() => openEditModal(r)}>Editar</Menu.Item>}
                        {canDeleteComment(r) && <Menu.Item color="red" onClick={() => handleDeleteComment(r.id)}>Eliminar</Menu.Item>}
                        <Menu.Item onClick={() => logger.debug('Reportar comentario', r.id)}>Reportar</Menu.Item>
                      </>
                    ) : (
                      <>
                        <Menu.Item onClick={() => logger.debug('Reportar comentario', r.id)}>Reportar</Menu.Item>
                      </>
                    )}
                  </Menu.Dropdown>
                </Menu>
              </div>
              <Group spacing={8} align="flex-start">
                <Avatar
                  name={r.author?.displayName || r.author?.username || 'Usuario'}
                  color="initials"
                  allowedInitialsColors={['blue', 'red', 'cyan', 'indigo', 'pink', 'violet']}
                  radius="xl"
                  size={20}
                  style={{ border: '1px solid var(--accent-cyan-0-12)' }}
                />
                <div style={{ flex: 1 }}>
                  <Group position="apart" style={{ alignItems: 'center' }}>
                    <Text
                      size="xs"
                      fw={600}
                      style={{ color: 'var(--text-color)' }}
                    >
                      {r.author?.displayName || r.author?.username}
                    </Text>
                    <Text size="xs" style={{ color: 'var(--dimmed-text)' }}>{formatTimeAgo(r.createdAt)}</Text>
                  </Group>
                  <div style={{ marginTop: 6, color: 'var(--text-color)', wordBreak: 'break-word' }}>
                    <Text size="sm" component="span">
                      {renderTruncatedContent(r.content, r.id, 300)}
                    </Text>
                  </div>

                  {/* Botón Responder */}
                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Button
                      size="xs"
                      variant="subtle"
                      compact
                      onClick={() => {
                        handleReply(r.author, parentId, r.id)
                        // Scroll suave al comentario después de un pequeño delay
                        setTimeout(() => {
                          try {
                            const node = commentNodesRef.current[String(r.id)]
                            if (node) node.scrollIntoView({ behavior: 'smooth', block: 'center' })
                          } catch { /* noop */ }
                        }, 100)
                      }}
                      styles={{
                        root: {
                          color: 'var(--dimmed-text)',
                          fontSize: '11px',
                          height: '20px',
                          padding: '0 8px',
                          '&:hover': {
                            color: 'rgb(var(--accent-cyan))',
                            background: 'rgba(var(--accent-cyan), 0.08)'
                          }
                        }
                      }}
                    >
                      <IconMessage size={12} style={{ marginRight: 4 }} />
                      Responder
                    </Button>
                    {depth >= MAX_REPLY_DEPTH && (
                      <Text size="xs" style={{ color: 'var(--dimmed-text)', fontStyle: 'italic' }}>
                        Nivel {depth}
                      </Text>
                    )}
                  </div>

                  {/* render replies of this reply recursively */}
                  {renderRepliesRecursive(r.replies || [], r.id, depth + 1)}
                </div>
              </Group>
            </Card>
          </div>
        ))}
        {/* Loading state */}
        {repliesLoadingState[String(parentId)] && (
          <div style={{ marginLeft: 12, marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Loader size="xs" color="cyan" />
            <Text size="xs" style={{ color: 'var(--dimmed-text)' }}>Cargando respuestas...</Text>
          </div>
        )}

        {/* paginado: si quedan páginas, mostrar botón */}
        {replyPages[String(parentId)] && replyPages[String(parentId)].page < (replyPages[String(parentId)].totalPages || 1) && !repliesLoadingState[String(parentId)] && (
          <div style={{ marginLeft: 12, marginTop: 8 }}>
            <Button
              size="xs"
              variant="subtle"
              onClick={async () => {
                const next = (replyPages[String(parentId)].page || 1) + 1
                await fetchRepliesPage(parentId, next)
              }}
              styles={{
                root: {
                  color: 'rgb(var(--accent-cyan))',
                  '&:hover': {
                    backgroundColor: 'rgba(var(--accent-cyan), 0.08)'
                  }
                }
              }}
            >
              <IconPlus size={12} style={{ marginRight: 4 }} />
              Cargar más respuestas
            </Button>
          </div>
        )}
      </div>
    )
  }

  useEffect(() => {
    if (detailRequest && detailRequest.id) {
      setDetailComments([])
      setDetailCommentsPage(1)
      // ordenar según configuración (Boost Temporal) en la carga inicial
      fetchRequestComments(detailRequest.id, 1, 50)
      // Removed autofocus to prevent mobile keyboard from popping up
      // setTimeout(() => {
      //   try { if (commentInputRef.current && typeof commentInputRef.current.focus === 'function') commentInputRef.current.focus() } catch { void 0 }
      // }, 140)
    } else {
      setDetailComments([])
      setDetailCommentsPagination(null)
    }
  }, [detailRequest])

  // Hide the "Nuevo comentario" button when user scrolls back to top
  useEffect(() => {
    const onScroll = () => {
      try {
        const c = commentsContainerRef.current
        const nearTop = c && typeof c.scrollTop === 'number' ? (c.scrollTop <= 120) : ((window.scrollY || window.pageYOffset || 0) <= 120)
        if (nearTop && showNewCommentBtn) setShowNewCommentBtn(false)
      } catch { /* noop */ }
    }
    try { window.addEventListener('scroll', onScroll, { passive: true }) } catch { window.addEventListener('scroll', onScroll) }
    const c = commentsContainerRef.current
    if (c && c.addEventListener) try { c.addEventListener('scroll', onScroll, { passive: true }) } catch { c.addEventListener('scroll', onScroll) }
    return () => {
      try { window.removeEventListener('scroll', onScroll) } catch { /* noop */ }
      if (c && c.removeEventListener) try { c.removeEventListener('scroll', onScroll) } catch { /* noop */ }
    }
  }, [showNewCommentBtn])

  // Conectar SSE para recibir comentarios en tiempo real
  useEffect(() => {
    if (!detailRequest || !detailRequest.id) return
    let es
    let onCreated
    let onReaction
    let onTyping
    try {
      const streamUrl = endpoint('comments', 'stream')
      try {
        es = new EventSource(streamUrl, { withCredentials: true })
      } catch {
        es = new EventSource(streamUrl)
      }
      onCreated = async (e) => {
        try {
          const data = JSON.parse(e.data)
          // Ignorar eventos ya procesados localmente (evita duplicados al crear respuestas)
          try {
            const evtId = String(data.id ?? data._id ?? '')
            if (evtId && processedCommentIdsRef.current && processedCommentIdsRef.current.has(evtId)) return
          } catch { /* noop */ }
          // Solo procesar si el evento corresponde a este request
          if (data && data.targetType === 'request' && String(data.targetId) === String(detailRequest.id)) {
            const sseAuthorFallback = user || (data.userId ? { id: data.userId } : null)
            const newC = {
              id: data.id,
              content: data.content,
              author: buildOptimisticAuthor(data.author, sseAuthorFallback),
              createdAt: data.createdAt,
              isSpoiler: !!data.isSpoiler,
              likesCount: 0
            }

            // If this is a reply, insert into the parent comment's replies instead of top-level
            let eventParentId = data.parentId ?? data.parent_id ?? null
            // If server SSE doesn't include parentId, try resolving it via GET /api/comments/:id
            if (!eventParentId) {
              try {
                const info = await api.get('comments', String(data.id))
                const commentInfo = (info && info.data && info.data.comment) ? info.data.comment : (info && info.comment) || null
                if (commentInfo) eventParentId = commentInfo.parentId ?? commentInfo.parent_id ?? null
              } catch { /* noop */ }
            }
            if (eventParentId) {
              setDetailComments(prev => {
                const list = prev || []
                // if a top-level comment already contains this reply, skip
                const already = list.some(c => (String(c.id ?? c._id) === String(eventParentId) && Array.isArray(c.replies) && c.replies.some(r => String(r.id) === String(data.id))) || (Array.isArray(c.replies) && c.replies.some(r => String(r.id) === String(data.id))))
                if (already) return prev

                // If parentId matches a top-level comment id, append to that comment's replies
                if (list.some(c => String(c.id ?? c._id) === String(eventParentId))) {
                  return list.map(c => {
                    const cid = String(c.id ?? c._id)
                    if (cid === String(eventParentId)) {
                      const nextReplies = Array.isArray(c.replies) ? c.replies.slice() : []
                      nextReplies.push(newC)
                      return { ...c, replies: maybeSortComments(nextReplies) }
                    }
                    return c
                  })
                }

                // Otherwise, find the top-level comment that contains a reply with id == eventParentId
                for (const c of list) {
                  if (Array.isArray(c.replies) && c.replies.some(r => String(r.id) === String(eventParentId))) {
                    return list.map(cc => {
                      if (String(cc.id ?? cc._id) !== String(c.id ?? c._id)) return cc
                      const nextReplies = Array.isArray(cc.replies) ? cc.replies.slice() : []
                      // insert after the matched reply
                      const idx = nextReplies.findIndex(r => String(r.id) === String(eventParentId))
                      if (idx === -1) {
                        nextReplies.push(newC)
                      } else {
                        nextReplies.splice(idx + 1, 0, newC)
                      }
                      return { ...cc, replies: maybeSortComments(nextReplies) }
                    })
                  }
                }

                // If we couldn't find the parent in current list, skip inserting to avoid creating a top-level duplicate.
                return list
              })
              try { const evtId = String(data.id ?? data._id ?? ''); if (evtId) processedCommentIdsRef.current.add(evtId) } catch { /* noop */ }
            } else {
              // top-level comment: normalize and insert using the same sorter (aplica Boost Temporal)
              try { const evtId = String(data.id ?? data._id ?? ''); if (evtId) processedCommentIdsRef.current.add(evtId) } catch { /* noop */ }
              const normalized = normalizeApiComment(newC)
              // Insert top-level comment only if it doesn't exist anywhere in current state
              setDetailComments(prev => {
                const now = prev || []
                const exists = now.some(cc => {
                  if (!cc) return false
                  if (String(cc.id ?? cc._id) === String(normalized.id)) return true
                  if (Array.isArray(cc.replies) && cc.replies.some(r => String(r.id) === String(normalized.id))) return true
                  return false
                })
                if (exists) return prev

                // detect if user is scrolled away from the top (reading "abajo")
                const c = commentsContainerRef.current
                const isNearTop = (() => {
                  try {
                    if (c && typeof c.scrollTop === 'number') {
                      return c.scrollTop <= 120
                    }
                    return (window.scrollY || window.pageYOffset || 0) <= 120
                  } catch { return true }
                })()

                const next = maybeSortComments(dedupeComments([normalized, ...now]))
                // if user is not near top, show floating "Nuevo comentario" button instead of forcing scroll
                if (!isNearTop) {
                  latestIncomingCommentRef.current = String(normalized.id)
                  try { setShowNewCommentBtn(true) } catch { /* noop */ }
                } else {
                  // if user is at top, ensure the new comment is visible immediately
                  try { setShowNewCommentBtn(false) } catch { /* noop */ }
                  // optional: scroll container to top to reveal new comment
                  try {
                    if (c && typeof c.scrollTop === 'number') c.scrollTop = 0
                    else window.scrollTo({ top: 0, behavior: 'smooth' })
                  } catch { /* noop */ }
                }
                return next
              })
            }
          }
        } catch { /* noop */ }
      }
      es.addEventListener('comment.created', onCreated)
      onReaction = (e) => {
        try {
          const data = JSON.parse(e.data)
          if (!data) return
          const cid = String(data.commentId || data.id || data.comment_id || data.comment)
          if (!cid) return
          // Actualizar conteos de forma autoritativa según el backend
          setDetailComments(prev => maybeSortComments((prev || []).map(c => {
            if (!c) return c
            if (String(c.id ?? c._id) !== cid) return c
            const likes = typeof data.likesCount !== 'undefined' ? data.likesCount : (data.likes || c.likesCount || 0)
            const dislikes = typeof data.dislikesCount !== 'undefined' ? data.dislikesCount : (data.dislikes || c.dislikesCount || 0)
            return { ...c, likesCount: likes, dislikesCount: dislikes }
          })))

          // Si el evento incluye la reacción del viewer o userId, sincronizar userReactions
          const viewerReaction = data.viewerReaction || data.reaction || data.action
          const eventUserId = data.userId || data.user_id || null
          if (viewerReaction && user && String(eventUserId) === String(user.id)) {
            setUserReactions(prev => ({ ...(prev || {}), [cid]: viewerReaction }))
          }
        } catch { /* noop */ }
      }
      es.addEventListener('comment.reaction', onReaction)
      onTyping = (e) => {
        try {
          const data = JSON.parse(e.data)
          if (!data) return
          // reuse existing incoming typing handler
          handleIncomingTyping(data)
        } catch { /* noop */ }
      }
      es.addEventListener('comment.typing', onTyping)
      es.addEventListener('open', () => { /* connection opened */ })
      es.addEventListener('error', (ev) => {
        // Silenciar error SSE - es opcional para la funcionalidad principal
        // console.warn('SSE connection error', ev)
        try { es && es.close() } catch { /* noop */ }
      })
      // remove listeners on cleanup handled below
    } catch {
      // SSE no disponible - continuar sin comentarios en tiempo real
      // console.warn('SSE no disponible')
    }
    return () => { try { if (es) { es.removeEventListener('comment.created', onCreated); es.removeEventListener('comment.reaction', onReaction); es.removeEventListener('comment.typing', onTyping); es.close() } } catch { void 0 } }
  }, [detailRequest, user])

  // Manejar like / dislike con actualización optimista y envío a un endpoint tipo webhook
  const handleReaction = async (commentId, type) => {
    let prevReaction
    try {
      if (!user) { openLogin(); return }
      const cid = String(commentId)
      prevReaction = userReactions[cid]
      const other = type === 'like' ? 'dislike' : 'like'
      // si el usuario hace click sobre su misma reacción, la acción real a enviar es 'remove'
      const actionToSend = (prevReaction === type) ? 'remove' : type

      // compute optimistic counts update
      setDetailComments(prevComments => {
        return (prevComments || []).map(c => {
          if (!c) return c
          if (String(c.id ?? c._id) !== cid) return c
          const likes = Number(c.likesCount || 0)
          const dislikes = Number(c.dislikesCount || 0)
          let nl = likes
          let nd = dislikes
          if (prevReaction === type) {
            // remove existing reaction
            if (type === 'like') nl = Math.max(0, likes - 1)
            else nd = Math.max(0, dislikes - 1)
          } else {
            // add this reaction
            if (type === 'like') nl = likes + 1
            else nd = dislikes + 1
            // if previously had the other, remove it
            if (prevReaction === other) {
              if (other === 'like') nl = Math.max(0, nl - 1)
              else nd = Math.max(0, nd - 1)
            }
          }
          return { ...c, likesCount: nl, dislikesCount: nd }
        })
      })

      // apply optimistic reaction state
      setUserReactions(prev => {
        const next = { ...(prev || {}) }
        if (prev && prev[cid] === type) delete next[cid]
        else next[cid] = type
        return next
      })

      // Encolar la acción para persistirla en background (rate-limited)
      try {
        queueReaction(cid, actionToSend)
      } catch (e) {
        // fallback: revertir optimista y reintentar fetch completo
        try {
          const cidStr = String(commentId)
          setUserReactions(prevMap => {
            const next = { ...(prevMap || {}) }
            if (typeof prevReaction === 'undefined') delete next[cidStr]
            else next[cidStr] = prevReaction
            return next
          })
          if (detailRequest && detailRequest.id) fetchRequestComments(detailRequest.id, detailCommentsPage, detailCommentsPagination?.limit || 50)
        } catch { /* noop */ }
        console.warn('Error encolando reacción', e)
      }
    } catch (err) {
      // revertir optimista en error: restaurar la reacción previa
      try {
        const cid = String(commentId)
        setUserReactions(prevMap => {
          const next = { ...(prevMap || {}) }
          if (typeof prevReaction === 'undefined') {
            delete next[cid]
          } else {
            next[cid] = prevReaction
          }
          return next
        })
        // Re-fetch comment list to reconcile counts (simple fallback)
        if (detailRequest && detailRequest.id) fetchRequestComments(detailRequest.id, detailCommentsPage, detailCommentsPagination?.limit || 50)
      } catch { /* noop */ }
      if (err && err.status === 401) { openLogin(); return }
      console.warn('Error enviando reacción', err)
    }
  }

  const handlePollVote = async (commentId, optionId) => {
    try {
      if (!user) {
        openLogin()
        return
      }

      const cid = String(commentId)

      // Verificar si ya votó
      if (userPollVotes[cid]) {
        return
      }

      // Actualizar estado local inmediatamente (optimistic UI)
      setUserPollVotes(prev => ({
        ...prev,
        [cid]: optionId
      }))

      // Enviar voto al backend
      try {
        const res = await api.post('comments', `${commentId}/poll/vote`, { option_id: optionId })

        // Actualizar el comentario con los datos reales del servidor
        if (res && res.data && res.data.poll) {
          const pollData = res.data.poll

          // Actualizar el comentario en el state
          setDetailComments(prev => {
            return prev.map(comment => {
              if (String(comment.id ?? comment._id) === cid) {
                return {
                  ...comment,
                  poll: pollData
                }
              }
              return comment
            })
          })

          // Asegurar que el voto del usuario esté registrado
          setUserPollVotes(prev => ({
            ...prev,
            [cid]: pollData.user_voted_option_id
          }))
        }
      } catch (err) {
        // Revertir en caso de error
        setUserPollVotes(prev => {
          const next = { ...prev }
          delete next[cid]
          return next
        })

        if (err && err.status === 401) {
          openLogin()
          return
        }

        // Si el error es que ya votó, recargar el comentario para obtener el estado correcto
        if (err && err.message && err.message.includes('Ya has votado')) {
          try {
            const commentRes = await api.get('comments', cid)
            if (commentRes && commentRes.data && commentRes.data.comment) {
              const updatedComment = commentRes.data.comment

              // Actualizar el comentario en el state
              setDetailComments(prev => {
                return prev.map(comment => {
                  if (String(comment.id ?? comment._id) === cid) {
                    return {
                      ...comment,
                      poll: updatedComment.poll
                    }
                  }
                  return comment
                })
              })

              // Actualizar el voto del usuario
              if (updatedComment.poll && updatedComment.poll.user_voted_option_id) {
                setUserPollVotes(prev => ({
                  ...prev,
                  [cid]: updatedComment.poll.user_voted_option_id
                }))
              }
            }
          } catch (refreshErr) {
            console.warn('Error refrescando comentario', refreshErr)
          }
        } else {
          console.warn('Error enviando voto de encuesta', err)
        }
      }
    } catch (err) {
      if (err && err.status === 401) {
        openLogin()
        return
      }
      console.warn('Error en handlePollVote', err)
    }
  }

  const handleSubmitComment = async () => {
    // Validar detailRequest
    const targetId = detailRequest?.id || detailRequest?.targetId;
    const targetType = detailRequest?.type || detailRequest?.targetType || 'request';

    if (!targetId) {
      console.error('No se puede enviar comentario: falta targetId');
      alert('Error: No se puede identificar el elemento a comentar');
      return;
    }

    // Validar que haya al menos contenido de texto O encuesta completa
    const hasValidText = commentText.trim().length >= MIN_COMMENT_LENGTH
    const hasValidPoll = isPollMode && pollQuestion.trim().length > 0 && pollOptions.filter(opt => opt.trim().length > 0).length >= 2

    if (!hasValidText && !hasValidPoll) {
      if (isPollMode) {
        alert('Completa la encuesta con una pregunta y al menos 2 opciones')
      } else {
        alert(`El comentario debe tener al menos ${MIN_COMMENT_LENGTH} caracteres`)
      }
      return
    }

    // Validar opciones de encuesta si está en modo encuesta
    if (isPollMode) {
      if (!pollQuestion.trim()) {
        alert('Debe escribir una pregunta para la encuesta')
        return
      }
      const validOptions = pollOptions.filter(opt => opt.trim().length > 0)
      if (validOptions.length < 2) {
        alert('Debe agregar al menos 2 opciones válidas para la encuesta')
        return
      }
    }

    setCommentSubmitting(true)
    try {
      // Si hay encuesta, el contenido debe ser solo el texto adicional (si lo hay)
      // La pregunta de la encuesta NO debe duplicarse en el contenido
      let content = commentText.trim()

      const payload = {
        targetType: targetType,
        targetId: targetId,
        content: content || '', // Si no hay contenido pero hay encuesta, dejar vacío
        isSpoiler: !!isSpoilerMode
      }

      // Agregar datos de encuesta si está activo
      if (isPollMode && pollQuestion.trim()) {
        const validOptions = pollOptions.filter(opt => opt.trim().length > 0)
        if (validOptions.length >= 2) {
          payload.poll = {
            question: pollQuestion.trim(),
            options: validOptions.map(opt => opt.trim())
          }
        }
      }

      if (replyingTo && replyingTo.id) payload.parentId = replyingTo.id
      const res = await api.post('comments', '', payload)
      // Try to use backend response to add the created comment locally (optimistic and secure)
      const created = res && res.data && res.data.comment ? res.data.comment : (res && res.comment) || null

      if (created) {
        const newComment = {
          id: created.id,
          content: created.content,
          author: buildOptimisticAuthor(created.author, user),
          createdAt: created.createdAt || new Date().toISOString(),
          isSpoiler: !!created.isSpoiler,
          poll: created.poll || null,
          likesCount: 0
        }

        if (payload.parentId) {
          // agregar la respuesta al comentario padre en el state
          setDetailComments(prev => {
            return (prev || []).map(c => {
              if (!c) return c
              const cid = c.id ?? c._id
              if (String(cid) === String(payload.parentId)) {
                const nextReplies = Array.isArray(c.replies) ? c.replies.slice() : []
                // insertar la nueva respuesta al final (orden ascendente por createdAt en replies endpoint)
                nextReplies.push(newComment)
                return { ...c, replies: maybeSortComments(nextReplies) }
              }
              return c
            })
          })
          try { processedCommentIdsRef.current.add(String(newComment.id)) } catch { /* noop */ }
          // mostrar las respuestas del comentario padre tras responder
          try { setRepliesVisible(prev => ({ ...prev, [payload.parentId]: true })) } catch { /* noop */ }
        } else {
          // Prepend the newly created top-level comment and avoid re-sorting immediately
          setDetailComments(prev => dedupeComments([newComment, ...(prev || [])]))
          try { processedCommentIdsRef.current.add(String(newComment.id)) } catch { /* noop */ }
        }
      }

      setCommentText('')
      setCommentSuccess(true)
      setIsSpoilerMode(false)
      setIsPollMode(false)
      setPollQuestion('')
      setPollOptions(['', ''])
      setTimeout(() => setCommentSuccess(false), 1400)
    } catch (err) {
      if (err && err.status === 401) { openLogin(); return }
      console.warn('Error enviando comentario', err)
    } finally {
      setCommentSubmitting(false)
    }
  }

  return (
    <div style={{ marginTop: 24, position: 'relative' }}>

      {/* Header con Contador Refinado */}
      <Group position="apart" mb="lg">
        <Group spacing={12}>
          <div style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            background: 'linear-gradient(135deg, var(--accent-cyan-0-15) 0%, var(--accent-cyan-0-05) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--accent-cyan-0-2)',
            boxShadow: '0 2px 8px var(--accent-cyan-0-1)'
          }}>
            <IconMessage size={22} color="rgb(var(--accent-cyan))" />
          </div>
          <div>
            <Text fw={700} size="lg" style={{ color: 'var(--text-color)', letterSpacing: '-0.01em' }}>
              Comentarios
            </Text>
          </div>
        </Group>

        {detailComments.length > 0 && (
          <Badge
            size="lg"
            variant="filled"
            styles={{
              root: {
                backgroundColor: 'var(--accent-cyan-0-1)',
                color: 'rgb(var(--accent-cyan))',
                border: '1px solid var(--accent-cyan-0-25)',
                fontWeight: 600,
                fontSize: '13px',
                padding: '0 14px',
                height: 28,
                boxShadow: '0 2px 8px var(--accent-cyan-0-1)'
              }
            }}
          >
            {detailComments.length}
          </Badge>
        )}
      </Group>

      {/* Input de Comentario Premium */}
      <div style={{
        marginBottom: 28,
        padding: 16,
        background: 'linear-gradient(135deg, var(--subtle-bg-hover) 0%, var(--subtle-bg) 100%)',
        borderRadius: 16,
        border: `1px solid var(--border-color-subtle)`,
        boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.04), 0 2px 12px rgba(0, 0, 0, 0.03)',
        transition: 'all 0.3s ease',
        position: 'relative'
      }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          {user && (
            <Avatar
              name={username || user?.username || user?.displayName || 'Usuario'}
              color="initials"
              allowedInitialsColors={['blue', 'red', 'cyan', 'indigo', 'pink', 'violet']}
              radius="xl"
              size={28}
              style={{
                border: '2px solid var(--accent-cyan-0-3)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                flexShrink: 0
              }}
            />
          )}
          <div style={{ flex: 1 }}>
            <Textarea
              placeholder="Comparte tu opinión sobre esta serie..."
              minRows={3}
              variant="unstyled"
              value={commentText}
              ref={commentInputRef}
              onChange={(e) => {
                setCommentText(e.currentTarget.value);
                checkForMentionToken(e.currentTarget.value, 'main');
                try {
                  const k = 'main'
                  if (typingDebounceRef.current[k]) clearTimeout(typingDebounceRef.current[k])
                  typingDebounceRef.current[k] = setTimeout(() => { try { sendTyping() } catch { /* noop */ }; try { delete typingDebounceRef.current[k] } catch { /* noop */ } }, 700)
                } catch { /* noop */ }
              }}
              maxLength={MAX_COMMENT_LENGTH}
              disabled={commentSubmitting}
              aria-busy={commentSubmitting}
              styles={{
                input: {
                  fontSize: '14px',
                  color: 'var(--text-color)',
                  padding: '4px 0',
                  lineHeight: 1.6,
                  '&::placeholder': {
                    color: 'var(--dimmed-text)',
                    opacity: 0.7
                  }
                }
              }}
            />
            {typingCount > 0 && (
              <div style={{ marginTop: 8 }}>
                <Text size="sm" color="dimmed">{typingCount === 1 ? '1 persona está escribiendo...' : `${typingCount} personas están escribiendo...`}</Text>
              </div>
            )}
            {mentionSuggestions['main'] && mentionSuggestions['main'].visible && (
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: 0, top: 6, background: 'var(--subtle-bg)', border: '1px solid var(--border-color-subtle)', borderRadius: 8, zIndex: 60, minWidth: 220, boxShadow: '0 6px 18px rgba(0,0,0,0.06)' }}>
                  {(mentionSuggestions['main'].items || []).map((it) => (
                    <div key={it.value} onMouseDown={(e) => { e.preventDefault(); applyMentionSuggestion(it.value, 'main') }} style={{ padding: '8px 10px', cursor: 'pointer' }}>
                      <div style={{ fontWeight: 600 }}>{it.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--dimmed-text)' }}>@{it.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {replyingTo && (
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ background: 'var(--subtle-bg-hover)', padding: '6px 10px', borderRadius: 999, border: '1px solid var(--border-color-subtle)', color: 'var(--dimmed-text)', fontSize: 13 }}>
                  Respondiendo a <span style={{ color: 'rgb(var(--accent-cyan))' }}>@{replyingTo.username}</span>
                </div>
                <Button size="xs" variant="subtle" onClick={() => {
                  setReplyingTo(null)
                  setCommentText(prev => {
                    try {
                      const cur = String(prev || '')
                      const mention = `@${replyingTo.username} `
                      if (cur.startsWith(mention)) return cur.slice(mention.length)
                      return cur
                    } catch { return prev }
                  })
                }}>Cancelar</Button>
              </div>
            )}
          </div>
        </div>

        {/* Creador de Encuesta */}
        {isPollMode && (
          <div style={{
            marginTop: 12,
            padding: 20,
            background: 'linear-gradient(135deg, rgba(var(--accent-cyan), 0.04) 0%, rgba(var(--accent-cyan), 0.01) 100%)',
            borderRadius: 16,
            border: '1.5px solid rgba(var(--accent-cyan), 0.15)',
            boxShadow: '0 4px 12px rgba(var(--accent-cyan), 0.08)',
            transition: 'all 0.3s ease'
          }}>
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 16,
              paddingBottom: 12,
              borderBottom: '1px solid rgba(var(--accent-cyan), 0.1)'
            }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'linear-gradient(135deg, rgba(var(--accent-cyan), 0.15) 0%, rgba(var(--accent-cyan), 0.05) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(var(--accent-cyan), 0.1)'
              }}>
                <IconChartBar size={20} style={{ color: 'rgb(var(--accent-cyan))' }} />
              </div>
              <Text size="sm" fw={600} style={{ color: 'var(--text-color)' }}>Crear Encuesta</Text>
            </div>

            {/* Pregunta */}
            <TextInput
              placeholder="Escribe tu pregunta..."
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value)}
              maxLength={300}
              styles={{
                root: { marginBottom: 14 },
                input: {
                  background: 'var(--card-bg)',
                  border: '1.5px solid var(--border-color-subtle)',
                  borderRadius: 10,
                  padding: '12px 14px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'var(--text-color)',
                  transition: 'all 0.2s ease',
                  '&:focus': {
                    borderColor: 'rgba(var(--accent-cyan), 0.5)',
                    boxShadow: '0 0 0 3px rgba(var(--accent-cyan), 0.1)'
                  },
                  '&::placeholder': {
                    color: 'var(--dimmed-text)',
                    opacity: 0.6
                  }
                }
              }}
            />

            {/* Opciones */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pollOptions.map((option, index) => (
                <div key={index} style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'center',
                  animation: 'fadeIn 0.3s ease'
                }}>
                  <div style={{
                    minWidth: 24,
                    height: 24,
                    borderRadius: 6,
                    background: 'rgba(var(--accent-cyan), 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'rgb(var(--accent-cyan))'
                  }}>
                    {index + 1}
                  </div>
                  <TextInput
                    placeholder={`Opción ${index + 1}`}
                    value={option}
                    onChange={(e) => {
                      const newOptions = [...pollOptions]
                      newOptions[index] = e.target.value
                      setPollOptions(newOptions)
                    }}
                    maxLength={150}
                    style={{ flex: 1 }}
                    styles={{
                      input: {
                        background: 'var(--card-bg)',
                        border: '1.5px solid var(--border-color-subtle)',
                        borderRadius: 10,
                        padding: '10px 12px',
                        fontSize: '13px',
                        color: 'var(--text-color)',
                        transition: 'all 0.2s ease',
                        '&:focus': {
                          borderColor: 'rgba(var(--accent-cyan), 0.5)',
                          boxShadow: '0 0 0 3px rgba(var(--accent-cyan), 0.1)'
                        },
                        '&::placeholder': {
                          color: 'var(--dimmed-text)',
                          opacity: 0.5
                        }
                      }
                    }}
                  />
                  {/* Botón eliminar (solo si hay más de 2 opciones) */}
                  {pollOptions.length > 2 && (
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      size="md"
                      onClick={() => {
                        setPollOptions(pollOptions.filter((_, i) => i !== index))
                      }}
                      style={{
                        transition: 'all 0.2s ease',
                        borderRadius: 8
                      }}
                    >
                      <IconX size={16} />
                    </ActionIcon>
                  )}
                </div>
              ))}
            </div>

            {/* Botón agregar opción */}
            {pollOptions.length < 5 && (
              <Button
                variant="light"
                size="xs"
                leftSection={<IconPlus size={14} />}
                onClick={() => setPollOptions([...pollOptions, ''])}
                mt={12}
                styles={{
                  root: {
                    background: 'rgba(var(--accent-cyan), 0.08)',
                    color: 'rgb(var(--accent-cyan))',
                    border: '1.5px dashed rgba(var(--accent-cyan), 0.3)',
                    borderRadius: 8,
                    fontWeight: 600,
                    fontSize: '12px',
                    padding: '8px 14px',
                    height: 'auto',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      background: 'rgba(var(--accent-cyan), 0.12)',
                      borderColor: 'rgba(var(--accent-cyan), 0.5)',
                      transform: 'translateY(-1px)'
                    }
                  }
                }}
              >
                Agregar opción
              </Button>
            )}

            {/* Info */}
            <div style={{
              marginTop: 14,
              paddingTop: 14,
              borderTop: '1px solid rgba(var(--accent-cyan), 0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}>
              <div style={{
                width: 4,
                height: 4,
                borderRadius: '50%',
                background: 'rgba(var(--accent-cyan), 0.5)'
              }} />
              <Text size="xs" c="dimmed" style={{ fontSize: '11px', lineHeight: 1.4 }}>
                Mínimo 2 opciones, máximo 5. Los votos son permanentes.
              </Text>
            </div>
          </div>
        )}

        {/* Nota: loader global eliminado; el loader permanece en el botón */}

        {/* Divider sutil */}
        <div style={{
          height: 1,
          background: 'linear-gradient(90deg, transparent, var(--border-color-subtle), transparent)',
          margin: '12px 0'
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <Tooltip label={isSpoilerMode ? "Quitar spoiler" : "Marcar como spoiler"} withArrow>
                <ActionIcon
                  variant="light"
                  size="lg"
                  onClick={() => setIsSpoilerMode(s => !s)}
                  style={{
                    background: isSpoilerMode ? 'rgba(251, 191, 36, 0.12)' : 'transparent',
                    color: isSpoilerMode ? 'rgb(251, 191, 36)' : 'var(--dimmed-text)',
                    border: isSpoilerMode ? '1.5px solid rgba(251, 191, 36, 0.3)' : '1.5px solid var(--border-color-subtle)',
                    borderRadius: 8,
                    transition: 'all 0.2s ease'
                  }}
                >
                  {isSpoilerMode ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                </ActionIcon>
              </Tooltip>
              <Tooltip label={isPollMode ? "Quitar encuesta" : "Agregar encuesta"} withArrow>
                <ActionIcon
                  variant="light"
                  size="lg"
                  onClick={() => {
                    setIsPollMode(s => !s)
                    if (!isPollMode) {
                      setPollQuestion('')
                      setPollOptions(['', ''])
                    }
                  }}
                  style={{
                    background: isPollMode ? 'rgba(var(--accent-cyan), 0.12)' : 'transparent',
                    color: isPollMode ? 'rgb(var(--accent-cyan))' : 'var(--dimmed-text)',
                    border: isPollMode ? '1.5px solid rgba(var(--accent-cyan), 0.3)' : '1.5px solid var(--border-color-subtle)',
                    borderRadius: 8,
                    transition: 'all 0.2s ease'
                  }}
                >
                  <IconChartBar size={18} />
                </ActionIcon>
              </Tooltip>
            </div>

            {isTooShort && trimmedLength > 0 && (
              <Text size="xs" style={{
                color: 'rgb(var(--accent-amber))',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                marginLeft: 6
              }}>
                <IconAlertCircle size={12} />
                Mín. {MIN_COMMENT_LENGTH} caracteres
              </Text>
            )}
            {isTooLong && (
              <Text size="xs" style={{
                color: 'rgb(var(--accent-red))',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                marginLeft: 6
              }}>
                <IconAlertCircle size={12} />
                Límite excedido
              </Text>
            )}
          </div>

          <Button
            size="sm"
            radius="xl"
            leftSection={<IconSend size={15} style={{ marginRight: -2 }} />}
            onClick={async () => { if (!user) { openLogin(); return } await handleSubmitComment() }}
            disabled={user ? (!canSubmit || commentSubmitting) : false}
            loading={commentSubmitting}
            style={{
              background: !user
                ? 'linear-gradient(135deg, rgb(var(--accent-cyan)) 0%, rgba(var(--accent-cyan), 0.9) 100%)'
                : (canSubmit && !commentSubmitting
                  ? 'linear-gradient(135deg, rgb(var(--accent-cyan)) 0%, rgba(var(--accent-cyan), 0.9) 100%)'
                  : 'var(--subtle-bg-hover)'),
              color: !user ? '#ffffff' : (canSubmit ? '#ffffff' : 'var(--dimmed-text)'),
              border: 'none',
              fontWeight: 600,
              padding: '0 16px',
              height: 36,
              flexShrink: 0,
              marginLeft: 8,
              boxShadow: (canSubmit || !user) ? '0 6px 16px rgba(6,182,212,0.12)' : 'none',
              transition: 'transform 120ms ease, box-shadow 120ms ease'
            }}
          >
            {commentSubmitting ? 'Enviando...' : (commentSuccess ? (
              <>
                <IconCheck size={14} style={{ marginRight: 8, color: 'rgb(var(--accent-green))' }} />
                Publicado
              </>
            ) : (!user ? 'Iniciar sesión' : 'Publicar'))}
          </Button>
        </div>
      </div>

      {/* Filtros de Comentarios */}
      {detailComments.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '16px 0',
          borderBottom: '1px solid var(--border-color-subtle)',
          marginTop: 8
        }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <Button
              variant={commentFilter === 'newest' ? 'filled' : 'subtle'}
              size="xs"
              onClick={() => setCommentFilter('newest')}
              styles={{
                root: {
                  background: commentFilter === 'newest' ? 'linear-gradient(135deg, rgb(var(--accent-cyan)) 0%, rgba(var(--accent-cyan), 0.9) 100%)' : 'transparent',
                  color: commentFilter === 'newest' ? '#ffffff' : 'var(--dimmed-text)',
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: '12px',
                  padding: commentFilter === 'newest' ? '6px 12px' : '6px 8px',
                  height: 30,
                  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: 'scale(1)',
                  '&:hover': {
                    background: commentFilter === 'newest' ? 'linear-gradient(135deg, rgb(var(--accent-cyan)) 0%, rgba(var(--accent-cyan), 0.85) 100%)' : 'var(--subtle-bg)',
                    transform: 'scale(1.05)'
                  }
                }
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
              }}>
                <IconSparkles size={16} style={{
                  transition: 'margin-right 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  marginRight: commentFilter === 'newest' ? 6 : 0
                }} />
                <span style={{
                  maxWidth: commentFilter === 'newest' ? '100px' : '0',
                  overflow: 'hidden',
                  opacity: commentFilter === 'newest' ? 1 : 0,
                  transition: 'max-width 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease',
                  whiteSpace: 'nowrap'
                }}>
                  Más nuevos
                </span>
              </div>
            </Button>
            <Button
              variant={commentFilter === 'popular' ? 'filled' : 'subtle'}
              size="xs"
              onClick={() => setCommentFilter('popular')}
              styles={{
                root: {
                  background: commentFilter === 'popular' ? 'linear-gradient(135deg, rgb(var(--accent-cyan)) 0%, rgba(var(--accent-cyan), 0.9) 100%)' : 'transparent',
                  color: commentFilter === 'popular' ? '#ffffff' : 'var(--dimmed-text)',
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: '12px',
                  padding: commentFilter === 'popular' ? '6px 12px' : '6px 8px',
                  height: 30,
                  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: 'scale(1)',
                  '&:hover': {
                    background: commentFilter === 'popular' ? 'linear-gradient(135deg, rgb(var(--accent-cyan)) 0%, rgba(var(--accent-cyan), 0.85) 100%)' : 'var(--subtle-bg)',
                    transform: 'scale(1.05)'
                  }
                }
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
              }}>
                <IconTrendingUp size={16} style={{
                  transition: 'margin-right 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  marginRight: commentFilter === 'popular' ? 6 : 0
                }} />
                <span style={{
                  maxWidth: commentFilter === 'popular' ? '100px' : '0',
                  overflow: 'hidden',
                  opacity: commentFilter === 'popular' ? 1 : 0,
                  transition: 'max-width 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease',
                  whiteSpace: 'nowrap'
                }}>
                  Populares
                </span>
              </div>
            </Button>
            <Button
              variant={commentFilter === 'oldest' ? 'filled' : 'subtle'}
              size="xs"
              onClick={() => setCommentFilter('oldest')}
              styles={{
                root: {
                  background: commentFilter === 'oldest' ? 'linear-gradient(135deg, rgb(var(--accent-cyan)) 0%, rgba(var(--accent-cyan), 0.9) 100%)' : 'transparent',
                  color: commentFilter === 'oldest' ? '#ffffff' : 'var(--dimmed-text)',
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: '12px',
                  padding: commentFilter === 'oldest' ? '6px 12px' : '6px 8px',
                  height: 30,
                  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: 'scale(1)',
                  '&:hover': {
                    background: commentFilter === 'oldest' ? 'linear-gradient(135deg, rgb(var(--accent-cyan)) 0%, rgba(var(--accent-cyan), 0.85) 100%)' : 'var(--subtle-bg)',
                    transform: 'scale(1.05)'
                  }
                }
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
              }}>
                <IconHistory size={16} style={{
                  transition: 'margin-right 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  marginRight: commentFilter === 'oldest' ? 6 : 0
                }} />
                <span style={{
                  maxWidth: commentFilter === 'oldest' ? '100px' : '0',
                  overflow: 'hidden',
                  opacity: commentFilter === 'oldest' ? 1 : 0,
                  transition: 'max-width 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease',
                  whiteSpace: 'nowrap'
                }}>
                  Más antiguos
                </span>
              </div>
            </Button>
          </div>
        </div>
      )}

      {/* Listado de Comentarios */}
      {detailCommentsLoading ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 0',
          gap: 12
        }}>
          <Loader size="md" color="cyan" variant="dots" />
          <Text size="sm" style={{ color: 'var(--dimmed-text)' }}>Cargando comentarios...</Text>
        </div>
      ) : (
        <div
          ref={commentsContainerRef}
          style={{
            overflowY: 'visible',
            paddingRight: 8
          }}
        >
          <Stack spacing="md">
            {detailComments.length === 0 && (
              <div style={{
                textAlign: 'center',
                padding: '60px 30px',
                background: 'linear-gradient(135deg, var(--subtle-bg-hover) 0%, transparent 100%)',
                borderRadius: 16,
                border: '1px dashed var(--border-color-subtle)'
              }}>
                <div style={{
                  width: 64,
                  height: 64,
                  borderRadius: 16,
                  background: 'var(--accent-cyan-0-08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px'
                }}>
                  <IconMessage size={28} style={{ color: 'rgb(var(--accent-cyan))', opacity: 0.6 }} />
                </div>
                <Text fw={600} size="md" style={{ color: 'var(--text-color)', marginBottom: 6 }}>
                  Sin comentarios aún
                </Text>
                <Text c="dimmed" size="sm" style={{ maxWidth: 280, margin: '0 auto' }}>
                  ¡Sé el primero en compartir tu opinión sobre esta serie!
                </Text>
              </div>
            )}

            {(() => {
              // Filtrar y ordenar comentarios según el filtro seleccionado
              let filteredComments = [...detailComments]

              if (commentFilter === 'newest') {
                // Más nuevos primero (orden descendente por fecha)
                filteredComments.sort((a, b) => {
                  const dateA = new Date(a.createdAt || 0).getTime()
                  const dateB = new Date(b.createdAt || 0).getTime()
                  return dateB - dateA
                })
              } else if (commentFilter === 'popular') {
                // Más populares primero (por likes - dislikes)
                filteredComments.sort((a, b) => {
                  const scoreA = (a.likesCount || 0) - (a.dislikesCount || 0)
                  const scoreB = (b.likesCount || 0) - (b.dislikesCount || 0)
                  return scoreB - scoreA
                })
              } else if (commentFilter === 'oldest') {
                // Más antiguos primero (orden ascendente por fecha)
                filteredComments.sort((a, b) => {
                  const dateA = new Date(a.createdAt || 0).getTime()
                  const dateB = new Date(b.createdAt || 0).getTime()
                  return dateA - dateB
                })
              }

              return filteredComments.map((c, index) => (
                <div
                  key={c.id}
                  ref={(el) => { try { if (el) commentNodesRef.current[String(c.id)] = el; else delete commentNodesRef.current[String(c.id)]; } catch { /* noop */ } }}
                  style={{ willChange: 'transform', position: 'relative', marginTop: index === 0 ? 20 : 20 }}
                >
                  <UserBadges
                    userStats={{
                      streak: c.author?.streak || 0,
                      totalChapters: c.author?.totalChapters || 0,
                      comments: c.author?.comments || 0,
                      nightReads: c.author?.nightReads || 0,
                      maxChaptersPerHour: c.author?.maxChaptersPerHour || 0,
                    }}
                    maxBadges={3}
                    size="compact"
                    showTooltip={true}
                  />
                  <Card
                    p={0}
                    radius="lg"
                    style={{
                      background: 'linear-gradient(135deg, var(--subtle-bg) 0%, rgba(var(--accent-cyan), 0.01) 100%)',
                      border: `1px solid var(--border-color-subtle)`,
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      animation: `fadeInUp 0.4s ease ${index * 0.05}s both`,
                    }}
                    className="comment-card"
                  >
                    
                    <div style={{ padding: 10, position: 'relative' }}>
                      {/* Acción: menú pegado arriba a la derecha */}
                      <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 6 }}>
                        <Menu withinPortal position="bottom-end" placement="end" withArrow>
                          <Menu.Target>
                            <ActionIcon size="sm" aria-label="Opciones" variant="subtle">
                              <IconDotsVertical size={18} />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            {(canEditComment(c) || canDeleteComment(c)) ? (
                              <>
                                {canEditComment(c) && <Menu.Item onClick={() => openEditModal(c)}>Editar</Menu.Item>}
                                {canDeleteComment(c) && <Menu.Item color="red" onClick={() => handleDeleteComment(c.id)}>Eliminar</Menu.Item>}
                                <Menu.Item onClick={() => logger.debug('Reportar comentario', c.id)}>Reportar</Menu.Item>
                              </>
                            ) : (
                              <>
                                <Menu.Item onClick={() => logger.debug('Reportar comentario', c.id)}>Reportar</Menu.Item>
                              </>
                            )}
                          </Menu.Dropdown>
                        </Menu>
                      </div>
                      <Group align="flex-start" spacing={14} style={{ flexWrap: 'nowrap' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Group position="apart" mb={6} style={{ flexWrap: 'nowrap', alignItems: 'center' }}>
                            <Group spacing={8} style={{ flexWrap: 'nowrap', alignItems: 'center' }}>
                              <div style={{ position: 'relative' }}>
                                <Avatar
                                  name={c.author?.displayName || c.author?.username || 'Usuario'}
                                  color="initials"
                                  allowedInitialsColors={['blue', 'red', 'cyan', 'indigo', 'pink', 'violet']}
                                  radius="xl"
                                  size={30}
                                  style={{
                                    border: '2px solid var(--accent-cyan-0-25)',
                                    boxShadow: '0 3px 10px rgba(0, 0, 0, 0.08)'
                                  }}
                                />
                                {c.author?.isOnline && (
                                  <div style={{
                                    position: 'absolute',
                                    bottom: 0,
                                    right: 0,
                                    width: 10,
                                    height: 10,
                                    borderRadius: '50%',
                                    background: 'rgb(var(--accent-green))',
                                    border: '2px solid var(--subtle-bg)'
                                  }} />
                                )}
                              </div>

                              <Text
                                fw={600}
                                size="sm"
                                role="button"
                                tabIndex={0}
                                onClick={() => handleReply(c.author, c.id ?? c._id)}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleReply(c.author, c.id ?? c._id) } }}
                                style={{
                                  color: 'var(--text-color)',
                                  cursor: 'pointer',
                                  transition: 'color 0.15s ease'
                                }}
                              >
                                {c.author?.displayName || c.author?.username}
                              </Text>
                            </Group>

                            <Group spacing={6} style={{ flexWrap: 'nowrap', alignItems: 'center' }}>
                              <Text size="xs" style={{ color: 'var(--dimmed-text)', whiteSpace: 'nowrap' }}>
                                {formatTimeAgo(c.createdAt)}
                              </Text>
                            </Group>
                          </Group>

                          <div style={{ marginLeft: 19 }}>
                            {c.isSpoiler ? (
                              <div style={{ position: 'relative' }}>
                                <div
                                  onClick={() => toggleReveal(c.id)}
                                  style={{
                                    filter: revealedComments[c.id] ? 'none' : 'blur(4px)',
                                    transition: 'filter 220ms ease',
                                    cursor: revealedComments[c.id] ? 'text' : 'pointer'
                                  }}
                                >
                                  <Text
                                    size="sm"
                                    style={{
                                      lineHeight: 1.65,
                                      color: 'var(--text-color)',
                                      opacity: 0.88,
                                      wordBreak: 'break-word'
                                    }}
                                  >
                                    {renderContentWithMentions(c.content, c.id)}
                                  </Text>
                                </div>

                                {!revealedComments[c.id] && (
                                  <div
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => toggleReveal(c.id)}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleReveal(c.id) } }}
                                    style={{
                                      position: 'absolute',
                                      top: 8,
                                      right: 8,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      pointerEvents: 'auto'
                                    }}
                                  >
                                    <div style={{
                                      background: 'rgba(0,0,0,0.45)',
                                      color: '#fff',
                                      padding: '6px 10px',
                                      borderRadius: 999,
                                      display: 'flex',
                                      gap: 8,
                                      alignItems: 'center',
                                      fontSize: 13
                                    }}>
                                      <IconEye size={14} />
                                      Spoiler
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <>
                                <div style={{
                                  lineHeight: 1.65,
                                  color: 'var(--text-color)',
                                  opacity: 0.88,
                                  wordBreak: 'break-word'
                                }}>
                                  <Text size="sm" component="span">
                                    {renderTruncatedContent(c.content, c.id, 400)}
                                  </Text>
                                </div>

                                {/* Renderizado de encuesta */}
                                {c.poll && c.poll.options && (
                                  <div style={{ marginTop: 16, padding: 16, background: 'var(--subtle-bg)', borderRadius: 12, border: '1px solid var(--border-color-subtle)' }}>
                                    {/* Pregunta */}
                                    {c.poll.question && (
                                      <Text fw={600} size="sm" mb={12} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8
                                      }}>
                                        <IconChartBar size={16} style={{ color: 'rgb(var(--accent-cyan))' }} />
                                        {c.poll.question}
                                      </Text>
                                    )}

                                    {/* Opciones */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                      {c.poll.options.map((option) => {
                                        const commentId = String(c.id ?? c._id)
                                        const optionId = option.id
                                        const optionText = option.text || option

                                        // Usar datos del backend si están disponibles
                                        const hasVoted = c.poll.user_voted || userPollVotes[commentId]
                                        const userVotedOptionId = c.poll.user_voted_option_id || userPollVotes[commentId]
                                        const isUserChoice = userVotedOptionId === optionId

                                        // Los resultados solo se muestran si el usuario votó
                                        const voteCount = option.vote_count
                                        const percentage = option.percentage || 0

                                        return (
                                          <div
                                            key={optionId}
                                            onClick={() => {
                                              if (!user) {
                                                openLogin()
                                                return
                                              }
                                              if (!hasVoted) {
                                                handlePollVote(commentId, optionId)
                                              }
                                            }}
                                            style={{
                                              padding: '10px 14px',
                                              borderRadius: 8,
                                              border: isUserChoice ? '1px solid rgb(var(--accent-cyan))' : '1px solid var(--border-color-subtle)',
                                              background: isUserChoice ? 'rgba(var(--accent-cyan), 0.1)' : 'var(--card-bg)',
                                              cursor: hasVoted ? 'default' : 'pointer',
                                              transition: 'all 0.2s ease',
                                              position: 'relative',
                                              overflow: 'hidden'
                                            }}
                                          >
                                            {/* Barra de progreso (solo visible después de votar) */}
                                            {hasVoted && voteCount !== null && (
                                              <div
                                                style={{
                                                  position: 'absolute',
                                                  left: 0,
                                                  top: 0,
                                                  height: '100%',
                                                  width: `${percentage || 0}%`,
                                                  background: isUserChoice
                                                    ? 'rgba(var(--accent-cyan), 0.2)'
                                                    : 'rgba(var(--accent-cyan), 0.08)',
                                                  transition: 'width 0.5s ease',
                                                  zIndex: 0
                                                }}
                                              />
                                            )}

                                            <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                              <Text size="sm" style={{ color: isUserChoice ? 'rgb(var(--accent-cyan))' : 'var(--text-color)' }}>
                                                {optionText}
                                              </Text>

                                              {/* Porcentaje (solo si ya votó) */}
                                              {hasVoted && voteCount !== null && (
                                                <Text size="sm" fw={600} style={{
                                                  color: isUserChoice ? 'rgb(var(--accent-cyan))' : 'var(--dimmed-text)'
                                                }}>
                                                  {percentage}%
                                                </Text>
                                              )}
                                            </div>
                                          </div>
                                        )
                                      })}
                                    </div>

                                    {/* Total de votos (solo si ya votó) */}
                                    {(() => {
                                      const hasVoted = c.poll.user_voted || userPollVotes[String(c.id ?? c._id)]
                                      const totalVotes = c.poll.total_votes || 0

                                      return hasVoted && c.poll.options.some(opt => opt.vote_count !== null) ? (
                                        <Text size="xs" c="dimmed" mt={8}>
                                          {totalVotes} voto{totalVotes !== 1 ? 's' : ''}
                                        </Text>
                                      ) : null
                                    })()}
                                  </div>
                                )}
                              </>
                            )}
                          </div>

                          {/* Acciones del comentario */}
                          <Group spacing={16} mt={12} style={{ marginLeft: 10, alignItems: 'center' }}>
                            <Text
                              size="xs"
                              role="button"
                              tabIndex={0}
                              onClick={() => handleReply(c.author, c.id ?? c._id)}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleReply(c.author, c.id ?? c._id) } }}
                              style={{
                                color: 'var(--dimmed-text)',
                                cursor: 'pointer',
                                opacity: 0.6,
                                transition: 'all 0.2s ease'
                              }}
                            >
                              Responder
                            </Text>

                            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                              <div
                                role="button"
                                tabIndex={0}
                                aria-label="Me gusta"
                                aria-pressed={userReactions[String(c.id ?? c._id)] === 'like'}
                                onClick={() => handleReaction(c.id ?? c._id, 'like')}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleReaction(c.id ?? c._id, 'like') } }}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  padding: '4px 8px',
                                  borderRadius: 8,
                                  background: userReactions[String(c.id ?? c._id)] === 'like' ? 'linear-gradient(135deg, rgba(6,182,212,0.06), rgba(6,182,212,0.02))' : 'linear-gradient(180deg, rgba(255,255,255,0.015), rgba(0,0,0,0.02))',
                                  border: userReactions[String(c.id ?? c._id)] === 'like' ? '1px solid rgba(6,182,212,0.12)' : '1px solid rgba(255,255,255,0.04)',
                                  boxShadow: userReactions[String(c.id ?? c._id)] === 'like' ? '0 6px 16px rgba(6,182,212,0.06)' : '0 4px 12px rgba(6,182,212,0.04)',
                                  cursor: 'pointer',
                                  transition: 'transform 120ms ease, box-shadow 120ms ease, background 120ms ease'
                                }}
                              >
                                <IconThumbUp size={13} style={{ color: userReactions[String(c.id ?? c._id)] === 'like' ? 'rgb(var(--accent-cyan))' : 'var(--dimmed-text)' }} />
                                <Text size="xs" style={{ color: userReactions[String(c.id ?? c._id)] === 'like' ? 'rgb(var(--accent-cyan))' : 'var(--dimmed-text)', fontWeight: 700, fontSize: 12 }}>{c.likesCount || 0}</Text>
                              </div>

                              <div
                                role="button"
                                tabIndex={0}
                                aria-label="No me gusta"
                                aria-pressed={userReactions[String(c.id ?? c._id)] === 'dislike'}
                                onClick={() => handleReaction(c.id ?? c._id, 'dislike')}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleReaction(c.id ?? c._id, 'dislike') } }}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  padding: '4px 8px',
                                  borderRadius: 8,
                                  background: userReactions[String(c.id ?? c._id)] === 'dislike' ? 'linear-gradient(135deg, rgba(255,80,80,0.04), rgba(255,80,80,0.01))' : 'transparent',
                                  border: userReactions[String(c.id ?? c._id)] === 'dislike' ? '1px solid rgba(255,80,80,0.08)' : '1px solid rgba(255,255,255,0.03)',
                                  boxShadow: userReactions[String(c.id ?? c._id)] === 'dislike' ? '0 6px 16px rgba(255,80,80,0.04)' : 'inset 0 1px 0 rgba(255,255,255,0.02)',
                                  cursor: 'pointer',
                                  transition: 'transform 120ms ease, box-shadow 120ms ease, background 120ms ease'
                                }}
                              >
                                <IconThumbDown size={13} style={{ color: userReactions[String(c.id ?? c._id)] === 'dislike' ? 'rgb(var(--accent-red))' : 'var(--dimmed-text)' }} />
                                <Text size="xs" style={{ color: userReactions[String(c.id ?? c._id)] === 'dislike' ? 'rgb(var(--accent-red))' : 'var(--dimmed-text)', fontWeight: 700, fontSize: 12 }}>{c.dislikesCount || 0}</Text>
                              </div>
                            </div>
                          </Group>

                          {/* Respuestas (si las hay) */}
                          {Array.isArray(c.replies) && c.replies.length > 0 && (
                            <div style={{ marginTop: 12, marginBottom: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 22 }}>
                                <Button
                                  variant="subtle"
                                  size="xs"
                                  leftSection={repliesVisible[String(c.id ?? c._id)] ? <IconEyeOff size={14} /> : <IconEye size={14} />}
                                  rightSection={repliesLoadingState[String(c.id ?? c._id)] && <Loader size={12} />}
                                  onClick={() => toggleReplies(c.id ?? c._id)}
                                  disabled={repliesLoadingState[String(c.id ?? c._id)]}
                                  styles={{
                                    root: {
                                      paddingLeft: 8,
                                      paddingRight: 10,
                                      color: repliesVisible[String(c.id ?? c._id)] ? 'rgb(var(--accent-cyan))' : 'var(--dimmed-text)',
                                      backgroundColor: repliesVisible[String(c.id ?? c._id)] ? 'rgba(var(--accent-cyan), 0.05)' : 'transparent',
                                      '&:hover': {
                                        backgroundColor: 'rgba(var(--accent-cyan), 0.08)',
                                        color: 'rgb(var(--accent-cyan))'
                                      }
                                    }
                                  }}
                                >
                                  {repliesVisible[String(c.id ?? c._id)] ? `Ocultar ${c.replies.length} respuesta${c.replies.length > 1 ? 's' : ''}` : `Ver ${c.replies.length} respuesta${c.replies.length > 1 ? 's' : ''}`}
                                </Button>
                                {c.replies.length >= 5 && (
                                  <Text size="xs" style={{ color: 'var(--dimmed-text)', fontStyle: 'italic' }}>
                                    · Muchas respuestas
                                  </Text>
                                )}
                              </div>

                              {repliesVisible[String(c.id ?? c._id)] && renderRepliesRecursive(c.replies || [], c.id ?? c._id, 1)}
                            </div>
                          )}

                          {/* Caja de respuesta por comentario (input exclusivo) */}
                          {replyBoxes[c.id ?? c._id]?.open && (
                            <div style={{ marginTop: 12, marginLeft: 0, marginRight: 0, width: '100%', boxSizing: 'border-box' }}>
                              <div style={{ borderLeft: '3px solid rgb(var(--accent-cyan))', paddingLeft: 12, background: 'linear-gradient(90deg, rgba(var(--accent-cyan),0.02), transparent)', borderRadius: 8 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div style={{ background: 'var(--subtle-bg-hover)', padding: '6px 10px', borderRadius: 999, border: '1px solid var(--border-color-subtle)', color: 'var(--dimmed-text)', fontSize: 13 }}>
                                      Respondiendo a <span style={{ color: 'rgb(var(--accent-cyan))' }}>@{(replyBoxes[c.id]?.text || '').match(/^@([A-Za-z0-9_.-]+)/)?.[1] || c.author?.username}</span>
                                    </div>
                                  </div>
                                  <Button size="xs" variant="subtle" onClick={() => cancelReplyBox(c.id)}>Cerrar</Button>
                                </div>

                                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', width: '100%' }}>
                                  <div style={{ width: 0, flexShrink: 0 }} />
                                  <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
                                    <Textarea
                                      placeholder="Escribe tu respuesta..."
                                      minRows={2}
                                      variant="unstyled"
                                      value={replyBoxes[c.id]?.text || ''}
                                      onChange={(e) => setReplyBoxTextWithMention(c.id, e.currentTarget.value)}
                                      maxLength={MAX_COMMENT_LENGTH}
                                      disabled={replyBoxes[c.id ?? c._id]?.submitting}
                                      style={{ width: '100%' }}
                                      styles={{ input: { fontSize: '13px', color: 'var(--text-color)', padding: '4px 0', lineHeight: 1.5 } }}
                                      ref={(el) => { try { replyInputRefs.current[c.id ?? c._id] = el } catch { /* noop */ } }}
                                    />

                                    {mentionSuggestions[String(c.id ?? c._id)] && mentionSuggestions[String(c.id ?? c._id)].visible && (
                                      <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: 12, top: 8, background: 'var(--subtle-bg)', border: '1px solid var(--border-color-subtle)', borderRadius: 8, zIndex: 60, minWidth: 200, boxShadow: '0 6px 18px rgba(0,0,0,0.06)' }}>
                                          {(mentionSuggestions[String(c.id ?? c._id)].items || []).map((it) => (
                                            <div key={it.value} onMouseDown={(e) => { e.preventDefault(); applyMentionSuggestion(it.value, String(c.id ?? c._id)) }} style={{ padding: '8px 10px', cursor: 'pointer' }}>
                                              <div style={{ fontWeight: 600 }}>{it.label}</div>
                                              <div style={{ fontSize: 12, color: 'var(--dimmed-text)' }}>@{it.value}</div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, gap: 8, flexWrap: 'wrap' }}>
                                      <div style={{ display: 'flex', alignItems: 'center' }}>
                                        <Button size="xs" variant="subtle" onClick={() => cancelReplyBox(c.id)}>Cancelar</Button>
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center' }}>
                                        <Button
                                          size="xs"
                                          radius="xl"
                                          leftSection={<IconSend size={14} style={{ marginRight: -2 }} />}
                                          onClick={async () => { if (!user) { openLogin(); return } await handleSubmitReply(c.id) }}
                                          loading={replyBoxes[c.id]?.submitting}
                                          disabled={replyBoxes[c.id]?.submitting || contentLengthExcludingMentions(replyBoxes[c.id]?.text) < MIN_COMMENT_LENGTH}
                                        >
                                          {replyBoxes[c.id]?.submitting ? 'Enviando...' : (replyBoxes[c.id]?.success ? (<><IconCheck size={14} style={{ marginRight: 8 }} />Publicado</>) : 'Responder')}
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </Group>
                    </div>
                  </Card>
                </div>
              ))
            })()}
          </Stack>

          {/* Paginación */}
          {detailCommentsPagination && detailCommentsPagination.pages > 1 && (
            <Group position="center" mt="xl" pb="md">
              <CustomPagination
                value={detailCommentsPage}
                onChange={(p) => {
                  setDetailCommentsPage(p);
                  fetchRequestComments(detailRequest.id, p, detailCommentsPagination.limit || 20)
                }}
                total={detailCommentsPagination.pages}
                size="sm"
              />
            </Group>
          )}
        </div>
      )}

      {/* Modal para editar comentario */}
      <Modal opened={editModalOpen} onClose={() => { setEditModalOpen(false); setEditingComment(null) }} title="Editar comentario" centered>
        <div>
          <Textarea
            minRows={3}
            value={editText}
            onChange={(e) => setEditText(e.currentTarget.value)}
            maxLength={MAX_COMMENT_LENGTH}
            styles={{ input: { color: 'var(--text-color)' } }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
            <Checkbox label="Spoiler" checked={editIsSpoiler} onChange={(e) => setEditIsSpoiler(e.currentTarget.checked)} />
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="subtle" onClick={() => { setEditModalOpen(false); setEditingComment(null) }}>Cancelar</Button>
              <Button onClick={handleSaveEdit} loading={editSubmitting} disabled={editSubmitting || (String(editText || '').trim().length < MIN_COMMENT_LENGTH)}>Guardar</Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Botón flotante de nuevo comentario */}
      {showNewCommentBtn && (
        <div style={{ position: 'fixed', right: 18, bottom: 22, zIndex: 9999 }}>
          <Button
            radius="xl"
            onClick={() => {
              try {
                setShowNewCommentBtn(false)
                const c = commentsContainerRef.current
                if (c && typeof c.scrollTop === 'number') {
                  // scroll to top where new comments are prepended
                  c.scrollTo({ top: 0, behavior: 'smooth' })
                  // if we have a node for the incoming comment, ensure it's visible
                  const id = latestIncomingCommentRef.current
                  try {
                    const node = commentNodesRef.current && commentNodesRef.current[String(id)]
                    if (node && typeof node.scrollIntoView === 'function') node.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  } catch { /* noop */ }
                } else {
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }
              } catch { /* noop */ }
            }}
            styles={{ root: { background: 'linear-gradient(135deg, rgb(var(--accent-cyan)) 0%, rgba(var(--accent-cyan), 0.9) 100%)', color: '#fff', boxShadow: '0 8px 24px rgba(6,182,212,0.12)' } }}
          >
            ↓ Nuevo comentario
          </Button>
        </div>
      )}
    </div>
  )
}