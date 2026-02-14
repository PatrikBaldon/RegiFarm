/**
 * LoadingContext - Context per gestire lo stato di caricamento globale dell'app
 */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useAzienda } from './AziendaContext';
import api from '../services/api';
import { preloadDashboardData } from '../services/dashboardPreload';

const LoadingContext = createContext({
  isLoading: false,
  loadingMessage: '',
  setLoading: () => {},
  checkBackendReady: async () => {},
  homeDataLoaded: false,
  setHomeDataLoaded: () => {},
  setSyncStatus: () => {}, // Nuovo: per aggiornare lo stato di sync
});

export const LoadingProvider = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Caricamento in corso...');
  const { initializing, session, profile, refreshProfile } = useAuth();
  const { loading: aziendaLoading, azienda } = useAzienda();
  const [backendReady, setBackendReady] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false); // Traccia se i dati sono già stati caricati
  const [homeDataLoaded, setHomeDataLoaded] = useState(false); // Traccia se i dati di Home sono caricati
  const [syncStatus, setSyncStatus] = useState(null); // Stato sincronizzazione database locale

  // Verifica che il backend sia pronto
  const checkBackendReady = useCallback(async () => {
    if (backendReady) return true;
    
    try {
      const ready = await api.waitForBackend();
      setBackendReady(ready);
      return ready;
    } catch (error) {

      // Procedi comunque dopo un breve delay
      setTimeout(() => setBackendReady(true), 2000);
      return false;
    }
  }, [backendReady]);

  // Rimossa attesa per caricamento dati Home - caricano in background

  // Aggiorna lo stato di caricamento globale
  useEffect(() => {
    const updateLoadingState = async () => {
      // Se l'auth è ancora in inizializzazione, mostra loading
      if (initializing) {
        setIsLoading(true);
        setLoadingMessage('Verifica credenziali e connessione...');
        return;
      }

      // Se non c'è sessione, non mostrare loading
      if (!session) {
        setIsLoading(false);
        setBackendReady(false);
        setHasLoadedOnce(false); // Reset quando si esce dalla sessione
        return;
      }

      // IMPORTANTE: Se c'è una sessione ma l'azienda non è ancora disponibile,
      // mantieni sempre il loading attivo finché l'azienda non è caricata
      // Questo previene la visualizzazione del form di login durante l'inizializzazione
      if (!azienda || aziendaLoading) {
        setIsLoading(true);
        setLoadingMessage('Caricamento informazioni azienda...');
        return;
      }

      // Se i dati sono già stati caricati in precedenza, NON ripartire il loading
      // Questo previene loop infiniti quando l'utente interagisce con l'app
      if (hasLoadedOnce && azienda && !aziendaLoading) {
        setIsLoading(false);
        return;
      }

      // Se c'è uno stato di sync attivo, mostra quello (PRIORITÀ ALTA - prima di tutto il resto)
      if (syncStatus && (syncStatus.isSyncing || syncStatus.phase)) {
        setIsLoading(true);
        if (syncStatus.phase === 'pull') {
          const pulled = syncStatus.result?.pulled || 0;
          setLoadingMessage(`Sincronizzazione dati dal server... (${pulled} record)`);
        } else if (syncStatus.phase === 'push') {
          const pushed = syncStatus.result?.pushed || 0;
          setLoadingMessage(`Invio modifiche al server... (${pushed} record)`);
        } else if (syncStatus.phase === 'start') {
          setLoadingMessage('Inizializzazione database locale...');
        } else {
          setLoadingMessage('Sincronizzazione database locale...');
        }
        return;
      }

      // Se c'è una sessione ma il profilo non è ancora stato caricato, prova a caricarlo quando il backend è pronto
      if (session && !profile && !initializing && !hasLoadedOnce) {
        const ready = await checkBackendReady();
        
        if (ready) {
          // Backend pronto, prova a caricare il profilo
          setIsLoading(true);
          setLoadingMessage('Caricamento informazioni utente...');
          try {
            await refreshProfile();
          } catch (profileError) {
            console.error('[LoadingContext] Errore durante retry caricamento profilo:', profileError);
            // Continua comunque - il profilo verrà caricato quando possibile
          }
        } else {
          // Backend non ancora pronto, mostra loading
          setIsLoading(true);
          setLoadingMessage('Connessione al server in corso...');
          // Timeout: dopo 3 secondi procedi comunque
          setTimeout(() => {
            setIsLoading(false);
            setHasLoadedOnce(true); // Marca come caricato anche se il backend non risponde
          }, 3000);
        }
      }

      // Verifica che il backend sia pronto (solo se non già verificato e se l'azienda è disponibile)
      if (azienda && !aziendaLoading && !hasLoadedOnce) {
        const ready = await checkBackendReady();
        
        if (!ready) {
          setIsLoading(true);
          setLoadingMessage('Connessione al server in corso...');
          // Timeout: dopo 3 secondi procedi comunque
          setTimeout(() => {
            setIsLoading(false);
            setHasLoadedOnce(true); // Marca come caricato anche se il backend non risponde
          }, 3000);
        } else {
          // Backend pronto: precarica i dati della dashboard durante la rotella
          // così alla prima apertura della Home i dati sono già visibili
          setIsLoading(true);
          setLoadingMessage('Caricamento dati...');
          await preloadDashboardData(azienda.id);
          setIsLoading(false);
          setHasLoadedOnce(true);
        }
      }
    };

    updateLoadingState();
  }, [initializing, session, aziendaLoading, azienda, checkBackendReady, hasLoadedOnce, homeDataLoaded, syncStatus, profile, refreshProfile]);

  const setLoading = useCallback((loading, message = 'Caricamento in corso...') => {
    setIsLoading(loading);
    setLoadingMessage(message);
  }, []);

  // Reset homeDataLoaded quando la sessione cambia
  useEffect(() => {
    if (!session) {
      setHomeDataLoaded(false);
    }
  }, [session]);

  const value = {
    isLoading,
    loadingMessage,
    setLoading,
    checkBackendReady,
    backendReady,
    homeDataLoaded,
    setHomeDataLoaded,
    setSyncStatus, // Espone setter per aggiornare stato sync
  };

  return <LoadingContext.Provider value={value}>{children}</LoadingContext.Provider>;
};

export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within LoadingProvider');
  }
  return context;
};

