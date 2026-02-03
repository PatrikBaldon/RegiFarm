import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, useRef } from 'react';

import api from '../services/api';
import { isSupabaseConfigured, supabase } from '../services/supabaseClient';
import localDataService from '../services/localDataService';

const AuthContext = createContext({
  initializing: true,
  loading: false,
  session: null,
  profile: null,
  firstLoginRequired: false,
  pendingApproval: false,
  error: null,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
  completeFirstLogin: async () => {},
  refreshProfile: async () => {},
  recordActivity: () => {}, // Registra attività utente per resettare il timer di inattività
});

const missingSupabaseError = new Error(
  'Configurazione Supabase mancante. Verifica il file .env e le variabili SUPABASE_URL / SUPABASE_ANON_KEY.'
);

// Costanti per la gestione della sessione
const THIRTY_MINUTES_MS = 30 * 60 * 1000; // 30 minuti di inattività = logout automatico
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000; // 12 ore dall'ultimo login = richiede nuovo login

// Chiavi localStorage
const LAST_LOGIN_STORAGE_KEY = 'regifarm:lastLoginAt';
const LAST_ACTIVITY_STORAGE_KEY = 'regifarm:lastActivityAt';
const MANUAL_LOGOUT_STORAGE_KEY = 'regifarm:manualLogout';

// --- Gestione timestamp ultimo LOGIN ---
const readLastLoginTimestamp = () => {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(LAST_LOGIN_STORAGE_KEY);
  if (!raw) return null;
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const writeLastLoginTimestamp = (value = Date.now()) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LAST_LOGIN_STORAGE_KEY, value.toString());
};

const clearLastLoginTimestamp = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(LAST_LOGIN_STORAGE_KEY);
};

// --- Gestione timestamp ultima ATTIVITÀ ---
const readLastActivityTimestamp = () => {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY);
  if (!raw) return null;
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const writeLastActivityTimestamp = (value = Date.now()) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, value.toString());
};

const clearLastActivityTimestamp = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(LAST_ACTIVITY_STORAGE_KEY);
};

// --- Gestione flag LOGOUT MANUALE ---
const wasManualLogout = () => {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(MANUAL_LOGOUT_STORAGE_KEY) === 'true';
};

const setManualLogout = (value = true) => {
  if (typeof window === 'undefined') return;
  if (value) {
    window.localStorage.setItem(MANUAL_LOGOUT_STORAGE_KEY, 'true');
  } else {
    window.localStorage.removeItem(MANUAL_LOGOUT_STORAGE_KEY);
  }
};

const clearManualLogout = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(MANUAL_LOGOUT_STORAGE_KEY);
};

// Verifica se l'utente è inattivo da più di 30 minuti
const isInactiveTimeout = () => {
  const lastActivity = readLastActivityTimestamp();
  if (lastActivity === null) return true;
  return Date.now() - lastActivity >= THIRTY_MINUTES_MS;
};

// Verifica se sono passate più di 12 ore dall'ultimo login
const isLoginExpired = () => {
  const lastLogin = readLastLoginTimestamp();
  if (lastLogin === null) return true;
  return Date.now() - lastLogin >= TWELVE_HOURS_MS;
};

// Verifica se deve essere mostrata la pagina di login
const shouldRequireLogin = () => {
  // Se c'è stato un logout manuale, richiede sempre login
  if (wasManualLogout()) {
    return true;
  }
  // Se sono passate più di 12 ore dall'ultimo login, richiede login
  if (isLoginExpired()) {
    return true;
  }
  return false;
};

// Verifica se la sessione è ancora valida (per controlli periodici)
const isSessionStillValid = () => {
  // Se c'è stato logout manuale, sessione non valida
  if (wasManualLogout()) {
    return false;
  }
  // Se inattivo da più di 30 minuti, sessione non valida
  if (isInactiveTimeout()) {
    return false;
  }
  // Se sono passate più di 12 ore dall'ultimo login, sessione non valida
  if (isLoginExpired()) {
    return false;
  }
  return true;
};

// Verifica se un token JWT è scaduto
const isTokenExpired = (expiresAt) => {
  if (!expiresAt) return true;
  // expiresAt è in secondi (Unix timestamp), converto in millisecondi
  const expirationTime = expiresAt * 1000;
  const now = Date.now();
  // Aggiungo un margine di 5 minuti per sicurezza
  return now >= (expirationTime - 5 * 60 * 1000);
};

