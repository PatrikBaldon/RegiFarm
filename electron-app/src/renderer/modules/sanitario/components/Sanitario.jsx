/**
 * Sanitario - Main component for Sanitario module
 * Gestione magazzino medicinali, farmaci e somministrazioni
 */
import React, { useState, useEffect, useMemo } from 'react';
import './Sanitario.css';
import MagazzinoMedicinali from './MagazzinoMedicinali';
import GestioneFarmaci from './GestioneFarmaci';
import Somministrazioni from './Somministrazioni';
import { useAzienda } from '../../../context/AziendaContext';
import {
  prefetchSanitarioFarmaci,
  prefetchSanitarioMagazzino,
  prefetchSanitarioSomministrazioni,
} from '../prefetchers';

const Sanitario = () => {
  const [activeTab, setActiveTab] = useState('magazzino');
  const { azienda } = useAzienda();

  const tabs = useMemo(
    () => [
      {
        id: 'magazzino',
        label: 'Magazzino Medicinali',
        prefetch: () => prefetchSanitarioMagazzino(azienda?.id),
      },
      { id: 'farmaci', label: 'Gestione Farmaci', prefetch: () => prefetchSanitarioFarmaci() },
      {
        id: 'somministrazioni',
        label: 'Somministrazioni',
        prefetch: () => prefetchSanitarioSomministrazioni(azienda?.id),
      },
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
    <div className="sanitario-module">
      <div className="sanitario-header">
        <h2>Modulo Sanitario</h2>
      </div>

      <div className="sanitario-tabs">
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

      <div className="sanitario-content">
        <div style={{ display: activeTab === 'magazzino' ? 'block' : 'none' }}>
          <MagazzinoMedicinali />
        </div>
        <div style={{ display: activeTab === 'farmaci' ? 'block' : 'none' }}>
          <GestioneFarmaci />
        </div>
        <div style={{ display: activeTab === 'somministrazioni' ? 'block' : 'none' }}>
          <Somministrazioni />
        </div>
      </div>
    </div>
  );
};

export default Sanitario;

