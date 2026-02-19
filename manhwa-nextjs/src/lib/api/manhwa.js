import api from './client'

/**
 * @typedef {Object} Manhwa
 * @property {number} id
 * @property {string} title
 * @property {string} slug
 * @property {string} [synopsis]
 * @property {string} [cover]
 * @property {string[]} [genres]
 * @property {'ongoing'|'completed'|'hiatus'|'dropped'|'upcoming'} status
 * @property {'manhwa'|'manga'|'manhua'|'webtoon'} contentType
 * @property {number} [rating]
 * @property {number} [views]
 * @property {boolean} [isAdult]
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} ManhwaStats
 * @property {number} totalSeries
 * @property {number} totalChapters
 * @property {number} totalUsers
 * @property {number} dailyUpdates
 */

export const manhwaService = {
  // Obtener estadísticas generales
  async getStats() {
    return await api.get('series', 'stats')
  },

  // Obtener manhwas destacados/populares
  async getFeatured(limit = 6) {
    return await api.get('series', `?featured=true&limit=${limit}`)
  },

  // Obtener manhwas populares
  async getPopular(limit = 12) {
    return await api.get('series', `?sort=views&order=desc&limit=${limit}`)
  },

  // Obtener manhwas recientes
  async getRecent(limit = 12) {
    return await api.get('series', `?sort=createdAt&order=desc&limit=${limit}`)
  },

  // Obtener un manhwa específico por slug
  async getBySlug(slug) {
    return await api.get('series', slug)
  },

  // Obtener todos los manhwas con paginación
  async getAll(page = 1, limit = 20, filters = {}) {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...filters
    })
    return await api.get('series', `?${params.toString()}`)
  }
}