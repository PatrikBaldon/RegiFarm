import api from '../../services/api';
import { amministrazioneService } from './services/amministrazioneService';
import hybridDataService from '../../services/hybridDataService';
import { prefetchOnce, getCachedData, setCache } from '../../services/prefetchCache';

const fattureKey = (aziendaId) =>
  aziendaId
    ? `amministrazione/fatture?azienda_id=${aziendaId}&limit=1000`
    : 'amministrazione/fatture?azienda_id=__none__&limit=1000';
const FORNITORI_KEY = 'amministrazione/fornitori';

const fattureEmesseKey = (aziendaId) =>
  aziendaId ? `amministrazione/fatture-emesse?azienda_id=${aziendaId}` : null;

export const prefetchFatture = (aziendaId, options = {}) =>
  prefetchOnce(
    fattureKey(aziendaId),
    async () => {
      const params = { limit: 1000 };
      if (aziendaId) {
        params.azienda_id = aziendaId;
      }
      // Usa hybridDataService per leggere dal database locale (più veloce)
      try {
        return await hybridDataService.getFatture(params);
      } catch (error) {
        // Fallback al backend se il database locale non è disponibile

        return amministrazioneService.getFatture(params);
      }
    },
    options,
  );

export const getCachedFatture = (aziendaId) => getCachedData(fattureKey(aziendaId));

export const setCachedFatture = (aziendaId, data) => setCache(fattureKey(aziendaId), data);

export const prefetchFattureEmesse = (aziendaId, options = {}) => {
  if (!aziendaId) return Promise.resolve(null);
  const key = fattureEmesseKey(aziendaId);
  return prefetchOnce(
    key,
    async () => {
      const [fattureData, venditeData] = await Promise.all([
        amministrazioneService.getFattureEmesse(aziendaId),
        amministrazioneService.getVenditeProdotti({ azienda_id: aziendaId }),
      ]);

      const vendite = Array.isArray(venditeData) ? venditeData : [];

      return (fattureData || []).map((fattura) => {
        const venditaCollegata = vendite.find((vendita) => vendita.numero_fattura === fattura.numero);
        return {
          ...fattura,
          vendita_prodotto: venditaCollegata || null,
        };
      });
    },
    options,
  );
};

export const getCachedFattureEmesse = (aziendaId) => {
  const key = fattureEmesseKey(aziendaId);
  if (!key) return null;
  return getCachedData(key);
};

export const setCachedFattureEmesse = (aziendaId, data) => {
  const key = fattureEmesseKey(aziendaId);
  if (key) {
    setCache(key, data);
  }
};

export const prefetchFornitori = (options = {}) =>
  prefetchOnce(
    FORNITORI_KEY,
    async () => {
      // Timeout aumentato per getFornitori che può avere molti dati
      const [fornitoriData, tipiData] = await Promise.all([
        api.get('/amministrazione/fornitori/', {}),
        amministrazioneService.getFornitoriTipi(),
      ]);
      return {
        fornitori: fornitoriData || [],
        tipi: tipiData || [],
      };
    },
    options,
  );

export const getCachedFornitori = () => getCachedData(FORNITORI_KEY);

export const setCachedFornitori = (data) => setCache(FORNITORI_KEY, data);

