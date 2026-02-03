/**
 * GestionePolizze - Gestione polizze attrezzature
 */
import React, { useState, useEffect, useMemo, useImperativeHandle, forwardRef } from 'react';
import { amministrazioneService } from '../../amministrazione/services/amministrazioneService';
import { attrezzaturaService } from '../services/attrezzaturaService';
import SmartSelect from '../../../components/SmartSelect';
import BaseModal from '../../../components/BaseModal';
import { useAzienda } from '../../../context/AziendaContext';
import '../../alimentazione/components/Alimentazione.css';
import './GestionePolizze.css';

const TIPI_POLIZZA = [
  { value: 'rc', label: 'RC (Responsabilità Civile)' },
  { value: 'furto', label: 'Furto' },
  { value: 'incendio', label: 'Incendio' },
  { value: 'kasko', label: 'Kasko' },
  { value: 'altro', label: 'Altro' },
];


const TODAY = new Date().toISOString().split('T')[0];

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('it-IT');
};

const formatCurrency = (value) => {
  if (!value) return '€ 0,00';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(num);
};

const GestionePolizze = forwardRef((props, ref) => {
  const { azienda } = useAzienda();
  const aziendaId = azienda?.id;

  const [polizze, setPolizze] = useState([]);
  const [attrezzature, setAttrezzature] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showRinnovoModal, setShowRinnovoModal] = useState(false);
  const [selectedPolizza, setSelectedPolizza] = useState(null);
  const [selectedPolizzaForRinnovo, setSelectedPolizzaForRinnovo] = useState(null);
  const [polizzaDetails, setPolizzaDetails] = useState(null);

  const [formData, setFormData] = useState({
    azienda_id: aziendaId,
    attrezzatura_id: '',
    tipo_polizza: 'rca',
    numero_polizza: '',
    compagnia: '',
    data_inizio: TODAY,
    data_scadenza: '',
    premio_annuale: '',
    numero_rate: 1,
    data_prossimo_pagamento: '',
    importo_assicurato: '',
    coperture: [],
    note: '',
    attiva: true,
  });

  const [formDataRinnovo, setFormDataRinnovo] = useState({
    data_rinnovo: TODAY,
    nuovo_premio_annuale: '',
    cambiamenti_copertura: '',
    note: '',
  });

  useEffect(() => {
    if (aziendaId) {
      loadPolizze();
      loadAttrezzature();
    }
  }, [aziendaId]);

  const loadPolizze = async () => {
    if (!aziendaId) return;
    try {
      setLoading(true);
      const data = await amministrazioneService.getPolizzeAttrezzature({
        azienda_id: aziendaId,
      });
      setPolizze(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Errore nel caricamento polizze:', error);
      setPolizze([]);
    } finally {
      setLoading(false);
    }
  };

  const loadAttrezzature = async () => {
    if (!aziendaId) return;
    try {
      const data = await attrezzaturaService.getAttrezzature({ azienda_id: aziendaId });
      setAttrezzature(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Errore nel caricamento attrezzature:', error);
      setAttrezzature([]);
    }
  };

  const loadPolizzaDetails = async (polizzaId) => {
    try {
      const polizza = await amministrazioneService.getPolizzaAttrezzatura(polizzaId);
      const pagamenti = await amministrazioneService.getPolizzaPagamenti(polizzaId);
      const rinnovi = await amministrazioneService.getPolizzaRinnovi(polizzaId);
      setPolizzaDetails({
        ...polizza,
        pagamenti: pagamenti || [],
        rinnovi: rinnovi || [],
      });
    } catch (error) {
      console.error('Errore nel caricamento dettagli polizza:', error);
      alert('Errore nel caricamento dei dettagli della polizza');
    }
  };

  const resetForm = () => {
    setFormData({
      azienda_id: aziendaId,
      attrezzatura_id: '',
      tipo_polizza: 'rca',
      numero_polizza: '',
      compagnia: '',
      data_inizio: TODAY,
      data_scadenza: '',
      premio_annuale: '',
      numero_rate: 1,
      data_prossimo_pagamento: '',
      importo_assicurato: '',
      coperture: [],
      note: '',
      attiva: true,
    });
    setSelectedPolizza(null);
  };

  const resetFormRinnovo = () => {
    setFormDataRinnovo({
      data_rinnovo: TODAY,
      nuovo_premio_annuale: '',
      cambiamenti_copertura: '',
      note: '',
    });
    setSelectedPolizzaForRinnovo(null);
  };

  const handleEdit = (polizza) => {
    setSelectedPolizza(polizza);
    setFormData({
      azienda_id: polizza.azienda_id,
      attrezzatura_id: String(polizza.attrezzatura_id),
      tipo_polizza: polizza.tipo_polizza || 'rca',
      numero_polizza: polizza.numero_polizza || '',
      compagnia: polizza.compagnia || '',
      data_inizio: polizza.data_inizio || TODAY,
      data_scadenza: polizza.data_scadenza || '',
      premio_annuale: polizza.premio_annuale || '',
      numero_rate: polizza.numero_rate || 1,
      data_prossimo_pagamento: polizza.data_prossimo_pagamento || '',
      importo_assicurato: polizza.importo_assicurato || '',
      coperture: Array.isArray(polizza.coperture) ? polizza.coperture : (polizza.coperture ? [polizza.coperture] : []),
      note: polizza.note || '',
      attiva: polizza.attiva !== false,
    });
    setShowModal(true);
  };

  const handleRinnovo = (polizza) => {
    setSelectedPolizzaForRinnovo(polizza);
    setFormDataRinnovo({
      data_rinnovo: TODAY,
      nuovo_premio_annuale: polizza.premio_annuale || '',
      cambiamenti_copertura: '',
      note: '',
    });
    setShowRinnovoModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const payload = {
        ...formData,
        azienda_id: aziendaId,
        attrezzatura_id: parseInt(formData.attrezzatura_id),
        premio_annuale: parseFloat(formData.premio_annuale) || 0,
        numero_rate: parseInt(formData.numero_rate) || 1,
        importo_assicurato: formData.importo_assicurato ? parseFloat(formData.importo_assicurato) : null,
        data_prossimo_pagamento: formData.data_prossimo_pagamento || null,
        coperture: Array.isArray(formData.coperture) ? formData.coperture : (formData.coperture ? [formData.coperture] : []),
      };

      if (selectedPolizza) {
        await amministrazioneService.updatePolizzaAttrezzatura(selectedPolizza.id, payload);
      } else {
        await amministrazioneService.createPolizzaAttrezzatura(payload);
      }

      await loadPolizze();
      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error('Errore nel salvataggio polizza:', error);
      alert('Errore nel salvataggio della polizza: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRinnovo = async (e) => {
    e.preventDefault();
    if (!selectedPolizzaForRinnovo) return;

    try {
      setLoading(true);
      const payload = {
        ...formDataRinnovo,
        nuovo_premio_annuale: parseFloat(formDataRinnovo.nuovo_premio_annuale) || 0,
      };

      await amministrazioneService.createPolizzaRinnovo(selectedPolizzaForRinnovo.id, payload);
      
      // Aggiorna la polizza con il nuovo premio e le nuove date se specificate
      const updateData = {
        premio_annuale: payload.nuovo_premio_annuale,
      };
      if (formDataRinnovo.nuova_data_inizio) {
        updateData.data_inizio = formDataRinnovo.nuova_data_inizio;
      }
      if (formDataRinnovo.nuova_data_scadenza) {
        updateData.data_scadenza = formDataRinnovo.nuova_data_scadenza;
      }
      if (formDataRinnovo.coperture_nuove && formDataRinnovo.coperture_nuove.length > 0) {
        updateData.coperture = formDataRinnovo.coperture_nuove;
      }

      await amministrazioneService.updatePolizzaAttrezzatura(selectedPolizzaForRinnovo.id, updateData);

      await loadPolizze();
      setShowRinnovoModal(false);
      resetFormRinnovo();
    } catch (error) {
      console.error('Errore nel rinnovo polizza:', error);
      alert('Errore nel rinnovo della polizza: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (polizza) => {
    if (!confirm('Sei sicuro di voler eliminare questa polizza?')) return;

    try {
      setLoading(true);
      await amministrazioneService.deletePolizzaAttrezzatura(polizza.id);
      await loadPolizze();
    } catch (error) {
      console.error('Errore nell\'eliminazione polizza:', error);
      alert('Errore nell\'eliminazione della polizza: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (polizza) => {
    await loadPolizzaDetails(polizza.id);
  };

  const attrezzaturaOptions = useMemo(() => {
    return attrezzature.map((att) => ({
      value: String(att.id),
      label: `${att.nome}${att.targa ? ` - ${att.targa}` : ''}`,
    }));
  }, [attrezzature]);

  // Filtra polizze per scadenza (30 giorni)
  const polizzeInScadenza = useMemo(() => {
    const oggi = new Date();
    const scadenza30g = new Date();
    scadenza30g.setDate(oggi.getDate() + 30);
    
    return polizze.filter((p) => {
      if (!p.attiva || !p.data_scadenza) return false;
      const scadenza = new Date(p.data_scadenza);
      return scadenza >= oggi && scadenza <= scadenza30g;
    });
  }, [polizze]);

  const polizzeScadute = useMemo(() => {
    const oggi = new Date();
    return polizze.filter((p) => {
      if (!p.attiva || !p.data_scadenza) return false;
      const scadenza = new Date(p.data_scadenza);
      return scadenza < oggi;
    });
  }, [polizze]);

  // Espone metodi pubblici tramite ref
  useImperativeHandle(ref, () => ({
    openPolizza: async (polizzaId) => {
      try {
        // Carica la polizza completa
        const polizza = await amministrazioneService.getPolizzaAttrezzatura(polizzaId);
        if (polizza) {
          handleEdit(polizza);
        }
      } catch (error) {
        console.error('Errore nel caricamento polizza:', error);
        alert('Impossibile aprire la polizza');
      }
    }
  }));

  if (!aziendaId) {
    return <div className="empty-state">Seleziona un'azienda per visualizzare le polizze</div>;
  }

  return (
    <div className="gestione-polizze-container">
      <div className="page-header">
        <h2>Gestione Polizze Attrezzature</h2>
        <button
          className="btn btn-primary"
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          disabled={loading}
        >
          Nuova Polizza
        </button>
      </div>

      {/* Alert per polizze in scadenza */}
      {polizzeInScadenza.length > 0 && (
        <div className="alert alert-warning">
          <strong>Attenzione:</strong> {polizzeInScadenza.length} polizza/e in scadenza nei prossimi 30 giorni
        </div>
      )}

      {polizzeScadute.length > 0 && (
        <div className="alert alert-danger">
          <strong>Attenzione:</strong> {polizzeScadute.length} polizza/e scaduta/e
        </div>
      )}

      {loading && polizze.length === 0 ? (
        <div className="loading">Caricamento polizze...</div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Attrezzatura</th>
                <th>Numero Polizza</th>
                <th>Compagnia</th>
                <th>Data Inizio</th>
                <th>Data Scadenza</th>
                <th>Premio Annuale</th>
                <th>Rate</th>
                <th>Stato</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {polizze.length === 0 ? (
                <tr>
                  <td colSpan="9" className="empty-state">
                    Nessuna polizza registrata
                  </td>
                </tr>
              ) : (
                polizze.map((polizza) => {
                  const attrezzatura = attrezzature.find((a) => a.id === polizza.attrezzatura_id);
                  const scadenza = polizza.data_scadenza ? new Date(polizza.data_scadenza) : null;
                  const oggi = new Date();
                  const giorniAllaScadenza = scadenza ? Math.ceil((scadenza - oggi) / (1000 * 60 * 60 * 24)) : null;
                  const isScaduta = scadenza && scadenza < oggi;
                  const isInScadenza = scadenza && scadenza >= oggi && giorniAllaScadenza <= 30;

                  return (
                    <tr key={polizza.id} className={isScaduta ? 'row-scaduta' : isInScadenza ? 'row-in-scadenza' : ''}>
                      <td>{attrezzatura?.nome || `ID ${polizza.attrezzatura_id}`}</td>
                      <td>{polizza.numero_polizza}</td>
                      <td>{polizza.compagnia}</td>
                      <td>{formatDate(polizza.data_inizio)}</td>
                      <td>
                        {formatDate(polizza.data_scadenza)}
                        {isInScadenza && (
                          <span className="badge badge-warning" style={{ marginLeft: '8px' }}>
                            {giorniAllaScadenza} giorni
                          </span>
                        )}
                        {isScaduta && (
                          <span className="badge badge-danger" style={{ marginLeft: '8px' }}>
                            Scaduta
                          </span>
                        )}
                      </td>
                      <td>{formatCurrency(polizza.premio_annuale)}</td>
                      <td>{polizza.numero_rate || 1}</td>
                      <td>
                        <button
                          type="button"
                          className={`toggle-button ${polizza.attiva ? 'active' : ''}`}
                          onClick={async () => {
                            try {
                              await amministrazioneService.updatePolizzaAttrezzatura(polizza.id, { attiva: !polizza.attiva });
                              await loadPolizze();
                            } catch (error) {
                              console.error('Errore nell\'aggiornamento stato polizza:', error);
                              alert('Errore nell\'aggiornamento dello stato');
                            }
                          }}
                          aria-label={polizza.attiva ? 'Disattiva' : 'Attiva'}
                        />
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => handleViewDetails(polizza)}
                            title="Dettagli"
                          >
                            Dettagli
                          </button>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => handleRinnovo(polizza)}
                            title="Rinnova"
                          >
                            Rinnova
                          </button>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => handleEdit(polizza)}
                            title="Modifica"
                          >
                            Modifica
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleDelete(polizza)}
                            title="Elimina"
                          >
                            Elimina
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Nuova/Modifica Polizza */}
      <BaseModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          resetForm();
        }}
        title={selectedPolizza ? 'Modifica Polizza' : 'Nuova Polizza'}
        size="large"
        footerActions={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => { setShowModal(false); resetForm(); }}>
              Annulla
            </button>
            <button type="submit" form="polizza-form" className="btn btn-primary">Salva</button>
          </>
        }
      >
        <form id="polizza-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Attrezzatura *</label>
              <SmartSelect
                className="select-compact"
                options={attrezzaturaOptions}
                value={formData.attrezzatura_id}
                onChange={(e) => setFormData({ ...formData, attrezzatura_id: e.target.value })}
                displayField="label"
                valueField="value"
                required
                placeholder="Seleziona attrezzatura"
              />
            </div>
            <div className="form-group">
              <label>Numero Polizza *</label>
              <input
                type="text"
                value={formData.numero_polizza}
                onChange={(e) => setFormData({ ...formData, numero_polizza: e.target.value })}
                required
                maxLength={100}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Compagnia Assicurativa *</label>
              <input
                type="text"
                value={formData.compagnia}
                onChange={(e) => setFormData({ ...formData, compagnia: e.target.value })}
                required
                maxLength={200}
              />
            </div>
            <div className="form-group">
              <label>Tipo Polizza *</label>
              <SmartSelect
                className="select-compact"
                options={TIPI_POLIZZA}
                value={formData.tipo_polizza}
                onChange={(e) => setFormData({ ...formData, tipo_polizza: e.target.value })}
                displayField="label"
                valueField="value"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Data Inizio Copertura *</label>
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
              <label>Premio Annuale *</label>
              <input
                type="number"
                step="0.01"
                value={formData.premio_annuale}
                onChange={(e) => setFormData({ ...formData, premio_annuale: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Numero Rate Annuali</label>
              <input
                type="number"
                min="1"
                value={formData.numero_rate}
                onChange={(e) => setFormData({ ...formData, numero_rate: parseInt(e.target.value) || 1 })}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Data Prossimo Pagamento</label>
              <input
                type="date"
                value={formData.data_prossimo_pagamento}
                onChange={(e) => setFormData({ ...formData, data_prossimo_pagamento: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Importo Assicurato (Massimale)</label>
              <input
                type="number"
                step="0.01"
                value={formData.importo_assicurato}
                onChange={(e) => setFormData({ ...formData, importo_assicurato: e.target.value })}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group span-12">
              <label>Coperture (separate da virgola)</label>
              <input
                type="text"
                value={Array.isArray(formData.coperture) ? formData.coperture.join(', ') : formData.coperture}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData({ ...formData, coperture: value ? value.split(',').map(c => c.trim()) : [] });
                }}
                placeholder="Es: RC, Furto, Incendio"
              />
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className={`toggle-button ${formData.attiva ? 'active' : ''}`}
                  onClick={() => setFormData({ ...formData, attiva: !formData.attiva })}
                  aria-label="Attiva"
                />
                <span>Attiva</span>
              </label>
            </div>
          </div>

          <div className="form-group span-12">
            <label>Note</label>
            <textarea
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              rows={3}
            />
          </div>
        </form>
      </BaseModal>

      {/* Modal Rinnovo Polizza */}
      <BaseModal
        isOpen={showRinnovoModal}
        onClose={() => {
          setShowRinnovoModal(false);
          resetFormRinnovo();
        }}
        title="Rinnova Polizza"
        footerActions={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => { setShowRinnovoModal(false); resetFormRinnovo(); }}>
              Annulla
            </button>
            <button type="submit" form="rinnovo-form" className="btn btn-primary">Salva Rinnovo</button>
          </>
        }
      >
        <form id="rinnovo-form" onSubmit={handleSubmitRinnovo}>
          <div className="form-row">
            <div className="form-group">
              <label>Data Rinnovo *</label>
              <input
                type="date"
                value={formDataRinnovo.data_rinnovo}
                onChange={(e) => setFormDataRinnovo({ ...formDataRinnovo, data_rinnovo: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Nuovo Premio Annuale *</label>
              <input
                type="number"
                step="0.01"
                value={formDataRinnovo.nuovo_premio_annuale}
                onChange={(e) => setFormDataRinnovo({ ...formDataRinnovo, nuovo_premio_annuale: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group span-12">
            <label>Cambiamenti Copertura</label>
            <textarea
              value={formDataRinnovo.cambiamenti_copertura}
              onChange={(e) => setFormDataRinnovo({ ...formDataRinnovo, cambiamenti_copertura: e.target.value })}
              placeholder="Descrivi i cambiamenti nelle coperture, premio, ecc."
              rows={4}
            />
          </div>

          <div className="form-group span-12">
            <label>Note</label>
            <textarea
              value={formDataRinnovo.note}
              onChange={(e) => setFormDataRinnovo({ ...formDataRinnovo, note: e.target.value })}
              rows={3}
            />
          </div>
        </form>
      </BaseModal>

      {/* Modal Dettagli Polizza */}
      {polizzaDetails && (
        <BaseModal
          isOpen={!!polizzaDetails}
          onClose={() => setPolizzaDetails(null)}
          title={`Dettagli Polizza: ${polizzaDetails.numero_polizza}`}
          size="large"
          footerActions={
            <button onClick={() => setPolizzaDetails(null)}>Chiudi</button>
          }
        >
          <div className="polizza-details">
            <div className="details-section">
              <h3>Informazioni Polizza</h3>
              <div className="details-grid">
                <div><strong>Attrezzatura:</strong> {attrezzature.find(a => a.id === polizzaDetails.attrezzatura_id)?.nome || `ID ${polizzaDetails.attrezzatura_id}`}</div>
                <div><strong>Compagnia:</strong> {polizzaDetails.compagnia}</div>
                <div><strong>Tipo Polizza:</strong> {polizzaDetails.tipo_polizza || 'N/A'}</div>
                <div><strong>Data Inizio:</strong> {formatDate(polizzaDetails.data_inizio)}</div>
                <div><strong>Data Scadenza:</strong> {formatDate(polizzaDetails.data_scadenza)}</div>
                <div><strong>Premio Annuale:</strong> {formatCurrency(polizzaDetails.premio_annuale)}</div>
                <div><strong>Numero Rate:</strong> {polizzaDetails.numero_rate || 1}</div>
                <div><strong>Coperture:</strong> {Array.isArray(polizzaDetails.coperture) ? polizzaDetails.coperture.join(', ') : (polizzaDetails.coperture || 'N/A')}</div>
                {polizzaDetails.importo_assicurato && <div><strong>Importo Assicurato:</strong> {formatCurrency(polizzaDetails.importo_assicurato)}</div>}
                {polizzaDetails.data_prossimo_pagamento && <div><strong>Data Prossimo Pagamento:</strong> {formatDate(polizzaDetails.data_prossimo_pagamento)}</div>}
                {polizzaDetails.note && <div><strong>Note:</strong> {polizzaDetails.note}</div>}
              </div>
            </div>

            {polizzaDetails.pagamenti && polizzaDetails.pagamenti.length > 0 && (
              <div className="details-section">
                <h3>Pagamenti</h3>
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Data Pagamento</th>
                        <th>Importo</th>
                        <th>Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {polizzaDetails.pagamenti.map((pagamento) => (
                        <tr key={pagamento.id}>
                          <td>{formatDate(pagamento.data_pagamento)}</td>
                          <td>{formatCurrency(pagamento.importo)}</td>
                          <td>{pagamento.note || ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {polizzaDetails.rinnovi && polizzaDetails.rinnovi.length > 0 && (
              <div className="details-section">
                <h3>Rinnovi</h3>
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Data Rinnovo</th>
                        <th>Nuovo Premio</th>
                        <th>Cambiamenti</th>
                        <th>Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {polizzaDetails.rinnovi.map((rinnovo) => (
                        <tr key={rinnovo.id}>
                          <td>{formatDate(rinnovo.data_rinnovo)}</td>
                          <td>{formatCurrency(rinnovo.nuovo_premio_annuale)}</td>
                          <td>{rinnovo.cambiamenti_copertura || ''}</td>
                          <td>{rinnovo.note || ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </BaseModal>
      )}
    </div>
  );
});

GestionePolizze.displayName = 'GestionePolizze';

export default GestionePolizze;

