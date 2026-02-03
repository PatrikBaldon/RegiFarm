/**
 * Service for Aziende API calls
 * Uses persistent cache for static data (aziende list)
 */
import api from '../../../services/api';
import persistentCache, { CACHE_KEYS } from '../../../services/persistentCache';

export const aziendeService = {
  /**
   * Get all aziende with persistent cache (7 days TTL)
   * Cache is invalidated on create/update/delete
   */
  getAziende: async (options = {}) => {
    const { force = false } = options;
    return persistentCache.getOrSet(
      CACHE_KEYS.AZIENDE,
      () => api.get('/aziende'),
      { force, ttl: 7 * 24 * 60 * 60 * 1000 } // 7 giorni
    );
  },
  getAzienda: (id) => api.get(`/aziende/${id}`),
  createAzienda: async (data) => {
    const result = await api.post('/aziende', data);
    // Invalidate cache
    persistentCache.clear(CACHE_KEYS.AZIENDE);
    return result;
  },
  updateAzienda: async (id, data) => {
    const result = await api.put(`/aziende/${id}`, data);
    // Invalidate cache
    persistentCache.clear(CACHE_KEYS.AZIENDE);
    return result;
  },
  deleteAzienda: async (id) => {
    const result = await api.delete(`/aziende/${id}`);
    // Invalidate cache
    persistentCache.clear(CACHE_KEYS.AZIENDE);
    return result;
  },
};

