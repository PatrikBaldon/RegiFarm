/**
 * Hook per Database Locale e Sincronizzazione
 * 
 * Gestisce l'inizializzazione del database locale, la sincronizzazione
 * con Supabase e fornisce metodi per accedere ai dati locali.
 * 
 * Uso:
 *   const { 
 *     isReady, 
 *     isOnline,
 *     syncStatus,
 *     localData,
 *     forceSync 
 *   } = useLocalDatabase(aziendaId, authToken);
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import localDataService from '../services/localDataService';

/**
 * Hook principale per database locale
 * @param {number} aziendaId - ID dell'azienda corrente
 * @param {string} authToken - Token JWT per autenticazione sync
 */
export const useLocalDatabase = (aziendaId, authToken) => {
  const [isReady, setIsReady] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState({
    isSyncing: false,
    lastSync: null,
    pendingCount: 0,
    error: null,
  });
  const [initialSyncDone, setInitialSyncDone] = useState(false);
  
  const initRef = useRef(false);

  // Monitora stato online/offline
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Inizializza database locale
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const init = async () => {
      try {

        
        // Inizializza database locale
        const success = await localDataService.init();
        
        if (success) {

          
          // Setup listener per aggiornamenti sync
          localDataService.setOnSyncUpdate((data) => {

            setSyncStatus({
              isSyncing: data.status === 'syncing',
              phase: data.phase || null,
              lastSync: data.lastSync || null,
              error: data.error || null,
              result: data.result || null,
            });
          });

          setIsReady(true);
        } else {

        }
      } catch (error) {

        // Continua comunque, userà API online come fallback
        setIsReady(false);
      }
    };

    init();
  }, []);

  // Traccia azienda precedente per pulizia al cambio
  const prevAziendaIdRef = useRef(null);

  // Quando abbiamo aziendaId e token, configura sync
  useEffect(() => {
    if (!isReady || !aziendaId || !authToken) return;

    const setupSync = async () => {
      try {
        // Se è cambiata l'azienda, pulisci dati vecchi
        if (prevAziendaIdRef.current && prevAziendaIdRef.current !== aziendaId) {

          await localDataService.clearAziendaData(prevAziendaIdRef.current);
          // Reset stato sync
          setInitialSyncDone(false);
        }
        prevAziendaIdRef.current = aziendaId;

        // Imposta token e azienda per sync
        await localDataService.setAuthToken(authToken);
        if (aziendaId) {
          await localDataService.setAziendaId(aziendaId);
        }

        // Verifica se serve sync iniziale
        const needsInitial = await localDataService.needsInitialSync(aziendaId);
        
        if (needsInitial) {

          setSyncStatus(prev => ({ ...prev, isSyncing: true }));
          
          const result = await localDataService.initialSync(aziendaId);
          
          if (result.success) {

            setInitialSyncDone(true);
          } else {

            setSyncStatus(prev => ({ ...prev, error: result.error }));
          }
        } else {
          setInitialSyncDone(true);
        }

        // Avvia sync periodica se online
        if (isOnline) {
          await localDataService.startSync();
        }

      } catch (error) {

      }
    };

    setupSync();

    // Cleanup: ferma sync quando smonta
    return () => {
      localDataService.stopSync();
    };
  }, [isReady, aziendaId, authToken, isOnline]);

  // Avvia/ferma sync in base a stato online
  useEffect(() => {
    if (!isReady || !initialSyncDone) return;

    if (isOnline) {
      localDataService.startSync();
      // Trigger sync immediata quando torna online
      localDataService.triggerSync();
    } else {
      localDataService.stopSync();
    }
  }, [isOnline, isReady, initialSyncDone]);

  // Force sync manuale
  const forceSync = useCallback(async () => {
    if (!isOnline) {
      return { success: false, error: 'Offline' };
    }
    setSyncStatus(prev => ({ ...prev, isSyncing: true }));
    const result = await localDataService.triggerSync();
    setSyncStatus(prev => ({ 
      ...prev, 
      isSyncing: false,
      lastSync: new Date().toISOString(),
      error: result.error || null,
    }));
    return result;
  }, [isOnline]);

  // Ottieni stato sync
  const refreshSyncStatus = useCallback(async () => {
    const status = await localDataService.getSyncStatus();
    if (status) {
      setSyncStatus(prev => ({
        ...prev,
        ...status,
      }));
    }
  }, []);

  return {
    // Stato
    isReady: isReady && initialSyncDone,
    isInitializing: isReady && !initialSyncDone,
    isOnline,
    syncStatus,
    
    // Servizio dati locali
    localData: localDataService,
    
    // Azioni
    forceSync,
    refreshSyncStatus,
  };
};

/**
 * Hook semplificato per accedere ai dati locali
 * Usa in componenti che hanno già inizializzato useLocalDatabase a livello superiore
 */
export const useLocalData = () => {
  return localDataService;
};

export default useLocalDatabase;

