/**
 * BoxView - Gestione box di uno stabilimento con visualizzazione animali
 */
import React, { useState, useEffect, useMemo } from 'react';
import BaseModal from '../../../../components/BaseModal';
import SearchableSelect from '../../../../components/SearchableSelect';
import { allevamentoService } from '../../services/allevamentoService';
import LoadingSpinner from '../../../../components/LoadingSpinner';
import { useRequest } from '../../../../context/RequestContext';
import './EntityView.css';

const BoxView = ({ stabilimento, onBack }) => {
  const [box, setBox] = useState([]);
  const [animali, setAnimali] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    capacita: '',
    tipo_allevamento: '',
    stato: 'libero',
    note: '',
  });

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

  const { getAbortController, isActive } = useRequest();
  
  // Usa stabilimento.id come dipendenza invece dell'oggetto intero
  const stabilimentoId = stabilimento?.id;

  useEffect(() => {
    if (stabilimentoId) {
      loadBox();
      loadAnimali();
    } else {
      // Se non c'è stabilimentoId, resetta il loading
      setLoading(false);
    }
  }, [stabilimentoId]);

  const loadBox = async () => {
    if (!stabilimentoId) {
      setLoading(false);
      return;
    }
    
    const { controller, cleanup } = getAbortController();
    
    try {
      setLoading(true);
      const data = await allevamentoService.getBox(stabilimentoId, { signal: controller.signal });
      
      if (controller.aborted) {
        setLoading(false);
        cleanup();
        return;
      }
      
      setBox(data || []);
    } catch (err) {
      if (err.message?.includes('cancelled') || err.message?.includes('Request cancelled') || err.name === 'AbortError') {
        setLoading(false);
        cleanup();
        return;
      }
      // Per errori 503, gestisci silenziosamente e mostra lista vuota
      if (err.status === 503 || err.isServiceUnavailable) {
        setBox([]);
      } else {

      }
    } finally {
      // Assicurati che il loading sia sempre resettato
      if (!controller.aborted) {
        setLoading(false);
      } else {
        setLoading(false);
      }
      cleanup();
    }
  };

  const loadAnimali = async () => {
    
    const { controller, cleanup } = getAbortController();
    
    try {
      const data = await allevamentoService.getAnimali({}, { signal: controller.signal });
      
      if (controller.aborted) {
        return;
      }
      
      setAnimali(data || []);
    } catch (err) {
      if (err.message?.includes('cancelled') || err.message?.includes('Request cancelled') || err.name === 'AbortError') {
        return;
      }

    } finally {
      cleanup();
    }
  };

  const handleSubmit = async () => {
    try {
      if (editing) {
        await allevamentoService.updateBox(editing.id, {
          ...formData,
          capacita: parseInt(formData.capacita),
        });
      } else {
        await allevamentoService.createBox({
          ...formData,
          stabilimento_id: stabilimentoId,
          capacita: parseInt(formData.capacita),
        });
      }
      setShowForm(false);
      setEditing(null);
      resetForm();
      loadBox();
    } catch (err) {
      alert(`Errore nel salvataggio: ${err.message}`);
    }
  };

  const handleClose = () => {
    setShowForm(false);
    setEditing(null);
    resetForm();
  };

  const handleEdit = (e, boxItem) => {
    e.stopPropagation();
    setEditing(boxItem);
    setFormData({
      nome: boxItem.nome || '',
      capacita: boxItem.capacita ? String(boxItem.capacita) : '',
      tipo_allevamento: boxItem.tipo_allevamento || '',
      stato: boxItem.stato || 'libero',
      note: boxItem.note || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Sei sicuro di voler eliminare questo box?')) return;
    try {
      await allevamentoService.deleteBox(id);
      loadBox();
    } catch (err) {
      alert(`Errore nell'eliminazione: ${err.message}`);
    }
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      capacita: '',
      tipo_allevamento: '',
      stato: 'libero',
      note: '',
    });
  };

  const getBoxAnimali = (boxId) => {
    return animali.filter(a => a.box_id === boxId && a.stato === 'presente');
  };

  const getBoxInfo = (boxItem) => {
    const animaliInBox = getBoxAnimali(boxItem.id);
    const occupazione = animaliInBox.length;
    const disponibilita = boxItem.capacita - occupazione;
    const percentuale = (occupazione / boxItem.capacita) * 100;
    return { occupazione, disponibilita, percentuale, animaliInBox };
  };

  return (
    <div className="entity-view">
      <div className="entity-header">
        <div>
          <h2>Box</h2>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={onBack}>
            ← Indietro
          </button>
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            Nuovo Box
          </button>
        </div>
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

      <div className="box-grid">
        {loading ? (
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'center', padding: '2rem' }}>
            <LoadingSpinner message="Caricamento box..." size="medium" />
          </div>
        ) : box.length === 0 ? (
          <div className="empty-state">
            <p>Nessun box presente per questo stabilimento</p>
          </div>
        ) : (
          box.map(boxItem => {
            const info = getBoxInfo(boxItem);
            return (
              <div key={boxItem.id} className={`box-card ${boxItem.stato} ${info.disponibilita === 0 ? 'full' : ''}`}>
                <div className="box-card-header">
                  <h3>{boxItem.nome}</h3>
                  <div className="entity-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="btn-icon" onClick={(e) => handleEdit(e, boxItem)} title="Modifica">
                      ✏️
                    </button>
                    <button className="btn-icon btn-danger" onClick={(e) => handleDelete(e, boxItem.id)} title="Elimina">
                      🗑️
                    </button>
                  </div>
                </div>
                <div className="box-capacity">
                  <div className="capacity-bar">
                    <div
                      className="capacity-fill"
                      style={{ width: `${info.percentuale}%` }}
                    />
                  </div>
                </div>
                <div className="box-animals">
                  {info.animaliInBox.length > 0 ? (
                    info.animaliInBox.map(animale => (
                      <span key={animale.id} className="animal-tag">
                        {animale.auricolare}
                      </span>
                    ))
                  ) : (
                    <span className="empty-box">Vuoto</span>
                  )}
                </div>
                <div className="box-footer">
                  <div className="box-capacity-info">
                    {info.occupazione} / {boxItem.capacita}
                  </div>
                  <div className="box-status">
                    <span className={`status-badge ${boxItem.stato}`}>
                      {boxItem.stato}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default BoxView;

