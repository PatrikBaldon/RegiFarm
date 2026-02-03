import React, { useEffect, useRef, useState } from 'react';
import './App.css';
import './components/auth/Auth.css';
import Home from './components/Home';
import Sidebar from './components/layout/Sidebar';
import Allevamento from './modules/allevamento/components/Allevamento';
import Sanitario from './modules/sanitario/components/Sanitario';
import Alimentazione from './modules/alimentazione/components/Alimentazione';
import Terreni from './modules/terreni/components/Terreni';
import Amministrazione from './modules/amministrazione/components/Amministrazione';
import Attrezzatura from './modules/attrezzatura/components/Attrezzatura';
import Profilo from './modules/profilo/components/Profilo';
import { useAuth } from './context/AuthContext';
import { AziendaProvider } from './context/AziendaContext';
import { ImpostazioniProvider } from './context/ImpostazioniContext';
import { LoadingProvider, useLoading } from './context/LoadingContext';
import { RequestProvider } from './context/RequestContext';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import FirstAccess from './components/auth/FirstAccess';
import PendingApproval from './components/auth/PendingApproval';
import LoadingSpinner from './components/LoadingSpinner';
import { useAzienda } from './context/AziendaContext';
import useDataPreloader from './hooks/useDataPreloader';
import useLocalDatabase from './hooks/useLocalDatabase';
import introVideo from './assets/RegiFarm_welcome.mp4';

// Costanti per il controllo del video
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
const LAST_LOGIN_STORAGE_KEY = 'regifarm:lastLoginAt';
const MANUAL_LOGOUT_STORAGE_KEY = 'regifarm:manualLogout';

// Verifica se mostrare il video (passate più di 12 ore dall'ultimo login o logout manuale)
const shouldShowIntroVideo = () => {
  if (typeof window === 'undefined') return true;
  
  // Se c'è stato un logout manuale, mostra il video
  const wasManualLogout = window.localStorage.getItem(MANUAL_LOGOUT_STORAGE_KEY) === 'true';
  if (wasManualLogout) {
    return true;
  }
  
  // Verifica l'ultimo login
  const raw = window.localStorage.getItem(LAST_LOGIN_STORAGE_KEY);
  if (!raw) return true; // Nessun login precedente, mostra il video
  
  const lastLogin = parseInt(raw, 10);
  if (Number.isNaN(lastLogin)) return true;
  
  // Mostra il video solo se sono passate più di 12 ore
  return Date.now() - lastLogin >= TWELVE_HOURS_MS;
};

