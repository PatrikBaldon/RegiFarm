import React, { createContext, useContext, useMemo } from 'react';
import { useAuth } from './AuthContext';

const AziendaContext = createContext({
  azienda: null,
  loading: true,
  error: null,
  refresh: async () => {},
});

export const AziendaProvider = ({ children }) => {
  const { profile, initializing, loading, error, refreshProfile, session } = useAuth();

  const value = useMemo(
    () => {
      // Se c'è una sessione ma il profilo non è ancora stato caricato, considera ancora in caricamento
      // Questo previene la visualizzazione del form di login quando fetchProfile fallisce durante il login
      const isProfileLoading = session && !profile && !initializing;
      
      return {
        azienda: profile?.azienda ?? null,
        loading: initializing || loading || isProfileLoading,
        error,
        refresh: refreshProfile,
      };
    },
    [profile?.azienda, initializing, loading, error, refreshProfile, session, profile]
  );

  return <AziendaContext.Provider value={value}>{children}</AziendaContext.Provider>;
};

export const useAzienda = () => useContext(AziendaContext);


