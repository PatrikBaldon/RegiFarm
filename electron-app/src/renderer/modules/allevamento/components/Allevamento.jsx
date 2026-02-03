/**
 * Main Allevamento module component
 */
import React, { useMemo, useState, useEffect } from 'react';
import './Allevamento.css';
import AllevamentoHierarchy from './AllevamentoHierarchy';
import GestioneAnimali from './GestioneAnimali';
import SincronizzazioneAnagrafe from './SincronizzazioneAnagrafe';
import { useAzienda } from '../../../context/AziendaContext';
import { prefetchAnimali } from '../prefetchers';

const Allevamento = () => {
  const [activeView, setActiveView] = useState('hierarchy'); // hierarchy, gestione, sincronizzazione
  const { azienda } = useAzienda();

  // Prefetch animali solo se non già in cache
  useEffect(() => {
    if (azienda?.id) {
      // Il prefetch controlla automaticamente la cache, quindi è sicuro chiamarlo
      prefetchAnimali(azienda.id, { soloPresenti: true, force: false });
    }
  }, [azienda?.id]);

  const tabs = useMemo(
    () => [
      { id: 'hierarchy', label: 'Gestione Gerarchica' },
      {
        id: 'gestione',
        label: 'Gestione Animali',
        prefetch: () => azienda?.id && prefetchAnimali(azienda.id, { soloPresenti: true }),
      },
      { id: 'sincronizzazione', label: 'Sincronizzazione Anagrafe' },
    ],
    [azienda?.id],
  );

  // Prefetch del tab attivo quando cambia il tab (oltre al prefetch iniziale)
  useEffect(() => {
    const activeTabConfig = tabs.find(tab => tab.id === activeView);
    if (activeTabConfig?.prefetch) {
      activeTabConfig.prefetch();
    }
  }, [activeView, tabs]);

  // Listener per eventi di notifiche - cambia vista se necessario
  useEffect(() => {
    const handleOpenNotificationRecord = (event) => {
      const { tipo, modulo } = event.detail;
      
      // Se la notifica è per questo modulo (allevamento) e tipo assicurazione_aziendale
      if (modulo === 'allevamento' && tipo === 'assicurazione_aziendale') {
        // Cambia alla vista gerarchica (dove sono le assicurazioni aziendali)
        setActiveView('hierarchy');
      }
    };

    window.addEventListener('openNotificationRecord', handleOpenNotificationRecord);
    return () => {
      window.removeEventListener('openNotificationRecord', handleOpenNotificationRecord);
    };
  }, []);

  return (
    <div className="allevamento-module">
      <div className="allevamento-header">
        <h2>Modulo Allevamento</h2>
      </div>

      <div className="allevamento-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-button ${activeView === tab.id ? 'active' : ''}`}
            onMouseEnter={() => tab.prefetch?.()}
            onFocus={() => tab.prefetch?.()}
            onClick={() => {
              tab.prefetch?.();
              setActiveView(tab.id);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="allevamento-content">
        <div style={{ display: activeView === 'hierarchy' ? 'block' : 'none' }}>
          <AllevamentoHierarchy />
        </div>
        <div style={{ display: activeView === 'gestione' ? 'block' : 'none' }}>
          <GestioneAnimali />
        </div>
        <div style={{ display: activeView === 'sincronizzazione' ? 'block' : 'none' }}>
          <SincronizzazioneAnagrafe />
        </div>
      </div>
    </div>
  );
};

export default Allevamento;

