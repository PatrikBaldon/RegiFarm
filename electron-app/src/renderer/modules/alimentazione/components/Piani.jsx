import React, { useCallback, useEffect, useState } from 'react';
import { alimentazioneService } from '../services/alimentazioneService';
import SearchableSelect from '../../../components/SearchableSelect';
import SimpleSelect from '../../../components/SimpleSelect';
import BaseModal from '../../../components/BaseModal';
import './Alimentazione.css';
import {
  prefetchAlimentazionePiani,
  getCachedAlimentazionePiani,
} from '../prefetchers';
import { useAzienda } from '../../../context/AziendaContext';
import { useRequest } from '../../../context/RequestContext';

const Piani = () => {
  const { azienda } = useAzienda();
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [dataLoaded, setDataLoaded] = useState(false); // Flag per tracciare se i dati sono stati caricati almeno una volta

  const [piani, setPiani] = useState([]);
  const [formPiano, setFormPiano] = useState({ nome: '', descrizione: '', tipo_allevamento: '', versione: '', validita_da: '', validita_a: '' });
  const [editingPianoId, setEditingPianoId] = useState(null);
  const [showPianoModal, setShowPianoModal] = useState(false);
  const [savingPiano, setSavingPiano] = useState(false);

  const [componenti, setComponenti] = useState([]);
  const [mangimi, setMangimi] = useState([]);

  const [composizioni, setComposizioni] = useState([]);
  const [formComposizione, setFormComposizione] = useState({ piano_alimentazione_id: '', componente_alimentare_id: '', mangime_confezionato_id: '', quantita: '', ordine: '', tipo_fornitura: '' });
  const [editingComposizioneId, setEditingComposizioneId] = useState(null);
  const [showCompModal, setShowCompModal] = useState(false);
  const [savingComposizione, setSavingComposizione] = useState(false);
  const [selectedPianoId, setSelectedPianoId] = useState(null);

  const applyPayload = useCallback((payload) => {
    if (!payload) return;
    setPiani(payload.piani || []);
    setComponenti(payload.componenti || []);
    setMangimi(payload.mangimi || []);
    setComposizioni(payload.composizioni || []);
    setDataLoaded(true); // Marca i dati come caricati, anche se sono array vuoti
  }, []);

  const hydratePiani = useCallback(
    async ({ force = false, showErrors = true } = {}) => {
      // Se i dati sono già stati caricati e non è forzato, non ricaricare
      // Usa dataLoaded invece di controllare length per gestire correttamente array vuoti
      if (!force && dataLoaded) {
        return null;
      }

      const cached = getCachedAlimentazionePiani();
      if (!force && cached) {
        applyPayload(cached);
        setLoading(false);
        return cached;
      } else if (force) {
        setLoading(true);
      } else if (!cached) {
        setLoading(true);
      }

      try {
        const data = await prefetchAlimentazionePiani({ force });
        if (data) {
          applyPayload(data);
        }
        return data;
      } catch (error) {

        if (showErrors) {
          showToast('Errore nel caricamento', 'error');
        }
        return null;
      } finally {
        setLoading(false);
      }
    },
    [applyPayload, dataLoaded],
  );

  useEffect(() => {
    hydratePiani();
  }, [hydratePiani]);

  function showToast(message, type = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  }

  function openNewPiano() {
    setEditingPianoId(null);
    setFormPiano({ nome: '', descrizione: '', tipo_allevamento: '', versione: '', validita_da: '', validita_a: '' });
    setShowPianoModal(true);
  }

  function openEditPiano(p) {
    setEditingPianoId(p.id);
    setFormPiano({
      nome: p.nome || '',
      descrizione: p.descrizione || '',
      tipo_allevamento: p.tipo_allevamento || '',
      versione: p.versione || '',
      validita_da: p.validita_da || '',
      validita_a: p.validita_a || '',
    });
    setShowPianoModal(true);
  }

  async function savePiano() {
    if (!azienda?.id) {
      showToast('Nessuna azienda selezionata', 'error');
      return;
    }
    setSavingPiano(true);
    const payload = { 
      ...formPiano, 
      validita_da: formPiano.validita_da || null, 
      validita_a: formPiano.validita_a || null,
      azienda_id: azienda.id
    };
    try {
      if (editingPianoId) {
        await alimentazioneService.updatePiano(editingPianoId, payload);
        showToast('Piano aggiornato');
      } else {
        await alimentazioneService.createPiano(payload);
        showToast('Piano creato');
      }
      setShowPianoModal(false);
      setEditingPianoId(null);
      setFormPiano({ nome: '', descrizione: '', tipo_allevamento: '', versione: '', validita_da: '', validita_a: '' });
      await hydratePiani({ force: true });
    } catch (e) {

      showToast('Errore salvataggio piano', 'error');
    } finally {
      setSavingPiano(false);
    }
  }

  function openNewComposizione() {
    setEditingComposizioneId(null);
    setFormComposizione({ piano_alimentazione_id: '', componente_alimentare_id: '', mangime_confezionato_id: '', quantita: '', ordine: '', tipo_fornitura: '' });
    setShowCompModal(true);
  }

  function openEditComposizione(c) {
    setEditingComposizioneId(c.id);
    setFormComposizione({
      piano_alimentazione_id: c.piano_alimentazione_id ?? '',
      componente_alimentare_id: c.componente_alimentare_id ?? '',
      mangime_confezionato_id: c.mangime_confezionato_id ?? '',
      quantita: c.quantita ?? '',
      ordine: c.ordine ?? '',
      tipo_fornitura: c.tipo_fornitura || '',
    });
    setShowCompModal(true);
  }

  async function saveComposizione() {
    setSavingComposizione(true);
    const payload = {
      ...formComposizione,
      piano_alimentazione_id: formComposizione.piano_alimentazione_id ? Number(formComposizione.piano_alimentazione_id) : null,
      componente_alimentare_id: formComposizione.componente_alimentare_id ? Number(formComposizione.componente_alimentare_id) : null,
      mangime_confezionato_id: formComposizione.mangime_confezionato_id ? Number(formComposizione.mangime_confezionato_id) : null,
      quantita: formComposizione.quantita === '' ? null : parseFloat(formComposizione.quantita),
      ordine: formComposizione.ordine === '' ? null : Number(formComposizione.ordine),
    };
    try {
      if (editingComposizioneId) {
        await alimentazioneService.updateComposizione(editingComposizioneId, payload);
        showToast('Composizione aggiornata');
      } else {
        await alimentazioneService.createComposizione(payload);
        showToast('Composizione aggiunta');
      }
      setShowCompModal(false);
      setEditingComposizioneId(null);
      setFormComposizione({ piano_alimentazione_id: '', componente_alimentare_id: '', mangime_confezionato_id: '', quantita: '', ordine: '', tipo_fornitura: '' });
      await hydratePiani({ force: true });
    } catch (e) {

      showToast('Errore salvataggio composizione', 'error');
    } finally {
      setSavingComposizione(false);
    }
  }

  return (
    <div className="alimentazione-section">
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Piani e Composizioni</h3>
        <button className="btn-primary" onClick={openNewPiano} style={{ marginRight: '0' }}>
          Nuovo Piano
        </button>
      </div>

      {loading && <div className="loading">Caricamento...</div>}

      {/* Piani */}
      <section className="section-block">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}></th>
                <th>Nome</th>
                <th>Versione</th>
                <th>Tipo</th>
                <th>Validità</th>
                <th>Composizioni</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {piani.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-state">Nessun piano alimentare presente.</td>
                </tr>
              ) : (
                piani.map(p => {
                const pianoComposizioni = composizioni.filter(c => c.piano_alimentazione_id === p.id);
                const isSelected = selectedPianoId === p.id;
                return (
                  <React.Fragment key={p.id}>
                    <tr 
                      className={isSelected ? 'selected-row' : ''}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelectedPianoId(isSelected ? null : p.id)}
                    >
                      <td>
                        <button
                          className="btn-icon"
                          style={{ padding: '4px 8px', fontSize: '12px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPianoId(isSelected ? null : p.id);
                          }}
                          title={isSelected ? 'Chiudi composizioni' : 'Vedi composizioni'}
                        >
                          {isSelected ? '▼' : '▶'}
                        </button>
                      </td>
                      <td className="cell-strong">{p.nome}</td>
                  <td>{p.versione || '-'}</td>
                  <td>{p.tipo_allevamento || '-'}</td>
                  <td>{(p.validita_da || '-') + ' → ' + (p.validita_a || '-')}</td>
                      <td>{pianoComposizioni.length}</td>
                  <td>
                        <button 
                          className="btn-icon" 
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditPiano(p);
                          }} 
                          title="Modifica"
                        >
                          ✏️
                        </button>
                    <button
                      className="btn-icon"
                          onClick={async (e) => {
                            e.stopPropagation();
                        if (confirm('Eliminare il piano?')) {
                          await alimentazioneService.deletePiano(p.id);
                          await hydratePiani({ force: true });
                          showToast('Piano eliminato');
                              if (selectedPianoId === p.id) setSelectedPianoId(null);
                        }
                      }}
                      title="Elimina"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
                    {isSelected && (
                      <tr>
                        <td colSpan={7} style={{ padding: '20px', background: '#f8f9fa' }}>
                          <div className="piano-composizioni-expanded">
                            <div className="block-header" style={{ marginBottom: '12px' }}>
                              <button 
                                className="btn-primary" 
                                style={{ fontSize: '13px', padding: '6px 12px' }}
                                onClick={() => {
                                  setFormComposizione({ ...formComposizione, piano_alimentazione_id: String(p.id) });
                                  openNewComposizione();
                                }}
                              >
                                + Aggiungi Composizione
                              </button>
        </div>
                            {pianoComposizioni.length > 0 ? (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ingrediente/Mangime</th>
                <th>Quantità</th>
                <th>Ordine</th>
                <th>Tipo fornitura</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
                                    {pianoComposizioni.map(c => (
                <tr key={c.id}>
                  <td>{c.componente_alimentare_id ? `Comp #${c.componente_alimentare_id}` : (c.mangime_confezionato_id ? `Mangime #${c.mangime_confezionato_id}` : '-')}</td>
                  <td>{c.quantita}</td>
                  <td>{c.ordine ?? '-'}</td>
                  <td>{c.tipo_fornitura || '-'}</td>
                  <td>
                    <button className="btn-icon" onClick={() => openEditComposizione(c)} title="Modifica">✏️</button>
                    <button
                      className="btn-icon"
                      onClick={async () => {
                        if (confirm('Eliminare la riga?')) {
                          await alimentazioneService.deleteComposizione(c.id);
                          await hydratePiani({ force: true });
                          showToast('Composizione eliminata');
                        }
                      }}
                      title="Elimina"
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
                                Nessuna composizione per questo piano. Clicca su "Aggiungi Composizione" per crearne una.
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal Piano */}
      <BaseModal
        isOpen={showPianoModal}
        onClose={() => setShowPianoModal(false)}
        title={editingPianoId ? 'Modifica Piano' : 'Nuovo Piano'}
        size="large"
        footerActions={
          <>
            <button className="btn btn-secondary" onClick={() => setShowPianoModal(false)}>Annulla</button>
            <button className="btn btn-primary" onClick={savePiano} disabled={savingPiano}>{savingPiano ? 'Salvataggio...' : 'Salva'}</button>
          </>
        }
      >
        <div className="form-group">
          <label>Nome *</label>
          <input value={formPiano.nome} onChange={e => setFormPiano({ ...formPiano, nome: e.target.value })} required />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Versione</label>
            <input value={formPiano.versione} onChange={e => setFormPiano({ ...formPiano, versione: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Tipo allevamento</label>
            <input value={formPiano.tipo_allevamento} onChange={e => setFormPiano({ ...formPiano, tipo_allevamento: e.target.value })} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Validità da</label>
            <input type="date" value={formPiano.validita_da} onChange={e => setFormPiano({ ...formPiano, validita_da: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Validità a</label>
            <input type="date" value={formPiano.validita_a} onChange={e => setFormPiano({ ...formPiano, validita_a: e.target.value })} />
          </div>
        </div>
        <div className="form-group">
          <label>Descrizione</label>
          <input value={formPiano.descrizione} onChange={e => setFormPiano({ ...formPiano, descrizione: e.target.value })} />
        </div>
      </BaseModal>

      {/* Modal Composizione */}
      <BaseModal
        isOpen={showCompModal}
        onClose={() => setShowCompModal(false)}
        title={editingComposizioneId ? 'Modifica Composizione' : 'Aggiungi Composizione'}
        size="large"
        footerActions={
          <>
            <button className="btn btn-secondary" onClick={() => setShowCompModal(false)}>Annulla</button>
            <button className="btn btn-primary" onClick={saveComposizione} disabled={savingComposizione}>{savingComposizione ? 'Salvataggio...' : 'Salva'}</button>
          </>
        }
      >
        <div className="form-group">
          <label>Piano *</label>
          <SearchableSelect
            options={piani.map(p => ({ ...p, displayName: `${p.nome}${p.versione ? ` (${p.versione})` : ''}` }))}
            value={formComposizione.piano_alimentazione_id ? String(formComposizione.piano_alimentazione_id) : ''}
            onChange={(e) => setFormComposizione({ ...formComposizione, piano_alimentazione_id: e.target.value })}
            placeholder="Cerca piano..."
            displayField="displayName"
            valueField="id"
            required
          />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Componente</label>
            <SearchableSelect
              options={[{ id: '', nome: '(opzionale)' }, ...componenti]}
              value={formComposizione.componente_alimentare_id ? String(formComposizione.componente_alimentare_id) : ''}
              onChange={(e) => setFormComposizione({ ...formComposizione, componente_alimentare_id: e.target.value, mangime_confezionato_id: '' })}
              placeholder="Cerca componente..."
              displayField="nome"
              valueField="id"
            />
          </div>
          <div className="form-group">
            <label>Mangime</label>
            <SimpleSelect
              options={mangimi.map(m => ({ value: m.id, label: m.nome }))}
              value={formComposizione.mangime_confezionato_id ? String(formComposizione.mangime_confezionato_id) : ''}
              onChange={(e) => setFormComposizione({ ...formComposizione, mangime_confezionato_id: e.target.value, componente_alimentare_id: '' })}
              placeholder="Seleziona mangime..."
              displayField="label"
              valueField="value"
              allowEmpty={true}
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Quantità *</label>
            <input value={formComposizione.quantita} onChange={e => setFormComposizione({ ...formComposizione, quantita: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>Ordine</label>
            <input value={formComposizione.ordine} onChange={e => setFormComposizione({ ...formComposizione, ordine: e.target.value })} />
          </div>
        </div>
        <div className="form-group">
          <label>Tipo fornitura</label>
          <input value={formComposizione.tipo_fornitura} onChange={e => setFormComposizione({ ...formComposizione, tipo_fornitura: e.target.value })} />
        </div>
      </BaseModal>

      {toast && (
        <div className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>{toast.message}</div>
      )}
    </div>
  );
};

export default Piani;