function App() {
  const { initializing, loading, session, firstLoginRequired, pendingApproval } = useAuth();
  const [activeModule, setActiveModule] = useState('home');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [authView, setAuthView] = useState('login'); // 'login' | 'register'
  // Traccia le tab già visitate per mantenerle montate
  const [visitedModules, setVisitedModules] = useState(new Set(['home']));
  
  // Video intro - mostrato solo se sono passate più di 12 ore dall'ultimo login
  const videoRef = useRef(null);
  const frozenVideoRef = useRef(null); // Ref per il video congelato come sfondo
  const [showVideo, setShowVideo] = useState(() => shouldShowIntroVideo());
  const [videoCompleted, setVideoCompleted] = useState(false);
  const [videoTimeout, setVideoTimeout] = useState(false);

  // Componente wrapper per Login con loadingMessage dal context
  const LoginWithLoading = () => {
    const { loadingMessage } = useLoading();
    return (
      <Login 
        showLoading={true}
        loadingMessage={loadingMessage}
      />
    );
  };

  // Componente wrapper che controlla se l'app è pronta prima di mostrare AppContent
  const AppContentWrapper = ({ session, pendingApproval, firstLoginRequired, activeModule, setActiveModule, sidebarOpen, setSidebarOpen, visitedModules, setVisitedModules }) => {
    const { isLoading, loadingMessage } = useLoading();
    const { azienda, loading: aziendaLoading } = useAzienda();
    
    // Se l'azienda non è ancora caricata o è in caricamento, mostra loading
    if (aziendaLoading || !azienda) {
      return <LoginWithLoading />;
    }
    
    // Se è ancora in caricamento (dati Home o altro), mostra loading
    if (isLoading) {
      return <LoginWithLoading />;
    }
    
    // L'app è pronta, mostra AppContent
    return (
      <AppContent 
        session={session}
        pendingApproval={pendingApproval}
        firstLoginRequired={firstLoginRequired}
        activeModule={activeModule}
        setActiveModule={setActiveModule}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        visitedModules={visitedModules}
        setVisitedModules={setVisitedModules}
      />
    );
  };

  // Componente interno per accedere a AziendaContext e LoadingContext
  const AppContent = ({ session, pendingApproval, firstLoginRequired, activeModule, setActiveModule, sidebarOpen, setSidebarOpen, visitedModules, setVisitedModules }) => {
    const { isLoading, loadingMessage } = useLoading();
    const { azienda, loading: aziendaLoading } = useAzienda();

    // 🗄️ DATABASE LOCALE: Inizializza database SQLite e sincronizzazione
    const accessToken = session?.access_token; // Token JWT per autenticazione sync
    const { 
      isReady: dbReady, 
      isInitializing: dbInitializing,
      isOnline,
      syncStatus: dbSyncStatus 
    } = useLocalDatabase(azienda?.id, accessToken);
    
    const { setSyncStatus } = useLoading();

    // 🚀 PRELOADER: Carica tutti i dati in background per navigazione istantanea
    const { isPreloading, progress: preloadProgress, errors: preloadErrors } = useDataPreloader(azienda?.id, {
      autoStart: true, // Avvia automaticamente quando l'azienda è disponibile
    });

    // Aggiorna LoadingContext con lo stato di sync del database locale
    useEffect(() => {
      if (dbInitializing) {
        // Database in inizializzazione
        setSyncStatus({ isSyncing: true, phase: 'start' });
      } else if (dbSyncStatus && (dbSyncStatus.isSyncing || dbSyncStatus.phase)) {
        // Sync in corso
        setSyncStatus(dbSyncStatus);
      } else if (dbReady && !dbSyncStatus?.isSyncing) {
        // Database pronto, nessuna sync in corso - rimuovi stato
        setSyncStatus(null);
      }
    }, [dbInitializing, dbSyncStatus, dbReady, setSyncStatus]);

    // Log per debug (solo quando cambia significativamente)
    const prevAppContentStateRef = React.useRef({});
    React.useEffect(() => {
      const currentState = {
        isLoading,
        loadingMessage,
        activeModule,
        hasSession: !!session,
        hasAzienda: !!azienda,
        aziendaLoading,
        isPreloading,
        preloadProgress
      };
      const prevState = prevAppContentStateRef.current;
      // Log solo se qualcosa è cambiato
      if (JSON.stringify(currentState) !== JSON.stringify(prevState)) {
        prevAppContentStateRef.current = currentState;
      }
    }, [isLoading, loadingMessage, activeModule, session, azienda, aziendaLoading, isPreloading, preloadProgress]);

    // Aggiungi il modulo corrente alle tab visitate quando cambia (solo se non è già presente)
    React.useEffect(() => {
      setVisitedModules(prev => {
        if (prev.has(activeModule)) {
          return prev; // Non modificare se già presente
        }
        return new Set([...prev, activeModule]);
      });
    }, [activeModule, setVisitedModules]);

    // Se l'azienda non è ancora caricata, mostra la modale con loading
    if (aziendaLoading || !azienda) {
      return <LoginWithLoading />;
    }

    // Se è ancora in caricamento (dati Home o altro), mostra la modale con loading
    if (isLoading) {
      return <LoginWithLoading />;
    }

    return (
      <ImpostazioniProvider>
          <div className="app-container">
            {/* Non mostrare più il LoadingSpinner fullscreen - tutto il loading è gestito nella modale */}
            {/* Mostra sempre il contenuto quando isLoading è false */}
            <div className="app-content" style={{ position: 'relative', zIndex: 1 }}>
                <button
                  className="sidebar-toggle"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  style={{
                    position: 'fixed',
                    left: sidebarOpen ? '240px' : '0px',
                    top: '30px',
                    width: '40px',
                    height: '120px',
                    zIndex: 999,
                    transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                >
                  <span className="toggle-text">MENU</span>
                </button>
                <Sidebar
                  activeModule={activeModule}
                  setActiveModule={setActiveModule}
                  isOpen={sidebarOpen}
                  onToggle={() => setSidebarOpen(false)}
                />
                <main className={`main-content ${sidebarOpen ? 'sidebar-open' : ''}`}>
                  {/* Mantieni montati i moduli già visitati per evitare ricaricamenti */}
                  {/* Nascondi solo visivamente quelli non attivi */}
                  {/* RequestProvider cancella automaticamente le richieste solo quando il modulo viene smontato */}
                  <div style={{ display: activeModule === 'home' ? 'block' : 'none' }}>
                    {visitedModules.has('home') && (
                      <RequestProvider moduleId="home" isActive={activeModule === 'home'}>
                        {(() => {
                          try {
                            return <Home setActiveModule={setActiveModule} />;
                          } catch (error) {
                            return <div>Errore nel caricamento del modulo Home: {error?.message}</div>;
                          }
                        })()}
                      </RequestProvider>
                    )}
                  </div>
                  <div style={{ display: activeModule === 'allevamento' ? 'block' : 'none' }}>
                    {visitedModules.has('allevamento') && (
                      <RequestProvider moduleId="allevamento" isActive={activeModule === 'allevamento'}>
                        <Allevamento />
                      </RequestProvider>
                    )}
                  </div>
                  <div style={{ display: activeModule === 'sanitario' ? 'block' : 'none' }}>
                    {visitedModules.has('sanitario') && (
                      <RequestProvider moduleId="sanitario" isActive={activeModule === 'sanitario'}>
                        <Sanitario />
                      </RequestProvider>
                    )}
                  </div>
                  <div style={{ display: activeModule === 'alimentazione' ? 'block' : 'none' }}>
                    {visitedModules.has('alimentazione') && (
                      <RequestProvider moduleId="alimentazione" isActive={activeModule === 'alimentazione'}>
                        <Alimentazione />
                      </RequestProvider>
                    )}
                  </div>
                  <div style={{ display: activeModule === 'terreni' ? 'block' : 'none' }}>
                    {visitedModules.has('terreni') && (
                      <RequestProvider moduleId="terreni" isActive={activeModule === 'terreni'}>
                        <Terreni />
                      </RequestProvider>
                    )}
                  </div>
                  <div style={{ display: activeModule === 'amministrazione' ? 'block' : 'none' }}>
                    {visitedModules.has('amministrazione') && (
                      <RequestProvider moduleId="amministrazione" isActive={activeModule === 'amministrazione'}>
                        <Amministrazione />
                      </RequestProvider>
                    )}
                  </div>
                  <div style={{ display: activeModule === 'attrezzatura' ? 'block' : 'none' }}>
                    {visitedModules.has('attrezzatura') && (
                      <RequestProvider moduleId="attrezzatura" isActive={activeModule === 'attrezzatura'}>
                        <Attrezzatura />
                      </RequestProvider>
                    )}
                  </div>
                  <div style={{ display: activeModule === 'profilo' ? 'block' : 'none' }}>
                    {visitedModules.has('profilo') && (
                      <RequestProvider moduleId="profilo" isActive={activeModule === 'profilo'}>
                        <Profilo />
                      </RequestProvider>
                    )}
                  </div>
                </main>
              </div>
          </div>
        </ImpostazioniProvider>
    );
  };

  const renderContent = () => {
    // Se il video è in corso e non ancora completato, mostra loading con video in background
    if (showVideo && !videoCompleted && !videoTimeout) {
      return (
        <AziendaProvider>
          <LoadingProvider>
            <LoginWithLoading />
          </LoadingProvider>
        </AziendaProvider>
      );
    }

    // Durante l'inizializzazione, mostra la pagina di login con spinner di caricamento
    if (initializing) {
      return (
        <AziendaProvider>
          <LoadingProvider>
            <LoginWithLoading />
          </LoadingProvider>
        </AziendaProvider>
      );
    }

    // Se non c'è sessione, mostra la pagina di Login (con sfondo video)
    if (!session) {
      if (authView === 'register') {
        return (
          <Register 
            showVideoBackground={true}
            onSwitchToLogin={() => setAuthView('login')}
          />
        );
      }
      return (
        <Login 
          showVideoBackground={true}
          onSwitchToRegister={() => setAuthView('register')}
        />
      );
    }

    // Gestione stati speciali della sessione
    if (pendingApproval) {
      return <PendingApproval />;
    }

    if (firstLoginRequired) {
      return <FirstAccess />;
    }

    // Se c'è una sessione attiva, mostra AppContentWrapper che controlla se l'app è pronta
    return (
      <AziendaProvider>
        <LoadingProvider>
          <AppContentWrapper 
            session={session}
            pendingApproval={pendingApproval}
            firstLoginRequired={firstLoginRequired}
            activeModule={activeModule}
            setActiveModule={setActiveModule}
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            visitedModules={visitedModules}
            setVisitedModules={setVisitedModules}
          />
        </LoadingProvider>
      </AziendaProvider>
    );
  };

  // Timeout per il video: se non finisce entro 30 secondi, procedi comunque
  React.useEffect(() => {
    if (showVideo && !videoCompleted && !videoTimeout) {
      const timeoutId = setTimeout(() => {
        console.log('[App] Video timeout - procedo senza aspettare');
        setVideoTimeout(true);
        setVideoCompleted(true);
      }, 30000); // 30 secondi
      return () => clearTimeout(timeoutId);
    }
  }, [showVideo, videoCompleted, videoTimeout]);

  // Handler per quando il video termina
  const handleVideoEnded = () => {
    console.log('[App] Video terminato');
    if (videoRef.current) {
      videoRef.current.pause();
    }
    setVideoCompleted(true);
  };

  // Handler per errori del video
  const handleVideoError = () => {
    console.log('[App] Errore video - procedo senza video');
    setVideoTimeout(true);
    setVideoCompleted(true);
  };

  // Forza il play del video quando viene montato
  React.useEffect(() => {
    if (showVideo && !videoCompleted && !videoTimeout && videoRef.current) {
      const video = videoRef.current;
      if (video.paused) {
        video.play().catch(err => {
          console.log('[App] Autoplay bloccato, procedo');
          setVideoTimeout(true);
          setVideoCompleted(true);
        });
      }
    }
  }, [showVideo, videoCompleted, videoTimeout]);

  // Renderizza il contenuto appropriato
  const content = renderContent();

  // Determina se mostrare il video (solo se sono passate più di 12 ore e non è ancora completato)
  const shouldRenderVideo = showVideo && !videoCompleted && !videoTimeout;

  // Mostra lo sfondo con ultimo frame del video quando non c'è sessione (pagina di login)
  const shouldShowFrozenBackground = !session && !shouldRenderVideo;

  return (
    <>
      {/* Video intro in riproduzione - mostrato solo se sono passate più di 12 ore dall'ultimo login */}
      {shouldRenderVideo && (
        <div 
          className="intro-video-layer"
          style={{ 
            zIndex: 9999,
            pointerEvents: 'auto',
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%'
          }}
        >
          <video
            ref={videoRef}
            className="intro-video-layer__video"
            src={introVideo}
            autoPlay
            muted
            playsInline
            loop={false}
            onEnded={handleVideoEnded}
            onError={handleVideoError}
            onLoadedData={() => {
              // Assicurati che il video parta dall'inizio
              if (videoRef.current && !videoCompleted && !videoTimeout) {
                const video = videoRef.current;
                if (video.currentTime > 0.1) {
                  video.currentTime = 0;
                }
                if (video.paused) {
                  video.play().catch(() => {
                    // Se autoplay fallisce, procedi senza video
                    setVideoTimeout(true);
                    setVideoCompleted(true);
                  });
                }
              }
            }}
          />
        </div>
      )}
      
      {/* Sfondo con ultimo frame del video - mostrato sulla pagina di login */}
      {shouldShowFrozenBackground && (
        <div 
          className="intro-video-layer intro-video-layer--frozen"
          style={{ 
            zIndex: 0,
            pointerEvents: 'none',
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: '#000'
          }}
        >
          <video
            ref={frozenVideoRef}
            className="intro-video-layer__video"
            src={introVideo}
            muted
            playsInline
            loop={false}
            style={{ pointerEvents: 'none' }}
            onLoadedMetadata={() => {
              // Vai all'ultimo frame quando i metadati sono caricati
              if (frozenVideoRef.current) {
                const video = frozenVideoRef.current;
                video.pause();
                if (video.duration && isFinite(video.duration) && video.duration > 0) {
                  video.currentTime = Math.max(video.duration - 0.05, 0);
                }
              }
            }}
            onLoadedData={() => {
              // Congela il video all'ultimo frame
              if (frozenVideoRef.current) {
                const video = frozenVideoRef.current;
                video.pause();
                const setToLastFrame = () => {
                  if (video.duration && isFinite(video.duration) && video.duration > 0) {
                    video.currentTime = Math.max(video.duration - 0.05, 0);
                  } else {
                    setTimeout(setToLastFrame, 100);
                  }
                };
                setToLastFrame();
              }
            }}
          />
        </div>
      )}
      
      {/* Contenuto dell'app - nascosto durante il video */}
      <div style={{ 
        position: 'relative', 
        zIndex: shouldRenderVideo ? 5 : 10,
        opacity: shouldRenderVideo ? 0 : 1,
        pointerEvents: shouldRenderVideo ? 'none' : 'auto'
      }}>
        {content || <Login showLoading={true} />}
      </div>
    </>
  );
}

export default App;

