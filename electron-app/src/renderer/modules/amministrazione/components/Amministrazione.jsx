/**
 * Amministrazione - Main component for Amministrazione module
 */
import React, { useState, useMemo, useEffect } from 'react';
import './Amministrazione.css';
import GestioneFornitori from './GestioneFornitori';
import GestioneDDT from './GestioneDDT';
import GestioneFatture from './GestioneFatture';
import GestionePrimaNota from './GestionePrimaNota';
import GestioneContrattiSoccida from './GestioneContrattiSoccida';
import Report from './Report';
import { useAzienda } from '../../../context/AziendaContext';
import {
  prefetchFornitori,
  prefetchFatture,
} from '../prefetchers';

const getInitialTab = () => {
  if (typeof window === 'undefined') return 'fornitori';
  return window.localStorage.getItem('amministrazione_activeTab') || 'fornitori';
};

const Amministrazione = () => {
  const [activeTab, setActiveTab] = useState(getInitialTab);
  const { azienda } = useAzienda();
  const fattureRef = React.useRef(null);

  const tabs = useMemo(
    () => [
      { id: 'fornitori', label: 'Fornitori e Clienti', prefetch: () => prefetchFornitori() },
      { id: 'ddt', label: 'DDT' },
      {
        id: 'fatture',
        label: 'Fatture',
        prefetch: () => {
          if (azienda?.id) {
            prefetchFatture(azienda.id);
          }
        },
      },
      { id: 'contratti-soccida', label: 'Contratti Soccida' },
      { id: 'prima-nota', label: 'Prima Nota' },
      { id: 'report', label: 'Report' },
    ],
    [azienda?.id]
  );

  // Listener per eventi di notifiche
  useEffect(() => {
    const handleOpenNotificationRecord = async (event) => {
      const { tipo, id, modulo } = event.detail;
      
      // Se la notifica è per questo modulo (amministrazione)
      if (modulo === 'amministrazione' && tipo === 'fattura' && id) {
        // Cambia al tab fatture
        setActiveTab('fatture');
        
        // Aspetta che il componente sia montato e poi apri la fattura
        // Usa un intervallo per verificare che il ref sia disponibile
        const checkAndOpen = () => {
          if (fattureRef.current && fattureRef.current.openFattura) {
            fattureRef.current.openFattura(id);
          } else {
            // Riprova dopo un breve delay se il ref non è ancora disponibile
            setTimeout(checkAndOpen, 100);
          }
        };
        
        // Inizia il controllo dopo un breve delay iniziale
        setTimeout(checkAndOpen, 200);
      }
    };

    window.addEventListener('openNotificationRecord', handleOpenNotificationRecord);
    return () => {
      window.removeEventListener('openNotificationRecord', handleOpenNotificationRecord);
    };
  }, []);

  // Persisti il tab attivo per evitare reset quando si apre/chiude il menu laterale
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('amministrazione_activeTab', activeTab);
    }
  }, [activeTab]);

  // Prefetch del tab attivo quando il componente viene montato o quando cambia il tab
  useEffect(() => {
    const activeTabConfig = tabs.find(tab => tab.id === activeTab);
    if (activeTabConfig?.prefetch) {
      activeTabConfig.prefetch();
    }
  }, [activeTab, tabs]);

  return (
    <div className="amministrazione-module">
      <div className="amministrazione-header">
        <h2>Modulo Amministrazione</h2>
      </div>

      <div className="amministrazione-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => {
              tab.prefetch?.();
              setActiveTab(tab.id);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="amministrazione-content">
        <div style={{ display: activeTab === 'fornitori' ? 'block' : 'none' }}>
          <GestioneFornitori />
        </div>
        <div style={{ display: activeTab === 'ddt' ? 'block' : 'none' }}>
          <GestioneDDT />
        </div>
        <div style={{ display: activeTab === 'fatture' ? 'block' : 'none' }}>
          <GestioneFatture ref={fattureRef} />
        </div>
        <div style={{ display: activeTab === 'contratti-soccida' ? 'block' : 'none' }}>
          <GestioneContrattiSoccida />
        </div>
        <div style={{ display: activeTab === 'prima-nota' ? 'block' : 'none' }}>
          <GestionePrimaNota />
        </div>
        <div style={{ display: activeTab === 'report' ? 'block' : 'none' }}>
          <Report />
        </div>
      </div>
    </div>
  );
};

export default Amministrazione;

