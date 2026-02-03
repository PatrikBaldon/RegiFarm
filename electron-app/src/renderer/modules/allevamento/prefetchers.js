import { prefetchOnce, getCachedData, setCache, clearCache } from '../../services/prefetchCache';
import { allevamentoService } from './services/allevamentoService';

const animaliKey = (aziendaId, soloPresenti = true) =>
  aziendaId
    ? `allevamento/animali?azienda_id=${aziendaId}&solo_presenti=${soloPresenti ? '1' : '0'}`
    : 'allevamento/animali?azienda_id=__none__';

export const prefetchAnimali = (aziendaId, options = {}) => {
  const { soloPresenti = true, ...rest } = options;
  return prefetchOnce(
    animaliKey(aziendaId, soloPresenti),
    async () => {
      if (!aziendaId) {
        return [];
      }
      const filters = { azienda_id: aziendaId };
      if (soloPresenti) {
        filters.stato = 'presente';
      }
      const data = await allevamentoService.getAnimali(filters);
      return data || [];
    },
    rest,
  );
};

export const getCachedAnimali = (aziendaId, soloPresenti = true) =>
  getCachedData(animaliKey(aziendaId, soloPresenti));

export const setCachedAnimali = (aziendaId, data, options = {}) => {
  const { soloPresenti = true, ...rest } = options;
  return setCache(animaliKey(aziendaId, soloPresenti), data, rest);
};

export const clearAnimali = (aziendaId, soloPresenti = true) =>
  clearCache(animaliKey(aziendaId, soloPresenti));

export default {
  prefetchAnimali,
  getCachedAnimali,
  setCachedAnimali,
  clearAnimali,
};

