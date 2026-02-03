/**
 * Hook per semplificare l'uso delle API con cancellazione automatica
 */
import { useCallback, useEffect, useRef } from 'react';
import { useRequest } from '../context/RequestContext';
import api from '../services/api';

/**
 * Hook per fare richieste API che vengono automaticamente cancellate quando il componente viene smontato
 * @returns {Function} Funzione per fare richieste API con cancellazione automatica
 */
export const useApiRequest = () => {
  const { getAbortController } = useRequest();
  const activeRequestsRef = useRef(new Set());

  // Cleanup quando il componente viene smontato
  useEffect(() => {
    return () => {
      // Cancella tutte le richieste attive quando il componente viene smontato
      activeRequestsRef.current.forEach(({ controller }) => {
        try {
          controller.abort();
        } catch (error) {
          // Ignora errori
        }
      });
      activeRequestsRef.current.clear();
    };
  }, []);

  const makeRequest = useCallback(async (endpoint, options = {}) => {
    // Ottieni un AbortController per questa richiesta
    const { controller, cleanup } = getAbortController();
    const requestId = `${endpoint}_${Date.now()}`;
    
    // Aggiungi alla lista delle richieste attive
    activeRequestsRef.current.add({ controller, requestId, cleanup });
    
    try {
      // Passa il signal al request
      const result = await api.request(endpoint, {
        ...options,
        signal: controller.signal,
      });
      
      // Rimuovi dalla lista delle richieste attive
      activeRequestsRef.current.delete({ controller, requestId, cleanup });
      cleanup();
      
      return result;
    } catch (error) {
      // Rimuovi dalla lista delle richieste attive
      activeRequestsRef.current.delete({ controller, requestId, cleanup });
      cleanup();
      
      // Se è stato cancellato, non è un errore reale
      if (error.message?.includes('cancelled') || error.message?.includes('Request cancelled')) {
        // Restituisci un valore vuoto invece di lanciare un errore
        return null;
      }
      
      throw error;
    }
  }, [getAbortController]);

  return makeRequest;
};

