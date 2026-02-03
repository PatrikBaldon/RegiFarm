import React, { useState, useEffect, useCallback } from 'react';
import './Alimentazione.css';
import SearchableSelect from '../../../components/SearchableSelect';
import BaseModal from '../../../components/BaseModal';
import { alimentazioneService } from '../services/alimentazioneService';
import { amministrazioneService } from '../../amministrazione/services/amministrazioneService';
import { useAzienda } from '../../../context/AziendaContext';
import { useRequest } from '../../../context/RequestContext';

const DDT = () => {
  const { azienda } = useAzienda();
  const { isActive } = useRequest();
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState({ data: '', numero: '', fornitore: '', voce_tipo: 'componente', voce_id: '', quantita: '', unita: 'kg', note: '' });
  const [ddtList, setDdtList] = useState([]);
  const [loading, setLoading] = useState(false);

  const VOCE_TIPO_OPTIONS = [
    { value: 'componente', label: 'Componente' },
    { value: 'mangime', label: 'Mangime' },
  ];
  
  // Stati per dropdown searchable
  const [fornitori, setFornitori] = useState([]);
  const [componenti, setComponenti] = useState([]);
  const [mangimi, setMangimi] = useState([]);

  function showToast(message, type = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  }

  // Carica lista DDT
  const loadDdtList = useCallback(async (force = false) => {
    // Se i dati sono già nello state e non è forzato, non ricaricare
    if (!force && ddtList.length > 0) {
      return;
    }

    setLoading(true);
    try {
      const data = await alimentazioneService.getDdt();
      setDdtList(Array.isArray(data) ? data : []);
    } catch (err) {

      setDdtList([]);
    } finally {
      setLoading(false);
    }
  }, [ddtList.length]);

  // Carica dati quando si apre la modale
  useEffect(() => {
    if (showModal) {
      loadFornitori();
      loadComponenti();
      loadMangimi();
    }
  }, [showModal]);

  // Carica lista DDT all'avvio e dopo il salvataggio
  useEffect(() => {
    loadDdtList();
  }, [loadDdtList]);

  const loadFornitori = async () => {
    try {
      const data = await amministrazioneService.getFornitori();
      setFornitori(data || []);
    } catch (err) {

      setFornitori([]);
    }
  };

  const loadComponenti = async () => {
    try {
      const data = await alimentazioneService.getComponenti();
      setComponenti(data || []);
    } catch (err) {

      setComponenti([]);
    }
  };

  const loadMangimi = async () => {
    try {
      const data = await alimentazioneService.getMangimi();
      setMangimi(data || []);
    } catch (err) {

      setMangimi([]);
    }
  };

  // Seleziona fornitore
  const selectFornitore = (fornitore) => {
    setForm({ ...form, fornitore: fornitore.id.toString() });
  };

  // Seleziona componente/mangime
  const selectVoce = (voce) => {
    setForm({ ...form, voce_id: voce.id.toString() });
  };

  // Reset quando cambia tipo voce
  useEffect(() => {
    setForm({ ...form, voce_id: '' });
  }, [form.voce_tipo]);

  async function submit() {
    if (!form.data || !form.numero || !form.quantita || !form.voce_id) {
      showToast('Compila i campi obbligatori', 'error');
      return;
    }

    if (!azienda?.id) {
      showToast('Nessuna azienda selezionata', 'error');
      return;
    }

    setSaving(true);
    try {
      // 1) Crea DDT
      const ddt = await alimentazioneService.createDdt({
        azienda_id: azienda.id,
        data: form.data,
        numero: form.numero,
        fornitore_id: form.fornitore ? Number(form.fornitore) : undefined,
        note: form.note || undefined,
      });

      // 2) Crea riga DDT
      const rigaPayload = {
        ddt_id: ddt.id,
        componente_alimentare_id: form.voce_tipo === 'componente' ? Number(form.voce_id) : undefined,
        mangime_confezionato_id: form.voce_tipo === 'mangime' ? Number(form.voce_id) : undefined,
        quantita: Number(form.quantita),
        unita_misura: form.unita || 'kg',
        note: form.note || undefined,
      };
      const riga = await alimentazioneService.createDdtRiga(rigaPayload);

      // 3) Registra movimento di carico collegato alla riga DDT
      await alimentazioneService.createMovimento({
        azienda_id: azienda.id,
        data: form.data,
        tipo: 'carico',
        componente_alimentare_id: riga.componente_alimentare_id || undefined,
        mangime_confezionato_id: riga.mangime_confezionato_id || undefined,
        quantita: Number(form.quantita),
        unita_misura: form.unita || 'kg',
        causale: 'DDT',
        ddt_riga_id: riga.id,
        note: form.note || undefined,
      });

      showToast('DDT registrato');
      setShowModal(false);
      setForm({ data: '', numero: '', fornitore: '', voce_tipo: 'componente', voce_id: '', quantita: '', unita: 'kg', note: '' });
      await loadDdtList(true); // Ricarica la lista dopo il salvataggio (forzato)
    } catch (err) {

      showToast(err.message || 'Errore durante il salvataggio', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="alimentazione-section">
      <div className="section-header" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <h3>DDT - Carico Ingredienti/Mangimi</h3>
        <button className="btn-primary" onClick={() => setShowModal(true)}>Registra DDT</button>
      </div>

      {loading && <div className="loading">Caricamento...</div>}

      {!loading && (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Numero DDT</th>
                <th>Fornitore</th>
                <th>Note</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {ddtList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-state">Nessun DDT registrato.</td>
                </tr>
              ) : (
                ddtList.map(ddt => (
                  <tr key={ddt.id}>
                    <td>{ddt.data ? new Date(ddt.data).toLocaleDateString('it-IT') : '-'}</td>
                    <td>{ddt.numero || '-'}</td>
                    <td>{ddt.fornitore?.nome || ddt.fornitore_id || '-'}</td>
                    <td>{ddt.note || '—'}</td>
                    <td>
                      <button className="btn-icon" onClick={() => {/* TODO: implementare visualizzazione dettagli */}} title="Dettagli">👁️</button>
                      <button className="btn-icon" onClick={async () => {
                        if (confirm('Eliminare il DDT?')) {
                          try {
                            await alimentazioneService.deleteDdt(ddt.id);
                            showToast('DDT eliminato');
                            await loadDdtList(true); // Ricarica la lista dopo l'eliminazione (forzato)
                          } catch (err) {
                            showToast('Errore durante l\'eliminazione', 'error');
                          }
                        }
                      }} title="Elimina">🗑️</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <BaseModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setForm({ data: '', numero: '', fornitore: '', voce_tipo: 'componente', voce_id: '', quantita: '', unita: 'kg', note: '' });
        }}
        title="Nuovo DDT"
        size="large"
        footerActions={
          <>
            <button className="btn btn-secondary" onClick={() => {
              setShowModal(false);
              setForm({ data: '', numero: '', fornitore: '', voce_tipo: 'componente', voce_id: '', quantita: '', unita: 'kg', note: '' });
            }}>Annulla</button>
            <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Salvataggio...' : 'Salva'}</button>
          </>
        }
      >
              <div className="form-row">
                <div className="form-group">
                  <label>Data *</label>
                  <input type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Numero DDT *</label>
                  <input value={form.numero} onChange={e => setForm({ ...form, numero: e.target.value })} required />
                </div>
              </div>
              <div className="form-group">
                <label>Fornitore</label>
                <SearchableSelect
                  options={fornitori}
                  value={form.fornitore ? String(form.fornitore) : ''}
                  onChange={(e) => {
                    const fornitoreId = e.target.value;
                    const fornitore = fornitori.find(f => String(f.id) === String(fornitoreId));
                    if (fornitore) {
                      selectFornitore(fornitore);
                    }
                  }}
                  placeholder="Cerca fornitore..."
                  displayField="nome"
                  valueField="id"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Tipo voce</label>
                  <SearchableSelect
                    className="select-compact"
                    options={VOCE_TIPO_OPTIONS}
                    value={form.voce_tipo}
                    onChange={(e) => setForm({ ...form, voce_tipo: e.target.value })}
                    displayField="label"
                    valueField="value"
                    placeholder="Seleziona tipologia"
                  />
                </div>
                <div className="form-group">
                  <label>{form.voce_tipo === 'componente' ? 'Componente' : 'Mangime'} *</label>
                  <SearchableSelect
                    options={form.voce_tipo === 'componente' ? componenti : mangimi}
                    value={form.voce_id ? String(form.voce_id) : ''}
                    onChange={(e) => {
                      const voceId = e.target.value;
                      const voce = (form.voce_tipo === 'componente' ? componenti : mangimi).find(v => String(v.id) === String(voceId));
                      if (voce) {
                        selectVoce(voce);
                      }
                    }}
                    placeholder={`Cerca ${form.voce_tipo === 'componente' ? 'componente' : 'mangime'}...`}
                    displayField="nome"
                    valueField="id"
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Quantità *</label>
                  <input value={form.quantita} onChange={e => setForm({ ...form, quantita: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Unità</label>
                  <input value={form.unita} onChange={e => setForm({ ...form, unita: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label>Note</label>
                <input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
              </div>
      </BaseModal>

      {toast && (
        <div className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>{toast.message}</div>
      )}
    </div>
  );
};

export default DDT;
