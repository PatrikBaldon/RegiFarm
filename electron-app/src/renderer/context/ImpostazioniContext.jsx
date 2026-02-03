import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { impostazioniService } from '../services/impostazioniService';
import { useAzienda } from './AziendaContext';

const ImpostazioniContext = createContext(null);

export const useImpostazioni = () => {
  const context = useContext(ImpostazioniContext);
  if (!context) {
    throw new Error('useImpostazioni must be used within ImpostazioniProvider');
  }
  return context;
};

// Impostazioni di default per non bloccare il rendering
const DEFAULT_IMPOSTAZIONI = {
  moduli: { moduli_abilitati: ['home', 'allevamento', 'sanitario', 'alimentazione', 'terreni', 'amministrazione', 'attrezzatura', 'profilo'] },
};

export const ImpostazioniProvider = ({ children }) => {
  const { azienda } = useAzienda();
  const aziendaId = azienda?.id;
  
  // Inizia con i default - NON bloccare il rendering
  const [impostazioni, setImpostazioni] = useState(DEFAULT_IMPOSTAZIONI);
  const [loading, setLoading] = useState(false); // false perché abbiamo già i default
  const [error, setError] = useState(null);
  const isLoadingRef = React.useRef(false); // Prevenire chiamate multiple simultanee
  const hasLoadedRef = React.useRef(false); // Traccia se è già stato caricato

  const loadImpostazioni = useCallback(async () => {
    // Se non c'è aziendaId, non caricare
    if (!aziendaId) {
      return;
    }
    
    // Se è già in caricamento, non fare nulla
    if (isLoadingRef.current) {
      return;
    }
    
    // Non setLoading(true) per non bloccare l'UI
    setError(null);
    isLoadingRef.current = true;
    try {
      const data = await impostazioniService.getImpostazioni(aziendaId);
      if (data) {
        setImpostazioni(data);
        hasLoadedRef.current = true;
      }
    } catch (err) {
      // Log solo se non è già stato caricato (evita log multipli)
      if (!hasLoadedRef.current) {

      // Mantieni i default, non bloccare l'app

      }
      setError(null);
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [aziendaId]);

  const saveImpostazioni = useCallback(async (data) => {
    if (!aziendaId) {
      throw new Error('aziendaId non disponibile per salvare le impostazioni');
    }
    try {
      await impostazioniService.saveImpostazioni(data, aziendaId);
      // Ricarica automaticamente le impostazioni dopo il salvataggio
      await loadImpostazioni();
      return true;
    } catch (err) {

      throw err;
    }
  }, [loadImpostazioni, aziendaId]);

  // Aggiorna le impostazioni e salva automaticamente in backend
  const updateImpostazioni = useCallback((updater) => {
    if (!aziendaId) {

      return;
    }
    
    setImpostazioni(prev => {
      const updated = typeof updater === 'function' ? updater(prev) : updater;
      
      // Assicurati che le impostazioni includano tutti i campi richiesti dallo schema
      const impostazioniComplete = {
        moduli: updated.moduli || prev.moduli || {},
        amministrazione: updated.amministrazione || prev.amministrazione || {},
        attrezzature: updated.attrezzature || prev.attrezzature || {},
        prima_nota: updated.prima_nota || prev.prima_nota || {},
      };
      
      // Salva automaticamente in backend (async, non blocca l'aggiornamento UI)
      // Usa un timeout per evitare troppe chiamate rapide (debounce implicito)
      setTimeout(() => {
        impostazioniService.saveImpostazioni(impostazioniComplete, aziendaId).then(() => {
          // Ricarica dopo il salvataggio per sincronizzare
          loadImpostazioni();
        }).catch(err => {

        });
      }, 100);
      
      return updated;
    });
  }, [loadImpostazioni, aziendaId]);

  useEffect(() => {
    // Carica quando aziendaId è disponibile o cambia
    if (aziendaId && !hasLoadedRef.current && !isLoadingRef.current) {
      loadImpostazioni();
    }
    // Reset quando cambia azienda
    if (aziendaId) {
      hasLoadedRef.current = false;
    }
  }, [aziendaId, loadImpostazioni]);

  const value = {
    impostazioni,
    loading,
    error,
    loadImpostazioni,
    saveImpostazioni,
    updateImpostazioni,
  };

  return (
    <ImpostazioniContext.Provider value={value}>
      {children}
    </ImpostazioniContext.Provider>
  );
};

