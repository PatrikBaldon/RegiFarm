/**
 * StallMap - Piano Stalla
 * Gestione spostamento animali con ricerca separata per animali e box
 */
import React, { useState, useEffect, useMemo } from 'react';
import SearchableSelect from '../../../components/SearchableSelect';
import { allevamentoService } from '../services/allevamentoService';
import { useAzienda } from '../../../context/AziendaContext';
import './StallMap.css';

const StallMap = () => {
  // ============ STATO SELEZIONE COMUNE ============
  const { azienda, loading: aziendaLoading } = useAzienda();
  const aziendaId = azienda?.id;
  const [selectedSede, setSelectedSede] = useState('');
  const [sedi, setSedi] = useState([]);

  // ============ STATO RICERCA ANIMALI ============
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSesso, setFilterSesso] = useState('');
  const [filterDataArrivo, setFilterDataArrivo] = useState('');
  const [filterRazza, setFilterRazza] = useState('');
  const [soloPresenti, setSoloPresenti] = useState(true); // Filtro solo animali presenti
  const [animaliRisultati, setAnimaliRisultati] = useState([]);
  const [animaliSelezionati, setAnimaliSelezionati] = useState([]); // Array di {id, auricolare}
  const [loadingAnimali, setLoadingAnimali] = useState(false);
  const [razzeDisponibili, setRazzeDisponibili] = useState([]);

  // ============ STATO RICERCA BOX ============
  const [filterStabilimento, setFilterStabilimento] = useState('');
  const [filterBox, setFilterBox] = useState('');
  const [stabilimenti, setStabilimenti] = useState([]);
  const [boxRisultati, setBoxRisultati] = useState([]);
  const [selectedStabilimento, setSelectedStabilimento] = useState(''); // ID stabilimento per spostamento (string)
  const [selectedBox, setSelectedBox] = useState(''); // ID box per spostamento (string)
  const [boxOccupazioni, setBoxOccupazioni] = useState({}); // {boxId: occupazione}
  const [loadingBox, setLoadingBox] = useState(false);

  // ============ STATO GENERALE ============
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const sedeSelectOptions = useMemo(
    () => [
      { value: '', label: 'Seleziona sede...' },
      ...sedi.map((s) => ({ value: String(s.id), label: `${s.nome} (${s.codice_stalla})` })),
    ],
    [sedi],
  );

  const stabilimentoSelectOptions = useMemo(
    () => [
      { value: '', label: 'Seleziona stabilimento...' },
      ...stabilimenti.map((s) => ({ value: String(s.id), label: s.nome })),
    ],
    [stabilimenti],
  );

  const sessoSelectOptions = useMemo(
    () => [
      { value: '', label: 'Tutti' },
      { value: 'M', label: 'Maschio' },
      { value: 'F', label: 'Femmina' },
    ],
    [],
  );

  const razzaSelectOptions = useMemo(
    () => [
      { value: '', label: 'Tutte' },
      ...razzeDisponibili.map((razza) => ({ value: razza, label: razza })),
    ],
    [razzeDisponibili],
  );

  const boxSelectOptions = useMemo(
    () => [
      { value: '', label: 'Usa stabilimento (distribuzione automatica)' },
      ...boxRisultati.map((b) => ({
        value: String(b.id),
        label: `${b.nome} - ${boxOccupazioni[b.id] || 0}/${b.capacita}`,
      })),
    ],
    [boxRisultati, boxOccupazioni],
  );

  // Carica sedi quando cambia azienda
  useEffect(() => {
    if (aziendaId) {
      loadSedi(aziendaId);
    } else {
      setSedi([]);
      setSelectedSede('');
    }
  }, [aziendaId]);

  // Carica stabilimenti quando cambia sede
  useEffect(() => {
    if (selectedSede) {
      loadStabilimenti();
      loadRazze();
    } else {
      setStabilimenti([]);
      setBoxRisultati([]);
      setFilterStabilimento('');
      setFilterBox('');
      setSelectedStabilimento('');
      setSelectedBox('');
    }
  }, [selectedSede]);

  // Carica box quando cambia stabilimento
  useEffect(() => {
    if (filterStabilimento) {
      loadBoxes();
    } else {
      setBoxRisultati([]);
      setFilterBox('');
      setSelectedBox('');
    }
  }, [filterStabilimento, selectedSede]);

  const loadSedi = async (aziendaId) => {
    try {
      const data = await allevamentoService.getSedi(aziendaId);
      setSedi(data || []);
    } catch (err) {

      setSedi([]);
    }
  };

  const loadStabilimenti = async () => {
    if (!selectedSede) return;
    try {
      const data = await allevamentoService.getStabilimenti(parseInt(selectedSede));
      setStabilimenti(data || []);
    } catch (err) {

      setStabilimenti([]);
    }
  };

  const loadRazze = async () => {
    if (!selectedSede) return;
    try {
      // Carica animali della sede per estrarre le razze uniche
      const sede = sedi.find(s => s.id === parseInt(selectedSede));
      if (!sede) return;
      
      const filters = { 
        stato: 'presente',
        codice_azienda_anagrafe: sede.codice_stalla
      };
      const animali = await allevamentoService.getAnimali(filters);
      const razze = [...new Set(animali.map(a => a.razza).filter(r => r))].sort();
      setRazzeDisponibili(razze);
    } catch (err) {

      setRazzeDisponibili([]);
    }
  };

  // Mantieni selezione animali anche se cambiano i filtri
  useEffect(() => {
    // Non rimuovere animali selezionati quando cambiano i risultati
    // La selezione rimane finché non viene rimossa manualmente
  }, [animaliRisultati]);

  const loadBoxes = async () => {
    if (!filterStabilimento) return;
    try {
      setLoadingBox(true);
      const data = await allevamentoService.getBox(parseInt(filterStabilimento));
      setBoxRisultati(data || []);
      
      // Carica occupazioni per tutti i box
      if (data && data.length > 0) {
        const occupazioni = {};
        for (const box of data) {
          try {
            const animali = await allevamentoService.getAnimali({ box_id: box.id, stato: 'presente' });
            occupazioni[box.id] = animali.length;
          } catch (err) {
            occupazioni[box.id] = 0;
          }
        }
        setBoxOccupazioni(occupazioni);
      }
    } catch (err) {

      setBoxRisultati([]);
    } finally {
      setLoadingBox(false);
    }
  };

  // Carica occupazione per un box specifico
  const loadBoxOccupazione = async (boxId) => {
    try {
      const animali = await allevamentoService.getAnimali({ box_id: boxId, stato: 'presente' });
      setBoxOccupazioni(prev => ({ ...prev, [boxId]: animali.length }));
    } catch (err) {

    }
  };

  // Ricerca animali
  const handleSearchAnimali = async () => {
    if (!selectedSede) {
      alert('Seleziona prima una sede');
      return;
    }

    setLoadingAnimali(true);
    setError(null);
    try {
      const sede = sedi.find(s => s.id === parseInt(selectedSede));
      if (!sede) {
        setAnimaliRisultati([]);
        return;
      }

      const filters = {
        codice_azienda_anagrafe: sede.codice_stalla
      };
      
      // Filtro per stato presente (se abilitato)
      if (soloPresenti) {
        filters.stato = 'presente';
      }
      
      // Carica animali della sede
      let allAnimali = await allevamentoService.getAnimali(filters);
      
      // Se filtro solo presenti è attivo, filtra anche animali arrivati, non usciti, e non trasferiti
      if (soloPresenti) {
        allAnimali = allAnimali.filter(a => 
          a.stato === 'presente' && 
          !a.data_uscita
        );
      }
      
      // Filtro per auricolare
      if (searchTerm) {
        const searchTermTrimmed = searchTerm.trim();
        if (searchTermTrimmed.length >= 4) {
          const last4 = searchTermTrimmed.slice(-4);
          allAnimali = allAnimali.filter(a => 
            a.auricolare && a.auricolare.slice(-4) === last4
          );
        } else if (searchTermTrimmed.length > 0) {
          allAnimali = allAnimali.filter(a => 
            a.auricolare && a.auricolare.includes(searchTermTrimmed)
          );
        }
      }
      
      // Filtro per sesso
      if (filterSesso) {
        allAnimali = allAnimali.filter(a => a.sesso === filterSesso);
      }
      
      // Filtro per data arrivo
      if (filterDataArrivo) {
        const dataArrivo = new Date(filterDataArrivo);
        allAnimali = allAnimali.filter(a => {
          if (!a.data_arrivo) return false;
          const dataAnimale = new Date(a.data_arrivo);
          return dataAnimale.toDateString() === dataArrivo.toDateString();
        });
      }
      
      // Filtro per razza
      if (filterRazza) {
        allAnimali = allAnimali.filter(a => a.razza === filterRazza);
      }
      
      setAnimaliRisultati(allAnimali);
    } catch (err) {

      setError(err.message || 'Errore nella ricerca animali');
      setAnimaliRisultati([]);
    } finally {
      setLoadingAnimali(false);
    }
  };

  const addAnimaleSelezionato = (animale) => {
    if (!animaliSelezionati.some(a => a.id === animale.id)) {
      setAnimaliSelezionati([...animaliSelezionati, { id: animale.id, auricolare: animale.auricolare }]);
    }
  };

  const removeAnimaleSelezionato = (animaleId) => {
    setAnimaliSelezionati(animaliSelezionati.filter(a => a.id !== animaleId));
  };


  // Sposta animali
  const handleSpostaAnimali = async () => {
    if (animaliSelezionati.length === 0) {
      alert('Seleziona almeno un animale');
      return;
    }

    if (!selectedStabilimento && !selectedBox) {
      alert('Seleziona uno stabilimento o un box di destinazione');
      return;
    }

    setLoading(true);
    try {
      let successi = 0;
      let errori = 0;

      if (selectedStabilimento) {
        // Spostamento su stabilimento: distribuzione sequenziale sui box liberi
        const boxes = await allevamentoService.getBox(parseInt(selectedStabilimento));
        
        // Ordina box per occupazione (da meno occupati a più occupati)
        const boxesOrdinati = boxes
          .map(box => ({
            box,
            occupazione: boxOccupazioni[box.id] || 0,
            spazioDisponibile: box.capacita - (boxOccupazioni[box.id] || 0)
          }))
          .sort((a, b) => {
            // Prima quelli con spazio disponibile, poi per occupazione crescente
            if (a.spazioDisponibile > 0 && b.spazioDisponibile <= 0) return -1;
            if (a.spazioDisponibile <= 0 && b.spazioDisponibile > 0) return 1;
            return a.occupazione - b.occupazione;
          });

        if (boxesOrdinati.length === 0) {
          alert('Nessun box disponibile nello stabilimento selezionato');
          setLoading(false);
          return;
        }

        // Distribuisci animali sequenzialmente sui box
        let boxIndex = 0;
        for (const animale of animaliSelezionati) {
          try {
            // Trova il prossimo box disponibile (con spazio o da riempire)
            let boxAssegnato = null;
            let tentativi = 0;
            
            while (tentativi < boxesOrdinati.length) {
              const boxInfo = boxesOrdinati[boxIndex % boxesOrdinati.length];
              boxIndex++;
              tentativi++;
              
              // Preferisci box con spazio, ma accetta anche quelli pieni (eccedenza)
              boxAssegnato = boxInfo.box;
              break;
            }

            if (boxAssegnato) {
              await allevamentoService.createMovimentazione({
                animale_id: animale.id,
                a_box_id: boxAssegnato.id,
              });
              
              // Aggiorna occupazione locale
              setBoxOccupazioni(prev => ({
                ...prev,
                [boxAssegnato.id]: (prev[boxAssegnato.id] || 0) + 1
              }));
              
              // Aggiorna anche l'ordinamento locale
              const boxInfo = boxesOrdinati.find(b => b.box.id === boxAssegnato.id);
              if (boxInfo) {
                boxInfo.occupazione++;
                boxInfo.spazioDisponibile--;
              }
              
              successi++;
            }
          } catch (err) {

            errori++;
          }
        }
      } else if (selectedBox) {
        // Spostamento su singolo box
        for (const animale of animaliSelezionati) {
          try {
            await allevamentoService.createMovimentazione({
              animale_id: animale.id,
              a_box_id: parseInt(selectedBox),
            });
            
            // Aggiorna occupazione locale
            setBoxOccupazioni(prev => ({
              ...prev,
              [selectedBox]: (prev[selectedBox] || 0) + 1
            }));
            
            successi++;
          } catch (err) {

            errori++;
          }
        }
      }

      if (successi > 0) {
        alert(`${successi} animale/i spostato/i con successo${errori > 0 ? `, ${errori} errore/i` : ''}`);
        // Reset selezione animali
        setAnimaliSelezionati([]);
        // Ricarica risultati
        handleSearchAnimali();
        loadBoxes();
      } else {
        alert(`Errore: nessun animale spostato${errori > 0 ? ` (${errori} errori)` : ''}`);
      }
    } catch (err) {

      alert(`Errore nello spostamento: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="stall-map-new">
      {error && <div className="error-message">{error}</div>}
      
      {/* SELEZIONE INIZIALE: Sede */}
      <div className="initial-selection">
        <div className="selection-row">
          <div className="filter-group">
            <label>Sede:</label>
            <SearchableSelect
              className="select-compact"
              options={sedeSelectOptions}
              value={selectedSede}
              onChange={(e) => setSelectedSede(e.target.value)}
              displayField="label"
              valueField="value"
              placeholder="Seleziona sede..."
              disabled={!aziendaId}
            />
          </div>
        </div>
      </div>

      {/* FILTRI E RICERCA - Appaiono solo dopo selezione sede */}
      {selectedSede && (
        <div className="stall-map-container">
          {/* SEZIONE RICERCA ANIMALI */}
          <div className="search-section search-animali">
            <h2 className="section-title">Ricerca Animali</h2>
            
            <div className="search-filters">
              <div className="filter-group">
                <label>Ricerca per auricolare:</label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && searchTerm.trim().length >= 4) {
                      handleSearchAnimali();
                    }
                  }}
                  placeholder="Ultime 4 cifre (es: 1000)"
                  maxLength="20"
                  className="search-input"
                />
              </div>

              <div className="filter-row">
                <div className="filter-group">
                  <label>Sesso:</label>
                  <SearchableSelect
                    className="select-compact"
                    options={sessoSelectOptions}
                    value={filterSesso}
                    onChange={(e) => setFilterSesso(e.target.value)}
                    displayField="label"
                    valueField="value"
                    placeholder="Tutti"
                  />
                </div>

                <div className="filter-group">
                  <label>Data Arrivo:</label>
                  <input
                    type="date"
                    value={filterDataArrivo}
                    onChange={(e) => setFilterDataArrivo(e.target.value)}
                    className="search-input"
                  />
                </div>

                <div className="filter-group">
                  <label>Razza:</label>
                  <SearchableSelect
                    className="select-compact"
                    options={razzaSelectOptions}
                    value={filterRazza}
                    onChange={(e) => setFilterRazza(e.target.value)}
                    displayField="label"
                    valueField="value"
                    placeholder="Tutte"
                  />
                </div>
              </div>

              <div className="filter-group" style={{ marginTop: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={soloPresenti}
                    onChange={(e) => setSoloPresenti(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>Solo animali presenti</span>
                </label>
              </div>

              <div className="filter-actions">
                <button 
                  className="btn-primary" 
                  onClick={handleSearchAnimali} 
                  disabled={loadingAnimali || !selectedSede}
                >
                  {loadingAnimali ? 'Ricerca...' : 'Cerca'}
                </button>
                <button 
                  className="btn-secondary" 
                  onClick={() => {
                    setSearchTerm('');
                    setFilterSesso('');
                    setFilterDataArrivo('');
                    setFilterRazza('');
                    setSoloPresenti(true);
                    setAnimaliRisultati([]);
                    // NON resettare animaliSelezionati - mantieni la selezione
                  }}
                >
                  Reset Filtri
                </button>
              </div>
            </div>

          {animaliRisultati.length > 0 && (
            <div className="search-results">
              <h3>Risultati ({animaliRisultati.length})</h3>
              <div className="results-list">
                {animaliRisultati.map(animale => {
                  const isSelected = animaliSelezionati.some(a => a.id === animale.id);
                  return (
                    <div 
                      key={animale.id} 
                      className={`result-item ${isSelected ? 'selected' : ''}`}
                    >
                      <span>
                        {animale.auricolare}
                        {animale.sesso && <span className="animal-info-separator"> | {animale.sesso}</span>}
                        {animale.razza && <span className="animal-info-separator"> | {animale.razza}</span>}
                      </span>
                      <button
                        className={`btn-small ${isSelected ? 'btn-secondary' : 'btn-primary'}`}
                        onClick={() => isSelected ? removeAnimaleSelezionato(animale.id) : addAnimaleSelezionato(animale)}
                      >
                        {isSelected ? 'Rimuovi' : 'Seleziona'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {animaliSelezionati.length > 0 && (
            <div className="selected-animali">
              <h3>Animali Selezionati ({animaliSelezionati.length})</h3>
              <div className="selected-list">
                {animaliSelezionati.map(animale => (
                  <span key={animale.id} className="selected-chip">
                    {animale.auricolare}
                    <button onClick={() => removeAnimaleSelezionato(animale.id)}>×</button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

          {/* SEZIONE RICERCA BOX/STABILIMENTO */}
          <div className="search-section search-box">
            <h2 className="section-title">Destinazione Spostamento</h2>
            
            <div className="search-filters">
              <div className="filter-row">
                <div className="filter-group">
                  <label>Stabilimento:</label>
                  <SearchableSelect
                    className="select-compact"
                    options={stabilimentoSelectOptions}
                    value={filterStabilimento}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFilterStabilimento(value);
                      setSelectedStabilimento(value);
                      setSelectedBox('');
                    }}
                    displayField="label"
                    valueField="value"
                    placeholder="Seleziona stabilimento..."
                  />
                </div>

                <div className="filter-group">
                  <label>Box (opzionale, se vuoto usa stabilimento):</label>
                  <SearchableSelect
                    className="select-compact"
                    options={boxSelectOptions}
                    value={filterBox}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFilterBox(value);
                      setSelectedBox(value);
                      if (value) {
                        setSelectedStabilimento('');
                      }
                    }}
                    displayField="label"
                    valueField="value"
                    placeholder="Usa stabilimento (distribuzione automatica)"
                    disabled={!filterStabilimento}
                  />
                </div>
              </div>
            </div>

            {loadingBox && <div className="loading">Caricamento box...</div>}

            {/* Stabilimenti disponibili */}
            {stabilimenti.length > 0 && (
              <div className="stabilimento-drop-zone">
                <h3>Stabilimenti Disponibili</h3>
                <div className="stabilimenti-grid">
                  {stabilimenti.map(stab => {
                    const isSelected = selectedStabilimento === String(stab.id) && !selectedBox;
                    return (
                      <div
                        key={stab.id}
                        className={`stabilimento-drop-card ${isSelected ? 'selected' : ''}`}
                        onClick={() => {
                          setSelectedStabilimento(String(stab.id));
                          setSelectedBox('');
                          setFilterStabilimento(stab.id.toString());
                          setFilterBox('');
                        }}
                      >
                        <strong>{stab.nome}</strong>
                        <span className="hint">Distribuzione automatica</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedStabilimento && !selectedBox && (
              <div className="info-box">
                <p>Gli animali selezionati verranno distribuiti sequenzialmente sui box dello stabilimento selezionato.</p>
                {(() => {
                  const boxes = boxRisultati;
                  const totaleCapienza = boxes.reduce((sum, b) => sum + b.capacita, 0);
                  const totaleOccupazione = boxes.reduce((sum, b) => sum + (boxOccupazioni[b.id] || 0), 0);
                  const nuovaOccupazione = totaleOccupazione + animaliSelezionati.length;
                  const isEccesso = nuovaOccupazione > totaleCapienza;
                  
                  return (
                    <div className={`box-info ${isEccesso ? 'excess' : ''}`}>
                      <strong>Stabilimento:</strong> {stabilimenti.find(s => s.id === parseInt(selectedStabilimento))?.nome || ''}
                      <br />
                      Box disponibili: {boxes.length} | Spazio totale: {totaleCapienza} | Occupazione attuale: {totaleOccupazione}
                      {isEccesso && (
                        <div className="excess-warning">
                          ⚠️ Attenzione: Dopo lo spostamento ci sarà un'eccedenza totale di {nuovaOccupazione - totaleCapienza} animali nello stabilimento
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {selectedBox && (
              <div className="info-box">
                <p>Gli animali selezionati verranno spostati nel box selezionato.</p>
                {(() => {
                  const box = boxRisultati.find(b => b.id === parseInt(selectedBox));
                  const occupazione = boxOccupazioni[selectedBox] || 0;
                  const nuovaOccupazione = occupazione + animaliSelezionati.length;
                  const isEccesso = box && nuovaOccupazione > box.capacita;
                  return box && (
                    <div className={`box-info ${isEccesso ? 'excess' : ''}`}>
                      <strong>{box.nome}</strong> - Occupazione attuale: {occupazione}/{box.capacita}
                      {isEccesso && (
                        <div className="excess-warning">
                          ⚠️ Attenzione: Dopo lo spostamento ci sarà un'eccedenza di {nuovaOccupazione - box.capacita} animali
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Box disponibili */}
            {boxRisultati.length > 0 && (
              <div className="box-drop-zone">
                <h3>Box Disponibili</h3>
                <div className="box-grid-drop">
                  {boxRisultati.map(box => {
                    const occupazione = boxOccupazioni[box.id] || 0;
                    const nuovaOccupazione = occupazione + animaliSelezionati.length;
                    const isEccesso = nuovaOccupazione > box.capacita;
                    const isSelected = selectedBox === box.id.toString();
                    
                    return (
                      <div
                        key={box.id}
                        className={`box-drop-card ${isSelected ? 'selected' : ''} ${isEccesso && isSelected ? 'excess' : ''}`}
                        onClick={() => {
                          setSelectedBox(box.id.toString());
                          setSelectedStabilimento('');
                          setFilterBox(box.id.toString());
                        }}
                      >
                        <div className="box-drop-header">
                          <strong>{box.nome}</strong>
                        </div>
                        <div className="box-drop-body">
                          {occupazione}/{box.capacita}
                          {isSelected && isEccesso && (
                            <span className="excess-badge">ECCESSO</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AZIONE SPOSTAMENTO */}
      {selectedSede && animaliSelezionati.length > 0 && (selectedStabilimento || selectedBox) && (
        <div className="action-section">
          <button 
            className="btn-primary btn-large" 
            onClick={handleSpostaAnimali}
            disabled={loading}
          >
            {loading ? 'Spostamento in corso...' : 
              `Sposta ${animaliSelezionati.length} animale/i ${selectedBox ? 'nel box selezionato' : 'nello stabilimento (distribuzione automatica)'}`}
          </button>
        </div>
      )}
    </div>
  );
};

export default StallMap;
