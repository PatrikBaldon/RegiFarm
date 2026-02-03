import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAzienda } from '../../context/AziendaContext';
import { useImpostazioni } from '../../context/ImpostazioniContext';
import { useAuth } from '../../context/AuthContext';
import Impostazioni from '../Impostazioni';
import {
  prefetchFornitori,
  prefetchFatture,
} from '../../modules/amministrazione/prefetchers';
import {
  prefetchAlimentazioneCatalogo,
  prefetchAlimentazionePiani,
  prefetchAlimentazioneStorico,
  prefetchAlimentazioneScorte,
} from '../../modules/alimentazione/prefetchers';
import {
  prefetchSanitarioFarmaci,
  prefetchSanitarioMagazzino,
  prefetchSanitarioSomministrazioni,
} from '../../modules/sanitario/prefetchers';
import { prefetchAttrezzature } from '../../modules/attrezzatura/prefetchers';
import { prefetchTerreni } from '../../modules/terreni/prefetchers';
import { prefetchAnimali } from '../../modules/allevamento/prefetchers';
import './Sidebar.css';

const MODULI_DISPONIBILI = [
  { id: 'home', label: 'Home' },
  { id: 'allevamento', label: 'Allevamento' },
  { id: 'sanitario', label: 'Sanitario' },
  { id: 'alimentazione', label: 'Alimentazione' },
  { id: 'terreni', label: 'Terreni' },
  { id: 'amministrazione', label: 'Amministrazione' },
  { id: 'attrezzatura', label: 'Attrezzatura' },
  { id: 'profilo', label: 'Profilo' },
];

const Sidebar = ({ activeModule, setActiveModule, isOpen, onToggle }) => {
  const [showImpostazioni, setShowImpostazioni] = useState(false);
  const { azienda } = useAzienda();
  const { impostazioni } = useImpostazioni();
  const { signOut } = useAuth();
  const sidebarRef = useRef(null);
  const timeoutRef = useRef(null);

  // Profilo è sempre incluso, anche se non è nelle impostazioni
  const modules = useMemo(() => {
    const moduliAbilitati = impostazioni?.moduli?.moduli_abilitati || MODULI_DISPONIBILI.map(m => m.id);
    const abilitati = [...moduliAbilitati];
    // Profilo è sempre incluso, indipendentemente dalle impostazioni
    if (!abilitati.includes('profilo')) {
      abilitati.push('profilo');
    }
    
    return MODULI_DISPONIBILI.filter(module => {
      if (module.id === 'profilo') return true; // Profilo è sempre visibile
      return abilitati.includes(module.id);
    });
  }, [impostazioni]);

  const handleModulePrefetch = (moduleId) => {
    switch (moduleId) {
      case 'amministrazione':
        prefetchFornitori();
        prefetchFatture(azienda?.id);
        break;
      case 'allevamento':
        if (azienda?.id) {
          prefetchAnimali(azienda.id, { soloPresenti: true });
        }
        break;
      case 'sanitario':
        prefetchSanitarioFarmaci();
        if (azienda?.id) {
          prefetchSanitarioMagazzino(azienda.id);
          prefetchSanitarioSomministrazioni(azienda.id);
        }
        break;
      case 'alimentazione':
        prefetchAlimentazioneCatalogo();
        prefetchAlimentazionePiani();
        prefetchAlimentazioneScorte();
        if (azienda?.id) {
          prefetchAlimentazioneStorico(azienda.id);
        }
        break;
      case 'attrezzatura':
        if (azienda?.id) {
          prefetchAttrezzature(azienda.id);
        }
        break;
      case 'terreni':
        if (azienda?.id) {
          prefetchTerreni(azienda.id);
        }
        break;
      default:
        break;
    }
  };

  // Auto-chiusura quando il mouse esce dalla sidebar
  // NON chiudere se la modal delle impostazioni è aperta
  useEffect(() => {
    if (!isOpen || !sidebarRef.current || showImpostazioni) return;

    const handleMouseLeave = () => {
      // Chiudi dopo un breve delay per evitare chiusure accidentali
      timeoutRef.current = setTimeout(() => {
        // Verifica di nuovo se la modal è aperta prima di chiudere
        if (!showImpostazioni && onToggle) {
          onToggle();
        }
      }, 300); // 300ms di delay
    };

    const handleMouseEnter = () => {
      // Cancella il timeout se il mouse rientra
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const sidebar = sidebarRef.current;
    sidebar.addEventListener('mouseleave', handleMouseLeave);
    sidebar.addEventListener('mouseenter', handleMouseEnter);

    return () => {
      sidebar.removeEventListener('mouseleave', handleMouseLeave);
      sidebar.removeEventListener('mouseenter', handleMouseEnter);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isOpen, onToggle, showImpostazioni]);

  return (
    <>
      <div className={`sidebar-overlay ${isOpen ? 'visible' : ''}`} />
      <aside ref={sidebarRef} className={`sidebar ${isOpen ? 'open' : ''}`}>
        <nav className="sidebar-nav">
          {modules.map((module) => (
            <button
              key={module.id}
              className={`nav-item ${activeModule === module.id ? 'active' : ''}`}
              onMouseEnter={() => handleModulePrefetch(module.id)}
              onFocus={() => handleModulePrefetch(module.id)}
              onClick={() => {
                handleModulePrefetch(module.id);
                setActiveModule(module.id);
              }}
            >
              {module.label}
            </button>
          ))}
          <div className="sidebar-divider" />
          <div className="sidebar-footer-actions">
            <button
              className="nav-item nav-item-settings"
              onClick={() => {
                // Cancella eventuali timeout di chiusura quando si apre la modal
                if (timeoutRef.current) {
                  clearTimeout(timeoutRef.current);
                  timeoutRef.current = null;
                }
                setShowImpostazioni(true);
              }}
              title="Impostazioni"
            >
              ⚙️
            </button>
            <button
              className="nav-item nav-item-logout"
              onClick={async () => {
                try {
                  await signOut();
                } catch (error) {

                }
              }}
              title="Esci dall'applicazione"
            >
              ⏻
            </button>
          </div>
        </nav>
      </aside>
      {showImpostazioni && (
        <Impostazioni onClose={() => setShowImpostazioni(false)} />
      )}
    </>
  );
};

export default Sidebar;

