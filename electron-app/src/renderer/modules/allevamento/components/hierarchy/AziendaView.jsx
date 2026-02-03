/**
 * AziendaView - Lista e gestione aziende
 */
import React, { useState, useEffect } from 'react';
import BaseModal from '../../../../components/BaseModal';
import { aziendeService } from '../../services/aziendeService';
import { alimentazioneService } from '../../../alimentazione/services/alimentazioneService';
import { amministrazioneService } from '../../../amministrazione/services/amministrazioneService';
import { useAzienda } from '../../../../context/AziendaContext';
import SearchableSelect from '../../../../components/SearchableSelect';
import AssicurazioniAzienda from './AssicurazioniAzienda';
import './EntityView.css';

const AziendaView = ({ onSelectAzienda }) => {
  const { refresh: refreshAziendaContext } = useAzienda();
  const [aziende, setAziende] = useState([]);
  const [veterinari, setVeterinari] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    codice_fiscale: '',
    partita_iva: '',
    indirizzo: '',
    telefono: '',
    email: '',
    veterinario_id: null,
  });

  useEffect(() => {
    loadAziende();
    loadVeterinari();
  }, []);

  const loadVeterinari = async () => {
    try {
      // Carica tutti i fornitori
      const fornitori = await amministrazioneService.getFornitori();
      // Carica i tipi fornitori per trovare quelli con categoria 'veterinario'
      const tipiFornitori = await amministrazioneService.getFornitoriTipi();
      
      // Filtra i fornitori che hanno categoria 'veterinario'
      const veterinariIds = tipiFornitori
        .filter(tipo => tipo.categoria === 'veterinario')
        .map(tipo => tipo.fornitore_id);
      
      const veterinariList = fornitori.filter(f => veterinariIds.includes(f.id));
      setVeterinari(veterinariList || []);
    } catch (error) {

    }
  };

  const loadAziende = async () => {
    try {
      setLoading(true);
      const data = await aziendeService.getAziende();
      setAziende(data || []);
    } catch (err) {
      alert(`Errore nel caricamento: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      if (!editing && aziende.length > 0) {
        alert('È possibile gestire una sola azienda. Modifica quella esistente per aggiornare i dati.');
        return;
      }
      if (editing) {
        await aziendeService.updateAzienda(editing.id, formData);
      } else {
        await aziendeService.createAzienda(formData);
      }
      setShowForm(false);
      setEditing(null);
      resetForm();
      await loadAziende();
      await refreshAziendaContext();
    } catch (err) {
      alert(`Errore nel salvataggio: ${err.message}`);
    }
  };

  const handleClose = () => {
    setShowForm(false);
    setEditing(null);
    resetForm();
  };

  const handleEdit = (e, azienda) => {
    e.stopPropagation();
    setEditing(azienda);
    setFormData({
      nome: azienda.nome || '',
      codice_fiscale: azienda.codice_fiscale || '',
      partita_iva: azienda.partita_iva || '',
      indirizzo: azienda.indirizzo || '',
      telefono: azienda.telefono || '',
      email: azienda.email || '',
      veterinario_id: azienda.veterinario_id || null,
    });
    setShowForm(true);
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Sei sicuro di voler eliminare questa azienda?')) return;
    try {
      await aziendeService.deleteAzienda(id);
      await loadAziende();
      await refreshAziendaContext();
    } catch (err) {
      alert(`Errore nell'eliminazione: ${err.message}`);
    }
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      codice_fiscale: '',
      partita_iva: '',
      indirizzo: '',
      telefono: '',
      email: '',
      veterinario_id: null,
    });
  };

  return (
    <div className="entity-view">
      <div className="entity-header">
        <h2>Azienda</h2>
        {aziende.length > 0 && (
          <p className="single-azienda-banner">
            È attiva una sola azienda. Usa le azioni di modifica per aggiornare le informazioni.
          </p>
        )}
      </div>

      <BaseModal
        isOpen={showForm}
        onClose={handleClose}
        title={editing ? 'Modifica Azienda' : 'Nuova Azienda'}
        size="medium"
        footerActions={
          <>
            <button type="button" className="btn btn-secondary" onClick={handleClose}>
              Annulla
            </button>
            <button type="button" className="btn btn-primary" onClick={handleSubmit}>
              Salva
            </button>
          </>
        }
      >
        <div className="form-grid">
          <div className="form-group span-12">
                <label>Nome *</label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  required
                />
              </div>
          <div className="form-group span-6">
                <label>Codice Fiscale *</label>
                <input
                  type="text"
                  value={formData.codice_fiscale}
                  onChange={(e) => setFormData({ ...formData, codice_fiscale: e.target.value })}
                  required
                />
              </div>
          <div className="form-group span-6">
                <label>Partita IVA</label>
                <input
                  type="text"
                  value={formData.partita_iva}
                  onChange={(e) => setFormData({ ...formData, partita_iva: e.target.value })}
                />
              </div>
          <div className="form-group span-12">
                <label>Indirizzo</label>
                <input
                  type="text"
                  value={formData.indirizzo}
                  onChange={(e) => setFormData({ ...formData, indirizzo: e.target.value })}
                />
              </div>
          <div className="form-group span-6">
                  <label>Telefono</label>
                  <input
                    type="text"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  />
                </div>
          <div className="form-group span-6">
                  <label>Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
          <div className="form-group span-12">
                <label>Veterinario</label>
                <SearchableSelect
                  options={veterinari}
                  value={formData.veterinario_id || ''}
                  onChange={(e) => setFormData({ ...formData, veterinario_id: e.target.value ? parseInt(e.target.value) : null })}
                  placeholder="Seleziona veterinario..."
                  displayField="nome"
                  valueField="id"
                />
                {veterinari.length === 0 && (
                  <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                    Nessun veterinario disponibile. Aggiungi un fornitore con categoria "Veterinario" nel modulo Amministrazione.
                  </p>
                )}
          </div>
        </div>
      </BaseModal>

      <div className="entity-grid">
        {loading ? (
          <div className="loading">Caricamento...</div>
        ) : aziende.length === 0 ? (
          <div className="empty-state">
            <p>Nessuna azienda presente</p>
            <button className="btn-primary" onClick={() => setShowForm(true)}>
              Crea azienda
            </button>
          </div>
        ) : (
          aziende.map(azienda => (
            <div
              key={azienda.id}
              className="entity-card"
            >
              <div className="entity-card-header">
                <h3 style={{ flex: 1 }}>{azienda.nome}</h3>
                <div className="entity-actions">
                  <button className="btn-icon" onClick={(e) => handleEdit(e, azienda)} title="Modifica">
                    ✏️
                  </button>
                  <button className="btn-icon btn-danger" onClick={(e) => handleDelete(e, azienda.id)} title="Elimina">
                    🗑️
                  </button>
                </div>
              </div>
              <div className="entity-card-body">
                <p><strong>Codice Fiscale:</strong> {azienda.codice_fiscale}</p>
                {azienda.partita_iva && (
                  <p><strong>P.IVA:</strong> {azienda.partita_iva}</p>
                )}
                {azienda.indirizzo && (
                  <p><strong>Indirizzo:</strong> {azienda.indirizzo}</p>
                )}
                {azienda.telefono && (
                  <p><strong>Telefono:</strong> {azienda.telefono}</p>
                )}
                {azienda.email && (
                  <p><strong>Email:</strong> {azienda.email}</p>
                )}
                {azienda.veterinario && (
                  <p><strong>Veterinario:</strong> {azienda.veterinario.nome}</p>
                )}
              </div>
              <div className="entity-card-footer">
                <span className="entity-action" onClick={() => onSelectAzienda(azienda)}>Clicca per entrare →</span>
              </div>
              
              {/* Sezione Assicurazioni Aziendali */}
              <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #e5e7eb', width: '100%', overflow: 'visible' }}>
                <AssicurazioniAzienda aziendaId={azienda.id} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AziendaView;

