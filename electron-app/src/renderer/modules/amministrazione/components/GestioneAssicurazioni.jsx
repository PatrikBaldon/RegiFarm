/**
 * GestioneAssicurazioni - Gestione assicurazioni aziendali
 */
import React, { useState, useEffect } from 'react';
import SearchableSelect from '../../../components/SearchableSelect';
import { amministrazioneService } from '../services/amministrazioneService';
import { useAzienda } from '../../../context/AziendaContext';
import '../../alimentazione/components/Alimentazione.css';
import './GestioneAssicurazioni.css';

const TIPI_ASSICURAZIONE = [
  { value: 'rc_professionale', label: 'RC Professionale' },
  { value: 'rc_strumentale', label: 'RC Strumentale' },
  { value: 'infortuni', label: 'Infortuni' },
  { value: 'malattia', label: 'Malattia' },
  { value: 'incendio', label: 'Incendio' },
  { value: 'furto', label: 'Furto' },
  { value: 'grandine', label: 'Grandine' },
  { value: 'multirischio', label: 'Multirischio' },
  { value: 'altro', label: 'Altro' },
];

const GestioneAssicurazioni = () => {
  const [assicurazioni, setAssicurazioni] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedAssicurazione, setSelectedAssicurazione] = useState(null);
  const [formData, setFormData] = useState({
    azienda_id: null,
    tipo: 'multirischio',
    numero_polizza: '',
    compagnia: '',
    data_inizio: new Date().toISOString().split('T')[0],
    data_scadenza: '',
    premio_annuale: '',
    importo_assicurato: '',
    numero_rate: 1,
    data_prossimo_pagamento: '',
    attiva: true,
    note: '',
  });

  const { azienda, loading: aziendaLoading } = useAzienda();
  const aziendaId = azienda?.id;
  const canOperate = Boolean(aziendaId);

  useEffect(() => {
    if (!aziendaId) return;
    setFormData((prev) => ({
      ...prev,
      azienda_id: prev.azienda_id ?? aziendaId,
    }));
    loadData(aziendaId);
  }, [aziendaId]);

  const loadData = async (id) => {
    if (!id) return;
    setLoading(true);
    try {
      const assicurazioniData = await amministrazioneService.getAssicurazioniAziendali(id);
      setAssicurazioni(assicurazioniData);
    } catch (error) {

      alert('Errore nel caricamento dei dati');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!aziendaId) {
      alert('Configura l\'azienda prima di registrare un\'assicurazione.');
      return;
    }
    try {
      const dataToSend = {
        ...formData,
        azienda_id: aziendaId,
        premio_annuale: parseFloat(formData.premio_annuale),
        importo_assicurato: formData.importo_assicurato ? parseFloat(formData.importo_assicurato) : null,
        numero_rate: parseInt(formData.numero_rate),
        data_prossimo_pagamento: formData.data_prossimo_pagamento || null,
      };

      if (selectedAssicurazione) {
        await amministrazioneService.updateAssicurazioneAziendale(selectedAssicurazione.id, dataToSend);
      } else {
        await amministrazioneService.createAssicurazioneAziendale(dataToSend);
      }
      setShowModal(false);
      resetForm();
      loadData(aziendaId);
    } catch (error) {

      alert('Errore nel salvataggio');
    }
  };

  const handleEdit = (assicurazione) => {
    setSelectedAssicurazione(assicurazione);
    setFormData({
      ...assicurazione,
      data_inizio: assicurazione.data_inizio.split('T')[0],
      data_scadenza: assicurazione.data_scadenza.split('T')[0],
      data_prossimo_pagamento: assicurazione.data_prossimo_pagamento ? assicurazione.data_prossimo_pagamento.split('T')[0] : '',
      premio_annuale: assicurazione.premio_annuale.toString(),
      importo_assicurato: assicurazione.importo_assicurato?.toString() || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Sei sicuro di voler eliminare questa assicurazione?')) return;
    
    try {
      await amministrazioneService.deleteAssicurazioneAziendale(id);
      loadData(aziendaId);
    } catch (error) {

      alert('Errore nell\'eliminazione');
    }
  };

  const resetForm = () => {
    setFormData({
      azienda_id: aziendaId || null,
      tipo: 'multirischio',
      numero_polizza: '',
      compagnia: '',
      data_inizio: new Date().toISOString().split('T')[0],
      data_scadenza: '',
      premio_annuale: '',
      importo_assicurato: '',
      numero_rate: 1,
      data_prossimo_pagamento: '',
      attiva: true,
      note: '',
    });
    setSelectedAssicurazione(null);
  };

  const isScaduta = (dataScadenza) => {
    return new Date(dataScadenza) < new Date();
  };

  const giorniAllaScadenza = (dataScadenza) => {
    const oggi = new Date();
    const scadenza = new Date(dataScadenza);
    const diffTime = scadenza - oggi;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className="gestione-assicurazioni">
      <div className="header-actions">
        <button
          className="btn btn-primary"
          onClick={() => { resetForm(); setShowModal(true); }}
          disabled={!canOperate}
          style={!canOperate ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
        >
          Nuova Assicurazione
        </button>
      </div>

      {!canOperate ? (
        <div className="empty-state">
          Configura l&apos;azienda nelle impostazioni per gestire le assicurazioni.
        </div>
      ) : (
        <>
          {loading ? (
            <div className="loading">Caricamento...</div>
          ) : (
            <div className="table-container">
              <table className="data-table">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Numero Polizza</th>
              <th>Compagnia</th>
              <th>Data Inizio</th>
              <th>Data Scadenza</th>
              <th>Premio Annuale</th>
              <th>Stato</th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
                  {assicurazioni.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="empty-state">
                        Nessuna assicurazione trovata
                      </td>
                    </tr>
                  ) : (
                    assicurazioni.map(assicurazione => {
              const scaduta = isScaduta(assicurazione.data_scadenza);
              const giorni = giorniAllaScadenza(assicurazione.data_scadenza);
              return (
                <tr key={assicurazione.id} className={scaduta ? 'row-expired' : giorni <= 30 ? 'row-warning' : ''}>
                  <td>{assicurazione.tipo}</td>
                  <td>{assicurazione.numero_polizza}</td>
                  <td>{assicurazione.compagnia}</td>
                  <td>{new Date(assicurazione.data_inizio).toLocaleDateString('it-IT')}</td>
                  <td>
                    {new Date(assicurazione.data_scadenza).toLocaleDateString('it-IT')}
                    {scaduta && <span className="badge badge-danger ml-2">SCADUTA</span>}
                    {!scaduta && giorni <= 30 && <span className="badge badge-warning ml-2">{giorni} giorni</span>}
                  </td>
                  <td>€{parseFloat(assicurazione.premio_annuale).toFixed(2)}</td>
                  <td>
                    <span className={`badge ${assicurazione.attiva ? 'badge-success' : 'badge-secondary'}`}>
                      {assicurazione.attiva ? 'Attiva' : 'Inattiva'}
                    </span>
                  </td>
                  <td>
                    <button className="btn-icon" onClick={() => handleEdit(assicurazione)} title="Modifica">✏️</button>
                    <button className="btn-icon" onClick={() => handleDelete(assicurazione.id)} title="Elimina">🗑️</button>
                  </td>
                </tr>
              );
                    })
                  )}
          </tbody>
        </table>
            </div>
          )}
        </>
      )}

      {showModal && (
        <div className="modal">
          <div className="modal-content large">
            <div className="modal-header">
              <h3>{selectedAssicurazione ? 'Modifica Assicurazione' : 'Nuova Assicurazione'}</h3>
              <button className="close-button" onClick={() => { setShowModal(false); resetForm(); }}>
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Tipo *</label>
                  <SearchableSelect
                    className="select-compact"
                    options={TIPI_ASSICURAZIONE}
                    value={formData.tipo}
                    onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                    displayField="label"
                    valueField="value"
                    required
                    placeholder="Seleziona tipo"
                  />
                </div>
                <div className="form-group">
                  <label>Numero Polizza *</label>
                  <input
                    type="text"
                    value={formData.numero_polizza}
                    onChange={(e) => setFormData({ ...formData, numero_polizza: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Compagnia Assicurativa *</label>
                <input
                  type="text"
                  value={formData.compagnia}
                  onChange={(e) => setFormData({ ...formData, compagnia: e.target.value })}
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Data Inizio *</label>
                  <input
                    type="date"
                    value={formData.data_inizio}
                    onChange={(e) => setFormData({ ...formData, data_inizio: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Data Scadenza *</label>
                  <input
                    type="date"
                    value={formData.data_scadenza}
                    onChange={(e) => setFormData({ ...formData, data_scadenza: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Premio Annuale (€) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.premio_annuale}
                    onChange={(e) => setFormData({ ...formData, premio_annuale: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Importo Assicurato (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.importo_assicurato}
                    onChange={(e) => setFormData({ ...formData, importo_assicurato: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Numero Rate</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.numero_rate}
                    onChange={(e) => setFormData({ ...formData, numero_rate: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div className="form-group">
                  <label>Data Prossimo Pagamento</label>
                  <input
                    type="date"
                    value={formData.data_prossimo_pagamento}
                    onChange={(e) => setFormData({ ...formData, data_prossimo_pagamento: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.attiva}
                      onChange={(e) => setFormData({ ...formData, attiva: e.target.checked })}
                    />
                    Attiva
                  </label>
                </div>
              </div>
              <div className="form-group">
                <label>Note</label>
                <textarea
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">Salva</button>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowModal(false); resetForm(); }}>
                  Annulla
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestioneAssicurazioni;

