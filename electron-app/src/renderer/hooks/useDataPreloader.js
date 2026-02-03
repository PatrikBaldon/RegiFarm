/**
 * Hook per gestire il preload dei dati
 * 
 * Uso:
 * const { isPreloading, isComplete, progress, errors } = useDataPreloader(aziendaId);
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  preloadAllData, 
  getPreloadState, 
  onPreloadStateChange,
  resetPreloader 
} from '../services/dataPreloader';

/**
 * Hook per gestire il preload automatico dei dati
 * @param {number|null} aziendaId - ID dell'azienda
 * @param {Object} options - Opzioni
 * @param {boolean} options.autoStart - Avvia automaticamente il preload (default: true)
 * @param {boolean} options.force - Forza ricaricamento anche se già completato
 */
export const useDataPreloader = (aziendaId, options = {}) => {
  const { autoStart = true, force = false } = options;
  
  const [state, setState] = useState(getPreloadState());

  // Sottoscrivi agli aggiornamenti di stato
  useEffect(() => {
    const unsubscribe = onPreloadStateChange(newState => {
      setState(newState);
    });
    return unsubscribe;
  }, []);

  // Avvia preload automaticamente quando cambia aziendaId
  useEffect(() => {
    if (autoStart && aziendaId && (!state.isComplete || force)) {
      // Reset se cambia azienda
      resetPreloader();
      preloadAllData(aziendaId, { force });
    }
  }, [aziendaId, autoStart, force]); // Rimuovo state.isComplete per evitare loop

  // Funzione per avviare manualmente il preload
  const startPreload = useCallback((opts = {}) => {
    if (aziendaId) {
      return preloadAllData(aziendaId, opts);
    }
    return Promise.resolve(false);
  }, [aziendaId]);

  // Funzione per forzare il refresh
  const forceRefresh = useCallback(() => {
    if (aziendaId) {
      resetPreloader();
      return preloadAllData(aziendaId, { force: true });
    }
    return Promise.resolve(false);
  }, [aziendaId]);

  return {
    isPreloading: state.isPreloading,
    isComplete: state.isComplete,
    progress: state.progress,
    errors: state.errors,
    startPreload,
    forceRefresh,
    reset: resetPreloader,
  };
};

export default useDataPreloader;

