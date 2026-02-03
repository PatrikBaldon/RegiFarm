/**
 * RegistraSomministrazione - Form per registrare una somministrazione
 */
import React, { useState, useEffect } from 'react';
import { sanitarioService } from '../services/sanitarioService';
import { allevamentoService } from '../../allevamento/services/allevamentoService';
import { useAzienda } from '../../../context/AziendaContext';
import SearchableSelect from '../../../components/SearchableSelect';
import BaseModal from '../../../components/BaseModal';
import './RegistraSomministrazione.css';
import '../../alimentazione/components/Alimentazione.css';

const RegistraSomministrazione = React.forwardRef(({ isModal = false, onSuccess, onCancel }, ref) => {
  const { azienda } = useAzienda();
  const [farmaci, setFarmaci] = useState([]);
  const [giacenze, setGiacenze] = useState([]);
  const [animali, setAnimali] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    animale_id: '',
    farmaco_id: '',
    lotto_farmaco_id: '',
    quantita: '',
    data_ora: new Date().toISOString().slice(0, 16),
    operatore_nome: '',
    veterinario: '',
    note: '',
    periodo_sospensione: ''
  });
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [animalSearch, setAnimalSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [allAnimali, setAllAnimali] = useState([]); // Tutti gli animali caricati
  const [loadingAnimali, setLoadingAnimali] = useState(false);
  // Rendi selectedAnimalIds e selectedAnimals/auricolari persistenti e globali per la sessione modulo
  const [selectedAnimalIds, setSelectedAnimalIds] = useState([]); // array di ID
  const [selectedAnimals, setSelectedAnimals] = useState([]); // array di {id, auricolare}
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    loadFarmaci();
  }, []);

  useEffect(() => {
    if (azienda?.id) {
      loadGiacenze();
      loadAnimali();
    }
  }, [azienda?.id]);

  useEffect(() => {
    if (formData.farmaco_id && azienda?.id) {
      // Filtra giacenze per farmaco selezionato
      loadGiacenze();
    }
  }, [formData.farmaco_id, azienda?.id]);

  // Carica tutti gli animali quando si apre la modale
  useEffect(() => {
    if (selectorOpen && azienda?.id) {
      loadAllAnimali();
    } else if (!selectorOpen) {
      setAllAnimali([]);
      setAnimali([]);
      setAnimalSearch('');
      setDateFrom('');
      setDateTo('');
    }
  }, [selectorOpen, azienda?.id]);

  // Filtra automaticamente gli animali in base alla ricerca e ai filtri
  useEffect(() => {
    if (!allAnimali.length) {
      setAnimali([]);
      return;
    }

    let filtered = [...allAnimali];

    // Filtro per auricolare (ricerca automatica)
        if (animalSearch && animalSearch.trim()) {
      const searchLower = animalSearch.trim().toLowerCase();
      filtered = filtered.filter(a => 
        a.auricolare?.toLowerCase().includes(searchLower) ||
        a.auricolare?.slice(-4).toLowerCase().includes(searchLower)
      );
        }

    // Filtro per data arrivo
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
    // Mantieni solo animali che sono ancora disponibili nel globale
    const nuovi = animali.filter(a => selectedAnimalIds.includes(a.id))
      .map(a => ({id: a.id, auricolare: a.auricolare}));
    // Aggiungi anche quelli selezionati in passate ricerche e non più nella lista ora
    const prev = selectedAnimals.filter(a => selectedAnimalIds.includes(a.id) && !nuovi.some(n => n.id === a.id));
    setSelectedAnimals([...prev, ...nuovi]);
  }, [selectedAnimalIds, animali]);

  const loadFarmaci = async () => {
    try {
      const data = await sanitarioService.getFarmaci();
      setFarmaci(data || []);
    } catch (err) {

    }
  };

  const loadGiacenze = async () => {
    if (!azienda?.id) return;
    try {
      const data = await sanitarioService.getGiacenzeAzienda(azienda.id);
      // Filtra solo quelli con quantità > 0
      const disponibili = (data || []).filter(l => parseFloat(l.quantita_rimanente) > 0);
      // Se c'è un farmaco selezionato, filtra per quello
      if (formData.farmaco_id) {
        setGiacenze(disponibili.filter(l => l.farmaco_id === parseInt(formData.farmaco_id)));
      } else {
        setGiacenze(disponibili);
      }
    } catch (err) {

    }
  };

  const loadAnimali = async () => {
    if (!azienda?.id) return;
    try {
      const data = await allevamentoService.getAnimali({ azienda_id: azienda.id, stato: 'presente' });
      setAnimali(data || []);
    } catch (err) {

    }
  };

  const loadAllAnimali = async () => {
    if (!azienda?.id) return;
    setLoadingAnimali(true);
    try {
      const data = await allevamentoService.getAnimali({ azienda_id: azienda.id, stato: 'presente' });
      setAllAnimali(data || []);
      setAnimali(data || []);
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
    if (!formData.animale_id || !formData.farmaco_id || !formData.quantita) {
      alert('Compila tutti i campi obbligatori');
      return;
    }

    if (formData.lotto_farmaco_id) {
      const lotto = giacenze.find(l => l.id === parseInt(formData.lotto_farmaco_id));
      if (lotto && parseFloat(lotto.quantita_rimanente) < parseFloat(formData.quantita)) {
        alert('Quantità insufficiente nel lotto selezionato');
        return;
      }
    }

    setLoading(true);
    try {
      await sanitarioService.createSomministrazione({
        ...formData,
        animale_id: parseInt(formData.animale_id),
        farmaco_id: parseInt(formData.farmaco_id),
        lotto_farmaco_id: formData.lotto_farmaco_id ? parseInt(formData.lotto_farmaco_id) : null,
        quantita: parseFloat(formData.quantita),
        periodo_sospensione: formData.periodo_sospensione ? parseInt(formData.periodo_sospensione) : null,
        data_ora: formData.data_ora ? new Date(formData.data_ora).toISOString() : new Date().toISOString()
      });
      alert('Somministrazione registrata con successo!');
      setFormData({
        animale_id: '',
        farmaco_id: '',
        lotto_farmaco_id: '',
        quantita: '',
        data_ora: new Date().toISOString().slice(0, 16),
        operatore_nome: '',
        veterinario: '',
        note: '',
        periodo_sospensione: ''
      });
      loadGiacenze();
      loadAnimali();
      
      // Se è in modal mode, chiama onSuccess
      if (isModal && onSuccess) {
        onSuccess();
      }
    } catch (err) {

      alert(`Errore: ${err.message || 'Errore nella registrazione'}`);
    } finally {
      setLoading(false);
    }
  };

  const selectedFarmaco = farmaci.find(f => f.id === parseInt(formData.farmaco_id));
  const selectedLotto = giacenze.find(l => l.id === parseInt(formData.lotto_farmaco_id));

  // Espone handleSubmit tramite ref se fornito
  React.useImperativeHandle(ref, () => ({
    submit: () => handleSubmit(null)
  }));

  return (
    <div className={isModal ? "" : "registra-somministrazione"}>
      {!isModal && <h3>Registra Somministrazione</h3>}
      
      <form onSubmit={handleSubmit} className="somministrazione-form">
        <div className="form-grid">
          <div className="form-group span-12">
            <label>Animale (auricolare)</label>
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
          </div>
        </div>

        <div className="form-grid">
          <div className="form-group span-6">
            <label>Farmaco *</label>
            <SearchableSelect
              options={farmaci}
              value={formData.farmaco_id ? String(formData.farmaco_id) : ''}
              onChange={(e) => {
                setFormData({...formData, farmaco_id: e.target.value, lotto_farmaco_id: ''});
                loadGiacenze();
              }}
              placeholder="Cerca farmaco..."
              displayField="nome_commerciale"
              valueField="id"
              required
            />
          </div>
          {selectedFarmaco && (
            <div className="form-group span-6">
              <label>Unità di Misura</label>
              <input type="text" value={selectedFarmaco.unita_misura} readOnly className="readonly-input" />
            </div>
          )}
        </div>
        
        {giacenze.length > 0 && (
          <div className="form-group">
            <label>Lotto Farmaco (opzionale, se vuoto scala automaticamente dal primo disponibile)</label>
            <SearchableSelect
              options={giacenze
                .filter(l => l.farmaco_id === parseInt(formData.farmaco_id))
                .map(lotto => ({ 
                  ...lotto, 
                  displayName: `Lotto: ${lotto.lotto} - Qty: ${parseFloat(lotto.quantita_rimanente).toFixed(2)} ${selectedFarmaco?.unita_misura || ''}` 
                }))}
              value={formData.lotto_farmaco_id ? String(formData.lotto_farmaco_id) : ''}
              onChange={(e) => setFormData({...formData, lotto_farmaco_id: e.target.value})}
              placeholder="Seleziona lotto (opzionale)..."
              displayField="displayName"
              valueField="id"
            />
          </div>
        )}
        
        <div className="form-grid">
          <div className="form-group span-6">
            <label>Quantità Somministrata * {selectedFarmaco && `(${selectedFarmaco.unita_misura})`}</label>
            <div className="quantita-input-group">
              <input
                type="number"
                step="0.01"
                value={formData.quantita}
                onChange={(e) => setFormData({...formData, quantita: e.target.value})}
                required
                className="quantita-input"
                placeholder={selectedFarmaco ? `In ${selectedFarmaco.unita_misura}` : ''}
              />
              {selectedFarmaco && (
                <span className="quantita-unit">{selectedFarmaco.unita_misura}</span>
              )}
            </div>
          </div>
          <div className="form-group span-6">
            <label>Data e Ora *</label>
            <input
              type="datetime-local"
              value={formData.data_ora}
              onChange={(e) => setFormData({...formData, data_ora: e.target.value})}
              required
            />
          </div>
        </div>

        <div className="form-grid">
          <div className="form-group span-6">
            <label>Operatore</label>
            <input
              type="text"
              value={formData.operatore_nome}
              onChange={(e) => setFormData({...formData, operatore_nome: e.target.value})}
            />
          </div>
          <div className="form-group span-6">
            <label>Veterinario</label>
            <input
              type="text"
              value={formData.veterinario}
              onChange={(e) => setFormData({...formData, veterinario: e.target.value})}
            />
          </div>
        </div>
        <div className="form-grid">
          <div className="form-group span-6">
            <label>Periodo Sospensione (giorni)</label>
            <input
              type="number"
              value={formData.periodo_sospensione}
              onChange={(e) => setFormData({...formData, periodo_sospensione: e.target.value})}
              placeholder="Giorni di attesa prima macellazione"
            />
          </div>
        </div>
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
              {loading ? 'Registrazione...' : 'Registra Somministrazione'}
            </button>
          </div>
        )}
      </form>
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
                {animali.length > 0 && (
                  <button 
                    type="button" 
                    className="btn btn-primary select-all-btn" 
          onClick={() => {
            const tutti = animali.map(a => a.id);
            setSelectedAnimalIds(prev => Array.from(new Set([...prev, ...tutti])));
                    }}
                  >
                    Seleziona tutti i {animali.length} animali filtrati
                  </button>
                )}
              </>
            )}
          </>
        )}
      </BaseModal>
      <BaseModal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title={`${selectedAnimals.length} animali selezionati`}
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

export default RegistraSomministrazione;

