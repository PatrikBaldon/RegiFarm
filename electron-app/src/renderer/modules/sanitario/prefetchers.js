import { prefetchOnce, getCachedData, setCache, clearCache } from '../../services/prefetchCache';
import { sanitarioService } from './services/sanitarioService';
import { allevamentoService } from '../allevamento/services/allevamentoService';

const FARMACI_KEY = (search = '') => `sanitario/farmaci?search=${search ?? ''}`;

const magazzinoKey = (aziendaId) =>
  aziendaId ? `sanitario/magazzino?azienda_id=${aziendaId}` : 'sanitario/magazzino?azienda_id=__none__';

const somministrazioniKey = (aziendaId) =>
  aziendaId
    ? `sanitario/somministrazioni?azienda_id=${aziendaId}`
    : 'sanitario/somministrazioni?azienda_id=__none__';

export const prefetchSanitarioFarmaci = (options = {}) =>
  prefetchOnce(
    FARMACI_KEY(''),
    async () => {
      const data = await sanitarioService.getFarmaci(null);
      return data || [];
    },
    options,
  );

export const getCachedSanitarioFarmaci = (search = '') => getCachedData(FARMACI_KEY(search));

export const setCachedSanitarioFarmaci = (data, options) =>
  setCache(FARMACI_KEY(''), data, options);

export const clearSanitarioFarmaci = () => clearCache(FARMACI_KEY(''));

export const prefetchSanitarioMagazzino = (aziendaId, options = {}) =>
  prefetchOnce(
    magazzinoKey(aziendaId),
    async () => {
      if (!aziendaId) {
        return { lotti: [], farmaci: [] };
      }
      const [lotti, farmaci] = await Promise.all([
        sanitarioService.getLottiFarmaco(aziendaId),
        sanitarioService.getFarmaci(null),
      ]);
      return {
        lotti: lotti || [],
        farmaci: farmaci || [],
      };
    },
    options,
  );

export const getCachedSanitarioMagazzino = (aziendaId) => getCachedData(magazzinoKey(aziendaId));

export const setCachedSanitarioMagazzino = (aziendaId, data, options) =>
  setCache(magazzinoKey(aziendaId), data, options);

export const clearSanitarioMagazzino = (aziendaId) => clearCache(magazzinoKey(aziendaId));

export const prefetchSanitarioSomministrazioni = (aziendaId, options = {}) =>
  prefetchOnce(
    somministrazioniKey(aziendaId),
    async () => {
      if (!aziendaId) {
        return {
          somministrazioni: [],
          animali: [],
          farmaci: [],
          giacenze: [],
        };
      }
      // Timeout aumentato per getSomministrazioni che può avere molti dati
      const [somministrazioni, animali, farmaci, giacenze] = await Promise.all([
        sanitarioService.getSomministrazioni({ azienda_id: aziendaId }),
        allevamentoService.getAnimali({ azienda_id: aziendaId }),
        sanitarioService.getFarmaci(null),
        sanitarioService.getGiacenzeAzienda(aziendaId),
      ]);
      return {
        somministrazioni: somministrazioni || [],
        animali: animali || [],
        farmaci: farmaci || [],
        giacenze: giacenze || [],
      };
    },
    options,
  );

export const getCachedSanitarioSomministrazioni = (aziendaId) =>
  getCachedData(somministrazioniKey(aziendaId));

export const setCachedSanitarioSomministrazioni = (aziendaId, data, options) =>
  setCache(somministrazioniKey(aziendaId), data, options);

export const clearSanitarioSomministrazioni = (aziendaId) =>
  clearCache(somministrazioniKey(aziendaId));

export default {
  prefetchSanitarioFarmaci,
  prefetchSanitarioMagazzino,
  prefetchSanitarioSomministrazioni,
};

