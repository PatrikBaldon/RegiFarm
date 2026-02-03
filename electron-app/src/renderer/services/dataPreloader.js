/**
 * Data Preloader Service
 * 
 * Carica TUTTI i dati dell'azienda in background all'avvio dell'app.
 * Questo garantisce che la navigazione tra i moduli sia istantanea
 * perché i dati sono già in cache.
 * 
 * Strategia OTTIMIZZATA (Offline-First):
 * 1. Prima prova a caricare dal database locale (istantaneo < 5ms)
 * 2. Se non disponibile, usa API online come fallback
 * 3. I dati locali sono sincronizzati dal SyncManager in background
 * 
 * Fasi:
 * 1. Carica dati critici (azienda, impostazioni) - PRIORITÀ ALTA
 * 2. Carica dati frequenti (animali, sedi) - PRIORITÀ MEDIA  
 * 3. Carica dati secondari (fatture, terreni) - PRIORITÀ BASSA (background)
 */

import api from './api';
import hybridDataService from './hybridDataService';
import { setCache } from './prefetchCache';
import { setPersistentCache, CACHE_KEYS } from './persistentCache';

// Stato del preload
let preloadState = {
  isPreloading: false,
  isComplete: false,
  progress: 0,
  errors: [],
  startTime: null,
};

// Listeners per aggiornamenti di stato
const listeners = new Set();

const notifyListeners = () => {
  listeners.forEach(fn => fn({ ...preloadState }));
};

/**
 * Registra un listener per gli aggiornamenti di preload
 * @param {Function} callback - Funzione chiamata con lo stato aggiornato
 * @returns {Function} - Funzione per rimuovere il listener
 */
export const onPreloadStateChange = (callback) => {
  listeners.add(callback);
  // Notifica subito lo stato corrente
  callback({ ...preloadState });
  return () => listeners.delete(callback);
};

/**
 * Ritorna lo stato corrente del preload
 */
export const getPreloadState = () => ({ ...preloadState });

/**
 * Preload di tutti i dati per un'azienda
 * @param {number} aziendaId - ID dell'azienda
 * @param {Object} options - Opzioni
 * @param {boolean} options.force - Forza ricaricamento anche se già in cache
 * @param {Function} options.onProgress - Callback per progresso
 */
export const preloadAllData = async (aziendaId, options = {}) => {
  if (!aziendaId) {
    return false;
  }

  if (preloadState.isPreloading) {
    return false;
  }

  preloadState = {
    isPreloading: true,
    isComplete: false,
    progress: 0,
    errors: [],
    startTime: Date.now(),
  };
  notifyListeners();

  const { force = false, onProgress } = options;

  try {
    // === FASE 1: Dati Critici (0-20%) ===
    
    const criticalPromises = [
      fetchAndCache(
        'azienda',
        () => api.get('/aziende/' + aziendaId),
        { ttl: 10 * 60 * 1000 } // 10 minuti
      ),
      fetchAndCache(
        'impostazioni',
        async () => {
          try {
            return await api.get('/impostazioni/', { azienda_id: aziendaId });
          } catch (error) {
            // Se l'endpoint non esiste o c'è un errore, restituisci oggetto vuoto invece di fallire
            if (error?.status === 404 || error?.message?.includes('404')) {
              return {};
            }
            throw error; // Rilancia altri errori
          }
        },
        { ttl: 10 * 60 * 1000 }
      ),
    ];

    await Promise.allSettled(criticalPromises);
    updateProgress(20, onProgress);

    // === FASE 2: Dati Frequenti (20-60%) ===
    // OTTIMIZZATO: Usa database locale quando disponibile (< 5ms invece di ~200ms)
    
    const frequentPromises = [
      // Allevamento - usa hybridDataService (locale se disponibile)
      fetchAndCache(
        `allevamento/animali?azienda_id=${aziendaId}&stato=presente`,
        () => hybridDataService.getAnimali({ azienda_id: aziendaId, stato: 'presente' }),
        { ttl: 5 * 60 * 1000 }
      ),
      fetchAndCache(
        `allevamento/sedi?azienda_id=${aziendaId}`,
        () => hybridDataService.getSedi({ azienda_id: aziendaId }),
        { ttl: 10 * 60 * 1000 }
      ),
      // Fornitori (dati statici - cache persistente) - usa locale
      fetchAndCachePersistent(
        CACHE_KEYS.FORNITORI,
        () => hybridDataService.getFornitori({ azienda_id: aziendaId }),
        { ttl: 7 * 24 * 60 * 60 * 1000 } // 7 giorni
      ),
      // Statistiche Home (batch) - sempre online per dati freschi aggregati
      fetchAndCache(
        `statistiche/home-batch?azienda_id=${aziendaId}`,
        () => hybridDataService.getHomeStatsBatch(aziendaId),
        { ttl: 5 * 60 * 1000 }
      ),
    ];

    await Promise.allSettled(frequentPromises);
    updateProgress(60, onProgress);

    // === FASE 3: Dati Secondari (60-100%) - In parallelo ===
    // OTTIMIZZATO: Usa database locale quando disponibile
    
    const secondaryPromises = [
      // Amministrazione - usa locale
      fetchAndCache(
        `amministrazione/fatture?azienda_id=${aziendaId}`,
        () => hybridDataService.getFatture({ azienda_id: aziendaId }),
        { ttl: 5 * 60 * 1000 }
      ),
      fetchAndCache(
        `amministrazione/partite?azienda_id=${aziendaId}`,
        () => api.get('/amministrazione/partite', { azienda_id: aziendaId }),
        { ttl: 5 * 60 * 1000 }
      ),
      // Alimentazione - usa locale
      fetchAndCachePersistent(
        CACHE_KEYS.COMPONENTI_ALIMENTARI,
        () => hybridDataService.getComponentiAlimentari({ azienda_id: aziendaId }).catch(() => []),
        { ttl: 7 * 24 * 60 * 60 * 1000 }
      ),
      fetchAndCachePersistent(
        CACHE_KEYS.MANGIMI_CONFEZIONATI,
        () => hybridDataService.getMangimi({ azienda_id: aziendaId }).catch(() => []),
        { ttl: 7 * 24 * 60 * 60 * 1000 }
      ),
      // Terreni - usa locale
      fetchAndCache(
        `terreni?azienda_id=${aziendaId}`,
        () => hybridDataService.getTerreni({ azienda_id: aziendaId }),
        { ttl: 10 * 60 * 1000 }
      ),
      // Attrezzature - usa locale
      fetchAndCache(
        `amministrazione/attrezzature?azienda_id=${aziendaId}`,
        () => hybridDataService.getAttrezzature({ azienda_id: aziendaId }),
        { ttl: 10 * 60 * 1000 }
      ),
      // Sanitario - usa locale
      fetchAndCachePersistent(
        CACHE_KEYS.FARMACI,
        () => hybridDataService.getFarmaci({ azienda_id: aziendaId }),
        { ttl: 7 * 24 * 60 * 60 * 1000 }
      ),
      // Statistiche batch per moduli - sempre online per dati aggregati freschi
      fetchAndCache(
        `statistiche/allevamento-batch?azienda_id=${aziendaId}`,
        () => api.get('/statistiche/allevamento-batch', { azienda_id: aziendaId }),
        { ttl: 5 * 60 * 1000 }
      ),
      fetchAndCache(
        `statistiche/amministrazione-batch?azienda_id=${aziendaId}`,
        () => api.get('/statistiche/amministrazione-batch', { azienda_id: aziendaId }),
        { ttl: 5 * 60 * 1000 }
      ),
    ];

    // Esegui in batch da 4 per non sovraccaricare
    const batchSize = 4;
    for (let i = 0; i < secondaryPromises.length; i += batchSize) {
      const batch = secondaryPromises.slice(i, i + batchSize);
      await Promise.allSettled(batch);
      const progress = 60 + Math.floor(((i + batch.length) / secondaryPromises.length) * 40);
      updateProgress(progress, onProgress);
    }

    // Completo
    const duration = Date.now() - preloadState.startTime;
    
    preloadState = {
      ...preloadState,
      isPreloading: false,
      isComplete: true,
      progress: 100,
    };
    notifyListeners();

    return true;

  } catch (error) {
    preloadState = {
      ...preloadState,
      isPreloading: false,
      errors: [...preloadState.errors, error.message],
    };
    notifyListeners();
    return false;
  }
};

