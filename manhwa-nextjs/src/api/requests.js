import api from './client'

const buildQuery = (params = {}) => {
  const q = new URLSearchParams()
  Object.keys(params).forEach((k) => {
    const v = params[k]
    if (v === undefined || v === null || v === '') return
    if (Array.isArray(v)) {
      v.forEach((val) => q.append(k, val))
    } else {
      q.append(k, String(v))
    }
  })
  const s = q.toString()
  return s ? `?${s}` : ''
}

export const listRequests = (opts = {}) => {
  const { page = 1, limit = 20, status, sort = 'votes', order = 'desc', search, genre } = opts
  const qs = buildQuery({ page, limit, status, sort, order, search, genre })
  return api.get('requests', qs)
}

export const getRequest = (id) => api.get('requests', id)

export const getRequestComments = (id, opts = {}) => {
  const { page = 1, limit = 20 } = opts
  const qs = buildQuery({ page, limit })
  return api.get('requests', `${id}/comments${qs}`)
}

export const createRequest = (body) => api.post('requests', '', body)

export const getOrCreateChapterRequest = (body) => api.post('requests', 'chapter', body)

export const voteRequest = (id) => api.post('requests', `${id}/vote`)

export const unvoteRequest = (id) => api.del('requests', `${id}/vote`)

export const updateRequestStatus = (id, body) => api.put('requests', `${id}/status`, body)

export const deleteRequest = (id) => api.del('requests', id)

export const updateRequest = (id, body) => api.put('requests', `${id}`, body)

// Series API
export const listSeries = (opts = {}) => {
  const { page = 1, limit = 20, sort, order, search, genres, status } = opts
  const qs = buildQuery({ page, limit, sort, order, search, genres, status })
  return api.get('series', qs)
}

export const getPopularSeries = (opts = {}) => {
  const { page = 1, limit = 20 } = opts
  const qs = buildQuery({ page, limit })
  return api.get('series', `popular${qs}`)
}

export const getTrendingSeries = (opts = {}) => {
  const { page = 1, limit = 20 } = opts
  const qs = buildQuery({ page, limit })
  return api.get('series', `trending${qs}`)
}

export const getLatestSeries = (opts = {}) => {
  const { page = 1, limit = 20 } = opts
  const qs = buildQuery({ page, limit })
  return api.get('series', `latest${qs}`)
}

export const getFeaturedSeries = (opts = {}) => {
  const { page = 1, limit = 20 } = opts
  const qs = buildQuery({ page, limit })
  return api.get('series', `featured${qs}`)
}

export const getSeriesDetail = (slug) => api.get('series', slug)

export const recordSeriesView = (slug, visitorId) =>
  api.post('series', `${slug}/view`, { visitorId })

export const updateSeries = (slug, data) => api.patch('series', slug, data)
export const getSeriesMerch = (slug) => api.get('series', `${slug}/merch`)

export const uploadSeriesCover = (slug, file) => {
  const formData = new FormData()
  formData.append('image', file) // El middleware uploadToSpaces espera 'image'
  return api.post('series', `${slug}/cover`, formData)
}

// Genres API
export const listGenres = () => api.get('genres', '')

// Spaces API
export const listManhwasFromSpaces = () => api.get('spaces', 'manhwas')

export const getManhwaFromSpaces = (slug) => api.get('spaces', `manhwas/${slug}`)

// Bookmarks API
export const getBookmarks = (opts = {}) => {
  const { page = 1, limit = 20, status, sort = 'updated_at', order = 'desc' } = opts
  const qs = buildQuery({ page, limit, status, sort, order })
  return api.get('bookmarks', qs)
}

export const addBookmark = (seriesId, data = {}) => api.post('bookmarks', seriesId, data)

export const removeBookmark = (seriesId) => api.del('bookmarks', seriesId)

export const updateBookmark = (seriesId, data) => api.put('bookmarks', seriesId, data)

export const checkBookmark = (seriesId) => api.get('bookmarks', `check/${seriesId}`)

export const updateReadingProgress = (seriesId, data) => api.put('bookmarks', `${seriesId}/progress`, data)

export const toggleBookmarkNotifications = (seriesId, data) => api.put('bookmarks', `${seriesId}/notifications`, data)

