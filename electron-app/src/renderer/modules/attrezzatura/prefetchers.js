import { prefetchOnce, getCachedData, setCache, clearCache } from '../../services/prefetchCache';
import { attrezzaturaService } from './services/attrezzaturaService';
import hybridDataService from '../../services/hybridDataService';

const attrezzatureKey = (aziendaId) =>
  aziendaId ? `attrezzatura/attrezzature?azienda_id=${aziendaId}` : 'attrezzatura/attrezzature?azienda_id=__none__';

export const prefetchAttrezzature = (aziendaId, options = {}) =>
  prefetchOnce(
    attrezzatureKey(aziendaId),
    async () => {
      if (!aziendaId) {
        return {
          attrezzature: [],
          fornitori: [],
        };
      }
      // Usa hybridDataService per leggere dal database locale
      const [attrezzature, fornitori] = await Promise.all([
        attrezzaturaService.getAttrezzature(aziendaId),
        hybridDataService.getFornitori({}),
      ]);
      return {
        attrezzature: attrezzature || [],
        fornitori: fornitori || [],
      };
    },
    options,
  );

export const getCachedAttrezzature = (aziendaId) => getCachedData(attrezzatureKey(aziendaId));

export const setCachedAttrezzature = (aziendaId, data, options) =>
  setCache(attrezzatureKey(aziendaId), data, options);

export const clearAttrezzature = (aziendaId) => clearCache(attrezzatureKey(aziendaId));

export default {
  prefetchAttrezzature,
  getCachedAttrezzature,
};

