/**
 * SediManager - CRUD interface for managing sedi
 */
import React, { useState, useEffect, useMemo } from 'react';
import SearchableSelect from '../../../components/SearchableSelect';
import BaseModal from '../../../components/BaseModal';
import { allevamentoService } from '../services/allevamentoService';
import { useAzienda } from '../../../context/AziendaContext';
import './SediManager.css';

const SediManager = () => {
  const { azienda } = useAzienda();
  const [sedi, setSedi] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    codice_stalla: '',
    indirizzo: '',
    latitudine: '',
    longitudine: '',
    tipo_allevamento: '',
    azienda_id: azienda?.id || null,
  });

  const tipoAllevamentoOptions = useMemo(
    () => [
      { value: '', label: 'Seleziona...' },
      { value: 'svezzamento', label: 'Svezzamento' },
      { value: 'ingrasso', label: 'Ingrasso' },
      { value: 'misto', label: 'Misto' },
    ],
    [],
  );

  // Aggiorna azienda_id nel form quando cambia azienda
  useEffect(() => {
    if (azienda?.id) {
      setFormData(prev => ({ ...prev, azienda_id: azienda.id }));
    }
  }, [azienda?.id]);

  useEffect(() => {
    if (azienda?.id) {
      loadSedi();
    }
  }, [azienda?.id]);

  const loadSedi = async (force = false) => {
    if (!azienda?.id) return;
    
    // Se i dati sono già nello state e non è forzato, non ricaricare
    if (!force && sedi.length > 0) {
      return;
    }

    try {
      setLoading(true);
      // Passa azienda_id per filtrare solo le sedi dell'azienda corrente
      const data = await allevamentoService.getSedi(azienda.id);
      setSedi(data || []);
    } catch (err) {
      alert(`Errore nel caricamento: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      if (editing) {
        await allevamentoService.updateSede(editing.id, formData);
      } else {
        await allevamentoService.createSede(formData);
      }
      setShowForm(false);
      setEditing(null);
      resetForm();
      loadSedi(true); // Forza il ricaricamento dopo il salvataggio
    } catch (err) {
      alert(`Errore nel salvataggio: ${err.message}`);
    }
  };

  const handleClose = () => {
    setShowForm(false);
    setEditing(null);
    resetForm();
  };

  const handleEdit = (sede) => {
    setEditing(sede);
    setFormData({
      nome: sede.nome || '',
      codice_stalla: sede.codice_stalla || '',
      indirizzo: sede.indirizzo || '',
      latitudine: sede.latitudine || '',
      longitudine: sede.longitudine || '',
      tipo_allevamento: sede.tipo_allevamento || '',
      azienda_id: sede.azienda_id || 1,
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Sei sicuro di voler eliminare questa sede?')) return;
    try {
      await allevamentoService.deleteSede(id);
      loadSedi(true); // Forza il ricaricamento dopo l'eliminazione
    } catch (err) {
      alert(`Errore nell'eliminazione: ${err.message}`);
    }
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      codice_stalla: '',
      indirizzo: '',
      latitudine: '',
      longitudine: '',
      tipo_allevamento: '',
      azienda_id: 1,
    });
  };

  return (
    <div className="sedi-manager">
      <div className="manager-header">
        <h2>Gestione Sedi</h2>
        <button onClick={() => { setShowForm(true); setEditing(null); resetForm(); }}>
          Nuova Sede
        </button>
      </div>

      <BaseModal
        isOpen={showForm}
        onClose={handleClose}
        title={editing ? 'Modifica Sede' : 'Nuova Sede'}
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
          <div className="form-group span-6">
                <label>Nome *</label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  required
                />
              </div>
          <div className="form-group span-6">
                <label>Codice Stalla *</label>
                <input
                  type="text"
                  value={formData.codice_stalla}
                  onChange={(e) => setFormData({ ...formData, codice_stalla: e.target.value })}
                  required
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
                  <label>Latitudine</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.latitudine}
                    onChange={(e) => setFormData({ ...formData, latitudine: e.target.value })}
                  />
                </div>
          <div className="form-group span-6">
                  <label>Longitudine</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.longitudine}
                    onChange={(e) => setFormData({ ...formData, longitudine: e.target.value })}
                  />
                </div>
          <div className="form-group span-12">
                <label>Tipo Allevamento</label>
                <SearchableSelect
                  className="select-compact"
                  options={tipoAllevamentoOptions}
                  value={formData.tipo_allevamento}
                  onChange={(e) => setFormData({ ...formData, tipo_allevamento: e.target.value })}
                  displayField="label"
                  valueField="value"
                  placeholder="Seleziona..."
                />
          </div>
        </div>
      </BaseModal>

      <div className="table-container">
        {loading ? (
          <div className="loading">Caricamento...</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Codice Stalla</th>
                <th>Tipo Allevamento</th>
                <th>Indirizzo</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {sedi.map(sede => (
                <tr key={sede.id}>
                  <td>{sede.nome}</td>
                  <td>{sede.codice_stalla}</td>
                  <td>{sede.tipo_allevamento || '-'}</td>
                  <td>{sede.indirizzo || '-'}</td>
                  <td>
                    <button onClick={() => handleEdit(sede)}>Modifica</button>
                    <button onClick={() => handleDelete(sede.id)} className="delete-btn">
                      Elimina
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default SediManager;

