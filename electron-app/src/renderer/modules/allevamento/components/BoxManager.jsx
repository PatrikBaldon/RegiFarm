/**
 * BoxManager - CRUD for box
 */
import React, { useState, useEffect, useMemo } from 'react';
import SearchableSelect from '../../../components/SearchableSelect';
import BaseModal from '../../../components/BaseModal';
import { allevamentoService } from '../services/allevamentoService';
import { useAzienda } from '../../../context/AziendaContext';
import './SediManager.css'; // Reuse styles

const BoxManager = () => {
  const sedeOptions = useMemo(
    () => [
      { value: '', label: 'Seleziona sede...' },
      ...sedi.map((sede) => ({ value: String(sede.id), label: `${sede.nome} (${sede.codice_stalla})` })),
    ],
    [sedi],
  );

  const stabilimentoOptions = useMemo(
    () => [
      { value: '', label: 'Seleziona stabilimento...' },
      ...stabilimenti.map((stab) => ({ value: String(stab.id), label: stab.nome })),
    ],
    [stabilimenti],
  );

  const tipoAllevamentoOptions = useMemo(
    () => [
      { value: '', label: 'Seleziona...' },
      { value: 'svezzamento', label: 'Svezzamento' },
      { value: 'ingrasso', label: 'Ingrasso' },
      { value: 'universale', label: 'Universale' },
    ],
    [],
  );

  const statoOptions = useMemo(
    () => [
      { value: 'libero', label: 'Libero' },
      { value: 'occupato', label: 'Occupato' },
      { value: 'pulizia', label: 'Pulizia' },
      { value: 'manutenzione', label: 'Manutenzione' },
    ],
    [],
  );
  const { azienda } = useAzienda();
  const [sedi, setSedi] = useState([]);
  const [stabilimenti, setStabilimenti] = useState([]);
  const [box, setBox] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedSede, setSelectedSede] = useState('');
  const [formData, setFormData] = useState({
    nome: '',
    capacita: '',
    tipo_allevamento: '',
    stato: 'libero',
    note: '',
    stabilimento_id: '',
  });

  useEffect(() => {
    if (azienda?.id) {
      loadSedi();
      loadBox();
    }
  }, [azienda?.id]);

  useEffect(() => {
    if (selectedSede) {
      loadStabilimenti(selectedSede);
    } else {
      setStabilimenti([]);
    }
  }, [selectedSede]);

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

  const loadStabilimenti = async (sedeId, force = false) => {
    // Se i dati sono già nello state e non è forzato, verifica se sono per la stessa sede
    if (!force && stabilimenti.length > 0) {
      const firstStab = stabilimenti[0];
      // Se il primo stabilimento appartiene alla stessa sede, non ricaricare
      if (firstStab?.sede_id === parseInt(sedeId)) {
        return;
      }
    }

    try {
      const data = await allevamentoService.getStabilimenti(sedeId);
      setStabilimenti(data || []);
    } catch (err) {

    }
  };

  const loadBox = async (force = false) => {
    // Se i dati sono già nello state e non è forzato, non ricaricare
    if (!force && box.length > 0) {
      return;
    }

    try {
      setLoading(true);
      const data = await allevamentoService.getBox();
      setBox(data || []);
    } catch (err) {
      alert(`Errore nel caricamento: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      if (editing) {
        await allevamentoService.updateBox(editing.id, {
          ...formData,
          stabilimento_id: parseInt(formData.stabilimento_id),
          capacita: parseInt(formData.capacita),
        });
      } else {
        await allevamentoService.createBox({
          ...formData,
          stabilimento_id: parseInt(formData.stabilimento_id),
          capacita: parseInt(formData.capacita),
        });
      }
      setShowForm(false);
      setEditing(null);
      resetForm();
      loadBox(true); // Forza il ricaricamento dopo il salvataggio
    } catch (err) {
      alert(`Errore nel salvataggio: ${err.message}`);
    }
  };

  const handleClose = () => {
    setShowForm(false);
    setEditing(null);
    resetForm();
  };

  const handleEdit = (boxItem) => {
    setEditing(boxItem);
    // Find sede from stabilimento
    const stabilimento = stabilimenti.find(s => s.id === boxItem.stabilimento_id);
    setSelectedSede(stabilimento ? String(stabilimento.sede_id) : '');
    setFormData({
      nome: boxItem.nome || '',
      capacita: boxItem.capacita ? String(boxItem.capacita) : '',
      tipo_allevamento: boxItem.tipo_allevamento || '',
      stato: boxItem.stato || 'libero',
      note: boxItem.note || '',
      stabilimento_id: boxItem.stabilimento_id ? String(boxItem.stabilimento_id) : '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Sei sicuro di voler eliminare questo box?')) return;
    try {
      await allevamentoService.deleteBox(id);
      loadBox(true); // Forza il ricaricamento dopo l'eliminazione
    } catch (err) {
      alert(`Errore nell'eliminazione: ${err.message}`);
    }
  };

  const resetForm = () => {
    setSelectedSede('');
    setFormData({
      nome: '',
      capacita: '',
      tipo_allevamento: '',
      stato: 'libero',
      note: '',
      stabilimento_id: '',
    });
  };

  const getStabilimentoInfo = (stabilimentoId) => {
    const stab = stabilimenti.find(s => s.id === stabilimentoId);
    if (!stab) return '-';
    const sede = sedi.find(s => s.id === stab.sede_id);
    return `${stab.nome} (${sede ? sede.nome : '-'})`;
  };

  return (
    <div className="sedi-manager">
      <div className="manager-header">
        <h2>Gestione Box</h2>
        <button onClick={() => { setShowForm(true); setEditing(null); resetForm(); }}>
          Nuovo Box
        </button>
      </div>

      <BaseModal
        isOpen={showForm}
        onClose={handleClose}
        title={editing ? 'Modifica Box' : 'Nuovo Box'}
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
                  value={selectedSede}
                  onChange={(e) => {
                    setSelectedSede(e.target.value);
                    setFormData({ ...formData, stabilimento_id: '' });
                  }}
                  displayField="label"
                  valueField="value"
                  required
                  disabled={!!editing}
                  placeholder="Seleziona sede..."
                />
              </div>
          <div className="form-group span-12">
                <label>Stabilimento *</label>
                <SearchableSelect
                  className="select-compact"
                  options={stabilimentoOptions}
                  value={formData.stabilimento_id ? String(formData.stabilimento_id) : ''}
                  onChange={(e) => setFormData({ ...formData, stabilimento_id: e.target.value })}
                  displayField="label"
                  valueField="value"
                  required
                  disabled={!!editing || !selectedSede}
                  placeholder="Seleziona stabilimento..."
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
                  <label>Capacità *</label>
                  <input
                    type="number"
                    value={formData.capacita}
                    onChange={(e) => setFormData({ ...formData, capacita: e.target.value })}
                    required
                    min="1"
                  />
                </div>
          <div className="form-group span-6">
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
          <div className="form-group span-6">
                <label>Stato</label>
                <SearchableSelect
                  className="select-compact"
                  options={statoOptions}
                  value={formData.stato}
                  onChange={(e) => setFormData({ ...formData, stato: e.target.value })}
                  displayField="label"
                  valueField="value"
                />
              </div>
          <div className="form-group span-12">
                <label>Note</label>
                <textarea
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  rows="3"
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
                <th>Stabilimento</th>
                <th>Nome</th>
                <th>Capacità</th>
                <th>Tipo Allevamento</th>
                <th>Stato</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {box.map(b => (
                <tr key={b.id}>
                  <td>{getStabilimentoInfo(b.stabilimento_id)}</td>
                  <td>{b.nome}</td>
                  <td>{b.capacita}</td>
                  <td>{b.tipo_allevamento || '-'}</td>
                  <td>{b.stato}</td>
                  <td>
                    <button onClick={() => handleEdit(b)}>Modifica</button>
                    <button onClick={() => handleDelete(b.id)} className="delete-btn">
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

export default BoxManager;