// Colecciones personales
export const getMyCollections = (seriesId) =>
  api.get('collections', `mine${buildQuery({ seriesId })}`, { cache: false })
export const createCollection = (data) => api.post('collections', '', data)
export const updateCollection = (publicId, data) => api.put('collections', publicId, data)
export const deleteCollection = (publicId) => api.del('collections', publicId)
export const getCollection = (publicId) => api.get('collections', publicId, { cache: false })
export const listCollections = (page = 1) => api.get('collections', buildQuery({ page }), { cache: false })
export const getUserCollections = (username, page = 1) => api.get('users', `${encodeURIComponent(username)}/collections${buildQuery({ page })}`, { cache: false })
export const getUserFavorites = (username, page = 1) => api.get('users', `${encodeURIComponent(username)}/bookmarks${buildQuery({ page })}`, { cache: false })
export const addSeriesToCollection = (publicId, seriesId) =>
  api.post('collections', `${publicId}/manhwas`, { seriesId })
export const removeSeriesFromCollection = (publicId, seriesId) =>
  api.del('collections', `${publicId}/manhwas/${encodeURIComponent(seriesId)}`)
export const getCollectionManhwas = (publicId, page = 1) =>
  api.get('collections', `${publicId}/manhwas${buildQuery({ page, limit: 20 })}`, { cache: false })
export const reorderCollection = (publicId, seriesIds) => api.put('collections', `${publicId}/manhwas/reorder`, { seriesIds })
export const likeCollection = (publicId) => api.post('collections', `${publicId}/like`)
export const unlikeCollection = (publicId) => api.del('collections', `${publicId}/like`)
export const copyCollection = (publicId) => api.post('collections', `${publicId}/copy`)

// Ratings API
export const rateSeries = (seriesId, rating) => api.post('series', `${seriesId}/rate`, { rating })

export const getUserRating = (seriesId) => api.get('series', `${seriesId}/rating`)

// Comments API
export const getSeriesComments = (seriesId, opts = {}) => {
  const { page = 1, limit = 20, sort = 'newest' } = opts
  const qs = buildQuery({ page, limit, sort })
  return api.get('comments', `series/${seriesId}${qs}`)
}

export const addComment = (seriesId, content, parentId = null) => 
  api.post('comments', 'series', { seriesId, content, parentId })

export const deleteComment = (commentId) => api.del('comments', commentId)

export const voteComment = (commentId, type) => api.post('comments', `${commentId}/vote`, { type })

// Related/Recommendations API
export const getRelatedSeries = (slug, limit = 6) => {
  const qs = buildQuery({ limit })
  return api.get('series', `${slug}/related${qs}`)
}

export const getAuthorSeries = (authorName, excludeSlug, limit = 6) => {
  const qs = buildQuery({ author: authorName, exclude: excludeSlug, limit })
  return api.get('series', `by-author${qs}`)
}

// Stats API (Admin)
export const getSeriesStats = (slug) => api.get('series', `${slug}/stats`)

// Share tracking
export const trackShare = (seriesId, platform) => api.post('series', `${seriesId}/share`, { platform })

const requestsApi = {
  listRequests,
  getRequest,
  getRequestComments,
  createRequest,
  getOrCreateChapterRequest,
  voteRequest,
  unvoteRequest,
  updateRequestStatus,
  deleteRequest,
  updateRequest,
  listSeries,
  getPopularSeries,
  getTrendingSeries,
  getLatestSeries,
  getFeaturedSeries,
  getSeriesDetail,
  updateSeries,
  uploadSeriesCover,
  listGenres,
  listManhwasFromSpaces,
  getManhwaFromSpaces,
  // Bookmarks
  getBookmarks,
  addBookmark,
  removeBookmark,
  updateBookmark,
  checkBookmark,
  updateReadingProgress,
  toggleBookmarkNotifications,
  getMyCollections,
  createCollection,
  addSeriesToCollection,
  removeSeriesFromCollection,
  getCollectionManhwas,
  // Ratings
  rateSeries,
  getUserRating,
  // Comments
  getSeriesComments,
  addComment,
  deleteComment,
  voteComment,
  // Related
  getRelatedSeries,
  getAuthorSeries,
  // Stats
  getSeriesStats,
  trackShare,
}

export default requestsApi
