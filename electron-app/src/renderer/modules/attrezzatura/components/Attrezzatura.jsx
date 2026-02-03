/**
 * Attrezzatura - Main component for Attrezzatura module
 */
import React, { useMemo, useState, useEffect } from 'react';
import './Attrezzatura.css';
import GestioneAttrezzature from './GestioneAttrezzature';
import GestionePolizze from './GestionePolizze';
import { useAzienda } from '../../../context/AziendaContext';
import { prefetchAttrezzature } from '../prefetchers';

const Attrezzatura = () => {
  const [activeTab, setActiveTab] = useState('attrezzature');
  const { azienda } = useAzienda();
  const attrezzatureRef = React.useRef(null);
  const polizzeRef = React.useRef(null);

  const tabs = useMemo(
    () => [
      {
        id: 'attrezzature',
        label: 'Gestione Attrezzature',
        prefetch: () => prefetchAttrezzature(azienda?.id),
      },
      {
        id: 'polizze',
        label: 'Gestione Polizze',
        prefetch: null,
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

  // Listener per eventi di notifiche
  useEffect(() => {
    const handleOpenNotificationRecord = (event) => {
      const { tipo, id, attrezzatura_id, modulo } = event.detail;
      
      // Se la notifica è per questo modulo (attrezzatura)
      if (modulo === 'attrezzatura') {
        if (tipo === 'polizza' && id) {
          // Cambia al tab polizze e apri la polizza
          setActiveTab('polizze');
          
          // Usa un intervallo per verificare che il ref sia disponibile
          const checkAndOpen = () => {
            if (polizzeRef.current && polizzeRef.current.openPolizza) {
              polizzeRef.current.openPolizza(id);
            } else {
              setTimeout(checkAndOpen, 100);
            }
          };
          setTimeout(checkAndOpen, 200);
        } else if (tipo === 'scadenza' && id && attrezzatura_id) {
          // Cambia al tab attrezzature e apri la scadenza
          setActiveTab('attrezzature');
          
          // Usa un intervallo per verificare che il ref sia disponibile
          const checkAndOpen = () => {
            if (attrezzatureRef.current && attrezzatureRef.current.openScadenza) {
              attrezzatureRef.current.openScadenza(id, attrezzatura_id);
            } else {
              setTimeout(checkAndOpen, 100);
            }
          };
          setTimeout(checkAndOpen, 200);
        }
      }
    };

    window.addEventListener('openNotificationRecord', handleOpenNotificationRecord);
    return () => {
      window.removeEventListener('openNotificationRecord', handleOpenNotificationRecord);
    };
  }, []);

  return (
    <div className="attrezzatura-module">
      <div className="attrezzatura-header">
        <h2>Modulo Attrezzatura</h2>
      </div>

      <div className="attrezzatura-tabs">
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

      <div className="attrezzatura-content">
        {activeTab === 'attrezzature' && <GestioneAttrezzature ref={attrezzatureRef} />}
        {activeTab === 'polizze' && <GestionePolizze ref={polizzeRef} />}
      </div>
    </div>
  );
};

export default Attrezzatura;

