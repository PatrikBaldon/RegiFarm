/**
 * GestioneAttrezzature - Gestione attrezzature con targhe, scadenze, ammortamenti
 */
import React, { useState, useEffect } from 'react';
import { amministrazioneService } from '../services/amministrazioneService';
import api from '../../../services/api';
import { alimentazioneService } from '../../alimentazione/services/alimentazioneService';
import { impostazioniService } from '../../../services/impostazioniService';
import SmartSelect from '../../../components/SmartSelect';
import BaseModal from '../../../components/BaseModal';
import { useAzienda } from '../../../context/AziendaContext';
import '../../alimentazione/components/Alimentazione.css';
import './GestioneAttrezzature.css';

// Tipi di default (usati se le impostazioni non sono disponibili)
const TIPI_ATTREZZATURA_DEFAULT = [
  { value: 'veicolo', label: 'Veicolo' },
  { value: 'macchinario', label: 'Macchinario' },
  { value: 'strumento', label: 'Strumento' },
  { value: 'attrezzatura', label: 'Attrezzatura' },
  { value: 'altro', label: 'Altro' },
];

const TIPI_SCADENZA = [
  { value: 'revisione', label: 'Revisione' },
  { value: 'assicurazione', label: 'Assicurazione' },
  { value: 'bollo', label: 'Bollo' },
  { value: 'patente', label: 'Patente' },
  { value: 'certificazione', label: 'Certificazione' },
  { value: 'manutenzione', label: 'Manutenzione' },
  { value: 'altro', label: 'Altro' },
];

const METODI_AMMORTAMENTO = [
  { value: 'lineare', label: 'Lineare' },
  { value: 'degressivo', label: 'Degressivo' },
];

