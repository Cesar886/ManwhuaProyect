import { useState, useEffect, useCallback } from 'react'
import { listRequests } from '../api/requests'

export default function useRequests(params = {}) {
  const [data, setData] = useState([])
  const [stats, setStats] = useState(null)
  const [pagination, setPagination] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const paramsKey = JSON.stringify(params || {})

  const fetch = useCallback(async (p = params) => {
    setLoading(true)
    setError(null)
    try {
      const res = await listRequests(p)
      // Se asume estructura: { success: true, data: { requests: [], stats: {}, pagination: {} } }
      if (res && res.data) {
        setData(Array.isArray(res.data.requests) ? res.data.requests : [])
        setStats(res.data.stats || null)
        setPagination(res.data.pagination || null)
      } else if (Array.isArray(res)) {
        // Fallback: algunos endpoints devuelven directamente array
        setData(res)
        setStats(null)
        setPagination(null)
      } else {
        setData([])
        setStats(null)
        setPagination(null)
      }
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }, [paramsKey])

  useEffect(() => {
    // Use the stable paramsKey to avoid re-running when a new object reference is passed
    fetch(params)
  }, [fetch, paramsKey])

  return { data, stats, pagination, loading, error, refetch: fetch }
}
