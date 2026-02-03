/**
 * AssociaPartiteModal - consente di associare intere partite a un contratto di soccida
 * e propaga automaticamente il contratto su tutti gli animali collegati alla partita.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { amministrazioneService } from '../services/amministrazioneService';
import { allevamentoService } from '../../allevamento/services/allevamentoService';
import { useCodiciStallaGestiti } from '../../../hooks/useCodiciStallaGestiti';
import SmartSelect from '../../../components/SmartSelect';
import BaseModal from '../../../components/BaseModal';
import './AssociaPartiteModal.css';

const PARTITE_FETCH_LIMIT = 1000;

const formatDate = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('it-IT');
  } catch {
    return value;
  }
};

const getTipoValue = (tipo) => {
  if (!tipo) return '—';
  if (typeof tipo === 'string') return tipo;
  if (typeof tipo === 'object' && tipo.value) return tipo.value;
  return String(tipo);
};

const AssociaPartiteModal = ({ contratto, aziendaId, onClose }) => {
  const [activeTab, setActiveTab] = useState('partite'); // 'partite' o 'animali'
  const [partite, setPartite] = useState([]);
  const [partiteAssociate, setPartiteAssociate] = useState([]);
  const [selectedPartite, setSelectedPartite] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [soloIngressi, setSoloIngressi] = useState(true);
  const [animali, setAnimali] = useState([]);
  const [animaliAssociati, setAnimaliAssociati] = useState([]);
  const [selectedAnimali, setSelectedAnimali] = useState([]);
  const [searchTermAnimali, setSearchTermAnimali] = useState('');
  const [filterStato, setFilterStato] = useState('presente');
  const [filterSesso, setFilterSesso] = useState('');
  const [filterRazza, setFilterRazza] = useState('');
  const [filterPesoMin, setFilterPesoMin] = useState('');
  const [filterPesoMax, setFilterPesoMax] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [pesoModalOpen, setPesoModalOpen] = useState(false);
  const [pesoModalData, setPesoModalData] = useState({ 
    tipo: 'medio', // 'medio' o 'totale'
    peso: '', 
    data_cambio: new Date().toISOString().split('T')[0],
    note: '' 
  });

  const { codiciStalla, isCodiceStallaGestito } = useCodiciStallaGestiti(aziendaId);

  const contrattoLabel = contratto?.numero_contratto || `#${contratto?.id ?? ''}`;

  const loadPartiteDisponibili = async () => {
    if (!aziendaId) return;
    try {
      setLoading(true);
      const filters = {
        azienda_id: aziendaId,
        limit: PARTITE_FETCH_LIMIT,
      };
      if (soloIngressi) {
        filters.tipo = 'ingresso';
      }
      const data = await amministrazioneService.getPartite(filters, { forceApi: true });
      setPartite(Array.isArray(data) ? data : []);
    } catch (error) {

      setErrorMessage(error.message || 'Errore nel caricamento delle partite');
    } finally {
      setLoading(false);
    }
  };

  const loadPartiteAssociate = async () => {
    if (!contratto?.id) return;
    try {
      const data = await amministrazioneService.getPartiteContratto(contratto.id);
      setPartiteAssociate(Array.isArray(data) ? data : []);
    } catch (error) {

      setErrorMessage(error.message || 'Errore nel caricamento delle partite associate');
    }
  };

  // Aggiorna automaticamente quando cambiano i parametri
  useEffect(() => {
    if (aziendaId) {
      loadPartiteDisponibili();
    }
  }, [aziendaId, soloIngressi]);

  useEffect(() => {
    if (contratto?.id) {
      loadPartiteAssociate();
      loadAnimaliAssociati();
    }
  }, [contratto?.id]);

  const loadAnimaliDisponibili = async () => {
    if (!aziendaId) return;
    try {
      setLoading(true);
      const filters = {
        azienda_id: aziendaId,
        limit: 1000,
      };
      // Se il contratto è chiuso, non filtrare per stato (mostra tutti per permettere selezione di animali usciti)
      // Altrimenti mostra solo animali presenti (default)
      if (contratto?.attivo !== false) {
        filters.stato = filterStato || 'presente';
      }
      // Se contratto chiuso, non aggiungere filtro stato per permettere di vedere animali usciti
      const data = await allevamentoService.getAnimali(filters);
      setAnimali(Array.isArray(data) ? data : []);
    } catch (error) {

      setErrorMessage(error.message || 'Errore nel caricamento degli animali');
    } finally {
      setLoading(false);
    }
  };

  const loadAnimaliAssociati = async () => {
    if (!contratto?.id) return;
    try {
      const data = await amministrazioneService.getAnimaliContratto(contratto.id);
      setAnimaliAssociati(Array.isArray(data) ? data : []);
    } catch (error) {

      setErrorMessage(error.message || 'Errore nel caricamento degli animali associati');
    }
  };

  useEffect(() => {
    if (activeTab === 'animali' && aziendaId) {
      loadAnimaliDisponibili();
    }
  }, [activeTab, aziendaId, filterStato, contratto?.attivo]);

  const partiteAssociateIds = useMemo(
    () => new Set(partiteAssociate.map((p) => p.id)),
    [partiteAssociate]
  );

  const animaliAssociatiIds = useMemo(
    () => new Set(animaliAssociati.map((a) => a.id)),
    [animaliAssociati]
  );

  // Genera opzioni per i filtri basate sugli animali caricati
  const statoOptions = useMemo(() => {
    const statiSet = new Set(animali.map(a => a.stato).filter(Boolean));
    return [
      { value: '', label: 'Tutti' },
      ...Array.from(statiSet).sort().map((stato) => ({ value: stato, label: stato })),
    ];
  }, [animali]);

  const sessoOptions = useMemo(() => {
    const values = new Set();
    animali.forEach((a) => {
      if (a.sesso) values.add(a.sesso);
    });
    return [
      { value: '', label: 'Tutti' },
      ...Array.from(values).map((sesso) => ({ value: sesso, label: sesso })),
    ];
  }, [animali]);

  const razzaOptions = useMemo(() => {
    const values = new Set();
    animali.forEach((a) => {
      if (a.razza) values.add(a.razza);
    });
    return [
      { value: '', label: 'Tutte' },
      ...Array.from(values).map((razza) => ({ value: razza, label: razza })),
    ];
  }, [animali]);

  const animaliDisponibili = useMemo(() => {
    let filtered = animali.filter((animale) => {
      // Escludi solo quelli già associati al contratto corrente
      if (animaliAssociatiIds.has(animale.id)) {
        return false; // già associato al contratto corrente
      }
      return true;
    });

    // Filtro per ricerca testuale
    if (searchTermAnimali) {
      const term = searchTermAnimali.toLowerCase();
      filtered = filtered.filter((animale) =>
        animale.auricolare?.toLowerCase().includes(term) ||
        animale.razza?.toLowerCase().includes(term) ||
        animale.specie?.toLowerCase().includes(term)
      );
    }

    // Filtro per stato (se non è un contratto chiuso)
    if (contratto?.attivo !== false && filterStato) {
      filtered = filtered.filter((animale) => animale.stato === filterStato);
    }

    // Filtro per sesso
    if (filterSesso) {
      filtered = filtered.filter((animale) => animale.sesso === filterSesso);
    }

    // Filtro per razza
    if (filterRazza) {
      filtered = filtered.filter((animale) => animale.razza === filterRazza);
    }

    // Filtro per peso minimo
    if (filterPesoMin) {
      const min = parseFloat(filterPesoMin.replace(',', '.'));
      if (!Number.isNaN(min)) {
        filtered = filtered.filter((animale) => {
          const peso = parseFloat(animale.peso_attuale || animale.peso_arrivo || 0);
          return peso >= min;
        });
      }
    }

    // Filtro per peso massimo
    if (filterPesoMax) {
      const max = parseFloat(filterPesoMax.replace(',', '.'));
      if (!Number.isNaN(max)) {
        filtered = filtered.filter((animale) => {
          const peso = parseFloat(animale.peso_attuale || animale.peso_arrivo || 0);
          return peso <= max;
        });
      }
    }

    return filtered;
  }, [animali, animaliAssociatiIds, contratto?.id, contratto?.attivo, searchTermAnimali, filterStato, filterSesso, filterRazza, filterPesoMin, filterPesoMax]);

  const handleToggleAnimale = (animaleId) => {
    setSelectedAnimali((prev) =>
      prev.includes(animaleId) ? prev.filter((id) => id !== animaleId) : [...prev, animaleId]
    );
  };

  const handleToggleSelectAllAnimali = () => {
    if (selectedAnimali.length === animaliDisponibili.length) {
      setSelectedAnimali([]);
    } else {
      setSelectedAnimali(animaliDisponibili.map((a) => a.id));
    }
  };

  const handleAssociaAnimali = async () => {
    if (!selectedAnimali.length) {
      setErrorMessage('Seleziona almeno un animale da associare');
      return;
    }
    if (!contratto?.id) {
      setErrorMessage('Contratto non valido');
      return;
    }
    // Apri il modal per il peso se ci sono animali selezionati
    setPesoModalOpen(true);
  };

  const handleConfirmPesoModal = async () => {
    if (!selectedAnimali.length || !contratto?.id) {
      setPesoModalOpen(false);
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);
      
      const options = {};
      if (pesoModalData.peso.trim()) {
        const peso = parseFloat(pesoModalData.peso);
        if (pesoModalData.tipo === 'totale') {
          options.peso_totale = peso;
        } else {
          options.peso_medio = peso;
        }
      }
      if (pesoModalData.data_cambio) {
        options.data_cambio = pesoModalData.data_cambio;
      }
      if (pesoModalData.note.trim()) {
        options.note = pesoModalData.note.trim();
      }

      const response = await amministrazioneService.associaAnimaliContratto(
        contratto.id,
        selectedAnimali,
        options
      );
      
      if (response?.message) {
        alert(response.message);
      }
      
      setPesoModalOpen(false);
      setPesoModalData({ 
        tipo: 'medio', 
        peso: '', 
        data_cambio: new Date().toISOString().split('T')[0],
        note: '' 
      });
      setSelectedAnimali([]);
      await Promise.all([loadAnimaliDisponibili(), loadAnimaliAssociati()]);
    } catch (error) {

      setErrorMessage(error.message || 'Errore nell\'associazione degli animali');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelPesoModal = () => {
    setPesoModalOpen(false);
  };

  const handleDisassociaAnimale = async (animaleId) => {
    if (!contratto?.id) return;
    if (!window.confirm('Rimuovere l\'animale dal contratto?')) {
      return;
    }
    try {
      setLoading(true);
      setErrorMessage(null);
      await amministrazioneService.disassociaAnimaleContratto(contratto.id, animaleId);
      await Promise.all([loadAnimaliDisponibili(), loadAnimaliAssociati()]);
    } catch (error) {

      setErrorMessage(error.message || 'Errore nella disassociazione dell\'animale');
    } finally {
      setLoading(false);
    }
  };

  const partiteDisponibili = useMemo(() => {
    const filtered = partite.filter((partita) => {
      if (partiteAssociateIds.has(partita.id)) {
        return false; // già legata al contratto corrente
      }
      if (partita.contratto_soccida_id && partita.contratto_soccida_id !== contratto?.id) {
        return false; // legata a un altro contratto
      }
      // Escludi partite provenienti da allevamenti gestiti (trasferimenti interni)
      // Controlla il codice_stalla (provenienza esterna), non codice_stalla_azienda
      // Per ingressi esterni: codice_stalla = provenienza NON gestita, codice_stalla_azienda = destinazione gestita
      // Per trasferimenti interni: codice_stalla = provenienza gestita
      if (partita.codice_stalla && isCodiceStallaGestito(partita.codice_stalla)) {
        return false; // partita proveniente da allevamento gestito (trasferimento interno)
      }
      // Filtro per tipo: se soloIngressi è true, mostra solo ingressi
      // Se una partita non ha tipo, la includiamo comunque (potrebbe essere appena creata)
      if (soloIngressi) {
        const tipoPartita = getTipoValue(partita.tipo);
        if (tipoPartita && tipoPartita !== 'ingresso') {
          return false;
        }
        // Se tipoPartita è null/undefined/empty, includiamo la partita (potrebbe essere appena creata)
      }
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        partita.numero_partita?.toLowerCase().includes(term) ||
        partita.codice_stalla?.toLowerCase().includes(term) ||
        getTipoValue(partita.tipo)?.toLowerCase().includes(term)
      );
    });
    
    // Debug: log per vedere quante partite vengono filtrate
    if (process.env.NODE_ENV === 'development') {



      if (partite.length > 0 && filtered.length === 0) {
      }
    }
    
    return filtered;
  }, [partite, partiteAssociateIds, contratto?.id, searchTerm, soloIngressi, isCodiceStallaGestito]);

  const handleTogglePartita = (partitaId) => {
    setSelectedPartite((prev) =>
      prev.includes(partitaId) ? prev.filter((id) => id !== partitaId) : [...prev, partitaId]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedPartite.length === partiteDisponibili.length) {
      setSelectedPartite([]);
    } else {
      setSelectedPartite(partiteDisponibili.map((p) => p.id));
    }
  };

  const selectedSummary = useMemo(() => {
    const map = new Map(partiteDisponibili.map((p) => [p.id, p]));
    const totalCapi = selectedPartite.reduce((acc, id) => {
      const partita = map.get(id);
      return acc + (partita?.numero_capi || 0);
    }, 0);
    return { numeroPartite: selectedPartite.length, capi: totalCapi };
  }, [selectedPartite, partiteDisponibili]);

  const handleAssocia = async () => {
    if (!selectedPartite.length) {
      setErrorMessage('Seleziona almeno una partita da associare');
      return;
    }
    if (!contratto?.id) {
      setErrorMessage('Contratto non valido');
      return;
    }
    try {
      setLoading(true);
      setErrorMessage(null);
      const response = await amministrazioneService.associaPartiteContratto(
        contratto.id,
        selectedPartite
      );
      if (response?.message) {
        alert(response.message);
      }
      setSelectedPartite([]);
      await Promise.all([loadPartiteDisponibili(), loadPartiteAssociate()]);
    } catch (error) {

      setErrorMessage(error.message || 'Errore nell\'associazione delle partite');
    } finally {
      setLoading(false);
    }
  };

  const handleDisassocia = async (partitaId) => {
    if (!contratto?.id) return;
    if (!window.confirm('Rimuovere la partita dal contratto? Gli animali collegati verranno aggiornati.')) {
      return;
    }
    try {
      setLoading(true);
      setErrorMessage(null);
      await amministrazioneService.disassociaPartitaContratto(contratto.id, partitaId);
      await Promise.all([loadPartiteDisponibili(), loadPartiteAssociate()]);
    } catch (error) {

      setErrorMessage(error.message || 'Errore nella disassociazione della partita');
    } finally {
      setLoading(false);
    }
  };

  const footerActions = (
    <>
      <button className="btn btn-secondary" onClick={onClose} disabled={loading}>
        Chiudi
      </button>
      {activeTab === 'partite' && (
        <button
          className="btn btn-primary"
          onClick={handleAssocia}
          disabled={loading || selectedPartite.length === 0}
        >
          {loading ? 'Associazione...' : 'Associa partite selezionate'}
        </button>
      )}
      {activeTab === 'animali' && (
        <button
          className="btn btn-primary"
          onClick={handleAssociaAnimali}
          disabled={loading || selectedAnimali.length === 0}
        >
          {loading ? 'Associazione...' : 'Associa animali selezionati'}
        </button>
      )}
    </>
  );

  return (
    <>
      <BaseModal
        isOpen={true}
        onClose={onClose}
        size="xlarge"
        footerActions={footerActions}
        className="associa-partite-modal"
        tabs={
          <div className="base-modal-tabs">
            <button
              type="button"
              className={`tab ${activeTab === 'partite' ? 'active' : ''}`}
              onClick={() => setActiveTab('partite')}
            >
              Partite
            </button>
            <button
              type="button"
              className={`tab ${activeTab === 'animali' ? 'active' : ''}`}
              onClick={() => setActiveTab('animali')}
            >
              Animali
            </button>
          </div>
        }
      >

          {activeTab === 'partite' && (
            <>
          <div className="partite-actions">
            <div className="search-bar">
              <input
                type="text"
                placeholder="Cerca per numero partita, codice stalla o tipo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="toggle-button-group">
              <label>Mostra solo partite di ingresso</label>
              <button
                type="button"
                className={`toggle-button ${soloIngressi ? 'active' : ''}`}
                onClick={() => setSoloIngressi(!soloIngressi)}
                aria-label={soloIngressi ? 'Filtro attivo' : 'Filtro disattivo'}
              />
            </div>
          </div>

          {errorMessage && <div className="alert alert-error">{errorMessage}</div>}

          <div className="partite-columns">
            <div className="partite-list available">
              <div className="list-header">
                <h3>Partite disponibili ({partiteDisponibili.length})</h3>
                <button
                  className="btn-link"
                  onClick={handleToggleSelectAll}
                  disabled={partiteDisponibili.length === 0 || loading}
                >
                  {selectedPartite.length === partiteDisponibili.length
                    ? 'Deseleziona tutte'
                    : 'Seleziona tutte'}
                </button>
              </div>

              {loading ? (
                <div className="loading">Caricamento...</div>
              ) : (
                <div className="list-body">
                  {partiteDisponibili.length === 0 ? (
                    <div className="empty-state">Nessuna partita disponibile</div>
                  ) : (
                    partiteDisponibili.map((partita) => {
                      const isSelected = selectedPartite.includes(partita.id);
                      return (
                    <div
                      key={partita.id}
                      className={`partita-item available ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleTogglePartita(partita.id)}
                    >
                          <div className="partita-checkbox">
                            <button
                              type="button"
                              className={`toggle-button ${isSelected ? 'active' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTogglePartita(partita.id);
                              }}
                              aria-label={isSelected ? 'Selezionato' : 'Non selezionato'}
                            />
                          </div>
                          <div className="partita-details">
                            <div className="numero">
                              {partita.numero_partita || `Partita #${partita.id}`}
                            </div>
                            <div className="meta">
                              <span>{getTipoValue(partita.tipo)}</span>
                              <span>· {formatDate(partita.data)}</span>
                              {partita.codice_stalla && (
                                <span>· {partita.codice_stalla}</span>
                              )}
                            </div>
                          </div>
                          <div className="partita-capi">
                            {partita.numero_capi ?? 0} capi
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {selectedPartite.length > 0 && (
                <div className="selection-summary">
                  <strong>{selectedSummary.numeroPartite}</strong> partite selezionate (
                  <strong>{selectedSummary.capi}</strong> capi totali)
                </div>
              )}
            </div>

            <div className="partite-list associated">
              <div className="list-header">
                <h3>Partite già associate ({partiteAssociate.length})</h3>
              </div>
              <div className="list-body">
                {partiteAssociate.length === 0 ? (
                  <div className="empty-state">Nessuna partita associata</div>
                ) : (
                  partiteAssociate.map((partita) => (
                    <div key={partita.id} className="partita-item associated">
                      <div className="partita-details">
                        <div className="numero">
                          {partita.numero_partita || `Partita #${partita.id}`}
                        </div>
                        <div className="meta">
                          <span>{getTipoValue(partita.tipo)}</span>
                          <span>· {formatDate(partita.data)}</span>
                          {partita.codice_stalla && <span>· {partita.codice_stalla}</span>}
                        </div>
                      </div>
                      <div className="partita-capi">{partita.numero_capi ?? 0} capi</div>
                      <button
                        className="btn-icon danger"
                        title="Rimuovi dal contratto"
                        onClick={() => handleDisassocia(partita.id)}
                        disabled={loading}
                      >
                        🗑️
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
            </>
          )}

          {activeTab === 'animali' && (
            <>
              <div className="partite-actions" style={{ marginBottom: '12px' }}>
                <div className="search-bar" style={{ flex: 1, maxWidth: '300px' }}>
                  <input
                    type="text"
                    placeholder="Cerca auricolare, razza, specie..."
                    value={searchTermAnimali}
                    onChange={(e) => setSearchTermAnimali(e.target.value)}
                  />
                </div>
              </div>

              {/* Filtri sempre visibili in modo compatto */}
              <div className="filters-compact">
                {contratto?.attivo !== false && (
                  <div className="filter-group">
                    <span className="filter-label">Stato:</span>
                    <SmartSelect
                      className="select-compact filter-select-compact"
                      options={statoOptions}
                      value={filterStato}
                      onChange={(e) => setFilterStato(e.target.value)}
                      displayField="label"
                      valueField="value"
                      placeholder="Tutti"
                      allowEmpty={false}
                    />
                  </div>
                )}
                <div className="filter-group">
                  <span className="filter-label">Sesso:</span>
                  <SmartSelect
                    className="select-compact filter-select-compact"
                    options={sessoOptions}
                    value={filterSesso}
                    onChange={(e) => setFilterSesso(e.target.value)}
                    displayField="label"
                    valueField="value"
                    placeholder="Tutti"
                    allowEmpty={false}
                  />
                </div>
                <div className="filter-group">
                  <span className="filter-label">Razza:</span>
                  <SmartSelect
                    className="select-compact filter-select-compact"
                    options={razzaOptions}
                    value={filterRazza}
                    onChange={(e) => setFilterRazza(e.target.value)}
                    displayField="label"
                    valueField="value"
                    placeholder="Tutte"
                    allowEmpty={false}
                  />
                </div>
                <div className="filter-group">
                  <span className="filter-label">Peso:</span>
                  <input
                    type="number"
                    step="0.1"
                    value={filterPesoMin}
                    onChange={(e) => setFilterPesoMin(e.target.value)}
                    placeholder="Min"
                    className="filter-input-compact"
                  />
                  <span className="filter-separator">-</span>
                  <input
                    type="number"
                    step="0.1"
                    value={filterPesoMax}
                    onChange={(e) => setFilterPesoMax(e.target.value)}
                    placeholder="Max"
                    className="filter-input-compact"
                  />
                </div>
                {(filterStato !== 'presente' || filterSesso || filterRazza || filterPesoMin || filterPesoMax || searchTermAnimali) && (
                  <button
                    type="button"
                    className="btn-link filter-reset"
                    onClick={() => {
                      setFilterStato('presente');
                      setFilterSesso('');
                      setFilterRazza('');
                      setFilterPesoMin('');
                      setFilterPesoMax('');
                      setSearchTermAnimali('');
                    }}
                    title="Reset filtri"
                  >
                    ✕ Reset
                  </button>
                )}
              </div>

              {errorMessage && <div className="alert alert-error">{errorMessage}</div>}

              <div className="partite-columns">
                <div className="partite-list available">
                  <div className="list-header">
                    <h3>Animali disponibili ({animaliDisponibili.length})</h3>
                    <button
                      className="btn-link"
                      onClick={handleToggleSelectAllAnimali}
                      disabled={animaliDisponibili.length === 0 || loading}
                    >
                      {selectedAnimali.length === animaliDisponibili.length
                        ? 'Deseleziona tutti'
                        : 'Seleziona tutti'}
                    </button>
                  </div>

                  {loading ? (
                    <div className="loading">Caricamento...</div>
                  ) : (
                    <div className="list-body">
                      {animaliDisponibili.length === 0 ? (
                        <div className="empty-state">Nessun animale disponibile</div>
                      ) : (
                        animaliDisponibili.map((animale) => {
                          const isSelected = selectedAnimali.includes(animale.id);
                          return (
                            <div
                              key={animale.id}
                              className={`partita-item available ${isSelected ? 'selected' : ''}`}
                              onClick={() => handleToggleAnimale(animale.id)}
                            >
                              <div className="partita-checkbox">
                                <button
                                  type="button"
                                  className={`toggle-button ${isSelected ? 'active' : ''}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleAnimale(animale.id);
                                  }}
                                  aria-label={isSelected ? 'Selezionato' : 'Non selezionato'}
                                />
                              </div>
                              <div className="partita-details">
                                <div className="numero">
                                  {animale.auricolare || `Animale #${animale.id}`}
                                  {animale.contratto_soccida_id && animale.contratto_soccida_id !== contratto?.id && (
                                    <span className="warning-text">
                                      (altro contratto)
                                    </span>
                                  )}
                                </div>
                                <div className="meta">
                                  <span>{animale.razza || '—'}</span>
                                  <span>· {animale.specie || '—'}</span>
                                  {animale.peso_attuale && (
                                    <span>· {animale.peso_attuale} kg</span>
                                  )}
                                  {animale.tipo_allevamento && (
                                    <span>· {animale.tipo_allevamento}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {selectedAnimali.length > 0 && (
                    <div className="selection-summary">
                      <strong>{selectedAnimali.length}</strong> animali selezionati
                    </div>
                  )}
                </div>

                <div className="partite-list associated">
                  <div className="list-header">
                    <h3>Animali già associati ({animaliAssociati.length})</h3>
                  </div>
                  <div className="list-body">
                    {animaliAssociati.length === 0 ? (
                      <div className="empty-state">Nessun animale associato</div>
                    ) : (
                      animaliAssociati.map((animale) => (
                        <div key={animale.id} className="partita-item associated">
                          <div className="partita-details">
                            <div className="numero">
                              {animale.auricolare || `Animale #${animale.id}`}
                            </div>
                            <div className="meta">
                              <span>{animale.razza || '—'}</span>
                              <span>· {animale.specie || '—'}</span>
                              {animale.peso_attuale && (
                                <span>· {animale.peso_attuale} kg</span>
                              )}
                            </div>
                          </div>
                          <button
                            className="btn-icon danger"
                            title="Rimuovi dal contratto"
                            onClick={() => handleDisassociaAnimale(animale.id)}
                            disabled={loading}
                          >
                            🗑️
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
    </BaseModal>

      {/* Modal per richiedere peso quando si associano animali multipli */}
      {pesoModalOpen && (
        <BaseModal
          isOpen={pesoModalOpen}
          onClose={handleCancelPesoModal}
          title="Associazione Animali - Peso di Riferimento"
          size="medium"
          footerActions={
            <>
            <button
                className="btn btn-secondary"
                onClick={handleCancelPesoModal}
                disabled={loading}
            >
                Annulla
            </button>
            <button
                className="btn btn-primary"
                onClick={handleConfirmPesoModal}
                disabled={loading || !pesoModalData.peso.trim()}
            >
                {loading ? 'Associazione...' : 'Conferma Associazione'}
            </button>
            </>
          }
        >
            <p className="info-text">
              Inserisci il peso di riferimento per {selectedAnimali.length} animale{selectedAnimali.length > 1 ? 'i' : ''}. 
              Questo peso verrà registrato nel log degli eventi per ogni animale.
            </p>
            
            <div className="form-group">
              <label>Tipo di peso</label>
              <SmartSelect
                className="select-compact"
                options={[
                  { value: 'medio', label: 'Peso medio (stesso peso per tutti gli animali)' },
                  { value: 'totale', label: 'Peso totale (da dividere tra tutti gli animali)' }
                ]}
                value={pesoModalData.tipo}
                onChange={(e) => setPesoModalData({ ...pesoModalData, tipo: e.target.value })}
                displayField="label"
                valueField="value"
              />
            </div>

            <div className="form-group">
              <label>
                {pesoModalData.tipo === 'totale' ? 'Peso totale (kg)' : 'Peso medio (kg)'} *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={pesoModalData.peso}
                onChange={(e) => setPesoModalData({ ...pesoModalData, peso: e.target.value })}
                placeholder={pesoModalData.tipo === 'totale' ? 'Es: 3500.00' : 'Es: 350.50'}
                autoFocus
              />
              {pesoModalData.tipo === 'totale' && pesoModalData.peso && selectedAnimali.length > 0 && (
                <p className="helper-text">
                  Peso per capo: {(parseFloat(pesoModalData.peso) / selectedAnimali.length).toFixed(2)} kg
                </p>
              )}
            </div>

            <div className="form-group">
              <label>Data cambio</label>
              <input
                type="date"
                value={pesoModalData.data_cambio}
                onChange={(e) => setPesoModalData({ ...pesoModalData, data_cambio: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Note (opzionale)</label>
              <textarea
                value={pesoModalData.note}
                onChange={(e) => setPesoModalData({ ...pesoModalData, note: e.target.value })}
                rows="3"
                placeholder="Note aggiuntive per il log..."
              />
            </div>
        </BaseModal>
      )}
    </>
  );
};

export default AssociaPartiteModal;


