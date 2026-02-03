/**
 * RequestContext - Context per gestire le richieste API attive per modulo
 * Permette di cancellare tutte le richieste di un modulo quando si cambia tab
 */
import React, { createContext, useContext, useRef, useCallback, useEffect } from 'react';

const RequestContext = createContext({
  registerAbortController: () => {},
  cancelModuleRequests: () => {},
  getAbortController: () => null,
  isActive: true,
});

export const RequestProvider = ({ children, moduleId, isActive = true }) => {
  // Mappa di AbortController per ogni richiesta attiva
  const abortControllersRef = useRef(new Map());
  const requestIdCounterRef = useRef(0);

  // Registra un AbortController per una richiesta
  const registerAbortController = useCallback((requestId, controller) => {
    abortControllersRef.current.set(requestId, controller);
    return () => {
      abortControllersRef.current.delete(requestId);
    };
  }, []);

  // Cancella tutte le richieste del modulo corrente
  const cancelModuleRequests = useCallback(() => {
    abortControllersRef.current.forEach((controller, requestId) => {
      try {
        controller.abort();
      } catch (error) {
        // Ignora errori se il controller è già stato abortito
      }
    });
    abortControllersRef.current.clear();
  }, []);

  // Ottieni un nuovo AbortController per una richiesta
  const getAbortController = useCallback(() => {
    // Permetti sempre le richieste - il controllo isActive è fatto a livello di componente
    // Questo permette richieste manuali anche quando il modulo non è attivo
    const requestId = `req_${moduleId}_${++requestIdCounterRef.current}`;
    const controller = new AbortController();
    registerAbortController(requestId, controller);
    return { controller, requestId, cleanup: () => abortControllersRef.current.delete(requestId) };
  }, [moduleId, registerAbortController]);

  // Cancella tutte le richieste quando il modulo viene smontato (non quando è solo nascosto)
  useEffect(() => {
    return () => {
      // Solo quando il componente viene completamente smontato
      cancelModuleRequests();
    };
  }, [cancelModuleRequests]);
  
  // NON cancellare le richieste quando il modulo diventa inattivo
  // Questo permette alle richieste di completarsi anche quando si cambia tab
  // Le richieste verranno comunque cancellate quando il modulo viene smontato

  const value = {
    registerAbortController,
    cancelModuleRequests,
    getAbortController,
    moduleId,
    isActive,
  };

  return <RequestContext.Provider value={value}>{children}</RequestContext.Provider>;
};

export const useRequest = () => {
  const context = useContext(RequestContext);
  if (!context) {
    // Se non c'è un RequestProvider, restituisci funzioni no-op
    return {
      registerAbortController: () => () => {},
      cancelModuleRequests: () => {},
      getAbortController: () => ({ controller: new AbortController(), requestId: 'default', cleanup: () => {} }),
      moduleId: 'default',
    };
  }
  return context;
};

