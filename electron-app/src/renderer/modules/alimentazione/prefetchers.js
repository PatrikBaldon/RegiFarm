import { prefetchOnce, getCachedData, setCache, clearCache } from '../../services/prefetchCache';
import { alimentazioneService } from './services/alimentazioneService';
import { allevamentoService } from '../allevamento/services/allevamentoService';

const CATALOGO_KEY = 'alimentazione/catalogo';
const PIANI_KEY = 'alimentazione/piani';
const SCORTE_KEY = 'alimentazione/scorte';

const storicoKey = (aziendaId) =>
  aziendaId ? `alimentazione/storico?azienda_id=${aziendaId}` : 'alimentazione/storico?azienda_id=__none__';

export const prefetchAlimentazioneCatalogo = (options = {}) =>
  prefetchOnce(
    CATALOGO_KEY,
    async () => {
      const [componenti, mangimi, fatture] = await Promise.all([
        alimentazioneService.getComponenti(),
        alimentazioneService.getMangimi(),
        alimentazioneService.getFatture(),
      ]);
      return {
        componenti: componenti || [],
        mangimi: mangimi || [],
        fatture: fatture || [],
      };
    },
    options,
  );

export const getCachedAlimentazioneCatalogo = () => getCachedData(CATALOGO_KEY);

export const setCachedAlimentazioneCatalogo = (data, options) =>
  setCache(CATALOGO_KEY, data, options);

export const clearAlimentazioneCatalogo = () => clearCache(CATALOGO_KEY);

export const prefetchAlimentazionePiani = (options = {}) =>
  prefetchOnce(
    PIANI_KEY,
    async () => {
      const [piani, componenti, mangimi, composizioni] = await Promise.all([
        alimentazioneService.getPiani(),
        alimentazioneService.getComponenti(),
        alimentazioneService.getMangimi(),
        alimentazioneService.getComposizioni(),
      ]);
      return {
        piani: piani || [],
        componenti: componenti || [],
        mangimi: mangimi || [],
        composizioni: composizioni || [],
      };
    },
    options,
  );

export const getCachedAlimentazionePiani = () => getCachedData(PIANI_KEY);

export const setCachedAlimentazionePiani = (data, options) =>
  setCache(PIANI_KEY, data, options);

export const clearAlimentazionePiani = () => clearCache(PIANI_KEY);

export const prefetchAlimentazioneStorico = (aziendaId, options = {}) =>
  prefetchOnce(
    storicoKey(aziendaId),
    async () => {
      // Timeout aumentato per getRegistro che può avere molti dati
      const [registro, piani, componenti, mangimi, sedi] = await Promise.all([
        alimentazioneService.getRegistro({ azienda_id: aziendaId }),
        alimentazioneService.getPiani(),
        alimentazioneService.getComponenti(),
        alimentazioneService.getMangimi(),
        aziendaId ? allevamentoService.getSedi(aziendaId) : Promise.resolve([]),
      ]);

      const registroFiltrato = (registro || []).filter(
        (voce) => !aziendaId || !voce.azienda_id || voce.azienda_id === aziendaId,
      );

      return {
        registro: registroFiltrato,
        piani: piani || [],
        componenti: componenti || [],
        mangimi: mangimi || [],
        sedi: sedi || [],
      };
    },
    options,
  );

export const getCachedAlimentazioneStorico = (aziendaId) => getCachedData(storicoKey(aziendaId));

export const setCachedAlimentazioneStorico = (aziendaId, data, options) =>
  setCache(storicoKey(aziendaId), data, options);

export const clearAlimentazioneStorico = (aziendaId) => clearCache(storicoKey(aziendaId));

export const prefetchAlimentazioneScorte = (options = {}) =>
  prefetchOnce(
    SCORTE_KEY,
    async () => {
      const scorte = await alimentazioneService.getScorte();
      return scorte || [];
    },
    options,
  );

export const getCachedAlimentazioneScorte = () => getCachedData(SCORTE_KEY);

export const setCachedAlimentazioneScorte = (data, options) =>
  setCache(SCORTE_KEY, data, options);

export const clearAlimentazioneScorte = () => clearCache(SCORTE_KEY);

export default {
  prefetchAlimentazioneCatalogo,
  getCachedAlimentazioneCatalogo,
  prefetchAlimentazionePiani,
  getCachedAlimentazionePiani,
  prefetchAlimentazioneStorico,
  getCachedAlimentazioneStorico,
  prefetchAlimentazioneScorte,
  getCachedAlimentazioneScorte,
};

