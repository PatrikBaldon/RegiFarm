/**
 * StabilimentoView - Gestione stabilimenti di una sede
 */
import React, { useState, useEffect } from 'react';
import BaseModal from '../../../../components/BaseModal';
import { allevamentoService } from '../../services/allevamentoService';
import LoadingSpinner from '../../../../components/LoadingSpinner';
import { useRequest } from '../../../../context/RequestContext';
import './EntityView.css';

const StabilimentoView = ({ sede, onSelectStabilimento, onBack }) => {
  const [stabilimenti, setStabilimenti] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    tipo: '',
    capacita_totale: '',
  });
  const { getAbortController, isActive } = useRequest();

  // Usa sede.id come dipendenza invece dell'oggetto intero
  const sedeId = sede?.id;

  useEffect(() => {
    if (sedeId) {
      loadStabilimenti();
    } else {
      // Se non c'è sedeId, resetta il loading
      setLoading(false);
    }
  }, [sedeId]);

  const loadStabilimenti = async () => {
    if (!sedeId) {
      setLoading(false);
      return;
    }
    
    const { controller, cleanup } = getAbortController();
    
    try {
      setLoading(true);
      const data = await allevamentoService.getStabilimenti(sedeId, { signal: controller.signal });
      
      if (controller.aborted) {
        setLoading(false);
        cleanup();
        return;
      }
      
      setStabilimenti(data || []);
    } catch (err) {
      if (err.message?.includes('cancelled') || err.message?.includes('Request cancelled') || err.name === 'AbortError') {
        setLoading(false);
        cleanup();
        return;
      }
      // Per errori 503, gestisci silenziosamente e mostra lista vuota
      if (err.status === 503 || err.isServiceUnavailable) {
        setStabilimenti([]);
      } else {

      }
    } finally {
      if (!controller.aborted) {
        setLoading(false);
      } else {
        // Assicurati che il loading sia sempre resettato
        setLoading(false);
      }
      cleanup();
    }
  };

  const handleSubmit = async () => {
    try {
      if (editing) {
        await allevamentoService.updateStabilimento(editing.id, {
          ...formData,
          capacita_totale: formData.capacita_totale ? parseInt(formData.capacita_totale) : null,
        });
      } else {
        await allevamentoService.createStabilimento({
          ...formData,
          sede_id: sedeId,
          capacita_totale: formData.capacita_totale ? parseInt(formData.capacita_totale) : null,
        });
      }
      setShowForm(false);
      setEditing(null);
      resetForm();
      loadStabilimenti();
    } catch (err) {
      alert(`Errore nel salvataggio: ${err.message}`);
    }
  };

  const handleClose = () => {
    setShowForm(false);
    setEditing(null);
    resetForm();
  };

  const handleEdit = (e, stab) => {
    e.stopPropagation();
    setEditing(stab);
    setFormData({
      nome: stab.nome || '',
      tipo: stab.tipo || '',
      capacita_totale: stab.capacita_totale || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Sei sicuro di voler eliminare questo stabilimento?')) return;
    try {
      await allevamentoService.deleteStabilimento(id);
      loadStabilimenti();
    } catch (err) {
      alert(`Errore nell'eliminazione: ${err.message}`);
    }
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      tipo: '',
      capacita_totale: '',
    });
  };

  return (
    <div className="entity-view">
      <div className="entity-header">
        <div>
          <h2>Stabilimenti</h2>
          <p className="entity-subtitle">Codice Stalla: {sede.codice_stalla}</p>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={onBack}>
            ← Indietro
          </button>
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            Nuovo Stabilimento
          </button>
        </div>
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

      <div className="entity-grid">
        {loading ? (
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'center', padding: '2rem' }}>
            <LoadingSpinner message="Caricamento stabilimenti..." size="medium" />
          </div>
        ) : stabilimenti.length === 0 ? (
          <div className="empty-state">
            <p>Nessuno stabilimento presente per questa sede</p>
          </div>
        ) : (
          stabilimenti.map(stab => (
            <div
              key={stab.id}
              className="entity-card"
            >
              <div className="entity-card-header">
                <h3 style={{ flex: 1 }}>{stab.nome}</h3>
                <div className="entity-actions">
                  <button className="btn-icon" onClick={(e) => handleEdit(e, stab)} title="Modifica">
                    ✏️
                  </button>
                  <button className="btn-icon btn-danger" onClick={(e) => handleDelete(e, stab.id)} title="Elimina">
                    🗑️
                  </button>
                </div>
              </div>
              <div className="entity-card-body">
                {stab.tipo && (
                  <p><strong>Tipo:</strong> {stab.tipo}</p>
                )}
                {stab.capacita_totale && (
                  <p><strong>Capacità:</strong> {stab.capacita_totale} capi</p>
                )}
              </div>
              <div className="entity-card-footer">
                <span className="entity-action" onClick={() => onSelectStabilimento(stab)}>Clicca per vedere i box →</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default StabilimentoView;

