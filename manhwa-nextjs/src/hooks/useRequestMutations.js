import { useState } from 'react'
import { createRequest, voteRequest, unvoteRequest } from '../api/requests'

export function useCreateRequest() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const execute = async (body, { onSuccess, onError } = {}) => {
    setLoading(true)
    setError(null)
    try {
      const res = await createRequest(body)
      if (onSuccess) onSuccess(res)
      return res
    } catch (err) {
      setError(err.message || String(err))
      if (onError) onError(err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { execute, loading, error }
}

export function useVoteRequest() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const vote = async (id, { onSuccess, onError } = {}) => {
    setLoading(true)
    setError(null)
    try {
      const res = await voteRequest(id)
      if (onSuccess) onSuccess(res)
      return res
    } catch (err) {
      setError(err.message || String(err))
      if (onError) onError(err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const unvote = async (id, { onSuccess, onError } = {}) => {
    setLoading(true)
    setError(null)
    try {
      const res = await unvoteRequest(id)
      if (onSuccess) onSuccess(res)
      return res
    } catch (err) {
      setError(err.message || String(err))
      if (onError) onError(err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { vote, unvote, loading, error }
}
