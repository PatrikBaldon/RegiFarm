/**
 * Impostazioni - Sistema completo di configurazione e personalizzazione dell'applicazione
 */
import React, { useState, useEffect, useRef } from 'react';
import { useImpostazioni } from '../context/ImpostazioniContext';
import { useAzienda } from '../context/AziendaContext';
import { impostazioniService } from '../services/impostazioniService';
import { amministrazioneService } from '../modules/amministrazione/services/amministrazioneService';
import BaseModal from './BaseModal';
import ToggleButton from './ToggleButton';
import api from '../services/api';
import './Impostazioni.css';


// Categorie Prima Nota: gestione nascosta in UI semplificata; le categorie restano nel backend per movimenti automatici
const SEZIONI = [
  { id: 'moduli', label: 'Moduli e Navigazione' },
  { id: 'ddt', label: 'DDT - Documenti di Trasporto' },
];

const MODULI_DISPONIBILI = [
  { id: 'home', label: 'Home', default: true },
  { id: 'allevamento', label: 'Allevamento', default: true },
  { id: 'sanitario', label: 'Sanitario', default: true },
  { id: 'alimentazione', label: 'Alimentazione', default: true },
  { id: 'terreni', label: 'Terreni', default: true },
  { id: 'amministrazione', label: 'Amministrazione', default: true },
  { id: 'attrezzatura', label: 'Attrezzatura', default: true },
  // Profilo non è incluso perché è sempre visibile e fondamentale
];

const MACROCATEGORIE_OPTIONS = [
  { value: 'nessuna', label: 'Nessuna' },
  { value: 'alimento', label: 'Alimento' },
  { value: 'terreno', label: 'Terreno' },
  { value: 'attrezzatura', label: 'Attrezzatura' },
  { value: 'sanitario', label: 'Sanitario' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'personale', label: 'Personale' },
  { value: 'servizi', label: 'Servizi' },
  { value: 'assicurazioni', label: 'Assicurazioni' },
  { value: 'finanziario', label: 'Finanziario' },
  { value: 'amministrativo', label: 'Amministrativo' },
];