export const AuthProvider = ({ children }) => {
  const [initializing, setInitializing] = useState(true);
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(isSupabaseConfigured ? null : missingSupabaseError);
  const [firstLoginRequired, setFirstLoginRequired] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(false);
  const processedSessionsRef = useRef(new Set()); // Traccia le sessioni già processate - DEVE essere a livello componente
  const inactivityTimerRef = useRef(null); // Timer per logout automatico dopo inattività
  const sessionRef = useRef(null); // Ref per accedere alla sessione nei listener senza causare re-render

  // Funzione per registrare attività utente (chiamata da componenti quando aprono modali, eliminano record, ecc.)
  const recordActivity = useCallback(() => {
    writeLastActivityTimestamp();
    // Reset del timer di inattività
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    // Imposta nuovo timer per logout dopo 30 minuti di inattività
    inactivityTimerRef.current = setTimeout(async () => {
      console.log('[AuthContext] Logout automatico per inattività (30 minuti)');
      if (supabase) {
        try {
          await supabase.auth.signOut();
        } catch (err) {
          // Ignora errori
        }
      }
      api.setAuthToken(null);
      setSession(null);
      setProfile(null);
      setFirstLoginRequired(false);
      setPendingApproval(false);
      clearLastActivityTimestamp();
      // NON impostare manualLogout - è un logout automatico
    }, THIRTY_MINUTES_MS);
  }, []);

  const fetchProfile = useCallback(
    async (accessToken) => {
      if (!accessToken) {

        api.setAuthToken(null);
        setProfile(null);
        setFirstLoginRequired(false);
        return null;
      }


      api.setAuthToken(accessToken);
      try {
        const data = await api.get('/onboarding/me');
        
        // Verifica che i dati siano validi
        if (!data) {
          throw new Error('Profilo vuoto ricevuto dal server');
        }
        
        setProfile(data);
        const userState = data?.utente?.stato;
        setFirstLoginRequired(userState === 'invited');
        setPendingApproval(userState === 'pending');
        setError(null);
        
        // Restituisci il profilo caricato
        return data;
        
      } catch (err) {

        
        // Se è un errore 503 (Service Unavailable), non bloccare l'app
        // L'app può funzionare in modalità limitata
        if (err?.status === 503 || err?.isServiceUnavailable) {
          // Non impostare il profilo, ma non bloccare l'app
          setError(err);
          setProfile(null);
          setFirstLoginRequired(false);
          setPendingApproval(false);
          // Non rilanciare l'errore per 503 - permette all'app di continuare
          return null;
        }
        
        setError(err);
        setProfile(null);
        setFirstLoginRequired(false);
        setPendingApproval(false);
        // Rilancia l'errore per permettere al chiamante di gestirlo
        throw err;
      }
    },
    []
  );

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setInitializing(false);
      return undefined;
    }

    let isMounted = true;

    const init = async () => {
      try {
        // Prima prova a recuperare la sessione da Supabase (persistita in localStorage)
        let sessionData;
        try {
          const result = await supabase.auth.getSession();
          sessionData = result.data;
        } catch (sessionError) {
          // Refresh token non valido/scaduto (es. "Refresh Token Not Found", "Invalid Refresh Token")
          const msg = sessionError?.message || String(sessionError);
          if (msg.includes('Refresh Token') && (msg.includes('Not Found') || msg.includes('Invalid'))) {
            console.log('[AuthContext] Refresh token non valido, richiesto nuovo login');
            try {
              await supabase.auth.signOut();
            } catch (_) {}
            clearLastLoginTimestamp();
            clearLastActivityTimestamp();
            api.setAuthToken(null);
            setSession(null);
            setProfile(null);
            setFirstLoginRequired(false);
            setPendingApproval(false);
            if (isMounted) setInitializing(false);
            return;
          }
          throw sessionError;
        }

        if (sessionData?.session?.access_token) {
          // Verifica la scadenza effettiva del token JWT
          const expiresAt = sessionData.session.expires_at;
          const tokenExpired = isTokenExpired(expiresAt);
          
          // Verifica se richiedere login:
          // 1. Logout manuale = sempre richiede login
          // 2. Più di 12 ore dall'ultimo login = richiede login
          // 3. Token JWT scaduto = richiede login
          const requireLogin = shouldRequireLogin();
          
          if (tokenExpired || requireLogin) {
            // Token scaduto o sessione non valida - richiedi nuovo login
            const reason = tokenExpired 
              ? 'Token JWT scaduto' 
              : wasManualLogout()
              ? 'Logout manuale precedente'
              : 'Sessione scaduta (oltre 12 ore)';
            
            console.log(`[AuthContext] Richiesto nuovo login: ${reason}`);

            try {
              await supabase.auth.signOut();
            } catch (signOutError) {
              // Ignora errori
            }
            // Pulisci tutto (ma NON il flag manualLogout - viene pulito solo al nuovo login)
            clearLastLoginTimestamp();
            clearLastActivityTimestamp();
            api.setAuthToken(null);
            setSession(null);
            setProfile(null);
            setFirstLoginRequired(false);
            setPendingApproval(false);
          } else {
            // Sessione valida: token non scaduto e dentro la finestra di 12 ore
            console.log('[AuthContext] Sessione valida, ripristino automatico');
            setSession(sessionData.session);
            // Prova a caricare il profilo, ma non bloccare se fallisce
            try {
              await fetchProfile(sessionData.session.access_token);
            } catch (profileError) {
              // Non bloccare l'app se il profilo non può essere caricato
              // L'app può funzionare in modalità limitata
            }
            // Registra attività per avviare il timer di inattività
            recordActivity();
            setInitializing(false);
            return;
          }
        } else {
          console.log('[AuthContext] Nessuna sessione trovata');
        }

        // Nessuna sessione valida o scaduta: pulisci tutto
        clearLastLoginTimestamp();
        clearLastActivityTimestamp();
        api.setAuthToken(null);
        setSession(null);
        setProfile(null);
        setFirstLoginRequired(false);
        setPendingApproval(false);
      } catch (err) {
        console.error('[AuthContext] Errore durante init:', err);
        setError(err);
      } finally {
        if (isMounted) {
          setInitializing(false);
        }
      }
    };

    // Timeout di sicurezza per evitare che l'app rimanga bloccata in caricamento
    const initTimeout = setTimeout(() => {
      if (isMounted) {

        setInitializing(false);
      }
    }, 5000);

    init().finally(() => {
      clearTimeout(initTimeout);
    });

    let listener = null;
    try {
      const listenerData = supabase.auth.onAuthStateChange(async (event, newSession) => {
        console.log(`[AuthContext] Auth state change: ${event}`);
        
        if (event === 'SIGNED_IN' && newSession?.access_token) {
          // Evita di processare la stessa sessione più volte
          const sessionKey = `${newSession.access_token.substring(0, 20)}_${newSession.expires_at}`;
          if (processedSessionsRef.current.has(sessionKey)) {
            return;
          }
          processedSessionsRef.current.add(sessionKey);
          
          // Pulisci sessioni vecchie (mantieni solo le ultime 5)
          if (processedSessionsRef.current.size > 5) {
            const firstKey = processedSessionsRef.current.values().next().value;
            processedSessionsRef.current.delete(firstKey);
          }
          
          setSession(newSession);
          // Prova a caricare il profilo, ma non bloccare se fallisce
          try {
            await fetchProfile(newSession.access_token);
          } catch (profileError) {
            // Non bloccare l'app se il profilo non può essere caricato
          }
          // Nuovo login: registra timestamp e pulisci flag logout manuale
          writeLastLoginTimestamp();
          clearManualLogout();
          recordActivity(); // Avvia timer inattività
        } else if (event === 'TOKEN_REFRESHED' && newSession?.access_token) {
          // Token refreshato con successo - mantieni la sessione solo se ancora valida
          const sessionValid = isSessionStillValid();
          if (sessionValid) {
            setSession(newSession);
            api.setAuthToken(newSession.access_token);
            // NON resettare il timestamp login - mantieni quello originale
          } else {
            console.log('[AuthContext] Sessione non più valida durante refresh token');
            try {
              await supabase.auth.signOut();
            } catch (signOutErr) {
              // Ignora errori
            }
          }
        } else if (event === 'INITIAL_SESSION' && newSession?.access_token) {
          // Sessione iniziale recuperata da localStorage - già gestita in init()
          console.log('[AuthContext] Sessione iniziale già gestita in init()');
        } else if (event === 'SIGNED_OUT') {
          api.setAuthToken(null);
          setProfile(null);
          setFirstLoginRequired(false);
          setPendingApproval(false);
          setSession(null);
          clearLastLoginTimestamp();
          clearLastActivityTimestamp();
          // Cancella timer inattività
          if (inactivityTimerRef.current) {
            clearTimeout(inactivityTimerRef.current);
            inactivityTimerRef.current = null;
          }
        }
      });
      listener = listenerData;
    } catch (listenerError) {
      console.error('[AuthContext] Errore listener:', listenerError);
      if (isMounted) setInitializing(false);
      return undefined;
    }

    // Controllo periodico per scadenza sessione e token (ogni minuto)
    const tokenCheckInterval = setInterval(async () => {
      if (!isMounted || !supabase) {
        clearInterval(tokenCheckInterval);
        return;
      }
      
      try {
        let currentSession;
        try {
          const result = await supabase.auth.getSession();
          currentSession = result.data;
        } catch (sessionErr) {
          const msg = sessionErr?.message || String(sessionErr);
          if (msg.includes('Refresh Token') && (msg.includes('Not Found') || msg.includes('Invalid'))) {
            console.log('[AuthContext] Refresh token non valido (check), logout');
            try {
              await supabase.auth.signOut();
            } catch (_) {}
            api.setAuthToken(null);
            setProfile(null);
            setFirstLoginRequired(false);
            setSession(null);
            clearLastLoginTimestamp();
            clearLastActivityTimestamp();
          }
          return;
        }

        const sessionValid = isSessionStillValid();
        const tokenExpired = currentSession?.session 
          ? isTokenExpired(currentSession.session.expires_at)
          : true;
        
        // Verifica se la sessione è ancora valida
        if (!sessionValid || tokenExpired || !currentSession?.session?.access_token) {
          const reason = !sessionValid 
            ? (isInactiveTimeout() ? 'Inattività (30 min)' : 'Sessione scaduta (12 ore)')
            : tokenExpired 
            ? 'Token JWT scaduto'
            : 'Nessuna sessione valida';

          console.log(`[AuthContext] Logout automatico: ${reason}`);
          try {
            await supabase.auth.signOut();
          } catch (signOutErr) {
            // Ignora errori
          }
          api.setAuthToken(null);
          setProfile(null);
          setFirstLoginRequired(false);
          setSession(null);
          clearLastLoginTimestamp();
          clearLastActivityTimestamp();
        }
      } catch (checkErr) {
        console.error('[AuthContext] Errore durante controllo sessione:', checkErr);
      }
    }, 60 * 1000); // Controlla ogni minuto

    // Al close della finestra, NON fare logout automatico - lascia che la sessione persista
    // Il controllo all'avvio deciderà se richiedere login (12 ore o logout manuale)

    return () => {
      isMounted = false;
      if (listener?.subscription) {
        listener.subscription.unsubscribe();
      }
      clearInterval(tokenCheckInterval);
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [fetchProfile, recordActivity]);

  // Aggiorna la ref della sessione quando cambia (senza causare re-render)
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // Listener separato per attività utente - NON dipende da session per evitare loop
  useEffect(() => {
    // Listener per attività utente (click, tastiera, scroll)
    const handleUserActivity = () => {
      // Usa la ref per verificare se c'è una sessione attiva
      if (sessionRef.current) {
        recordActivity();
      }
    };

    // Aggiungi listener per eventi di interazione
    window.addEventListener('click', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('scroll', handleUserActivity);

    return () => {
      window.removeEventListener('click', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('scroll', handleUserActivity);
    };
  }, [recordActivity]);

  const ensureConfigured = useCallback(() => {
    if (!isSupabaseConfigured) {
      throw missingSupabaseError;
    }
  }, []);

  const signIn = useCallback(
    async (email, password) => {
      ensureConfigured();
      setLoading(true);
      try {
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (authError) {
          throw authError;
        }
        setSession(data.session);
        if (data.session?.access_token) {
          try {
            const loadedProfile = await fetchProfile(data.session.access_token);
            
            // Dopo il login, sincronizza i dati dal server
            const aziendaId = loadedProfile?.azienda?.id;
            if (aziendaId && data.session?.access_token) {
              try {
                // Imposta token per sync
                await localDataService.setAuthToken(data.session.access_token);
                await localDataService.setAziendaId(aziendaId);
                
                // Verifica se serve sync iniziale
                const needsInitial = await localDataService.needsInitialSync(aziendaId);
                
                if (needsInitial) {
                  console.log('[AuthContext] Esecuzione sync iniziale dopo login...');
                  await localDataService.initialSync(aziendaId);
                } else {
                  // Sync normale (pull aggiornamenti)
                  console.log('[AuthContext] Sincronizzazione dati dopo login...');
                  await localDataService.triggerSync();
                }
              } catch (syncErr) {
                // Non bloccare il login se la sync fallisce
                console.error('[AuthContext] Errore durante sync dopo login:', syncErr);
                // Le modifiche locali rimangono e verranno sincronizzate quando possibile
              }
            }
          } catch (profileError) {
            // Se fetchProfile fallisce (ad esempio backend non pronto), NON bloccare il login
            // La sessione è valida e il profilo verrà caricato quando il backend sarà pronto
            console.error('[AuthContext] Errore durante caricamento profilo dopo login:', profileError);
            // La sessione rimane valida, il profilo verrà caricato quando possibile
            // AziendaContext manterrà loading = true finché il profilo non sarà caricato
          }
        }
        // Login riuscito: registra timestamp e pulisci flag logout manuale
        writeLastLoginTimestamp();
        clearManualLogout(); // Pulisci il flag di logout manuale
        recordActivity(); // Avvia timer inattività
        return data.session;
      } finally {
        setLoading(false);
      }
    },
    [ensureConfigured, fetchProfile, recordActivity]
  );

  const signUp = useCallback(
    async (email, password) => {
      ensureConfigured();
      setLoading(true);
      try {
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (authError) {
          throw authError;
        }
        return data;
      } finally {
        setLoading(false);
      }
    },
    [ensureConfigured]
  );

  const signOut = useCallback(async () => {
    ensureConfigured();
    setLoading(true);
    
    // Verifica se ci sono modifiche pendenti
    const aziendaId = profile?.azienda?.id;
    let pendingCount = 0;
    let hasPending = false;
    
    if (aziendaId) {
      try {
        const syncStatus = await localDataService.getSyncStatus();
        pendingCount = syncStatus?.pendingCount || 0;
        hasPending = pendingCount > 0;
      } catch (err) {
        console.error('[AuthContext] Errore durante verifica sync al logout:', err);
      }
    }
    
    // Se ci sono modifiche pendenti, avvisa l'utente
    if (hasPending && navigator.onLine) {
      // Avvisa che l'app rimarrà in background per completare la sync
      window.alert(
        `ℹ️ Sincronizzazione in corso\n\n` +
        `Hai ${pendingCount} modifiche da sincronizzare su Supabase.\n\n` +
        `L'applicazione rimarrà attiva in background per completare la sincronizzazione.\n` +
        `Puoi chiudere la finestra: il processo continuerà in background fino al completamento.`
      );
      
      // Avvia sync in background (non blocca)
      localDataService.triggerSync().catch(err => {
        console.error('[AuthContext] Errore durante sync in background:', err);
      });
    } else if (hasPending && !navigator.onLine) {
      // Offline: avvisa che le modifiche verranno sincronizzate quando torna online
      window.alert(
        `ℹ️ Sei offline\n\n` +
        `Hai ${pendingCount} modifiche salvate localmente.\n\n` +
        `Le modifiche verranno sincronizzate automaticamente quando tornerai online.`
      );
    }
    
    // Procedi con il logout MANUALE
    console.log('[AuthContext] Logout manuale - richiederà login alla prossima apertura');
    try {
      await supabase.auth.signOut();
      api.setAuthToken(null);
      setSession(null);
      setProfile(null);
      setFirstLoginRequired(false);
      setPendingApproval(false);
      clearLastLoginTimestamp();
      clearLastActivityTimestamp();
      setManualLogout(true); // IMPORTANTE: Imposta flag logout manuale
      // Cancella timer inattività
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
    } finally {
      setLoading(false);
    }
  }, [ensureConfigured, profile?.azienda?.id]);

  const completeFirstLogin = useCallback(
    async (newPassword) => {
      ensureConfigured();
      if (!session?.user) {
        throw new Error('Sessione non trovata');
      }
      setLoading(true);
      try {
        const { data, error: updateError } = await supabase.auth.updateUser({
          password: newPassword,
        });
        if (updateError) {
          throw updateError;
        }
        if (data?.session) {
          setSession(data.session);
        }
        if (!profile?.utente?.auth_user_id) {
          throw new Error('Profilo utente non disponibile per il primo login');
        }
        await api.post('/onboarding/utenti/first-login', {
          auth_user_id: profile.utente.auth_user_id,
        });
        setFirstLoginRequired(false);
        await fetchProfile((data?.session || session)?.access_token);
        writeLastLoginTimestamp();
        clearManualLogout();
        recordActivity();
      } finally {
        setLoading(false);
      }
    },
    [ensureConfigured, fetchProfile, profile?.utente?.auth_user_id, session, recordActivity]
  );

  const refreshProfile = useCallback(async () => {
    ensureConfigured();
    if (session?.access_token) {
      await fetchProfile(session.access_token);
    }
  }, [ensureConfigured, fetchProfile, session?.access_token]);

  const value = useMemo(
    () => ({
      initializing,
      loading,
      session,
      profile,
      firstLoginRequired,
      pendingApproval,
      error,
      signIn,
      signUp,
      signOut,
      completeFirstLogin,
      refreshProfile,
      recordActivity, // Esposto per permettere ai componenti di registrare interazioni significative
    }),
    [
      initializing,
      loading,
      session,
      profile,
      firstLoginRequired,
      pendingApproval,
      error,
      signIn,
      signUp,
      signOut,
      completeFirstLogin,
      refreshProfile,
      recordActivity,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
