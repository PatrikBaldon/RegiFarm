import React, { useEffect, useMemo, useState } from 'react';
import LoadingSpinner from '../../../components/LoadingSpinner';
import '../../alimentazione/components/Alimentazione.css';
import './PianiUscitaManager.css';

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleDateString('it-IT')} ${date.toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
};

const PianiUscitaManager = ({
  piani = [],
  loading = false,
  error = null,
  selectedId = null,
  onSelect = () => {},
  onRefresh = () => {},
  onUpdateNote = () => {},
  onRemoveAnimale = () => {},
  onDeletePiano = () => {},
}) => {
  const [noteDraft, setNoteDraft] = useState('');
  const selectedPiano = useMemo(
    () => piani.find((piano) => piano.id === selectedId) || null,
    [piani, selectedId],
  );

  useEffect(() => {
    setNoteDraft(selectedPiano?.note || '');
  }, [selectedPiano?.id, selectedPiano?.note]);

  return (
    <div className="piani-uscita-manager">
      <div className="piani-header">
        <div>
          <h3>Gestione Piani di Uscita</h3>
          <p>Visualizza e gestisci i piani di uscita creati dalla ricerca animali.</p>
        </div>
        <div className="piani-actions">
          <button type="button" className="btn-secondary" onClick={onRefresh} disabled={loading}>
            {loading ? 'Aggiornamento...' : 'Aggiorna elenco'}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

          {loading && !piani.length ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
          <LoadingSpinner message="Caricamento piani di uscita..." size="medium" />
        </div>
          ) : piani.length === 0 ? (
        <div className="empty-state">Nessun piano di uscita presente.</div>
      ) : (
        <>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}></th>
                  <th>Nome Piano</th>
                  <th>Stato</th>
                  <th>Animali</th>
                  <th>Data Uscita</th>
                  <th>Data Creazione</th>
                  <th>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {piani.map((piano) => (
                  <React.Fragment key={piano.id}>
                    <tr 
                      className={selectedId === piano.id ? 'selected-row' : ''}
                      style={{ cursor: 'pointer' }}
                onClick={() => onSelect(piano)}
              >
                      <td>
                        <button
                          type="button"
                          className="btn-icon"
                          style={{ padding: '4px 8px', fontSize: '12px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelect(selectedId === piano.id ? null : piano);
                          }}
                          title={selectedId === piano.id ? 'Chiudi dettagli' : 'Apri dettagli'}
                        >
                          {selectedId === piano.id ? '▼' : '▶'}
                        </button>
                      </td>
                      <td className="cell-strong">{piano.nome || `Piano #${piano.id}`}</td>
                      <td>
                  <span className={`piani-status ${piano.stato || 'default'}`}>
                    {piano.stato || 'Bozza'}
                  </span>
                      </td>
                      <td>{piano.animali?.length ?? 0}</td>
                      <td>{piano.data_uscita ? formatDateTime(piano.data_uscita) : '—'}</td>
                      <td>{formatDateTime(piano.created_at || piano.data_creazione)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Eliminare il piano "${piano.nome || `#${piano.id}`}"?`)) {
                              onDeletePiano(piano);
                            }
                          }}
                          title="Elimina piano"
                        >
                          🗑️
              </button>
                      </td>
                    </tr>
                    {selectedId === piano.id && selectedPiano && (
                      <tr>
                        <td colSpan={7} style={{ padding: '20px', background: '#f8f9fa' }}>
                          <div className="piano-detail-expanded">
                            <div style={{ marginBottom: '16px' }}>
                              <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 600, color: '#2c3e50' }}>
                                Dettagli Piano
                              </h4>
                              <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>
                    Creato il {formatDateTime(selectedPiano.created_at || selectedPiano.data_creazione)}
                    {selectedPiano.data_uscita ? ` • Uscita prevista ${formatDateTime(selectedPiano.data_uscita)}` : ''}
                  </p>
              </div>

                            <div className="form-group" style={{ marginBottom: '16px' }}>
                              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500 }}>Note</label>
                <textarea
                  value={noteDraft}
                                rows={3}
                  placeholder="Annotazioni interne sul piano..."
                  onChange={(e) => setNoteDraft(e.target.value)}
                  onBlur={() => {
                    if ((selectedPiano.note || '') !== noteDraft) {
                      onUpdateNote(selectedPiano, noteDraft);
                    }
                  }}
                                style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  border: '1px solid #ddd',
                                  borderRadius: '6px',
                                  fontSize: '14px',
                                  fontFamily: 'inherit',
                                  resize: 'vertical'
                                }}
                              />
                </div>

                            <div>
                              <h5 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: '#2c3e50' }}>
                                Animali inclusi ({selectedPiano.animali?.length ?? 0})
                              </h5>
                {selectedPiano.animali && selectedPiano.animali.length > 0 ? (
                                <div className="table-container">
                                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Auricolare</th>
                        <th>Sede</th>
                        <th>Stato</th>
                        <th>Azioni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPiano.animali.map((animale) => (
                        <tr key={animale.id}>
                          <td className="cell-strong">{animale.auricolare || '—'}</td>
                          <td>{animale.nome_sede || animale.sede_nome || '—'}</td>
                          <td>{animale.stato || '—'}</td>
                          <td>
                            <button
                              type="button"
                                              className="btn-icon"
                              onClick={() => onRemoveAnimale(selectedPiano, animale)}
                                              title="Rimuovi"
                            >
                                              🗑️
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              </div>
          ) : (
                                <div className="empty-state" style={{ padding: '20px' }}>
                                  Nessun animale ancora assegnato a questo piano.
            </div>
          )}
        </div>
      </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default PianiUscitaManager;

