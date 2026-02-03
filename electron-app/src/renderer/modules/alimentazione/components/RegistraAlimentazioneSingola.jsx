/**
 * RegistraAlimentazioneSingola - Form per registrare alimentazione per singolo animale
 */
import React, { useState, useEffect } from 'react';
import { alimentazioneService } from '../services/alimentazioneService';
import { allevamentoService } from '../../allevamento/services/allevamentoService';
import { useAzienda } from '../../../context/AziendaContext';
import SearchableSelect from '../../../components/SearchableSelect';
import SmartSelect from '../../../components/SmartSelect';
import BaseModal from '../../../components/BaseModal';
import './RegistraAlimentazione.css';
import '../components/Alimentazione.css';

const RegistraAlimentazioneSingola = React.forwardRef(({ isModal = false, onSuccess, onCancel }, ref) => {
  const { azienda } = useAzienda();
  const [piani, setPiani] = useState([]);
  const [componenti, setComponenti] = useState([]);
  const [mangimi, setMangimi] = useState([]);
  const [animali, setAnimali] = useState([]);
  const [allAnimali, setAllAnimali] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingAnimali, setLoadingAnimali] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [animalSearch, setAnimalSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedAnimalIds, setSelectedAnimalIds] = useState([]);
  const [selectedAnimals, setSelectedAnimals] = useState([]);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const [formData, setFormData] = useState({
    animale_id: '',
    tipo_alimento: 'singolo',
    piano_id: '',
    singolo_tipo: 'componente',
    componente_id: '',
    mangime_id: '',
    quantita: '',
    data: new Date().toISOString().slice(0, 10),
    note: ''
  });

  const tipoAlimentoOptions = [
    { value: 'piano', label: 'Piano alimentare' },
    { value: 'singolo', label: 'Alimento singolo' },
  ];

  const singoloTipoOptions = [
    { value: 'componente', label: 'Componente alimentare' },
    { value: 'mangime', label: 'Mangime confezionato' },
  ];

  useEffect(() => {
    loadPiani();
    loadComponenti();
    loadMangimi();
  }, []);

  useEffect(() => {
    if (azienda?.id) {
      loadAnimali();
    }
  }, [azienda?.id]);

  // Carica tutti gli animali quando si apre la modale
  useEffect(() => {
    if (selectorOpen && azienda?.id) {
      loadAllAnimali();
    } else if (!selectorOpen) {
      // Non resettare allAnimali se c'è un animale selezionato, serve per mostrare le info
      if (!formData.animale_id) {
        setAllAnimali([]);
      }
      setAnimali([]);
      setAnimalSearch('');
      setDateFrom('');
      setDateTo('');
    }
  }, [selectorOpen, azienda?.id]);

  // Carica animali quando si apre il componente se c'è già un animale selezionato
  useEffect(() => {
    if (formData.animale_id && azienda?.id && !allAnimali.length) {
      loadAllAnimali();
    }
  }, [formData.animale_id, azienda?.id]);

  // Filtra automaticamente gli animali in base alla ricerca e ai filtri
  useEffect(() => {
    if (!allAnimali.length) {
      setAnimali([]);
      return;
    }

    let filtered = [...allAnimali];

    if (animalSearch && animalSearch.trim()) {
      const searchLower = animalSearch.trim().toLowerCase();
      filtered = filtered.filter(a => 
        a.auricolare?.toLowerCase().includes(searchLower) ||
        a.auricolare?.slice(-4).toLowerCase().includes(searchLower)
      );
    }

    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      filtered = filtered.filter(a => {
        if (!a.data_arrivo) return false;
        const arrivoDate = new Date(a.data_arrivo);
        return arrivoDate >= fromDate;
      });
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(a => {
        if (!a.data_arrivo) return false;
        const arrivoDate = new Date(a.data_arrivo);
        return arrivoDate <= toDate;
      });
    }

    setAnimali(filtered);
  }, [allAnimali, animalSearch, dateFrom, dateTo]);

  // Aggiorna selectedAnimals ogni volta che la selezione cambia
  useEffect(() => {
    if (!selectedAnimalIds.length || !animali.length) return;
    const nuovi = animali.filter(a => selectedAnimalIds.includes(a.id))
      .map(a => ({id: a.id, auricolare: a.auricolare}));
    const prev = selectedAnimals.filter(a => selectedAnimalIds.includes(a.id) && !nuovi.some(n => n.id === a.id));
    setSelectedAnimals([...prev, ...nuovi]);
  }, [selectedAnimalIds, animali]);

  const loadPiani = async () => {
    try {
      const data = await alimentazioneService.getPiani();
      setPiani(data || []);
    } catch (err) {
      console.error('Errore caricamento piani:', err);
    }
  };

  const loadComponenti = async () => {
    try {
      const data = await alimentazioneService.getComponenti();
      setComponenti(data || []);
    } catch (err) {
      console.error('Errore caricamento componenti:', err);
    }
  };

  const loadMangimi = async () => {
    try {
      const data = await alimentazioneService.getMangimi();
      setMangimi(data || []);
    } catch (err) {
      console.error('Errore caricamento mangimi:', err);
    }
  };

  const loadAnimali = async () => {
    if (!azienda?.id) return;
    try {
      const data = await allevamentoService.getAnimali({ azienda_id: azienda.id, stato: 'presente' });
      setAnimali(data || []);
    } catch (err) {
      console.error('Errore caricamento animali:', err);
    }
  };

  const loadAllAnimali = async () => {
    if (!azienda?.id) return;
    setLoadingAnimali(true);
    try {
      const data = await allevamentoService.getAnimali({ azienda_id: azienda.id, stato: 'presente' });
      setAllAnimali(data || []);
      setAnimali(data || []);
      
      // Se c'è un animale già selezionato, mantieni la selezione
      if (formData.animale_id) {
        const animale = data.find(a => a.id === parseInt(formData.animale_id));
        if (animale) {
          setSelectedAnimals([{id: animale.id, auricolare: animale.auricolare}]);
          setSelectedAnimalIds([animale.id]);
        }
      }
    } catch (err) {
      console.error('Errore caricamento animali:', err);
      setAllAnimali([]);
      setAnimali([]);
    } finally {
      setLoadingAnimali(false);
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    
    if (!formData.animale_id || !formData.quantita || !formData.data) {
      alert('Compila tutti i campi obbligatori');
      return;
    }

    if (formData.tipo_alimento === 'piano' && !formData.piano_id) {
      alert('Seleziona un piano alimentare');
      return;
    }

    if (formData.tipo_alimento === 'singolo') {
      if (formData.singolo_tipo === 'componente' && !formData.componente_id) {
        alert('Seleziona un componente alimentare');
        return;
      }
      if (formData.singolo_tipo === 'mangime' && !formData.mangime_id) {
        alert('Seleziona un mangime confezionato');
        return;
      }
    }

    setLoading(true);
    try {
      // Per singolo animale, dobbiamo prima ottenere il box dell'animale
      const animale = allAnimali.find(a => a.id === parseInt(formData.animale_id));
      if (!animale) {
        alert('Animale non trovato');
        return;
      }

      if (!animale.box_id) {
        alert('L\'animale selezionato non ha un box associato. Impossibile registrare l\'alimentazione.');
        return;
      }

      // Nota: il sistema attuale distribuisce automaticamente a tutti gli animali del box
      // Per alimentare solo un animale specifico, sarebbe necessario un sistema diverso
      const conferma = window.confirm(
        `L'alimentazione verrà distribuita a tutti gli animali del box "${animale.box_nome || 'Box #' + animale.box_id}". ` +
        `Vuoi continuare?`
      );
      if (!conferma) return;

      const payload = {
        data: formData.data,
        quantita_totale: Number(formData.quantita),
        target_tipo: 'box',
        target_id: animale.box_id,
        tipo_alimento: formData.tipo_alimento,
        razione_id: formData.tipo_alimento === 'piano' ? parseInt(formData.piano_id, 10) : null,
        componente_alimentare_id:
          formData.tipo_alimento === 'singolo' && formData.singolo_tipo === 'componente' && formData.componente_id
            ? parseInt(formData.componente_id, 10)
            : null,
        mangime_confezionato_id:
          formData.tipo_alimento === 'singolo' && formData.singolo_tipo === 'mangime' && formData.mangime_id
            ? parseInt(formData.mangime_id, 10)
            : null,
        note: formData.note || null,
      };

      const response = await alimentazioneService.createVoceRegistro(payload);
      alert('Alimentazione registrata con successo!');
      
      setFormData({
        animale_id: '',
        tipo_alimento: 'singolo',
        piano_id: '',
        singolo_tipo: 'componente',
        componente_id: '',
        mangime_id: '',
        quantita: '',
        data: new Date().toISOString().slice(0, 10),
        note: ''
      });
      setSelectedAnimalIds([]);
      setSelectedAnimals([]);
      
      if (isModal && onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Errore registrazione alimentazione:', err);
      alert(`Errore: ${err.response?.data?.detail || err.message || 'Errore nella registrazione'}`);
    } finally {
      setLoading(false);
    }
  };

  // Espone handleSubmit tramite ref se fornito
  React.useImperativeHandle(ref, () => ({
    submit: () => handleSubmit(null)
  }));

  const selectedAnimale = allAnimali.find(a => a.id === parseInt(formData.animale_id));

  return (
    <div className={isModal ? "" : "registra-alimentazione"}>
      {!isModal && <h3>Registra Alimentazione Singola</h3>}
      
      <form onSubmit={handleSubmit} className="alimentazione-form">
        <div className="form-grid">
          <div className="form-group span-12">
            <label>Animale (auricolare) *</label>
            <div className="animal-selector-wrapper">
              <button type="button" className="btn-secondary" onClick={() => setSelectorOpen(true)}>
                Selettore...
              </button>
              {selectedAnimals.length === 0 ? (
                <span className="no-animals-selected">
                  Nessun selezionato
                </span>
              ) : (
                <span
                  className="animals-selected-count"
                  onClick={()=>setShowDetailModal(true)}
                >
                  {selectedAnimals.length} selezionat{selectedAnimals.length > 1 ? 'i' : 'o'}
                </span>
              )}
            </div>
            {selectedAnimale && (
              <div className="helper-text">
                Animale selezionato: {selectedAnimale.auricolare}
              </div>
            )}
          </div>
        </div>

        <div className="form-grid">
          <div className="form-group span-6">
            <label>Data *</label>
            <input
              type="date"
              value={formData.data}
              onChange={(e) => setFormData({...formData, data: e.target.value})}
              required
            />
          </div>
          <div className="form-group span-6">
            <label>Quantità *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.quantita}
              onChange={(e) => setFormData({...formData, quantita: e.target.value})}
              required
              placeholder="Es. 5.5"
            />
          </div>
        </div>

        <div className="form-grid">
          <div className="form-group span-6">
            <label>Tipo Alimento *</label>
            <SmartSelect
              options={tipoAlimentoOptions}
              value={formData.tipo_alimento}
              onChange={(e) => {
                const value = e.target.value;
                setFormData({
                  ...formData,
                  tipo_alimento: value,
                  piano_id: '',
                  componente_id: '',
                  mangime_id: '',
                });
              }}
              displayField="label"
              valueField="value"
              placeholder="Seleziona tipologia"
            />
          </div>
        </div>

        {formData.tipo_alimento === 'piano' ? (
          piani.length > 0 && (
            <div className="form-group span-12">
              <label>Piano alimentare *</label>
              <SearchableSelect
                options={piani.map((piano) => ({ value: piano.id, label: piano.nome }))}
                value={formData.piano_id}
                onChange={(event) => {
                  setFormData({ ...formData, piano_id: event.target.value });
                }}
                placeholder="Seleziona piano..."
              />
            </div>
          )
        ) : (
          <div className="form-grid">
            <div className="form-group span-6">
              <label>Tipo alimento singolo</label>
              <SmartSelect
                options={singoloTipoOptions}
                value={formData.singolo_tipo}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData({
                    ...formData,
                    singolo_tipo: value,
                    componente_id: '',
                    mangime_id: '',
                  });
                }}
                displayField="label"
                valueField="value"
                placeholder="Seleziona tipologia"
              />
            </div>
            <div className="form-group span-6">
              {formData.singolo_tipo === 'componente' ? (
                componenti.length > 0 && (
                  <>
                    <label>Componente *</label>
                    <SearchableSelect
                      options={componenti.map((comp) => ({ value: comp.id, label: comp.nome }))}
                      value={formData.componente_id}
                      onChange={(event) => {
                        setFormData({ ...formData, componente_id: event.target.value });
                      }}
                      placeholder="Seleziona componente..."
                    />
                  </>
                )
              ) : (
                mangimi.length > 0 && (
                  <>
                    <label>Mangime *</label>
                    <SearchableSelect
                      options={mangimi.map((item) => ({ value: item.id, label: item.nome }))}
                      value={formData.mangime_id}
                      onChange={(event) => {
                        setFormData({ ...formData, mangime_id: event.target.value });
                      }}
                      placeholder="Seleziona mangime..."
                    />
                  </>
                )
              )}
            </div>
          </div>
        )}

        <div className="form-group span-12">
          <label>Note</label>
          <textarea
            value={formData.note}
            onChange={(e) => setFormData({...formData, note: e.target.value})}
            rows="3"
          />
        </div>

        {!isModal && (
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Registrazione...' : 'Registra Alimentazione'}
            </button>
          </div>
        )}
      </form>

      {/* Modale selettore animali - stessa struttura di RegistraSomministrazione */}
      <BaseModal
        isOpen={selectorOpen}
        onClose={() => { 
          setSelectorOpen(false); 
          setAnimali([]); 
          setAllAnimali([]);
          setAnimalSearch('');
          setDateFrom('');
          setDateTo('');
        }}
        title="Selettore Animali"
        size="large"
        footerActions={
          <>
            <span className="selected-count">{selectedAnimalIds.length} selezionati</span>
            <div className="footer-actions-group">
              <button className="btn btn-secondary" onClick={() => { 
                setSelectorOpen(false); 
                setAnimali([]); 
                setAllAnimali([]);
                setAnimalSearch('');
                setDateFrom('');
                setDateTo('');
              }}>Annulla</button>
              <button className="btn btn-primary" onClick={() => {
                if (selectedAnimalIds.length === 0) {
                  alert('Seleziona almeno un animale');
                  return;
                }
                if (selectedAnimalIds.length > 1) {
                  alert('Seleziona un solo animale per l\'alimentazione singola');
                  return;
                }
                const animaleId = selectedAnimalIds[0];
                setFormData({...formData, animale_id: animaleId.toString()});
                // Mantieni la selezione anche dopo la chiusura
                const animale = allAnimali.find(a => a.id === animaleId);
                if (animale) {
                  setSelectedAnimals([{id: animale.id, auricolare: animale.auricolare}]);
                }
                setSelectorOpen(false);
              }}>Seleziona</button>
            </div>
          </>
        }
      >
        <div className="form-grid">
          <div className="form-group span-6">
            <label>Ricerca Auricolare (filtro automatico)</label>
            <input
              type="text"
              value={animalSearch}
              onChange={(e) => setAnimalSearch(e.target.value)}
              placeholder="Digita per filtrare automaticamente (es: 1234 o ultime 4 cifre)..."
              autoFocus
            />
            {animalSearch && (
              <div className="helper-text">
                {animali.length} animale{animali.length !== 1 ? 'i' : ''} trovato{animali.length !== 1 ? 'i' : ''} su {allAnimali.length} totali
              </div>
            )}
          </div>
          <div className="form-group span-3">
            <label>Data arrivo da</label>
            <input 
              type="date" 
              value={dateFrom} 
              onChange={(e) => setDateFrom(e.target.value)} 
            />
          </div>
          <div className="form-group span-3">
            <label>Data arrivo a</label>
            <input 
              type="date" 
              value={dateTo} 
              onChange={(e) => setDateTo(e.target.value)} 
            />
          </div>
        </div>
        <div className="selector-actions">
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={() => { 
              setAnimalSearch(''); 
              setDateFrom(''); 
              setDateTo(''); 
            }}
          >
            Reset Filtri
          </button>
          {loadingAnimali && (
            <span className="loading-text">Caricamento animali...</span>
          )}
          {!loadingAnimali && allAnimali.length > 0 && (
            <span className="info-text">
              {allAnimali.length} animali disponibili
            </span>
          )}
        </div>
        {loadingAnimali ? (
          <div className="loading">Caricamento animali...</div>
        ) : (
          <>
            {animali.length === 0 && allAnimali.length > 0 ? (
              <div className="empty-state">
                <p>Nessun animale trovato con i filtri selezionati.</p>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => { 
                    setAnimalSearch(''); 
                    setDateFrom(''); 
                    setDateTo(''); 
                  }}
                >
                  Rimuovi filtri
                </button>
              </div>
            ) : (
              <>
                <div className="selected-animals-list">
                  {animali.map(a => (
                    <label key={a.id} className="selected-item checkbox-label">
                      <input
                        type="checkbox"
                        className="checkbox-large"
                        checked={selectedAnimalIds.includes(a.id)}
                        onChange={(e) => {
                          setSelectedAnimalIds(prev => e.target.checked ? [...prev, a.id] : prev.filter(id => id !== a.id));
                        }}
                      />
                      <span>{a.auricolare}</span>
                      {a.data_arrivo && (
                        <span className="animal-meta">
                          (Arrivo: {new Date(a.data_arrivo).toLocaleDateString('it-IT')})
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </BaseModal>

      <BaseModal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title={`${selectedAnimals.length} animale selezionato`}
        size="small"
        footerActions={
          <button className="btn btn-secondary" onClick={() => setShowDetailModal(false)}>Chiudi</button>
        }
      >
        <div className="selected-animals-detail-list">
          {selectedAnimals.map((a, idx) => (
            <div key={a.id} className="selected-animal-detail-item">
              <span className="animal-auricolare">{a.auricolare}</span>
              <button
                className="remove-animal-btn"
                onClick={() => {
                  setSelectedAnimalIds(ids => ids.filter(id => id !== a.id));
                  setSelectedAnimals(an => an.filter(x => x.id !== a.id));
                  setFormData({...formData, animale_id: ''});
                }}
                title="Rimuovi"
              >×</button>
            </div>
          ))}
        </div>
      </BaseModal>
    </div>
  );
});

export default RegistraAlimentazioneSingola;