/**
 * Verifica se un errore è critico o può essere ignorato
 */
const isCriticalError = (error) => {
  const errorStr = typeof error === 'string' ? error : error.message || String(error);
  const errorLower = errorStr.toLowerCase();
  
  // Ignora errori non critici
  if (errorLower.includes('404') || errorLower.includes('not found')) {
    return false; // Endpoint opzionali
  }
  if (errorLower.includes('content security policy') || errorLower.includes('csp')) {
    return false; // CSP già risolto
  }
  if (errorLower.includes('network') && errorLower.includes('timeout')) {
    return true; // Timeout è critico
  }
  if (errorLower.includes('500') || errorLower.includes('503')) {
    return true; // Errori server sono critici
  }
  
  // Altri errori sono considerati critici
  return true;
};

/**
 * Fetch e salva in cache memory
 */
const fetchAndCache = async (key, fetcher, options = {}) => {
  try {
    const data = await fetcher();
    if (data !== undefined && data !== null) {
      setCache(key, data, options);
    }
    return data;
  } catch (error) {
    const errorMessage = error.message || String(error);
    
    // Aggiungi solo errori critici
    if (isCriticalError(error)) {
      preloadState.errors.push(`${key}: ${errorMessage}`);
    }
    return null;
  }
};

/**
 * Fetch e salva in cache persistente (localStorage)
 */
const fetchAndCachePersistent = async (key, fetcher, options = {}) => {
  try {
    const data = await fetcher();
    if (data !== undefined && data !== null) {
      setPersistentCache(key, data, options);
      // Salva anche in memory cache per accesso rapido
      setCache(key, data, { ttl: options.ttl || 10 * 60 * 1000 });
    }
    return data;
  } catch (error) {
    const errorMessage = error.message || String(error);
    
    // Aggiungi solo errori critici
    if (isCriticalError(error)) {
      preloadState.errors.push(`${key}: ${errorMessage}`);
    }
    return null;
  }
};

/**
 * Aggiorna progresso
 */
const updateProgress = (progress, onProgress) => {
  preloadState.progress = progress;
  notifyListeners();
  onProgress?.(progress);
};

/**
 * Resetta lo stato del preloader (per cambio azienda)
 */
export const resetPreloader = () => {
  preloadState = {
    isPreloading: false,
    isComplete: false,
    progress: 0,
    errors: [],
    startTime: null,
  };
  notifyListeners();
};

export default {
  preloadAllData,
  getPreloadState,
  onPreloadStateChange,
  resetPreloader,
};

