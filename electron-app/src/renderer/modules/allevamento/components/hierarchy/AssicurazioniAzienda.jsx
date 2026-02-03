/**
 * AssicurazioniAzienda - Gestione assicurazioni aziendali nell'anagrafica azienda
 */
import React, { useState, useEffect } from 'react';
import SearchableSelect from '../../../../components/SearchableSelect';
import BaseModal from '../../../../components/BaseModal';
import { amministrazioneService } from '../../../amministrazione/services/amministrazioneService';
import './AssicurazioniAzienda.css';

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

const AssicurazioniAzienda = ({ aziendaId }) => {
  const [assicurazioni, setAssicurazioni] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedAssicurazione, setSelectedAssicurazione] = useState(null);
  const [formData, setFormData] = useState({
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

  useEffect(() => {
    if (aziendaId) {
      loadData();
    }
  }, [aziendaId]);

  // Listener per eventi di notifiche
  useEffect(() => {
    const handleOpenNotificationRecord = async (event) => {
      const { tipo, id, modulo } = event.detail;
      
      // Se la notifica è per questo componente (assicurazione aziendale)
      if (modulo === 'allevamento' && tipo === 'assicurazione_aziendale' && id) {
        try {
          // Carica l'assicurazione e aprilo in modale
          const assicurazione = await amministrazioneService.getAssicurazioneAziendale(id);
          if (assicurazione) {
            handleEdit(assicurazione);
          }
        } catch (error) {
          console.error('Errore nel caricamento assicurazione:', error);
          alert('Impossibile aprire l\'assicurazione');
        }
      }
    };

    window.addEventListener('openNotificationRecord', handleOpenNotificationRecord);
    return () => {
      window.removeEventListener('openNotificationRecord', handleOpenNotificationRecord);
    };
  }, [aziendaId]);

  const loadData = async () => {
    if (!aziendaId) return;
    setLoading(true);
    try {
      const assicurazioniData = await amministrazioneService.getAssicurazioniAziendali(aziendaId);
      setAssicurazioni(assicurazioniData || []);
    } catch (error) {

    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
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
      loadData();
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
      loadData();
    } catch (error) {

      alert('Errore nell\'eliminazione');
    }
  };

  const resetForm = () => {
    setFormData({
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

  if (!aziendaId) return null;

  const handleCloseModal = () => {
    setShowModal(false);
    resetForm();
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    handleSubmit(e);
  };

  const handleSaveClick = () => {
    // Crea un evento fittizio per handleSubmit
    const fakeEvent = { preventDefault: () => {} };
    handleSubmit(fakeEvent);
  };

  return (
    <>
      <div className="assicurazioni-azienda">
        <div className="section-header">
          <h3>Assicurazioni Aziendali</h3>
          <button 
            type="button"
            className="btn btn-sm btn-primary" 
            onClick={(e) => { 
              e.preventDefault();
              e.stopPropagation();
              resetForm(); 
              setShowModal(true); 
            }}
          >
            Aggiungi Assicurazione
          </button>
        </div>

        {loading ? (
          <div>Caricamento...</div>
        ) : assicurazioni.length === 0 ? (
          <div className="empty-state">
            <p>Nessuna assicurazione presente</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Numero Polizza</th>
                  <th>Compagnia</th>
                  <th>Data Scadenza</th>
                  <th>Premio Annuale</th>
                  <th>Stato</th>
                  <th>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {assicurazioni.map(assicurazione => {
                  const scaduta = isScaduta(assicurazione.data_scadenza);
                  const giorni = giorniAllaScadenza(assicurazione.data_scadenza);
                  return (
                    <tr key={assicurazione.id} className={scaduta ? 'row-expired' : giorni <= 30 ? 'row-warning' : ''}>
                      <td>{assicurazione.tipo}</td>
                      <td>{assicurazione.numero_polizza}</td>
                      <td>{assicurazione.compagnia}</td>
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
                        <button 
                          type="button"
                          className="btn-icon" 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleEdit(assicurazione);
                          }} 
                          title="Modifica"
                        >
                          Modifica
                        </button>
        <button 
                          type="button"
                          className="btn-icon btn-danger" 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDelete(assicurazione.id);
                          }} 
                          title="Elimina"
                        >
                          Elimina
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <BaseModal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={selectedAssicurazione ? 'Modifica Assicurazione' : 'Nuova Assicurazione'}
        size="large"
        footerActions={
          <>
            <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>
              Annulla
            </button>
            <button type="button" className="btn btn-primary" onClick={handleSaveClick}>
              Salva
        </button>
          </>
        }
      >
        <form onSubmit={handleFormSubmit}>
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
                placeholder="Seleziona tipologia"
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
        </form>
      </BaseModal>
    </>
  );
};

export default AssicurazioniAzienda;

