/**
 * StabilimentiManager - CRUD for stabilimenti
 */
import React, { useState, useEffect, useMemo } from 'react';
import SearchableSelect from '../../../components/SearchableSelect';
import BaseModal from '../../../components/BaseModal';
import { allevamentoService } from '../services/allevamentoService';
import { useAzienda } from '../../../context/AziendaContext';
import './SediManager.css'; // Reuse styles

const StabilimentiManager = () => {
  const { azienda } = useAzienda();
  const [sedi, setSedi] = useState([]);
  const [stabilimenti, setStabilimenti] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    tipo: '',
    capacita_totale: '',
    sede_id: '',
  });

  const sedeOptions = useMemo(
    () => [
      { value: '', label: 'Seleziona sede...' },
      ...sedi.map((sede) => ({ value: String(sede.id), label: `${sede.nome} (${sede.codice_stalla})` })),
    ],
    [sedi],
  );

  useEffect(() => {
    if (azienda?.id) {
      loadSedi();
      loadStabilimenti();
    }
  }, [azienda?.id]);

  const loadSedi = async (force = false) => {
    if (!azienda?.id) return;
    
    // Se i dati sono già nello state e non è forzato, non ricaricare
    if (!force && sedi.length > 0) {
      return;
    }

    try {
      // Passa azienda_id per filtrare solo le sedi dell'azienda corrente
      const data = await allevamentoService.getSedi(azienda.id);
      setSedi(data || []);
    } catch (err) {

    }
  };

  const loadStabilimenti = async (force = false) => {
    // Se i dati sono già nello state e non è forzato, non ricaricare
    if (!force && stabilimenti.length > 0) {
      return;
    }

    try {
      setLoading(true);
      const data = await allevamentoService.getStabilimenti();
      setStabilimenti(data || []);
    } catch (err) {
      alert(`Errore nel caricamento: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      if (editing) {
        await allevamentoService.updateStabilimento(editing.id, {
          ...formData,
          sede_id: parseInt(formData.sede_id),
          capacita_totale: formData.capacita_totale ? parseInt(formData.capacita_totale) : null,
        });
      } else {
        await allevamentoService.createStabilimento({
          ...formData,
          sede_id: parseInt(formData.sede_id),
          capacita_totale: formData.capacita_totale ? parseInt(formData.capacita_totale) : null,
        });
      }
      setShowForm(false);
      setEditing(null);
      resetForm();
      loadStabilimenti(true); // Forza il ricaricamento dopo il salvataggio
    } catch (err) {
      alert(`Errore nel salvataggio: ${err.message}`);
    }
  };

  const handleClose = () => {
    setShowForm(false);
    setEditing(null);
    resetForm();
  };

  const handleEdit = (stabilimento) => {
    setEditing(stabilimento);
    setFormData({
      nome: stabilimento.nome || '',
      tipo: stabilimento.tipo || '',
      capacita_totale: stabilimento.capacita_totale ? String(stabilimento.capacita_totale) : '',
      sede_id: stabilimento.sede_id ? String(stabilimento.sede_id) : '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Sei sicuro di voler eliminare questo stabilimento?')) return;
    try {
      await allevamentoService.deleteStabilimento(id);
      loadStabilimenti(true); // Forza il ricaricamento dopo l'eliminazione
    } catch (err) {
      alert(`Errore nell'eliminazione: ${err.message}`);
    }
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      tipo: '',
      capacita_totale: '',
      sede_id: '',
    });
  };

  const getSedeName = (sedeId) => {
    const sede = sedi.find(s => s.id === sedeId);
    return sede ? sede.nome : '-';
  };

  return (
    <div className="sedi-manager">
      <div className="manager-header">
        <h2>Gestione Stabilimenti</h2>
        <button onClick={() => { setShowForm(true); setEditing(null); resetForm(); }}>
          Nuovo Stabilimento
        </button>
      </div>

      <BaseModal
        isOpen={showForm}
        onClose={handleClose}
        title={editing ? 'Modifica Stabilimento' : 'Nuovo Stabilimento'}
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
                <label>Sede *</label>
                <SearchableSelect
                  className="select-compact"
                  options={sedeOptions}
                  value={formData.sede_id ? String(formData.sede_id) : ''}
                  onChange={(e) => setFormData({ ...formData, sede_id: e.target.value })}
                  displayField="label"
                  valueField="value"
                  required
                  disabled={!!editing}
                  placeholder="Seleziona sede..."
                />
              </div>
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
                <label>Tipo</label>
                <input
                  type="text"
                  value={formData.tipo}
                  onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                  placeholder="es. Riscaldato, Ventilato"
                />
              </div>
          <div className="form-group span-12">
                <label>Capacità Totale</label>
                <input
                  type="number"
                  value={formData.capacita_totale}
                  onChange={(e) => setFormData({ ...formData, capacita_totale: e.target.value })}
                  min="0"
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
                <th>Sede</th>
                <th>Nome</th>
                <th>Tipo</th>
                <th>Capacità</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {stabilimenti.map(stab => (
                <tr key={stab.id}>
                  <td>{getSedeName(stab.sede_id)}</td>
                  <td>{stab.nome}</td>
                  <td>{stab.tipo || '-'}</td>
                  <td>{stab.capacita_totale || '-'}</td>
                  <td>
                    <button onClick={() => handleEdit(stab)}>Modifica</button>
                    <button onClick={() => handleDelete(stab.id)} className="delete-btn">
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

export default StabilimentiManager;

