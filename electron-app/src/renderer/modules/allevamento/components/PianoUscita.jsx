/**
 * PianoUscita - Pianificazione uscita animali
 * Permette di selezionare animali per intero box o singolarmente
 */
import React, { useState, useEffect, useMemo } from 'react';
import SearchableSelect from '../../../components/SearchableSelect';
import { allevamentoService } from '../services/allevamentoService';
import { aziendeService } from '../services/aziendeService';
import './PianoUscita.css';

const PianoUscita = () => {
  const [selectedAnimals, setSelectedAnimals] = useState([]); // Array di {id, auricolare}
  const [aziende, setAziende] = useState([]);
  const [sedi, setSedi] = useState([]);
  const [stabilimenti, setStabilimenti] = useState([]);
  const [boxes, setBoxes] = useState([]);
  const [boxAnimals, setBoxAnimals] = useState({}); // {boxId: [animali]}
  const [selectedAzienda, setSelectedAzienda] = useState('');
  const [selectedSede, setSelectedSede] = useState('');
  const [selectedStabilimento, setSelectedStabilimento] = useState('');
  const aziendaOptions = useMemo(
    () => [
      { value: '', label: 'Seleziona...' },
      ...aziende.map((az) => ({ value: String(az.id), label: az.nome })),
    ],
    [aziende],
  );

  const sedeOptions = useMemo(
    () => [
      { value: '', label: 'Seleziona...' },
      ...sedi.map((sede) => ({ value: String(sede.id), label: sede.nome })),
    ],
    [sedi],
  );

  const stabilimentoOptions = useMemo(
    () => [
      { value: '', label: 'Seleziona...' },
      ...stabilimenti.map((stab) => ({ value: String(stab.id), label: stab.nome })),
    ],
    [stabilimenti],
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingBoxAnimals, setLoadingBoxAnimals] = useState({}); // {boxId: true/false}

  useEffect(() => {
    loadAziende();
  }, []);

  useEffect(() => {
    if (selectedAzienda) {
      loadSedi(selectedAzienda);
    } else {
      setSedi([]);
      setStabilimenti([]);
      setBoxes([]);
    }
    setSelectedSede('');
    setSelectedStabilimento('');
    setBoxes([]);
  }, [selectedAzienda]);

  useEffect(() => {
    if (selectedSede) {
      loadStabilimenti(selectedSede);
    } else {
      setStabilimenti([]);
      setBoxes([]);
    }
    setSelectedStabilimento('');
    setBoxes([]);
  }, [selectedSede]);

  useEffect(() => {
    if (selectedStabilimento) {
      loadBoxes(selectedStabilimento);
    } else {
      setBoxes([]);
    }
  }, [selectedStabilimento]);

  const loadAziende = async () => {
    try {
      const data = await aziendeService.getAziende();
      setAziende(data || []);
    } catch (err) {

    }
  };

  const loadSedi = async (aziendaId) => {
    try {
      const data = await allevamentoService.getSedi(aziendaId);
      setSedi(data || []);
    } catch (err) {

      setSedi([]);
    }
  };

  const loadStabilimenti = async (sedeId) => {
    try {
      const data = await allevamentoService.getStabilimenti(sedeId);
      setStabilimenti(data || []);
    } catch (err) {

      setStabilimenti([]);
    }
  };

  const loadBoxes = async (stabilimentoId) => {
    try {
      const data = await allevamentoService.getBox(stabilimentoId);
      setBoxes(data || []);
      
      // Carica anche gli animali per ogni box
      if (data && data.length > 0) {
        const animalsData = {};
        const loadingData = {};
        
        for (const box of data) {
          loadingData[box.id] = true;
          try {
            const animali = await allevamentoService.getAnimali({ 
              box_id: box.id, 
              stato: 'presente' 
            });
            animalsData[box.id] = animali || [];
          } catch (err) {

            animalsData[box.id] = [];
          } finally {
            loadingData[box.id] = false;
          }
        }
        
        setBoxAnimals(animalsData);
        setLoadingBoxAnimals(loadingData);
      } else {
        setBoxAnimals({});
        setLoadingBoxAnimals({});
      }
    } catch (err) {

      setBoxes([]);
      setBoxAnimals({});
      setLoadingBoxAnimals({});
    }
  };

  const loadAnimalsFromBox = async (boxId) => {
    try {
      setLoading(true);
      const animali = await allevamentoService.getAnimali({ box_id: boxId, stato: 'presente' });
      
      // Aggiungi animali alla lista (evita duplicati)
      setSelectedAnimals(prev => {
        const newAnimals = animali.map(a => ({ id: a.id, auricolare: a.auricolare }));
        const existingIds = new Set(prev.map(a => a.id));
        const uniqueNew = newAnimals.filter(a => !existingIds.has(a.id));
        return [...prev, ...uniqueNew];
      });
    } catch (err) {
      alert(`Errore nel caricamento animali del box: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchTerm || searchTerm.trim().length < 4) {
      alert('Inserisci almeno 4 cifre dell\'auricolare');
      return;
    }

    try {
      setLoading(true);
      const searchTermTrimmed = searchTerm.trim();
      const last4 = searchTermTrimmed.slice(-4);
      
      // Carica tutti gli animali presenti
      const allAnimali = await allevamentoService.getAnimali({ stato: 'presente' });
      
      // Filtra per ultime 4 cifre
      const filtered = allAnimali.filter(a => 
        a.auricolare && a.auricolare.slice(-4) === last4
      );
      
      setSearchResults(filtered);
    } catch (err) {
      alert(`Errore nella ricerca: ${err.message}`);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const addAnimal = (animale) => {
    setSelectedAnimals(prev => {
      // Evita duplicati
      if (prev.some(a => a.id === animale.id)) {
        return prev;
      }
      return [...prev, { id: animale.id, auricolare: animale.auricolare }];
    });
  };

  const removeAnimal = (animaleId) => {
    setSelectedAnimals(prev => prev.filter(a => a.id !== animaleId));
  };

  const clearList = () => {
    if (window.confirm('Vuoi svuotare la lista degli animali selezionati?')) {
      setSelectedAnimals([]);
    }
  };

  const copyToClipboard = () => {
    if (selectedAnimals.length === 0) {
      alert('Nessun animale selezionato');
      return;
    }

    // Crea stringa con auricolari separati da newline
    const auricolari = selectedAnimals.map(a => a.auricolare).join('\n');
    
    // Copia negli appunti
    navigator.clipboard.writeText(auricolari).then(() => {
      alert(`${selectedAnimals.length} auricolari copiati negli appunti!`);
    }).catch(err => {

      alert('Errore nella copia negli appunti');
    });
  };

  const printPiano = async () => {
    if (selectedAnimals.length === 0) {
      alert('Nessun animale selezionato');
      return;
    }

    try {
      setLoading(true);
      const animaleIds = selectedAnimals.map(a => a.id);
      const savedPath = await allevamentoService.generatePianoUscitaPDF(animaleIds);
      if (savedPath) {
        alert(`PDF salvato con successo!\n\nPercorso: ${savedPath}`);
      }
    } catch (err) {
      if (err.message !== 'Salvataggio annullato') {
        alert(`Errore nella generazione PDF: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="piano-uscita">
      <div className="piano-uscita-header">
        <h2>Piano Uscita</h2>
        <div className="header-actions">
          <button 
            className="btn-secondary" 
            onClick={clearList}
            disabled={selectedAnimals.length === 0}
          >
            Svuota Lista
          </button>
          <button 
            className="btn-secondary" 
            onClick={copyToClipboard}
            disabled={selectedAnimals.length === 0}
          >
            Copia Lista ({selectedAnimals.length})
          </button>
          <button 
            className="btn-primary" 
            onClick={printPiano}
            disabled={selectedAnimals.length === 0 || loading}
          >
            {loading ? 'Generazione...' : 'Stampa Piano'}
          </button>
        </div>
      </div>

      <div className="piano-uscita-content">
        <div className="selection-panel">
          <div className="panel-section">
            <h3>Seleziona per Box</h3>
            <div className="filter-controls">
              <div className="filter-group">
                <label>Azienda:</label>
                <SearchableSelect
                  className="select-compact"
                  options={aziendaOptions}
                  value={selectedAzienda}
                  onChange={(e) => setSelectedAzienda(e.target.value)}
                  displayField="label"
                  valueField="value"
                  placeholder="Seleziona..."
                />
              </div>

              <div className="filter-group">
                <label>Sede:</label>
                <SearchableSelect
                  className="select-compact"
                  options={sedeOptions}
                  value={selectedSede}
                  onChange={(e) => setSelectedSede(e.target.value)}
                  displayField="label"
                  valueField="value"
                  placeholder="Seleziona..."
                  disabled={!selectedAzienda}
                />
              </div>

              <div className="filter-group">
                <label>Stabilimento:</label>
                <SearchableSelect
                  className="select-compact"
                  options={stabilimentoOptions}
                  value={selectedStabilimento}
                  onChange={(e) => setSelectedStabilimento(e.target.value)}
                  displayField="label"
                  valueField="value"
                  placeholder="Seleziona..."
                  disabled={!selectedSede}
                />
              </div>
            </div>

            {boxes.length > 0 && (
              <div className="boxes-list">
                <h4>Box disponibili:</h4>
                <div className="box-cards">
                  {boxes.map(box => {
                    const animaliBox = boxAnimals[box.id] || [];
                    const isLoadingBox = loadingBoxAnimals[box.id];
                    
                    return (
                      <div key={box.id} className="box-card">
                        <div className="box-info">
                          <h4>{box.nome}</h4>
                          <p>Capacità: {box.capacita} capi</p>
                          {isLoadingBox ? (
                            <p className="box-loading">Caricamento animali...</p>
                          ) : animaliBox.length > 0 ? (
                            <div className="box-animals-list">
                              <p className="animals-count">{animaliBox.length} capi presenti:</p>
                              <div className="auricolari-tags">
                                {animaliBox.map(animale => (
                                  <span key={animale.id} className="auricolare-tag">
                                    {animale.auricolare}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <p className="box-empty">Nessun animale presente</p>
                          )}
                        </div>
                        <button
                          className="btn-primary btn-small"
                          onClick={() => loadAnimalsFromBox(box.id)}
                          disabled={loading || animaliBox.length === 0}
                        >
                          Aggiungi Box
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="panel-section">
            <h3>Ricerca Singolo Animale</h3>
            <div className="search-controls">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch();
                  }
                }}
                placeholder="Ultime 4 cifre auricolare (es: 1000)"
                maxLength="20"
                className="search-input"
              />
              <button 
                className="btn-primary" 
                onClick={handleSearch}
                disabled={loading || !searchTerm || searchTerm.trim().length < 4}
              >
                {loading ? 'Ricerca...' : 'Cerca'}
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="search-results">
                <h4>Trovati {searchResults.length} animali:</h4>
                <div className="results-list">
                  {searchResults.map(animale => (
                    <div key={animale.id} className="result-item">
                      <span>{animale.auricolare}</span>
                      <button
                        className="btn-primary btn-small"
                        onClick={() => addAnimal(animale)}
                        disabled={selectedAnimals.some(a => a.id === animale.id)}
                      >
                        {selectedAnimals.some(a => a.id === animale.id) ? 'Già aggiunto' : 'Aggiungi'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="selected-list-panel">
          <h3>Lista Animali Selezionati ({selectedAnimals.length})</h3>
          {selectedAnimals.length === 0 ? (
            <div className="empty-state">
              <p>Nessun animale selezionato</p>
              <p className="hint">Usa i filtri sopra per selezionare box interi o cerca singoli animali</p>
            </div>
          ) : (
            <>
              <div className="selected-animals-list">
                {selectedAnimals.map(animale => (
                  <div key={animale.id} className="selected-item">
                    <span>{animale.auricolare}</span>
                    <button
                      className="btn-icon btn-danger"
                      onClick={() => removeAnimal(animale.id)}
                      title="Rimuovi"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <div className="list-preview">
                <h4>Anteprima (formato copia):</h4>
                <pre className="preview-text">{selectedAnimals.map(a => a.auricolare).join('\n')}</pre>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PianoUscita;

