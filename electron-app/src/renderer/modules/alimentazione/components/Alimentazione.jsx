import React, { useState, useEffect, useMemo } from 'react';
import './Alimentazione.css';
import Catalogo from './Catalogo';
import Piani from './Piani';
import Storico from './Storico';
import DDT from './DDT';
import Scorte from './Scorte';
import { useAzienda } from '../../../context/AziendaContext';
import {
  prefetchAlimentazioneCatalogo,
  prefetchAlimentazionePiani,
  prefetchAlimentazioneStorico,
  prefetchAlimentazioneScorte,
} from '../prefetchers';

const Alimentazione = () => {
  const [activeTab, setActiveTab] = useState('ddt');
  const { azienda } = useAzienda();

  // Prefetch iniziale delle scorte (usato da più tab)
  useEffect(() => {
    prefetchAlimentazioneScorte();
  }, []);

  const tabs = useMemo(
    () => [
      { id: 'ddt', label: 'DDT (Carichi)' },
      { id: 'catalogo', label: 'Ingredienti e Mangimi', prefetch: () => prefetchAlimentazioneCatalogo() },
      { id: 'piani', label: 'Piani e Composizioni', prefetch: () => prefetchAlimentazionePiani() },
      {
        id: 'storico',
        label: 'Registro Alimentazione',
        prefetch: () => prefetchAlimentazioneStorico(azienda?.id),
      },
      { id: 'scorte', label: 'Scorte', prefetch: () => prefetchAlimentazioneScorte() },
    ],
    [azienda?.id],
  );

  // Prefetch del tab attivo quando il componente viene montato o quando cambia il tab
  useEffect(() => {
    const activeTabConfig = tabs.find(tab => tab.id === activeTab);
    if (activeTabConfig?.prefetch) {
      activeTabConfig.prefetch();
    }
  }, [activeTab, tabs]);

  return (
    <div className="alimentazione-module">
      <div className="alimentazione-header">
        <h2>Modulo Alimentazione</h2>
      </div>

      <div className="alimentazione-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onMouseEnter={() => tab.prefetch?.()}
            onFocus={() => tab.prefetch?.()}
            onClick={() => {
              tab.prefetch?.();
              setActiveTab(tab.id);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="alimentazione-content">
        <div style={{ display: activeTab === 'ddt' ? 'block' : 'none' }}>
          <DDT />
        </div>
        <div style={{ display: activeTab === 'catalogo' ? 'block' : 'none' }}>
          <Catalogo />
        </div>
        <div style={{ display: activeTab === 'piani' ? 'block' : 'none' }}>
          <Piani />
        </div>
        <div style={{ display: activeTab === 'storico' ? 'block' : 'none' }}>
          <Storico />
        </div>
        <div style={{ display: activeTab === 'scorte' ? 'block' : 'none' }}>
          <Scorte />
        </div>
      </div>
    </div>
  );
};

export default Alimentazione;