const Impostazioni = ({ onClose }) => {
  const { azienda } = useAzienda();
  const aziendaId = azienda?.id;
  const { impostazioni: impostazioniFromContext, saveImpostazioni: saveImpostazioniToContext, updateImpostazioni, loading: contextLoading } = useImpostazioni();
  const [activeSezione, setActiveSezione] = useState('moduli');
  const [activeCategoriaTab, setActiveCategoriaTab] = useState('entrata'); // 'entrata' | 'uscita' | 'giroconto'
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categorieLoading, setCategorieLoading] = useState(false);
  const [categorie, setCategorie] = useState({ entrata: [], uscita: [], giroconto: [] });
  const [savingCategoria, setSavingCategoria] = useState(null); // ID della categoria in salvataggio
  const [editingCategoriaModal, setEditingCategoriaModal] = useState(null); // Categoria in modifica (null = chiusa)
  const [ddtConfig, setDdtConfig] = useState({
    formato_numero: '{progressivo}/{anno}',
    numero_partenza: 1,
  });
  const [ddtConfigLoading, setDdtConfigLoading] = useState(false);
  const [impostazioni, setImpostazioni] = useState({
    moduli: {
      moduli_abilitati: MODULI_DISPONIBILI.filter(m => m.default).map(m => m.id),
    },
  });


  // Carica le impostazioni dal Context quando disponibili
  useEffect(() => {
    if (impostazioniFromContext) {
      setImpostazioni(impostazioniFromContext);
    } else if (!contextLoading) {
      // Se il Context non ha ancora caricato, carica direttamente
      loadImpostazioni();
    }
  }, [impostazioniFromContext, contextLoading]);

  // Prevenire la chiusura accidentale della modal durante il caricamento iniziale
  const [isInitializing, setIsInitializing] = useState(true);
  useEffect(() => {
    // Dopo un breve delay, permettere la chiusura normale
    const timer = setTimeout(() => {
      setIsInitializing(false);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Carica le categorie Prima Nota quando si apre la sezione
  useEffect(() => {
    if (activeSezione === 'categorie' && aziendaId) {
      loadCategorie();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSezione, aziendaId]);

  // Carica configurazione DDT quando si apre la sezione
  useEffect(() => {
    if (activeSezione === 'ddt' && aziendaId) {
      loadDdtConfig();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSezione, aziendaId]);


  const loadImpostazioni = async () => {
    if (!aziendaId) {
      return;
    }
    
    setLoading(true);
    try {
      const data = await impostazioniService.getImpostazioni(aziendaId);
      if (data) {
        setImpostazioni(prev => ({
          moduli: {
            moduli_abilitati: data.moduli?.moduli_abilitati || prev.moduli.moduli_abilitati,
          },
        }));
      }
    } catch (error) {
      console.error('Errore nel caricamento impostazioni:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCategorie = async () => {
    if (!aziendaId) return;
    
    setCategorieLoading(true);
    try {
      console.log('Caricamento categorie per azienda:', aziendaId);
      const [entrate, uscite, giroconti] = await Promise.all([
        amministrazioneService.getCategoriePrimaNota(aziendaId, 'entrata', false),
        amministrazioneService.getCategoriePrimaNota(aziendaId, 'uscita', false),
        amministrazioneService.getCategoriePrimaNota(aziendaId, 'giroconto', false),
      ]);
      
      console.log('Categorie caricate:', { entrate, uscite, giroconti });
      
      setCategorie({
        entrata: entrate || [],
        uscita: uscite || [],
        giroconto: giroconti || [],
      });
    } catch (error) {
      console.error('Errore nel caricamento categorie:', error);
      // Non mostrare alert che potrebbe interferire con la modal
      // Mantieni le categorie esistenti invece di resettarle
      setCategorie(prev => ({
        entrata: prev.entrata || [],
        uscita: prev.uscita || [],
        giroconto: prev.giroconto || [],
      }));
    } finally {
      setCategorieLoading(false);
    }
  };

  const saveImpostazioni = async () => {
    if (!aziendaId) {
      alert('Azienda non selezionata');
      return;
    }
    
    setSaving(true);
    try {
      // Carica le impostazioni esistenti per mantenere tutti i dati
      const currentImpostazioni = await impostazioniService.getImpostazioni(aziendaId);
      
      // Assicurati che le impostazioni includano tutti i campi richiesti dallo schema
      const impostazioniComplete = {
        moduli: impostazioni.moduli || {},
        amministrazione: currentImpostazioni?.amministrazione || {},
        attrezzature: currentImpostazioni?.attrezzature || {},
        prima_nota: currentImpostazioni?.prima_nota || {},
        // Includi la configurazione DDT se siamo nella sezione DDT
        ddt_emessi: activeSezione === 'ddt' ? {
          formato_numero: ddtConfig.formato_numero,
          numero_partenza: parseInt(ddtConfig.numero_partenza) || 1,
        } : (currentImpostazioni?.ddt_emessi || {}),
      };
      
      // Salva tutte le impostazioni
      await saveImpostazioniToContext(impostazioniComplete);
      alert('Impostazioni salvate con successo!');
      onClose();
    } catch (error) {
      console.error('Errore nel salvataggio impostazioni:', error);
      alert('Errore nel salvataggio delle impostazioni');
    } finally {
      setSaving(false);
    }
  };

  const toggleModulo = (moduloId) => {
    // Aggiorna immediatamente Context e backend
    updateImpostazioni(prev => {
      const moduliAbilitati = [...(prev.moduli.moduli_abilitati || [])];
      const index = moduliAbilitati.indexOf(moduloId);
      
      if (index > -1) {
        moduliAbilitati.splice(index, 1);
      } else {
        moduliAbilitati.push(moduloId);
      }
      
      return {
        ...prev,
        moduli: {
          moduli_abilitati: moduliAbilitati,
        },
      };
    });
    
    // Aggiorna anche lo state locale per la UI immediata
    setImpostazioni(prev => {
      const moduliAbilitati = [...(prev.moduli.moduli_abilitati || [])];
      const index = moduliAbilitati.indexOf(moduloId);
      
      if (index > -1) {
        moduliAbilitati.splice(index, 1);
      } else {
        moduliAbilitati.push(moduloId);
      }
      
      return {
        ...prev,
        moduli: {
          moduli_abilitati: moduliAbilitati,
        },
      };
    });
  };



  const handleDeleteCategoria = async (categoriaId) => {
    if (!confirm('Sei sicuro di voler eliminare questa categoria?')) {
      return;
    }

    try {
      await amministrazioneService.deleteCategoriaPrimaNota(categoriaId);
      await loadCategorie();
    } catch (error) {
      console.error('Errore nell\'eliminazione categoria:', error);
      alert('Errore nell\'eliminazione della categoria: ' + (error.response?.data?.detail || error.message));
    }
  };


  const renderModuli = () => {
    return (
      <div className="impostazioni-module-content">
        <div className="section-description">
          <p>Abilita o disabilita i moduli disponibili nella navigazione laterale. I moduli disabilitati non saranno visibili nel menu.</p>
        </div>
        
        <div className="moduli-list">
          {MODULI_DISPONIBILI.map(modulo => {
            const isAbilitato = impostazioni.moduli.moduli_abilitati?.includes(modulo.id);
            return (
              <div key={modulo.id} className={`modulo-item ${isAbilitato ? 'active' : ''}`}>
                <span className="modulo-label">{modulo.label}</span>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={isAbilitato}
                    onChange={() => toggleModulo(modulo.id)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            );
          })}
        </div>
        
        <div className="info-box">
          Per applicare le modifiche ai moduli, è necessario ricaricare l'applicazione dopo il salvataggio.
        </div>
      </div>
    );
  };

  const loadDdtConfig = async () => {
    if (!aziendaId) return;
    
    setDdtConfigLoading(true);
    try {
      // Usa il servizio impostazioni per caricare la configurazione DDT
      const response = await impostazioniService.getImpostazioni(aziendaId);
      const ddtConfigData = response?.ddt_emessi || {};
      
      setDdtConfig({
        formato_numero: ddtConfigData.formato_numero || '{progressivo}/{anno}',
        numero_partenza: ddtConfigData.numero_partenza || 1,
      });
    } catch (error) {
      console.error('Errore nel caricamento configurazione DDT:', error);
      // Usa valori di default se errore
      setDdtConfig({
        formato_numero: '{progressivo}/{anno}',
        numero_partenza: 1,
      });
    } finally {
      setDdtConfigLoading(false);
    }
  };


  const renderDDT = () => {
    return (
      <div className="impostazioni-module-content">
        <div className="section-description">
          <p>Configura la numerazione dei Documenti di Trasporto (DDT). Il formato del numero e il numero di partenza possono essere personalizzati.</p>
        </div>
        
        {ddtConfigLoading ? (
          <div className="loading">Caricamento configurazione...</div>
        ) : (
          <div className="settings-section ddt-settings-section">
            <div className="form-row ddt-form-row">
              <div className="form-field full-width ddt-form-field">
                <label className="field-label">Formato Numero *</label>
                <input
                  type="text"
                  value={ddtConfig.formato_numero}
                  onChange={(e) => setDdtConfig(prev => ({ ...prev, formato_numero: e.target.value }))}
                  className="impostazioni-input"
                  placeholder="{progressivo}/{anno}"
                />
              </div>
            </div>
            <div className="field-hint-full ddt-hint-container">
                  <p><strong>Istruzioni per il formato:</strong></p>
                  <p>Usa <code>{'{progressivo}'}</code> per il numero progressivo e <code>{'{anno}'}</code> per l'anno completo (es. 2026) o <code>{'{anno_2cifre}'}</code> per l'anno a 2 cifre (es. 26).</p>
                  <p><strong>Esempi di formati:</strong></p>
                  <ul>
                    <li><code>{'{progressivo}/{anno}'}</code> → "1/2026"</li>
                    <li><code>{'{progressivo:03d}/{anno}'}</code> → "001/2026" (con zeri iniziali)</li>
                    <li><code>{'{progressivo:02d}-{anno:02d}'}</code> → "01-26" (formato compatto)</li>
                    <li><code>{'DDT-{progressivo:04d}/{anno}'}</code> → "DDT-0001/2026" (con prefisso)</li>
                  </ul>
                  <p>Puoi usare qualsiasi separatore o prefisso desiderato nel formato.</p>
            </div>
            
            <div className="form-row ddt-form-row">
              <div className="form-field full-width ddt-form-field">
                <label className="field-label">Numero di Partenza</label>
                <input
                  type="number"
                  value={ddtConfig.numero_partenza}
                  onChange={(e) => setDdtConfig(prev => ({ ...prev, numero_partenza: parseInt(e.target.value) || 1 }))}
                  className="impostazioni-input"
                  min="1"
                />
              </div>
            </div>
            <div className="field-hint-full ddt-hint-container">
                  <p>Il numero progressivo partirà da questo valore ogni anno. Il conteggio riparte automaticamente all'inizio di ogni anno (1 gennaio).</p>
                  <p><strong>Esempio:</strong> Se imposti il numero di partenza a 10, il primo DDT del 2026 sarà 10/2026, il secondo 11/2026, e così via. All'inizio del 2027, il conteggio ripartirà da 10/2027.</p>
            </div>
            
            <div className="info-box-full ddt-info-container">
              <p><strong>Nota importante:</strong> Le modifiche alla configurazione si applicheranno ai nuovi DDT creati dopo il salvataggio. I DDT già esistenti manterranno il loro numero originale e non verranno modificati.</p>
              <p>Per applicare le modifiche, utilizza il pulsante "Salva Impostazioni" nella parte inferiore della modale.</p>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderCategorie = () => {
    const tipoOperazioneLabels = {
      entrata: 'Entrate',
      uscita: 'Uscite',
      giroconto: 'Giroconti',
    };

    const currentCategorie = categorie[activeCategoriaTab] || [];

    return (
      <div className="impostazioni-module-content">
        <div className="section-description">
          <p>Gestisci le categorie unificate per Prima Nota, Fatture e tutti i movimenti finanziari. Le categorie possono richiedere l'associazione di un terreno o di un'attrezzatura specifica.</p>
        </div>

        <div className="amministrazione-tabs">
          <button
            className={`amministrazione-tab ${activeCategoriaTab === 'entrata' ? 'active' : ''}`}
            onClick={() => setActiveCategoriaTab('entrata')}
          >
            Entrate
          </button>
          <button
            className={`amministrazione-tab ${activeCategoriaTab === 'uscita' ? 'active' : ''}`}
            onClick={() => setActiveCategoriaTab('uscita')}
          >
            Uscite
          </button>
          <button
            className={`amministrazione-tab ${activeCategoriaTab === 'giroconto' ? 'active' : ''}`}
            onClick={() => setActiveCategoriaTab('giroconto')}
          >
            Giroconti
          </button>
        </div>

        {categorieLoading ? (
          <div className="loading">Caricamento categorie...</div>
        ) : (
          <div className="settings-section">
            <h4>Categorie {tipoOperazioneLabels[activeCategoriaTab]}</h4>
            <p className="section-hint">Categorie utilizzate per le operazioni di {tipoOperazioneLabels[activeCategoriaTab].toLowerCase()}</p>
            
            <div className="categorie-list-compact">
              {currentCategorie
                .sort((a, b) => (a.ordine || 0) - (b.ordine || 0))
                .map((cat) => (
                  <div 
                    key={cat.id} 
                    className="categoria-row clickable"
                    onClick={() => setEditingCategoriaModal({ ...cat })}
                  >
                    <div className="categoria-row-main">
                      <span className="categoria-ordine">#{cat.ordine || 0}</span>
                      <span className="categoria-nome">{cat.nome || 'Senza nome'}</span>
                      {cat.codice && <span className="categoria-codice">({cat.codice})</span>}
                      {cat.macrocategoria && cat.macrocategoria !== 'nessuna' && (
                        <span className="categoria-macro">{cat.macrocategoria}</span>
                      )}
                      {cat.creata_dal_sistema && <span className="system-badge-small">Sistema</span>}
                      {cat.attiva === false && <span className="inactive-badge">Inattiva</span>}
                    </div>
                  </div>
                ))}
              
              {currentCategorie.length === 0 && (
                <div className="empty-state">
                  <p>Nessuna categoria disponibile. Aggiungine una nuova.</p>
                </div>
              )}
              
              <div className="categoria-add-compact">
                <button 
                  className="btn-primary btn-add-categoria"
                  onClick={() => setEditingCategoriaModal({
                    nome: '',
                    codice: '',
                    descrizione: '',
                    tipo_operazione: activeCategoriaTab,
                    ordine: 0,
                    richiede_terreno: false,
                    richiede_attrezzatura: false,
                    macrocategoria: 'nessuna',
                    attiva: true,
                  })}
                >
                  Aggiungi Categoria
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };


  const handleOverlayClick = (e) => {
    // Prevenire la chiusura accidentale durante l'inizializzazione
    if (!isInitializing) {
      onClose();
    }
  };

  const handleSaveCategoriaModal = async () => {
    if (!editingCategoriaModal) return;
    
    if (!editingCategoriaModal.nome || !editingCategoriaModal.nome.trim()) {
      alert('Il nome della categoria è obbligatorio.');
      return;
    }
    
    if (!aziendaId) {
      alert('Azienda non selezionata.');
      return;
    }
    
    const categoriaId = editingCategoriaModal.id;
    setSavingCategoria(categoriaId || 'new');
    
    try {
      // Prepara i dati da inviare, rimuovendo campi non necessari
      // IMPORTANTE: Per la descrizione, inviamo sempre il valore (anche stringa vuota)
      // perché il backend aggiorna solo se il campo è presente (not None)
      const descrizioneValue = editingCategoriaModal.descrizione?.trim() || '';
      
      const payload = {
        nome: editingCategoriaModal.nome.trim(),
        codice: editingCategoriaModal.codice?.trim() || null,
        descrizione: descrizioneValue, // Invia sempre come stringa (anche vuota)
        ordine: editingCategoriaModal.ordine || 0,
        macrocategoria: editingCategoriaModal.macrocategoria || 'nessuna',
        richiede_terreno: editingCategoriaModal.richiede_terreno || false,
        richiede_attrezzatura: editingCategoriaModal.richiede_attrezzatura || false,
        attiva: editingCategoriaModal.attiva !== false,
      };
      
      console.log('Payload da inviare:', payload);
      
      let updatedCategoria;
      
      if (categoriaId) {
        // Modifica categoria esistente
        console.log('Aggiornamento categoria:', categoriaId, payload);
        updatedCategoria = await amministrazioneService.updateCategoriaPrimaNota(categoriaId, payload);
        console.log('Categoria aggiornata dal backend:', updatedCategoria);
      } else {
        // Crea nuova categoria
        const createPayload = {
          ...payload,
          azienda_id: aziendaId,
          tipo_operazione: activeCategoriaTab,
        };
        console.log('Creazione nuova categoria:', createPayload);
        updatedCategoria = await amministrazioneService.createCategoriaPrimaNota(createPayload);
        console.log('Categoria creata dal backend:', updatedCategoria);
      }
      
      // Aggiorna ottimisticamente lo stato locale
      if (updatedCategoria) {
        setCategorie(prev => {
          const updated = { ...prev };
          const tab = activeCategoriaTab;
          const index = updated[tab].findIndex(c => c.id === (categoriaId || updatedCategoria.id));
          
          if (index >= 0) {
            // Aggiorna categoria esistente
            updated[tab] = updated[tab].map((c, i) => i === index ? { ...c, ...updatedCategoria } : c);
          } else {
            // Aggiungi nuova categoria
            updated[tab] = [...updated[tab], updatedCategoria];
          }
          
          return updated;
        });
      }
      
      // Chiudi la modale
      setEditingCategoriaModal(null);
      
      // Invalida la cache delle categorie per forzare il refresh
      api.invalidateCache('/prima-nota/categorie');
      
      // Forza il refresh delle categorie invalidando la cache e ricaricando
      // Aspetta un momento per assicurarsi che il backend abbia processato
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Ricarica le categorie dal backend per sincronizzazione
      await loadCategorie();
    } catch (error) {
      console.error('Errore nel salvataggio categoria:', error);
      const errorMessage = error.response?.data?.detail || error.response?.data?.message || error.message || 'Errore sconosciuto';
      alert('Errore nel salvataggio della categoria: ' + errorMessage);
    } finally {
      setSavingCategoria(null);
    }
  };

  return (
    <>
      <BaseModal
        isOpen={true}
        onClose={onClose}
        title="Impostazioni e Personalizzazione"
        size="xlarge"
        className="impostazioni-modal"
        footerActions={
          <>
            <button className="btn-secondary" onClick={onClose}>Chiudi</button>
            <button 
              className="btn-primary" 
              onClick={saveImpostazioni}
              disabled={saving}
            >
              {saving ? 'Salvataggio...' : 'Salva Impostazioni'}
            </button>
          </>
        }
      >

        <div className="impostazioni-container">
          <div className="impostazioni-sidebar">
            {SEZIONI.map(sezione => (
              <button
                key={sezione.id}
                className={`impostazioni-module-button ${activeSezione === sezione.id ? 'active' : ''}`}
                onClick={() => setActiveSezione(sezione.id)}
              >
                {sezione.label}
              </button>
            ))}
          </div>

          <div className="impostazioni-content">
            {loading ? (
              <div className="loading">Caricamento...</div>
            ) : (
              <>
                {activeSezione === 'moduli' && renderModuli()}
                {activeSezione === 'categorie' && renderCategorie()}
                {activeSezione === 'ddt' && renderDDT()}
              </>
            )}
          </div>
        </div>
      </BaseModal>
    
      {/* Modale di modifica categoria */}
      <BaseModal
        isOpen={!!editingCategoriaModal}
        onClose={() => setEditingCategoriaModal(null)}
        title={editingCategoriaModal ? (editingCategoriaModal.id ? 'Modifica Categoria' : 'Nuova Categoria') : ''}
        size="small"
        className="categoria-edit-modal"
        footerActions={
          <>
            {editingCategoriaModal && editingCategoriaModal.id && !editingCategoriaModal.creata_dal_sistema && (
              <button 
                className="btn-danger" 
                onClick={async () => {
                  if (confirm('Sei sicuro di voler eliminare questa categoria?')) {
                    try {
                      await amministrazioneService.deleteCategoriaPrimaNota(editingCategoriaModal.id);
                      await loadCategorie();
                      setEditingCategoriaModal(null);
                    } catch (error) {
                      console.error('Errore nell\'eliminazione categoria:', error);
                      alert('Errore nell\'eliminazione della categoria: ' + (error.response?.data?.detail || error.message));
                    }
                  }
                }}
                disabled={savingCategoria !== null}
              >
                Elimina
              </button>
            )}
            <button className="btn-secondary" onClick={() => setEditingCategoriaModal(null)}>Annulla</button>
            <button 
              className="btn-primary" 
              onClick={handleSaveCategoriaModal}
              disabled={savingCategoria !== null}
            >
              {savingCategoria !== null ? 'Salvataggio...' : 'Salva'}
            </button>
          </>
        }
      >
          {editingCategoriaModal && (
            <div className="modal-body">
              <div className="categoria-edit-form">
                <div className="form-row">
                  <div className="form-field">
                    <label className="field-label">Nome *</label>
                    <input
                      type="text"
                      value={editingCategoriaModal.nome || ''}
                      onChange={(e) => setEditingCategoriaModal(prev => ({ ...prev, nome: e.target.value }))}
                      className="impostazioni-input"
                      disabled={editingCategoriaModal.creata_dal_sistema}
                      placeholder="Nome della categoria"
                    />
                  </div>
                  <div className="form-field small">
                    <label className="field-label">Ordine</label>
                    <input
                      type="number"
                      value={editingCategoriaModal.ordine || 0}
                      onChange={(e) => setEditingCategoriaModal(prev => ({ ...prev, ordine: parseInt(e.target.value) || 0 }))}
                      className="impostazioni-input"
                      min="0"
                    />
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-field">
                    <label className="field-label">Codice</label>
                    <input
                      type="text"
                      value={editingCategoriaModal.codice || ''}
                      onChange={(e) => setEditingCategoriaModal(prev => ({ ...prev, codice: e.target.value }))}
                      className="impostazioni-input"
                      placeholder="Opzionale"
                    />
                  </div>
                  <div className="form-field">
                    <label className="field-label">Macrocategoria</label>
                    <select
                      value={editingCategoriaModal.macrocategoria || 'nessuna'}
                      onChange={(e) => setEditingCategoriaModal(prev => ({ ...prev, macrocategoria: e.target.value }))}
                      className="impostazioni-input"
                    >
                      {MACROCATEGORIE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-field full-width">
                    <label className="field-label">Descrizione</label>
                    <input
                      type="text"
                      value={editingCategoriaModal.descrizione || ''}
                      onChange={(e) => setEditingCategoriaModal(prev => ({ ...prev, descrizione: e.target.value }))}
                      className="impostazioni-input"
                      placeholder="Opzionale"
                    />
                  </div>
                </div>
                
                <div className="form-row checkboxes">
                  <ToggleButton
                    id="toggle-richiede-terreno"
                    checked={editingCategoriaModal.richiede_terreno || false}
                    onChange={() => setEditingCategoriaModal(prev => ({ ...prev, richiede_terreno: !prev.richiede_terreno }))}
                    label="Richiede Terreno"
                  />
                  <ToggleButton
                    id="toggle-richiede-attrezzatura"
                    checked={editingCategoriaModal.richiede_attrezzatura || false}
                    onChange={() => setEditingCategoriaModal(prev => ({ ...prev, richiede_attrezzatura: !prev.richiede_attrezzatura }))}
                    label="Richiede Attrezzatura"
                  />
                  <ToggleButton
                    id="toggle-attiva-categoria"
                    checked={editingCategoriaModal.attiva !== false}
                    onChange={() => setEditingCategoriaModal(prev => ({ ...prev, attiva: !prev.attiva }))}
                    label="Attiva"
                  />
                </div>
              </div>
            </div>
          )}
      </BaseModal>
    </>
  );
};

export default Impostazioni;
