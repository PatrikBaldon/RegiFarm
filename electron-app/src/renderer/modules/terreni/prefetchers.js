import { prefetchOnce, getCachedData, setCache, clearCache } from '../../services/prefetchCache';
import { terreniService } from './services/terreniService';

const terreniKey = (aziendaId) =>
  aziendaId ? `terreni/list?azienda_id=${aziendaId}` : 'terreni/list?azienda_id=__none__';

export const prefetchTerreni = (aziendaId, options = {}) =>
  prefetchOnce(
    terreniKey(aziendaId),
    async () => {
      if (!aziendaId) {
        return [];
      }
      // Filtra sempre i record cancellati
      const data = await terreniService.getTerreni({ azienda_id: aziendaId, deleted_at: null });
      return data || [];
    },
    options,
  );

export const getCachedTerreni = (aziendaId) => getCachedData(terreniKey(aziendaId));

export const setCachedTerreni = (aziendaId, data, options = {}) =>
  setCache(terreniKey(aziendaId), data, options);

export const clearTerreni = (aziendaId) => clearCache(terreniKey(aziendaId));

export default {
  prefetchTerreni,
  getCachedTerreni,
};

