/**
 * Home - Dashboard completa con statistiche e cards per ogni modulo
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useImpostazioni } from '../context/ImpostazioniContext';
import { useLoading } from '../context/LoadingContext';
import { useAuth } from '../context/AuthContext';
import { statisticheService } from '../services/statisticheService';
import { allevamentoService } from '../modules/allevamento/services/allevamentoService';
import { aziendeService } from '../modules/allevamento/services/aziendeService';
import { amministrazioneService } from '../modules/amministrazione/services/amministrazioneService';
import { alimentazioneService } from '../modules/alimentazione/services/alimentazioneService';
import { terreniService } from '../modules/terreni/services/terreniService';
import { attrezzaturaService } from '../modules/attrezzatura/services/attrezzaturaService';
import { sanitarioService } from '../modules/sanitario/services/sanitarioService';
import './Home.css';
import { getCachedFornitori } from '../modules/amministrazione/prefetchers';
import {
  getCachedAlimentazioneCatalogo,
  getCachedAlimentazionePiani,
} from '../modules/alimentazione/prefetchers';
import { getCachedSanitarioFarmaci } from '../modules/sanitario/prefetchers';
import { getCachedData, setCache } from '../services/prefetchCache';
import CentroNotifiche from './CentroNotifiche';

const DASHBOARD_CACHE_KEY = 'dashboard/home@v1';
const DASHBOARD_CACHE_TTL = 1000 * 60 * 5; // 5 minuti

const Home = ({ setActiveModule }) => {
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('moduli'); // 'moduli' o 'notifiche'
  const { impostazioni } = useImpostazioni();
  const { setHomeDataLoaded } = useLoading();
  const { session } = useAuth(); // Per resettare quando cambia la sessione
  const [aziende, setAziende] = useState([]); // Cache per nomi aziende
  const [sediMap, setSediMap] = useState({}); // Cache per nomi sedi per azienda

  const hasHydratedCacheRef = useRef(false);
  const aziendeRef = useRef([]);
  const sediMapRef = useRef({});
  const hasNotifiedDataLoadedRef = useRef(false); // Evita notifiche multiple
  const prevSessionRef = useRef(session);
  
  // Reset quando cambia la sessione
  useEffect(() => {
    if (prevSessionRef.current !== session) {
      hasNotifiedDataLoadedRef.current = false;
      prevSessionRef.current = session;
    }
  }, [session]);
  
  // Mantieni i ref sincronizzati con lo state
  useEffect(() => {
    aziendeRef.current = aziende;
  }, [aziende]);
  
  useEffect(() => {
    sediMapRef.current = sediMap;
  }, [sediMap]);

  const hydrateFromCache = useCallback((cached) => {
    if (!cached) return;
    if (cached.stats) {
      setStats(cached.stats);
    }
    if (cached.aziende) {
      setAziende(cached.aziende);
    }
    if (cached.sediMap) {
      setSediMap(cached.sediMap);
    }
  }, []);

  // Caricamento iniziale: usa cache se disponibile, altrimenti carica
  useEffect(() => {
    const cachedDashboard = getCachedData(DASHBOARD_CACHE_KEY);
    if (cachedDashboard) {
      hydrateFromCache(cachedDashboard);
      hasHydratedCacheRef.current = true;
      setLoading(false);
      // Notifica che i dati sono stati caricati dalla cache (solo una volta)
      if (!hasNotifiedDataLoadedRef.current) {
        hasNotifiedDataLoadedRef.current = true;
        setHomeDataLoaded(true);
      }
    }
  }, [hydrateFromCache, setHomeDataLoaded]);

  const loadData = useCallback(async ({ force = false, silent = false } = {}) => {
    // Se i dati sono già nello state e non è forzato, non ricaricare
    // Controlla se abbiamo almeno alcune statistiche caricate (es. animali_presenti o sedi)
    const hasStatsData = stats.animali_presenti !== undefined || stats.sedi !== undefined || stats.fornitori !== undefined;
    if (!force && hasStatsData && aziende.length > 0) {
      return;
    }

    if (!silent) {
      const hasCachedData =
        getCachedAlimentazioneCatalogo() ||
        getCachedAlimentazionePiani() ||
        getCachedFornitori() ||
        getCachedSanitarioFarmaci();

      if (!hasCachedData && !hasHydratedCacheRef.current) {
        setLoading(true);
      }
    }

    try {
      const cachedDashboard = !force ? getCachedData(DASHBOARD_CACHE_KEY) : null;
      if (cachedDashboard && !silent) {
        hydrateFromCache(cachedDashboard);
        setLoading(false);
        if (!hasNotifiedDataLoadedRef.current) {
          hasNotifiedDataLoadedRef.current = true;
          setHomeDataLoaded(true); // Notifica che i dati sono stati caricati dalla cache
        }
        return;
      }

      const statsData = {};

      // Carica aziende una sola volta e riutilizza
      let aziendeList = aziendeRef.current.length > 0 ? aziendeRef.current : null;
      if (!aziendeList) {
        try {
          aziendeList = await aziendeService.getAziende();
          if (aziendeList && aziendeList.length > 0) {
            setAziende(aziendeList);
          }
        } catch (err) {

          aziendeList = [];
        }
      }
      statsData.aziende = aziendeList?.length || 0;
      
      if (!aziendeList || aziendeList.length === 0) {
        setStats(statsData);
        setCache(DASHBOARD_CACHE_KEY, { stats: statsData, aziende: [], sediMap }, { ttl: DASHBOARD_CACHE_TTL });
        setLoading(false);
        return;
      }
      
      // Usa cache quando disponibile
      const cachedCatalogo = getCachedAlimentazioneCatalogo();
      const cachedPiani = getCachedAlimentazionePiani();
      const cachedFornitori = getCachedFornitori();
      const cachedFarmaci = getCachedSanitarioFarmaci();
      
      try {
        // OTTIMIZZATO: Usa endpoint batch per statistiche principali (1 chiamata invece di molte)
        // + chiamate parallele per dati supplementari
        const [
          batchStatsResult,
          amministrazioneBatchResult,
          sediResults,
          fornitoriResult,
          farmaciResult,
          pianiResult,
          componentiResult,
          mangimiResult,
          terreniColtivatiResult
        ] = await Promise.allSettled([
          // Endpoint batch ottimizzato - carica tutte le statistiche in una chiamata
          statisticheService.getHomeStatsBatch(aziendeList[0]?.id).catch(() => ({})),
          
          // Endpoint batch amministrazione - calcola correttamente le fatture per tipo (senza limit)
          statisticheService.getAmministrazioneBatch(aziendeList[0]?.id).catch(() => ({})),
          
          // Sedi - usa endpoint count ottimizzato (molto più veloce)
          allevamentoService.getSediCount().catch(() => ({ count: 0 })),
          
          // Fornitori - usa cache se disponibile
          cachedFornitori
            ? Promise.resolve(cachedFornitori.fornitori || cachedFornitori || [])
            : amministrazioneService.getFornitori({ include_tipi: false }).catch(() => []),
          
          // Farmaci - usa cache se disponibile
          cachedFarmaci
            ? Promise.resolve(cachedFarmaci)
            : sanitarioService.getFarmaci().catch(() => []),
          
          // Dati Alimentazione - usa cache quando disponibile
          cachedPiani
            ? Promise.resolve(cachedPiani.piani || [])
            : alimentazioneService.getPiani().catch(() => []),
          cachedCatalogo
            ? Promise.resolve(cachedCatalogo.componenti || [])
            : alimentazioneService.getComponenti().catch(() => []),
          cachedCatalogo
            ? Promise.resolve(cachedCatalogo.mangimi || [])
            : alimentazioneService.getMangimi().catch(() => []),
          
          // Terreni coltivati
          statisticheService.getTerreniColtivati().catch(() => ({ numero_terreni_coltivati: 0, superficie_ettari: 0 }))
        ]);
        
        // Processa risultati batch (statistiche principali)
        if (batchStatsResult.status === 'fulfilled') {
          const batch = batchStatsResult.value;
          statsData.animali_stato = batch.animali_stato || {};
          statsData.animali_presenti = batch.animali_presenti || 0;
          statsData.somministrazioni_mese = batch.somministrazioni_totali || 0;
          statsData.terreni = batch.terreni?.numero || 0;
          statsData.superficie_ettari = batch.terreni?.superficie_ha || 0;
          statsData.attrezzature = batch.attrezzature || 0;
          statsData.revisioni_in_scadenza = batch.revisioni?.in_scadenza || 0;
          statsData.revisioni_scadute = batch.revisioni?.scadute || 0;
          statsData.fatture_scadute = batch.fatture_scadute || 0;
        }
        
        // Processa risultati batch amministrazione (fatture emesse/ricevute)
        if (amministrazioneBatchResult.status === 'fulfilled') {
          const ammBatch = amministrazioneBatchResult.value;
          // Il backend restituisce fatture_per_tipo come { 'entrata': count, 'uscita': count }
          // ENTRATA = fatture emesse (vendite)
          // USCITA = fatture ricevute (acquisti)
          const fatturePerTipo = ammBatch.fatture_per_tipo || {};
          // Gestisci sia chiavi stringa che Enum (per compatibilità)
          statsData.fatture_emesse = fatturePerTipo.entrata || fatturePerTipo.ENTRATA || fatturePerTipo['entrata'] || 0;
          statsData.fatture_ricevute = fatturePerTipo.uscita || fatturePerTipo.USCITA || fatturePerTipo['uscita'] || 0;
        }
        
        // Processa risultati sedi (ora usa endpoint count ottimizzato)
        if (sediResults.status === 'fulfilled') {
          const sediCountResult = sediResults.value;
          statsData.sedi = sediCountResult?.count || 0;
        }
        
        // Processa risultati fornitori
        if (fornitoriResult.status === 'fulfilled') {
          statsData.fornitori = fornitoriResult.value?.length || 0;
        }
        
        // Processa risultati farmaci
        if (farmaciResult.status === 'fulfilled') {
          statsData.farmaci = farmaciResult.value?.length || 0;
        }
        
        // Processa risultati alimentazione
        statsData.piani_alimentazione = pianiResult.status === 'fulfilled' ? (pianiResult.value?.length || 0) : 0;
        statsData.componenti_alimentari = componentiResult.status === 'fulfilled' ? (componentiResult.value?.length || 0) : 0;
        statsData.mangimi_confezionati = mangimiResult.status === 'fulfilled' ? (mangimiResult.value?.length || 0) : 0;
        
        // Processa risultati terreni coltivati
        if (terreniColtivatiResult.status === 'fulfilled') {
          const terreniColtivati = terreniColtivatiResult.value;
          statsData.terreni_coltivati = terreniColtivati?.numero_terreni_coltivati || 0;
          if (terreniColtivati?.superficie_ettari !== undefined && terreniColtivati.superficie_ettari > 0) {
            statsData.superficie_ettari = terreniColtivati.superficie_ettari;
          }
        }
        
      } catch (err) {

        // Anche in caso di errore, mostra i dati parziali caricati
      }

      // Aggiorna i dati non appena disponibili (anche se parziali)
      setStats(statsData);
      setCache(
        DASHBOARD_CACHE_KEY,
        {
          stats: statsData,
          aziende: aziendeList,
          sediMap: Object.keys(sediMapRef.current).length ? sediMapRef.current : {},
        },
        { ttl: DASHBOARD_CACHE_TTL }
      );
      hasHydratedCacheRef.current = true;
      setLoading(false);
      
      // Notifica che i dati di Home sono stati caricati (solo una volta)
      if (!hasNotifiedDataLoadedRef.current) {
        hasNotifiedDataLoadedRef.current = true;
        setHomeDataLoaded(true);
      
      }
    } catch (error) {

      setLoading(false);
      // Anche in caso di errore, notifica che il caricamento è terminato (con dati parziali o vuoti)
      if (!hasNotifiedDataLoadedRef.current) {
        hasNotifiedDataLoadedRef.current = true;
        setHomeDataLoaded(true);
      }
    }
  }, [hydrateFromCache, stats.animali_presenti, stats.sedi, stats.fornitori, aziende.length, setHomeDataLoaded]);

  // Carica i dati subito, non aspettare le impostazioni
  // Ma solo se i dati non sono già presenti
  useEffect(() => {
    // Se i dati sono già presenti, non ricaricare
    const hasStatsData = stats.animali_presenti !== undefined || stats.sedi !== undefined || stats.fornitori !== undefined;
    if (hasStatsData && aziende.length > 0) {
      return; // Dati già caricati, non ricaricare
    }

    if (hasHydratedCacheRef.current) {
      loadData({ force: false, silent: true }); // Non forzare se abbiamo cache
    } else {
      loadData();
    }
  }, [loadData, stats.animali_presenti, stats.sedi, stats.fornitori, aziende.length]);


  const animaliStato = stats.animali_stato || {};
  // Calcola usciti come somma di venduti e macellati
  const animaliUsciti = (animaliStato.venduto ?? 0) + (animaliStato.macellato ?? 0);

  const moduleCards = [
    {
      id: 'allevamento',
      title: 'Allevamento',
      icon: '🐄',
      color: '#4CAF50',
      stats: [
        { label: 'Presenti', value: animaliStato.presente ?? stats.animali_presenti ?? 0 },
        { label: 'Usciti', value: animaliUsciti },
        { label: 'Deceduti', value: animaliStato.deceduto ?? 0 },
        { label: 'Sedi', value: stats.sedi || 0 },
      ],
    },
    {
      id: 'amministrazione',
      title: 'Amministrazione',
      icon: '💰',
      color: '#2196F3',
      stats: [
        { label: 'Fatture Emesse', value: stats.fatture_emesse || 0 },
        { label: 'Fatture Ricevute', value: stats.fatture_ricevute || 0 },
        { label: 'Fornitori', value: stats.fornitori || 0 },
      ],
    },
    {
      id: 'sanitario',
      title: 'Sanitario',
      icon: '💊',
      color: '#F44336',
      stats: [
        { label: 'Farmaci', value: stats.farmaci || 0 },
        { label: 'Somministrazioni (Mese)', value: stats.somministrazioni_mese || 0 },
      ],
    },
    {
      id: 'alimentazione',
      title: 'Alimentazione',
      icon: '🌾',
      color: '#FF9800',
      stats: [
        { label: 'Piani Alimentazione', value: stats.piani_alimentazione || 0 },
        { label: 'Componenti', value: stats.componenti_alimentari || 0 },
        { label: 'Mangimi', value: stats.mangimi_confezionati || 0 },
      ],
    },
    {
      id: 'terreni',
      title: 'Terreni',
      icon: '🌱',
      color: '#8BC34A',
      stats: [
        { label: 'Terreni', value: stats.terreni || 0 },
        { label: 'Coltivati', value: stats.terreni_coltivati || 0 },
        { label: 'Superficie', value: stats.superficie_ettari > 0 ? `${stats.superficie_ettari} ha` : '0 ha' },
      ],
    },
    {
      id: 'attrezzatura',
      title: 'Attrezzatura',
      icon: '🔧',
      color: '#9E9E9E',
      stats: [
        { label: 'Attrezzature', value: stats.attrezzature || 0 },
        { label: 'Revisioni in Scadenza', value: stats.revisioni_in_scadenza || 0 },
        { label: 'Revisioni Scadute', value: stats.revisioni_scadute || 0 },
      ],
    },
  ];

  // Ottieni il nome dell'azienda principale (prima azienda se ce ne sono più)
  const aziendaPrincipale = aziende && aziende.length > 0 ? aziende[0] : null;

  return (
    <div className="home-container">
      <div className="home-header">
        <h1>
          Dashboard RegiFarm
          {aziendaPrincipale && (
            <span className="azienda-badge"> · {aziendaPrincipale.nome}</span>
          )}
        </h1>
        <p className="subtitle">Benvenuto nel sistema di gestione allevamenti</p>
      </div>

      {/* Tabs */}
      <div className="home-tabs">
        <button
          className={`tab-button ${activeTab === 'moduli' ? 'active' : ''}`}
          onClick={() => setActiveTab('moduli')}
        >
          Moduli
        </button>
        <button
          className={`tab-button ${activeTab === 'notifiche' ? 'active' : ''}`}
          onClick={() => setActiveTab('notifiche')}
        >
          Centro Notifiche
          {aziendaPrincipale && (
            <span className="tab-badge">!</span>
          )}
        </button>
      </div>

      {/* Contenuto Tab Moduli */}
      {activeTab === 'moduli' && (
        <section className="modules-section">
          <div className="modules-grid">
            {moduleCards.map((module) => (
              <div
                key={module.id}
                className="module-card"
                onClick={() => setActiveModule && setActiveModule(module.id)}
                style={{ borderLeft: `4px solid ${module.color}` }}
              >
                <div className="module-card-header">
                  <div className="module-icon" style={{ color: module.color }}>
                    {module.icon}
                  </div>
                  <h3 className="module-title">{module.title}</h3>
                </div>
                {module.stats.length > 0 && (
                  <div className="module-stats">
                    {module.stats.map((stat, idx) => (
                      <div key={idx} className="module-stat">
                        <span className="module-stat-label">{stat.label}:</span>
                        <span className="module-stat-value">{stat.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Contenuto Tab Centro Notifiche */}
      {activeTab === 'notifiche' && aziendaPrincipale && (
        <CentroNotifiche
          aziendaId={aziendaPrincipale.id}
          setActiveModule={setActiveModule}
        />
      )}

      {activeTab === 'notifiche' && !aziendaPrincipale && (
        <div className="empty-state">
          <p>Configura l&apos;azienda nelle impostazioni per visualizzare le notifiche.</p>
        </div>
      )}
    </div>
  );
};

export default Home;
