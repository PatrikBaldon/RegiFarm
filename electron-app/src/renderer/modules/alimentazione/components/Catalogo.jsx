import React, { useCallback, useEffect, useState } from 'react';
import { alimentazioneService } from '../services/alimentazioneService';
import BaseModal from '../../../components/BaseModal';
import './Alimentazione.css';
import {
  prefetchAlimentazioneCatalogo,
  getCachedAlimentazioneCatalogo,
} from '../prefetchers';
import { useAzienda } from '../../../context/AziendaContext';
import { useRequest } from '../../../context/RequestContext';

const Catalogo = () => {
  const { azienda } = useAzienda();
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null); // { type: 'success'|'error', message: string }
  const [dataLoaded, setDataLoaded] = useState(false); // Flag per tracciare se i dati sono stati caricati almeno una volta

  const [componenti, setComponenti] = useState([]);
  const [formComponente, setFormComponente] = useState({ nome: '', tipo: '', unita_misura: 'kg', autoprodotto: false, costo_unitario: '', per_svezzamento: true, per_ingrasso: true, note: '' });
  const [editingComponenteId, setEditingComponenteId] = useState(null);
  const [showCompModal, setShowCompModal] = useState(false);
  const [savingComponente, setSavingComponente] = useState(false);

  const [mangimi, setMangimi] = useState([]);
  const [formMangime, setFormMangime] = useState({ nome: '', tipo_allevamento: '', prezzo_unitario: '', unita_misura: 'kg' });
  const [editingMangimeId, setEditingMangimeId] = useState(null);
  const [showMangimeModal, setShowMangimeModal] = useState(false);
  const [savingMangime, setSavingMangime] = useState(false);

  const [fatture, setFatture] = useState([]);
  const [fattureMap, setFattureMap] = useState({});
  const [fatturaModal, setFatturaModal] = useState(null);
  const [activeTab, setActiveTab] = useState('ingredienti'); // 'ingredienti' o 'mangimi'

  const applyPayload = useCallback((payload) => {
    if (!payload) return;
    const componentiData = payload.componenti || [];
    const mangimiData = payload.mangimi || [];
    const fattureData = payload.fatture || [];

    setComponenti(componentiData);
    setMangimi(mangimiData);
    setFatture(fattureData);
    setDataLoaded(true); // Marca i dati come caricati, anche se sono array vuoti

    const map = {};
    fattureData.forEach((f) => {
      if (f?.id != null) {
        map[f.id] = f;
      }
    });
    setFattureMap(map);
  }, []);

  const hydrateCatalogo = useCallback(
    async ({ force = false, showErrors = true } = {}) => {
      // Se i dati sono già stati caricati e non è forzato, non ricaricare
      // Usa dataLoaded invece di controllare length per gestire correttamente array vuoti
      if (!force && dataLoaded) {
        return null;
      }

      const cached = getCachedAlimentazioneCatalogo();
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
        const data = await prefetchAlimentazioneCatalogo({ force });
        if (data) {
          applyPayload(data);
        }
        return data;
      } catch (error) {

        if (showErrors) {
          showToast('Errore nel caricamento del catalogo', 'error');
        }
        return null;
      } finally {
        setLoading(false);
      }
    },
    [applyPayload, dataLoaded],
  );

  useEffect(() => {
    hydrateCatalogo();
  }, [hydrateCatalogo]);

  function showToast(message, type = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  }

  const formatDate = (d) => {
    if (!d) return '-';
    const dt = new Date(d);
    return isNaN(dt) ? d : dt.toLocaleDateString('it-IT');
  };

  const formatMoney = (v) => {
    if (v === null || v === undefined || v === '') return '-';
    const num = typeof v === 'number' ? v : parseFloat(v);
    if (isNaN(num)) return v;
    return num.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
  };

  // Componenti
  async function saveComponente() {
    if (!azienda?.id) {
      showToast('Nessuna azienda selezionata', 'error');
      return;
    }
    setSavingComponente(true);
    const payload = { 
      ...formComponente, 
      costo_unitario: formComponente.costo_unitario === '' ? null : parseFloat(formComponente.costo_unitario),
      azienda_id: azienda.id
    };
    try {
      if (editingComponenteId) {
        await alimentazioneService.updateComponente(editingComponenteId, payload);
        showToast('Componente aggiornato');
      } else {
        await alimentazioneService.createComponente(payload);
        showToast('Componente creato');
      }
      setFormComponente({ nome: '', tipo: '', unita_misura: 'kg', autoprodotto: false, costo_unitario: '', per_svezzamento: true, per_ingrasso: true, note: '' });
      setEditingComponenteId(null);
      setShowCompModal(false);
      await hydrateCatalogo({ force: true });
    } catch (e) {

      showToast('Errore salvataggio componente', 'error');
    } finally {
      setSavingComponente(false);
    }
  }

  function openNewComponente() {
    setEditingComponenteId(null);
    setFormComponente({ nome: '', tipo: '', unita_misura: 'kg', autoprodotto: false, costo_unitario: '', per_svezzamento: true, per_ingrasso: true, note: '' });
    setShowCompModal(true);
  }

  function openEditComponente(c) {
    setEditingComponenteId(c.id);
    setFormComponente({
      nome: c.nome || '',
      tipo: c.tipo || '',
      unita_misura: c.unita_misura || 'kg',
      autoprodotto: !!c.autoprodotto,
      costo_unitario: c.costo_unitario ?? '',
      per_svezzamento: !!c.per_svezzamento,
      per_ingrasso: !!c.per_ingrasso,
      note: c.note || '',
    });
    setShowCompModal(true);
  }

  // Mangimi
  async function saveMangime() {
    if (!azienda?.id) {
      showToast('Nessuna azienda selezionata', 'error');
      return;
    }
    setSavingMangime(true);
    const payload = {
      ...formMangime,
      prezzo_unitario: formMangime.prezzo_unitario === '' ? null : parseFloat(formMangime.prezzo_unitario),
      azienda_id: azienda.id
    };
    try {
      if (editingMangimeId) {
        await alimentazioneService.updateMangime(editingMangimeId, payload);
        showToast('Mangime aggiornato');
      } else {
        await alimentazioneService.createMangime(payload);
        showToast('Mangime creato');
      }
      setFormMangime({ nome: '', tipo_allevamento: '', prezzo_unitario: '', unita_misura: 'kg' });
      setEditingMangimeId(null);
      setShowMangimeModal(false);
      await hydrateCatalogo({ force: true });
    } catch (e) {

      showToast('Errore salvataggio mangime', 'error');
    } finally {
      setSavingMangime(false);
    }
  }

  function openNewMangime() {
    setEditingMangimeId(null);
    setFormMangime({ nome: '', tipo_allevamento: '', prezzo_unitario: '', unita_misura: 'kg' });
    setShowMangimeModal(true);
  }

  function openEditMangime(m) {
    setEditingMangimeId(m.id);
    setFormMangime({
      nome: m.nome || '',
      tipo_allevamento: m.tipo_allevamento || '',
      prezzo_unitario: m.prezzo_unitario ?? '',
      unita_misura: m.unita_misura || 'kg',
    });
    setShowMangimeModal(true);
  }

  async function openFatturaDetails(id) {
    try {
      const data = await alimentazioneService.getFattura(id);
      setFatturaModal(data);
    } catch (e) {

      showToast('Impossibile caricare fattura', 'error');
    }
  }

  return (
    <div className="alimentazione-section">
      <div className="section-header">
        <h3>Ingredienti e Mangimi</h3>
      </div>

      {loading && <div className="loading">Caricamento...</div>}

      {/* Tab Navigation con pulsante allineato a destra */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className={`tab-button ${activeTab === 'ingredienti' ? 'active' : ''}`}
            onClick={() => setActiveTab('ingredienti')}
            style={{
              padding: '10px 20px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeTab === 'ingredienti' ? 600 : 400,
              color: activeTab === 'ingredienti' ? '#2563eb' : '#666',
              transition: 'all 0.2s ease'
            }}
          >
            Componenti Alimentari ({componenti.length})
          </button>
          <button
            className={`tab-button ${activeTab === 'mangimi' ? 'active' : ''}`}
            onClick={() => setActiveTab('mangimi')}
            style={{
              padding: '10px 20px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeTab === 'mangimi' ? 600 : 400,
              color: activeTab === 'mangimi' ? '#2563eb' : '#666',
              transition: 'all 0.2s ease'
            }}
          >
            Mangimi Confezionati ({mangimi.length})
          </button>
        </div>
        {activeTab === 'ingredienti' && (
          <button className="btn-primary" onClick={openNewComponente} style={{ marginRight: '0' }}>
            Nuovo Componente
          </button>
        )}
        {activeTab === 'mangimi' && (
          <button className="btn-primary" onClick={openNewMangime} style={{ marginRight: '0' }}>
            Nuovo Mangime
          </button>
        )}
      </div>

      {/* Componenti Alimentari Tab */}
      {activeTab === 'ingredienti' && (
        <section className="section-block">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Tipo</th>
                <th>Unità</th>
                <th>Costo</th>
                <th>Flag</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
                {componenti.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty-state">Nessun componente alimentare presente.</td>
                  </tr>
                ) : (
                  componenti.map(c => (
                <tr key={c.id}>
                  <td>{c.nome}</td>
                  <td>{c.tipo || '-'}</td>
                  <td>{c.unita_misura || '-'}</td>
                  <td>{formatMoney(c.costo_unitario)}</td>
                  <td>{c.autoprodotto ? 'Autoprod.' : ''} {c.per_svezzamento ? 'Svezz.' : ''} {c.per_ingrasso ? 'Ingr.' : ''}</td>
                  <td>
                    <button className="btn-icon" onClick={() => openEditComponente(c)} title="Modifica">✏️</button>
                    <button
                      className="btn-icon"
                      onClick={async () => {
                        if (confirm('Eliminare il componente?')) {
                          await alimentazioneService.deleteComponente(c.id);
                          await hydrateCatalogo({ force: true });
                          showToast('Componente eliminato');
                        }
                      }}
                      title="Elimina"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
                  ))
                )}
            </tbody>
          </table>
        </div>
      </section>
      )}

      {/* Mangimi Confezionati Tab */}
      {activeTab === 'mangimi' && (
      <section className="section-block">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Tipo</th>
                <th>Prezzo</th>
                <th>Unità</th>
                <th>Fattura</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
                {mangimi.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty-state">Nessun mangime confezionato presente.</td>
                  </tr>
                ) : (
                  mangimi.map(m => (
                <tr key={m.id}>
                  <td>{m.nome}</td>
                  <td>{m.tipo_allevamento || '-'}</td>
                  <td>{formatMoney(m.prezzo_unitario)}</td>
                  <td>{m.unita_misura || '-'}</td>
                  <td>{m.fattura_id ? (
                    <button className="btn-link" onClick={() => openFatturaDetails(m.fattura_id)} title="Dettaglio fattura">
                      {fattureMap[m.fattura_id]?.numero || m.fattura_id}
                    </button>
                  ) : '-'}</td>
                  <td>
                    <button className="btn-icon" onClick={() => openEditMangime(m)} title="Modifica">✏️</button>
                    <button
                      className="btn-icon"
                      onClick={async () => {
                        if (confirm('Eliminare il mangime?')) {
                          await alimentazioneService.deleteMangime(m.id);
                          await hydrateCatalogo({ force: true });
                          showToast('Mangime eliminato');
                        }
                      }}
                      title="Elimina"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
                  ))
                )}
            </tbody>
          </table>
        </div>
      </section>
      )}

      {/* Modal Componente */}
      <BaseModal
        isOpen={showCompModal}
        onClose={() => setShowCompModal(false)}
        title={editingComponenteId ? 'Modifica Componente' : 'Nuovo Componente'}
        size="large"
        footerActions={
          <>
            <button className="btn btn-secondary" onClick={() => setShowCompModal(false)}>Annulla</button>
            <button className="btn btn-primary" onClick={saveComponente} disabled={savingComponente}>{savingComponente ? 'Salvataggio...' : 'Salva'}</button>
          </>
        }
      >
        <div className="form-group">
          <label>Nome *</label>
          <input value={formComponente.nome} onChange={e => setFormComponente({ ...formComponente, nome: e.target.value })} required />
        </div>
        <div className="form-group">
          <label>Tipo</label>
          <input value={formComponente.tipo} onChange={e => setFormComponente({ ...formComponente, tipo: e.target.value })} />
        </div>
        <div className="form-grid">
          <div className="form-group span-6">
            <label>Unità</label>
            <input value={formComponente.unita_misura} onChange={e => setFormComponente({ ...formComponente, unita_misura: e.target.value })} />
          </div>
          <div className="form-group span-6">
            <label>Costo unitario</label>
            <input value={formComponente.costo_unitario} onChange={e => setFormComponente({ ...formComponente, costo_unitario: e.target.value })} />
          </div>
        </div>
        <div className="form-grid">
          <div className="form-group span-4">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                className={`toggle-button ${formComponente.autoprodotto ? 'active' : ''}`}
                onClick={() => setFormComponente({ ...formComponente, autoprodotto: !formComponente.autoprodotto })}
                aria-label="Autoprodotto"
              />
              <span>Autoprodotto</span>
            </label>
          </div>
          <div className="form-group span-4">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                className={`toggle-button ${formComponente.per_svezzamento ? 'active' : ''}`}
                onClick={() => setFormComponente({ ...formComponente, per_svezzamento: !formComponente.per_svezzamento })}
                aria-label="Per svezzamento"
              />
              <span>Per svezzamento</span>
            </label>
          </div>
          <div className="form-group span-4">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                className={`toggle-button ${formComponente.per_ingrasso ? 'active' : ''}`}
                onClick={() => setFormComponente({ ...formComponente, per_ingrasso: !formComponente.per_ingrasso })}
                aria-label="Per ingrasso"
              />
              <span>Per ingrasso</span>
            </label>
          </div>
        </div>
        <div className="form-group span-12">
          <label>Note</label>
          <textarea value={formComponente.note} onChange={e => setFormComponente({ ...formComponente, note: e.target.value })} rows="2" />
        </div>
      </BaseModal>

      {/* Modal Mangime */}
      <BaseModal
        isOpen={showMangimeModal}
        onClose={() => setShowMangimeModal(false)}
        title={editingMangimeId ? 'Modifica Mangime' : 'Nuovo Mangime'}
        size="large"
        footerActions={
          <>
            <button className="btn btn-secondary" onClick={() => setShowMangimeModal(false)}>Annulla</button>
            <button className="btn btn-primary" onClick={saveMangime} disabled={savingMangime}>{savingMangime ? 'Salvataggio...' : 'Salva'}</button>
          </>
        }
      >
        <div className="form-group">
          <label>Nome *</label>
          <input value={formMangime.nome} onChange={e => setFormMangime({ ...formMangime, nome: e.target.value })} required />
        </div>
        <div className="form-grid">
          <div className="form-group span-6">
            <label>Tipo allevamento</label>
            <input value={formMangime.tipo_allevamento} onChange={e => setFormMangime({ ...formMangime, tipo_allevamento: e.target.value })} />
          </div>
          <div className="form-group span-6">
            <label>Prezzo unitario</label>
            <input value={formMangime.prezzo_unitario} onChange={e => setFormMangime({ ...formMangime, prezzo_unitario: e.target.value })} />
          </div>
        </div>
        <div className="form-group">
          <label>Unità</label>
          <input value={formMangime.unita_misura} onChange={e => setFormMangime({ ...formMangime, unita_misura: e.target.value })} />
        </div>
      </BaseModal>

      <BaseModal
        isOpen={!!fatturaModal}
        onClose={() => setFatturaModal(null)}
        title="Dettaglio Fattura"
        size="medium"
        footerActions={
          <>
            <button className="btn btn-secondary" onClick={() => setFatturaModal(null)}>Chiudi</button>
            <button className="btn btn-primary" onClick={() => { window.location.hash = `#/amministrazione?tab=fatture&id=${fatturaModal.id}`; }}>Apri in Amministrazione</button>
          </>
        }
      >
        {fatturaModal && (
          <>
            <p><strong>Numero:</strong> {fatturaModal.numero}</p>
            <p><strong>Data:</strong> {formatDate(fatturaModal.data)}</p>
            <p><strong>Importo:</strong> {formatMoney(fatturaModal.importo)}</p>
            <p><strong>Note:</strong> {fatturaModal.note || '-'}</p>
          </>
        )}
      </BaseModal>

      {toast && (
        <div className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>{toast.message}</div>
      )}
    </div>
  );
};

export default Catalogo;
