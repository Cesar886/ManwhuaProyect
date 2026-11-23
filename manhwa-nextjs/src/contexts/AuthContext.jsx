"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { login as apiLogin, googleLogin as apiGoogleLogin, discordLogin as apiDiscordLogin, getCurrentUser as apiGetCurrentUser, logout as apiLogout, updateUserProfile as apiUpdateUserProfile, updateUserAvatar as apiUpdateUserAvatar, invalidateUserCache } from '../api/client'

const AuthContext = createContext(null)

/** Extract user object from various API response shapes */
function extractUser(res) {
  if (!res || typeof res !== 'object') return null
  if (res.data?.user) return res.data.user
  if (res.user) return res.user
  if (res.name && res.email) return res
  return null
}

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showLogin, setShowLogin] = useState(false)

  const openLogin = useCallback(() => setShowLogin(true), [])
  const closeLogin = useCallback(() => setShowLogin(false), [])

  // Prevent multiple simultaneous /api/auth/me requests
  const fetchUserPromiseRef = useRef(null)
  const hasFetchedRef = useRef(false)
  const userRef = useRef(null)

  const refreshUser = useCallback(async (force = false) => {
    if (!force && hasFetchedRef.current) {
      return Promise.resolve(userRef.current)
    }

    if (fetchUserPromiseRef.current) return fetchUserPromiseRef.current

    fetchUserPromiseRef.current = (async () => {
      try {
        setLoading(true)
        const res = await apiGetCurrentUser()
        const u = extractUser(res)
        setUser(u)
        userRef.current = u
        hasFetchedRef.current = true
        return u
      } catch (e) {
        setUser(null)
        userRef.current = null
        hasFetchedRef.current = true
        if (e && e.status !== 401) {
          console.error('Error al obtener usuario actual:', e)
        }
        return null
      } finally {
        setLoading(false)
        fetchUserPromiseRef.current = null
      }
    })()

    return fetchUserPromiseRef.current
  }, []) // No dependencies - uses refs for current values

  useEffect(() => {
    refreshUser()
  }, [refreshUser])

  const doLogin = async (credentials) => {
    const payload = {
      login: credentials.login || credentials.email || credentials.username || '',
      password: credentials.password,
      remember: credentials.remember || false,
    }
    const res = await apiLogin(payload)
    const u = extractUser(res)
    if (u) setUser(u)
    await refreshUser(true)
    closeLogin()
    return res
  }

  const doGoogleLogin = async (token, tokenType = 'credential') => {
    if (!token) throw new Error('Token de Google requerido')
    const res = await apiGoogleLogin(token, tokenType)
    if (!res || (!res.success && !res.data && !res.user)) {
      throw new Error(res?.message || 'Respuesta inválida del servidor')
    }
    const u = extractUser(res)
    if (u) setUser(u)
    await refreshUser(true)
    closeLogin()
    return res
  }

  const doDiscordLogin = async (code) => {
    const res = await apiDiscordLogin(code)
    const u = extractUser(res)
    if (u) setUser(u)
    await refreshUser(true)
    closeLogin()
    return res
  }

  // Update user profile and local state immediately
  const updateProfile = async (targetUserId, data) => {
    try {
      const currentUserId = user?.id || user?._id
      if (!currentUserId || String(targetUserId) !== String(currentUserId)) {
        const error = new Error('No tienes permiso para modificar este perfil')
        error.status = 403
        throw error
      }

      const payload = {
        ...(data.display_name !== undefined ? { displayName: data.display_name } : {}),
        ...(data.bio !== undefined ? { bio: data.bio } : {}),
        ...(data.location !== undefined ? { location: data.location } : {}),
        ...(data.show_active_reader !== undefined ? { showActiveReader: data.show_active_reader } : {}),
        ...(data.social_links !== undefined ? { socialLinks: data.social_links } : {}),
        ...(data.favorite_characters !== undefined ? { favoriteCharacters: data.favorite_characters } : {}),
      }
      const res = await apiUpdateUserProfile(payload)
      invalidateUserCache()
      const updatedUser = res?.data?.user || res?.user || {}
      const previousUser = userRef.current || user || {}
      const nextUser = {
        ...previousUser,
        ...data,
        ...updatedUser,
        display_name: updatedUser.displayName ?? updatedUser.display_name ?? data.display_name ?? previousUser.display_name,
        bio: updatedUser.bio ?? data.bio ?? previousUser.bio,
        location: updatedUser.location ?? data.location ?? previousUser.location,
        show_active_reader: updatedUser.showActiveReader ?? updatedUser.show_active_reader ?? data.show_active_reader ?? previousUser.show_active_reader,
        social_links: updatedUser.socialLinks ?? updatedUser.social_links ?? data.social_links ?? previousUser.social_links,
        favoriteCharacters: updatedUser.favoriteCharacters ?? updatedUser.favorite_characters ?? data.favorite_characters ?? previousUser.favoriteCharacters ?? previousUser.favorite_characters ?? [],
        favorite_characters: updatedUser.favoriteCharacters ?? updatedUser.favorite_characters ?? data.favorite_characters ?? previousUser.favoriteCharacters ?? previousUser.favorite_characters ?? [],
      }
      userRef.current = nextUser
      setUser(nextUser)

      return res;
    } catch (e) {
      console.error('Error updating profile:', e);
      throw e;
    }
  }

  const updateAvatar = async (avatarUrl) => {
    try {
      const res = await apiUpdateUserAvatar(avatarUrl)
      setUser(prev => ({ ...prev, avatar_url: avatarUrl, avatarUrl }))
      return res
    } catch (e) {
      console.error('Error updating profile avatar:', e)
      throw e
    }
  }

  const updateFollowingCount = (followingCount) => {
    const currentUser = userRef.current || user
    if (!currentUser) return
    const nextUser = {
      ...currentUser,
      following_count: followingCount,
      followingCount,
    }
    userRef.current = nextUser
    setUser(nextUser)
  }

  const doLogout = async () => {
    try { await apiLogout() } catch { /* continue cleaning client state */ }
    try {
      document.cookie = 'token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT;'
      document.cookie = 'refreshToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT;'
    } catch { /* non-httpOnly cookies only */ }
    setUser(null)
    userRef.current = null
    hasFetchedRef.current = false
  }

  const value = {
    user,
    loading,
    showLogin,
    openLogin,
    closeLogin,
    doLogin,
    doGoogleLogin,
    doDiscordLogin,
    doLogout,
    updateProfile,
    updateAvatar,
    updateFollowingCount,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export default AuthContext