const GestioneAttrezzature = () => {
  const [attrezzature, setAttrezzature] = useState([]);
  const [fornitori, setFornitori] = useState([]);
  const [tipiAttrezzatura, setTipiAttrezzatura] = useState(TIPI_ATTREZZATURA_DEFAULT);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showModalScadenza, setShowModalScadenza] = useState(false);
  const [showModalAmmortamento, setShowModalAmmortamento] = useState(false);
  const [selectedAttrezzatura, setSelectedAttrezzatura] = useState(null);
  const [selectedAttrezzaturaForScadenza, setSelectedAttrezzaturaForScadenza] = useState(null);
  const [selectedAttrezzaturaForAmmortamento, setSelectedAttrezzaturaForAmmortamento] = useState(null);
  const [attrezzaturaDetails, setAttrezzaturaDetails] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [attrezzaturaModalData, setAttrezzaturaModalData] = useState(null);
  const [formData, setFormData] = useState({
    azienda_id: null,
    nome: '',
    tipo: 'altro',
    marca: '',
    modello: '',
    numero_serie: '',
    targa: '',
    data_acquisto: '',
    costo_acquisto: '',
    fornitore_id: null,
    valore_residuo: '',
    durata_ammortamento_anni: '',
    metodo_ammortamento: 'lineare',
    attiva: true,
    note: '',
  });
  const [formDataScadenza, setFormDataScadenza] = useState({
    tipo: 'revisione',
    descrizione: '',
    data_scadenza: '',
    data_ultimo_rinnovo: '',
    costo: '',
    numero_polizza: '',
    note: '',
  });
  const [formDataAmmortamento, setFormDataAmmortamento] = useState({
    azienda_id: null,
    anno: new Date().getFullYear(),
    mese: null,
    quota_ammortamento: '',
    valore_residuo: '',
    note: '',
  });

  const { azienda, loading: aziendaLoading } = useAzienda();
  const aziendaId = azienda?.id;
  const canOperate = Boolean(aziendaId);

  useEffect(() => {
    loadImpostazioni();
    loadFornitori();
  }, []);

  useEffect(() => {
    if (!aziendaId) return;
    setFormData((prev) => ({
      ...prev,
      azienda_id: prev.azienda_id ?? aziendaId,
    }));
    setFormDataAmmortamento((prev) => ({
      ...prev,
      azienda_id: prev.azienda_id ?? aziendaId,
    }));
    loadData(aziendaId);
  }, [aziendaId]);

  const loadImpostazioni = async () => {
    if (!aziendaId) {

      return;
    }
    try {
      const impostazioni = await impostazioniService.getImpostazioni(aziendaId);
      if (impostazioni?.attrezzature?.tipi && impostazioni.attrezzature.tipi.length > 0) {
        // Converti i tipi (stringhe) in oggetti con value e label
        const tipi = impostazioni.attrezzature.tipi.map(tipo => ({
          value: tipo,
          label: tipo
        }));
        setTipiAttrezzatura(tipi);
      }
    } catch (error) {

      // Usa i tipi di default in caso di errore
    }
  };

  const loadData = async (id) => {
    if (!id) return;
    setLoading(true);
    try {
      const attrezzatureData = await amministrazioneService.getAttrezzature(id);
      setAttrezzature(attrezzatureData);
    } catch (error) {

      alert('Errore nel caricamento dei dati');
    } finally {
      setLoading(false);
    }
  };

  const loadFornitori = async () => {
    try {
      const fornitoriData = await amministrazioneService.getFornitori();
      setFornitori(fornitoriData || []);
    } catch (error) {

    }
  };

  const loadAttrezzaturaDetails = async (id) => {
    try {
      const details = await amministrazioneService.getAttrezzatura(id);
      setAttrezzaturaDetails(details);
      return details;
    } catch (error) {

    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!aziendaId) {
      alert('Configura l\'azienda prima di registrare un\'attrezzatura.');
      return;
    }
    try {
      const dataToSend = {
        ...formData,
        azienda_id: aziendaId,
        costo_acquisto: formData.costo_acquisto ? parseFloat(formData.costo_acquisto) : null,
        valore_residuo: formData.valore_residuo ? parseFloat(formData.valore_residuo) : null,
        durata_ammortamento_anni: formData.durata_ammortamento_anni ? parseInt(formData.durata_ammortamento_anni) : null,
        fornitore_id: formData.fornitore_id || null,
        data_acquisto: formData.data_acquisto || null,
      };

      if (selectedAttrezzatura) {
        await amministrazioneService.updateAttrezzatura(selectedAttrezzatura.id, dataToSend);
        setIsEditing(false);
        // Ricarica i dati dell'attrezzatura
        const updated = await amministrazioneService.getAttrezzatura(selectedAttrezzatura.id);
        setAttrezzaturaModalData(updated);
        setSelectedAttrezzatura(updated);
      } else {
        await amministrazioneService.createAttrezzatura(dataToSend);
        setShowModal(false);
        resetForm();
        setIsEditing(false);
        setSelectedAttrezzatura(null);
        setAttrezzaturaModalData(null);
      }
      loadData(aziendaId);
    } catch (error) {

      alert('Errore nel salvataggio');
    }
  };

  const handleSubmitScadenza = async (e) => {
    e.preventDefault();
    try {
      const dataToSend = {
        ...formDataScadenza,
        costo: formDataScadenza.costo ? parseFloat(formDataScadenza.costo) : null,
        data_ultimo_rinnovo: formDataScadenza.data_ultimo_rinnovo || null,
      };

      await amministrazioneService.createScadenzaAttrezzatura(selectedAttrezzaturaForScadenza.id, dataToSend);
      setShowModalScadenza(false);
      resetFormScadenza();
      if (attrezzaturaDetails?.id === selectedAttrezzaturaForScadenza.id) {
        await loadAttrezzaturaDetails(selectedAttrezzaturaForScadenza.id);
      }
    } catch (error) {

      alert('Errore nel salvataggio');
    }
  };

  const handleSubmitAmmortamento = async (e) => {
    e.preventDefault();
    try {
      const dataToSend = {
        ...formDataAmmortamento,
        azienda_id: aziendaId,
        quota_ammortamento: parseFloat(formDataAmmortamento.quota_ammortamento),
        valore_residuo: formDataAmmortamento.valore_residuo ? parseFloat(formDataAmmortamento.valore_residuo) : null,
        mese: formDataAmmortamento.mese || null,
      };

      await amministrazioneService.createAmmortamento(selectedAttrezzaturaForAmmortamento.id, dataToSend);
      setShowModalAmmortamento(false);
      resetFormAmmortamento();
      if (attrezzaturaDetails?.id === selectedAttrezzaturaForAmmortamento.id) {
        await loadAttrezzaturaDetails(selectedAttrezzaturaForAmmortamento.id);
      }
    } catch (error) {

      alert('Errore nel salvataggio');
    }
  };

  const handleEdit = async (attrezzatura) => {
    if (!attrezzatura) return;
    setSelectedAttrezzatura(attrezzatura);
    setAttrezzaturaModalData(attrezzatura);
    setFormData({
      ...attrezzatura,
      data_acquisto: attrezzatura.data_acquisto ? attrezzatura.data_acquisto.split('T')[0] : '',
      costo_acquisto: attrezzatura.costo_acquisto?.toString() || '',
      valore_residuo: attrezzatura.valore_residuo?.toString() || '',
      durata_ammortamento_anni: attrezzatura.durata_ammortamento_anni?.toString() || '',
    });
    setIsEditing(false);
    setShowModal(true);
  };

  const handleStartEdit = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    // Se si sta creando una nuova attrezzatura (attrezzaturaModalData è null), chiudi direttamente la modale
    if (!attrezzaturaModalData) {
      setShowModal(false);
      resetForm();
      setIsEditing(false);
      setSelectedAttrezzatura(null);
      setAttrezzaturaModalData(null);
      return;
    }
    
    // Se si sta modificando un'attrezzatura esistente, ripristina i dati originali
    setFormData({
      ...attrezzaturaModalData,
      data_acquisto: attrezzaturaModalData.data_acquisto ? attrezzaturaModalData.data_acquisto.split('T')[0] : '',
      costo_acquisto: attrezzaturaModalData.costo_acquisto?.toString() || '',
      valore_residuo: attrezzaturaModalData.valore_residuo?.toString() || '',
      durata_ammortamento_anni: attrezzaturaModalData.durata_ammortamento_anni?.toString() || '',
    });
    setIsEditing(false);
  };

  const handleViewDetails = async (attrezzatura) => {
    const details = await loadAttrezzaturaDetails(attrezzatura.id);
    setSelectedAttrezzatura(attrezzatura);
    setAttrezzaturaDetails(details);
    // Apri anche la modale principale in modalità visualizzazione
    setAttrezzaturaModalData(details);
    setFormData({
      ...details,
      data_acquisto: details.data_acquisto ? details.data_acquisto.split('T')[0] : '',
      costo_acquisto: details.costo_acquisto?.toString() || '',
      valore_residuo: details.valore_residuo?.toString() || '',
      durata_ammortamento_anni: details.durata_ammortamento_anni?.toString() || '',
    });
    setIsEditing(false);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Sei sicuro di voler eliminare questa attrezzatura?')) return;
    
    try {
      await amministrazioneService.deleteAttrezzatura(id);
      loadData(aziendaId);
    } catch (error) {

      alert('Errore nell\'eliminazione');
    }
  };

  const handleDeleteScadenza = async (id) => {
    if (!confirm('Sei sicuro di voler eliminare questa scadenza?')) return;
    
    try {
      await amministrazioneService.deleteScadenzaAttrezzatura(id);
      if (attrezzaturaDetails) {
        await loadAttrezzaturaDetails(attrezzaturaDetails.id);
      }
    } catch (error) {

      alert('Errore nell\'eliminazione');
    }
  };

  const resetForm = () => {
    setFormData({
      azienda_id: aziendaId || null,
      nome: '',
      tipo: 'altro',
      marca: '',
      modello: '',
      numero_serie: '',
      targa: '',
      data_acquisto: '',
      costo_acquisto: '',
      fornitore_id: null,
      valore_residuo: '',
      durata_ammortamento_anni: '',
      metodo_ammortamento: 'lineare',
      attiva: true,
      note: '',
    });
    setSelectedAttrezzatura(null);
    setAttrezzaturaModalData(null);
  };

  // Modal Render with Unified Structure (same as GestioneFatture and GestioneFornitori)
  const renderModalContent = () => {
    return (
      <BaseModal
        isOpen={showModal}
        onClose={() => {
          if (!isEditing) {
            setShowModal(false);
            setAttrezzaturaModalData(null);
            setIsEditing(false);
            setSelectedAttrezzatura(null);
            resetForm();
          }
        }}
        title={attrezzaturaModalData ? (isEditing ? 'Modifica Attrezzatura' : 'Dettagli Attrezzatura') : 'Nuova Attrezzatura'}
        size="xlarge"
        headerActions={
          <>
            {!isEditing && attrezzaturaModalData && (
              <>
                <button className="btn btn-secondary" onClick={handleStartEdit}>
                  Modifica
                </button>
                <button 
                  className="btn btn-danger" 
                  onClick={async () => {
                    if (confirm('Sei sicuro di voler eliminare questa attrezzatura?')) {
                      await handleDelete(attrezzaturaModalData.id);
                      setShowModal(false);
                      setAttrezzaturaModalData(null);
                      setSelectedAttrezzatura(null);
                    }
                  }}
                >
                  Elimina
                </button>
              </>
            )}
          </>
        }
        footerActions={
          isEditing ? (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCancelEdit}
              >
                Annulla
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={(e) => {
                  e.preventDefault();
                  handleSubmit(e);
                }}
              >
                Salva
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setShowModal(false);
                setAttrezzaturaModalData(null);
                setIsEditing(false);
                setSelectedAttrezzatura(null);
                resetForm();
              }}
            >
              Chiudi
            </button>
          )
        }
      >
        <form onSubmit={handleSubmit} className="movimento-form">
          <div className="form-grid">
            <div className="form-group span-12">
              <label>Nome *</label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  required
                />
              ) : (
                <span>{formData.nome || '-'}</span>
              )}
            </div>

            <div className="form-group">
              <label>Tipo *</label>
              {isEditing ? (
                <SmartSelect
                  className="select-compact"
                  options={tipiAttrezzatura}
                  value={formData.tipo || ''}
                  onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                  placeholder="Seleziona tipo..."
                  displayField="label"
                  valueField="value"
                  required
                />
              ) : (
                <span>{formData.tipo || '-'}</span>
              )}
            </div>

            <div className="form-group">
              <label>Marca</label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.marca}
                  onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
                />
              ) : (
                <span>{formData.marca || '-'}</span>
              )}
            </div>

            <div className="form-group">
              <label>Modello</label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.modello}
                  onChange={(e) => setFormData({ ...formData, modello: e.target.value })}
                />
              ) : (
                <span>{formData.modello || '-'}</span>
              )}
            </div>

            <div className="form-group">
              <label>Numero Serie</label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.numero_serie}
                  onChange={(e) => setFormData({ ...formData, numero_serie: e.target.value })}
                />
              ) : (
                <span>{formData.numero_serie || '-'}</span>
              )}
            </div>

            {formData.tipo === 'veicolo' && (
              <div className="form-group">
                <label>Targa</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.targa}
                    onChange={(e) => setFormData({ ...formData, targa: e.target.value.toUpperCase() })}
                    placeholder="AB123CD"
                  />
                ) : (
                  <span>{formData.targa || '-'}</span>
                )}
              </div>
            )}

            <div className="form-group">
              <label>Data Acquisto</label>
              {isEditing ? (
                <input
                  type="date"
                  value={formData.data_acquisto}
                  onChange={(e) => setFormData({ ...formData, data_acquisto: e.target.value })}
                />
              ) : (
                <span>{formData.data_acquisto ? new Date(formData.data_acquisto).toLocaleDateString('it-IT') : '-'}</span>
              )}
            </div>

            <div className="form-group">
              <label>Costo Acquisto (€)</label>
              {isEditing ? (
                <input
                  type="number"
                  step="0.01"
                  value={formData.costo_acquisto}
                  onChange={(e) => setFormData({ ...formData, costo_acquisto: e.target.value })}
                />
              ) : (
                <span>{formData.costo_acquisto ? `€${parseFloat(formData.costo_acquisto).toFixed(2)}` : '-'}</span>
              )}
            </div>

            <div className="form-group">
              <label>Fornitore</label>
              {isEditing ? (
                <SmartSelect
                  className="select-compact"
                  options={fornitori}
                  value={formData.fornitore_id || ''}
                  onChange={(e) => setFormData({ ...formData, fornitore_id: e.target.value ? parseInt(e.target.value) : null })}
                  placeholder="Cerca fornitore..."
                  displayField="nome"
                  valueField="id"
                />
              ) : (
                <span>{getFornitoreName(formData.fornitore_id)}</span>
              )}
            </div>

            <div className="form-group">
              <label>Valore Residuo (€)</label>
              {isEditing ? (
                <input
                  type="number"
                  step="0.01"
                  value={formData.valore_residuo}
                  onChange={(e) => setFormData({ ...formData, valore_residuo: e.target.value })}
                />
              ) : (
                <span>{formData.valore_residuo ? `€${parseFloat(formData.valore_residuo).toFixed(2)}` : '-'}</span>
              )}
            </div>

            <div className="form-group">
              <label>Durata Ammortamento (anni)</label>
              {isEditing ? (
                <input
                  type="number"
                  value={formData.durata_ammortamento_anni}
                  onChange={(e) => setFormData({ ...formData, durata_ammortamento_anni: e.target.value })}
                />
              ) : (
                <span>{formData.durata_ammortamento_anni || '-'}</span>
              )}
            </div>

            <div className="form-group">
              <label>Metodo Ammortamento</label>
              {isEditing ? (
                <SmartSelect
                  className="select-compact"
                  options={METODI_AMMORTAMENTO}
                  value={formData.metodo_ammortamento || 'lineare'}
                  onChange={(e) => setFormData({ ...formData, metodo_ammortamento: e.target.value })}
                  displayField="label"
                  valueField="value"
                  placeholder="Seleziona metodo"
                />
              ) : (
                <span>{METODI_AMMORTAMENTO.find(m => m.value === formData.metodo_ammortamento)?.label || '-'}</span>
              )}
            </div>

            <div className="form-group">
              <label>
                {isEditing ? (
                  <>
                    <input
                      type="checkbox"
                      checked={formData.attiva}
                      onChange={(e) => setFormData({ ...formData, attiva: e.target.checked })}
                    />
                    Attiva
                  </>
                ) : (
                  <span>{formData.attiva ? 'Attiva' : 'Inattiva'}</span>
                )}
              </label>
            </div>
          </div>

          {/* Note - fuori dalla griglia */}
          <div className="form-group">
            <label>Note</label>
            {isEditing ? (
              <textarea
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                rows={3}
              />
            ) : (
              <span>{formData.note || '-'}</span>
            )}
          </div>
        </form>
      </BaseModal>
    );
  };

  const resetFormScadenza = () => {
    setFormDataScadenza({
      tipo: 'revisione',
      descrizione: '',
      data_scadenza: '',
      data_ultimo_rinnovo: '',
      costo: '',
      numero_polizza: '',
      note: '',
    });
    setSelectedAttrezzaturaForScadenza(null);
  };

  const resetFormAmmortamento = () => {
    setFormDataAmmortamento({
      azienda_id: aziendaId || null,
      anno: new Date().getFullYear(),
      mese: null,
      quota_ammortamento: '',
      valore_residuo: '',
      note: '',
    });
    setSelectedAttrezzaturaForAmmortamento(null);
  };

  const getFornitoreName = (fornitoreId) => {
    if (!fornitoreId) return '-';
    const fornitore = fornitori.find(f => f.id === fornitoreId);
    return fornitore ? fornitore.nome : 'N/A';
  };

  return (
    <div className="gestione-attrezzature">
      <div className="header-actions">
        <button
          className="btn btn-primary"
          onClick={() => { 
            resetForm(); 
            setSelectedAttrezzatura(null);
            setAttrezzaturaModalData(null);
            setIsEditing(true);
            setShowModal(true); 
          }}
          disabled={!canOperate}
          style={!canOperate ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
        >
          Nuova Attrezzatura
        </button>
      </div>

      {!canOperate ? (
        <div className="empty-state">
          Configura l&apos;azienda nelle impostazioni per gestire le attrezzature.
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
              <th>Nome</th>
              <th>Tipo</th>
              <th>Targa</th>
              <th>Marca</th>
              <th>Modello</th>
              <th>Costo Acquisto</th>
              <th>Stato</th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
                  {attrezzature.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="empty-state">
                        Nessuna attrezzatura trovata
                      </td>
                    </tr>
                  ) : (
                    attrezzature.filter(att => att).map(attrezzatura => (
              <tr key={attrezzatura.id}>
                <td>{attrezzatura.nome}</td>
                <td>{attrezzatura.tipo || '-'}</td>
                <td>{attrezzatura.targa || '-'}</td>
                <td>{attrezzatura.marca || '-'}</td>
                <td>{attrezzatura.modello || '-'}</td>
                <td>{attrezzatura.costo_acquisto ? `€${parseFloat(attrezzatura.costo_acquisto).toFixed(2)}` : '-'}</td>
                <td>
                  <span className={`badge ${attrezzatura.attiva ? 'badge-success' : 'badge-secondary'}`}>
                    {attrezzatura.attiva ? 'Attiva' : 'Inattiva'}
                  </span>
                </td>
                <td>
                  <button className="btn-icon" onClick={() => handleViewDetails(attrezzatura)} title="Dettagli">👁️</button>
                  <button className="btn-icon" onClick={() => handleEdit(attrezzatura)} title="Modifica">✏️</button>
                  <button className="btn-icon" onClick={() => handleDelete(attrezzatura.id)} title="Elimina">🗑️</button>
                </td>
              </tr>
                    ))
                  )}
          </tbody>
        </table>
            </div>
          )}
        </>
      )}

      {showModal && renderModalContent()}

      {attrezzaturaDetails && (
        <div className="modal">
          <div className="modal-content large">
            <div className="modal-header">
              <h3>Dettagli Attrezzatura: {attrezzaturaDetails.nome}</h3>
              <button className="close-button" onClick={() => { setAttrezzaturaDetails(null); setSelectedAttrezzatura(null); }}>
                ×
              </button>
            </div>
            <div className="attrezzatura-details">
              <div className="details-section">
                <h4>Informazioni Generali</h4>
                <p><strong>Tipo:</strong> {attrezzaturaDetails.tipo || '-'}</p>
                <p><strong>Marca:</strong> {attrezzaturaDetails.marca || '-'}</p>
                <p><strong>Modello:</strong> {attrezzaturaDetails.modello || '-'}</p>
                {attrezzaturaDetails.targa && <p><strong>Targa:</strong> {attrezzaturaDetails.targa}</p>}
                {attrezzaturaDetails.costo_acquisto && <p><strong>Costo Acquisto:</strong> €{parseFloat(attrezzaturaDetails.costo_acquisto).toFixed(2)}</p>}
              </div>

              <div className="details-section">
                <div className="section-header">
                  <h4>Scadenze</h4>
                  <button 
                    className="btn btn-sm btn-primary"
                    onClick={() => {
                      setSelectedAttrezzaturaForScadenza(attrezzaturaDetails);
                      resetFormScadenza();
                      setShowModalScadenza(true);
                    }}
                  >
                    + Aggiungi Scadenza
                  </button>
                </div>
                <div className="table-container">
                  <table className="data-table">
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Descrizione</th>
                      <th>Data Scadenza</th>
                      <th>Costo</th>
                      <th>Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                      {attrezzaturaDetails.scadenze && attrezzaturaDetails.scadenze.length > 0 ? (
                        attrezzaturaDetails.scadenze.map(scadenza => (
                      <tr key={scadenza.id}>
                        <td>{scadenza.tipo}</td>
                        <td>{scadenza.descrizione}</td>
                        <td>{new Date(scadenza.data_scadenza).toLocaleDateString('it-IT')}</td>
                        <td>{scadenza.costo ? `€${parseFloat(scadenza.costo).toFixed(2)}` : '-'}</td>
                        <td>
                          <button className="btn-icon" onClick={() => handleDeleteScadenza(scadenza.id)} title="Elimina">🗑️</button>
                        </td>
                      </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="empty-state">
                            Nessuna scadenza registrata
                          </td>
                        </tr>
                      )}
                  </tbody>
                </table>
                </div>
              </div>

              <div className="details-section">
                <div className="section-header">
                  <h4>Ammortamenti</h4>
                  <button 
                    className="btn btn-sm btn-primary"
                    onClick={() => {
                      setSelectedAttrezzaturaForAmmortamento(attrezzaturaDetails);
                      resetFormAmmortamento();
                      setShowModalAmmortamento(true);
                    }}
                  >
                    + Aggiungi Ammortamento
                  </button>
                </div>
                <div className="table-container">
                  <table className="data-table">
                  <thead>
                    <tr>
                      <th>Anno</th>
                      <th>Mese</th>
                      <th>Quota</th>
                      <th>Valore Residuo</th>
                    </tr>
                  </thead>
                  <tbody>
                      {attrezzaturaDetails.ammortamenti && attrezzaturaDetails.ammortamenti.length > 0 ? (
                        attrezzaturaDetails.ammortamenti.map(ammortamento => (
                      <tr key={ammortamento.id}>
                        <td>{ammortamento.anno}</td>
                        <td>{ammortamento.mese || '-'}</td>
                        <td>€{parseFloat(ammortamento.quota_ammortamento).toFixed(2)}</td>
                        <td>{ammortamento.valore_residuo ? `€${parseFloat(ammortamento.valore_residuo).toFixed(2)}` : '-'}</td>
                      </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="empty-state">
                            Nessun ammortamento registrato
                          </td>
                        </tr>
                      )}
                  </tbody>
                </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showModalScadenza && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Nuova Scadenza</h3>
              <button className="close-button" onClick={() => { setShowModalScadenza(false); resetFormScadenza(); }}>
                ×
              </button>
            </div>
            <form onSubmit={handleSubmitScadenza}>
              <div className="form-row">
                <div className="form-group">
                  <label>Tipo *</label>
                  <SmartSelect
                    className="select-compact"
                    options={TIPI_SCADENZA}
                    value={formDataScadenza.tipo}
                    onChange={(e) => setFormDataScadenza({ ...formDataScadenza, tipo: e.target.value })}
                    displayField="label"
                    valueField="value"
                    required
                    placeholder="Seleziona tipo"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Descrizione *</label>
                <input
                  type="text"
                  value={formDataScadenza.descrizione}
                  onChange={(e) => setFormDataScadenza({ ...formDataScadenza, descrizione: e.target.value })}
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Data Scadenza *</label>
                  <input
                    type="date"
                    value={formDataScadenza.data_scadenza}
                    onChange={(e) => setFormDataScadenza({ ...formDataScadenza, data_scadenza: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Data Ultimo Rinnovo</label>
                  <input
                    type="date"
                    value={formDataScadenza.data_ultimo_rinnovo}
                    onChange={(e) => setFormDataScadenza({ ...formDataScadenza, data_ultimo_rinnovo: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Costo (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formDataScadenza.costo}
                    onChange={(e) => setFormDataScadenza({ ...formDataScadenza, costo: e.target.value })}
                  />
                </div>
                {formDataScadenza.tipo === 'assicurazione' && (
                  <div className="form-group">
                    <label>Numero Polizza</label>
                    <input
                      type="text"
                      value={formDataScadenza.numero_polizza}
                      onChange={(e) => setFormDataScadenza({ ...formDataScadenza, numero_polizza: e.target.value })}
                    />
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>Note</label>
                <textarea
                  value={formDataScadenza.note}
                  onChange={(e) => setFormDataScadenza({ ...formDataScadenza, note: e.target.value })}
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">Salva</button>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowModalScadenza(false); resetFormScadenza(); }}>
                  Annulla
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showModalAmmortamento && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Nuovo Ammortamento</h3>
              <button className="close-button" onClick={() => { setShowModalAmmortamento(false); resetFormAmmortamento(); }}>
                ×
              </button>
            </div>
            <form onSubmit={handleSubmitAmmortamento}>
              <div className="form-row">
                <div className="form-group">
                  <label>Anno *</label>
                  <input
                    type="number"
                    value={formDataAmmortamento.anno}
                    onChange={(e) => setFormDataAmmortamento({ ...formDataAmmortamento, anno: parseInt(e.target.value) })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Mese (opzionale)</label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={formDataAmmortamento.mese || ''}
                    onChange={(e) => setFormDataAmmortamento({ ...formDataAmmortamento, mese: e.target.value ? parseInt(e.target.value) : null })}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Quota Ammortamento (€) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formDataAmmortamento.quota_ammortamento}
                    onChange={(e) => setFormDataAmmortamento({ ...formDataAmmortamento, quota_ammortamento: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Valore Residuo (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formDataAmmortamento.valore_residuo}
                    onChange={(e) => setFormDataAmmortamento({ ...formDataAmmortamento, valore_residuo: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Note</label>
                <textarea
                  value={formDataAmmortamento.note}
                  onChange={(e) => setFormDataAmmortamento({ ...formDataAmmortamento, note: e.target.value })}
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">Salva</button>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowModalAmmortamento(false); resetFormAmmortamento(); }}>
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

export default GestioneAttrezzature;

