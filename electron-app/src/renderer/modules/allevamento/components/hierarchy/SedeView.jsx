/**
 * SedeView - Gestione sedi di un'azienda
 */
import React, { useState, useEffect } from 'react';
import BaseModal from '../../../../components/BaseModal';
import { allevamentoService } from '../../services/allevamentoService';
import LoadingSpinner from '../../../../components/LoadingSpinner';
import { useRequest } from '../../../../context/RequestContext';
import './EntityView.css';

const SedeView = ({ azienda, onSelectSede, onBack }) => {
  const [sedi, setSedi] = useState([]);
  const [loading, setLoading] = useState(true); // Inizia con loading true
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    codice_stalla: '',
    indirizzo: '',
    latitudine: '',
    longitudine: '',
  });
  const { getAbortController, isActive } = useRequest();

  // Usa azienda.id come dipendenza invece dell'oggetto intero per evitare fetch duplicati
  const aziendaId = azienda?.id;

  useEffect(() => {
    if (aziendaId) {
      loadSedi();
    } else {
      // Se non c'è aziendaId, resetta il loading
      setLoading(false);
    }
    // Cleanup: cancella le richieste quando il componente viene smontato
    return () => {
      // Il RequestProvider gestirà la cancellazione automaticamente
    };
  }, [aziendaId]); // Solo quando cambia l'ID

  const loadSedi = async () => {
    if (!aziendaId) {
      setLoading(false);
      return;
    }
    
    // Ottieni un AbortController per questa richiesta
    const { controller, cleanup } = getAbortController();
    
    try {
      setLoading(true);
      // Passa il signal alla richiesta API
      const data = await allevamentoService.getSedi(aziendaId, { signal: controller.signal });
      
      // Controlla se la richiesta è stata cancellata
      if (controller.aborted) {
        setLoading(false);
        cleanup();
        return;
      }
      
      setSedi(data || []);
    } catch (err) {
      // Ignora errori di cancellazione
      if (err.message?.includes('cancelled') || err.message?.includes('Request cancelled') || err.name === 'AbortError') {
        setLoading(false);
        cleanup();
        return;
      }
      // Per errori 503, gestisci silenziosamente e mostra lista vuota
      if (err.status === 503 || err.isServiceUnavailable) {
        setSedi([]);
      } else {

      }
      // Non mostrare alert per evitare interruzioni
    } finally {
      if (!controller.aborted) {
        setLoading(false);
      }
      cleanup();
    }
  };

  const handleSubmit = async () => {
    try {
      if (editing) {
        await allevamentoService.updateSede(editing.id, {
          ...formData,
          latitudine: formData.latitudine ? parseFloat(formData.latitudine) : null,
          longitudine: formData.longitudine ? parseFloat(formData.longitudine) : null,
        });
      } else {
        await allevamentoService.createSede({
          ...formData,
          azienda_id: aziendaId,
          latitudine: formData.latitudine ? parseFloat(formData.latitudine) : null,
          longitudine: formData.longitudine ? parseFloat(formData.longitudine) : null,
        });
      }
      setShowForm(false);
      setEditing(null);
      resetForm();
      loadSedi();
    } catch (err) {
      alert(`Errore nel salvataggio: ${err.message}`);
    }
  };

  const handleClose = () => {
    setShowForm(false);
    setEditing(null);
    resetForm();
  };

  const handleEdit = (e, sede) => {
    e.stopPropagation();
    setEditing(sede);
    setFormData({
      nome: sede.nome || '',
      codice_stalla: sede.codice_stalla || '',
      indirizzo: sede.indirizzo || '',
      latitudine: sede.latitudine || '',
      longitudine: sede.longitudine || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Sei sicuro di voler eliminare questa sede?')) return;
    try {
      await allevamentoService.deleteSede(id);
      loadSedi();
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
    });
  };

  return (
    <div className="entity-view">
      <div className="entity-header">
        <div>
          <h2>Sedi</h2>
          <p className="entity-subtitle">CF: {azienda.codice_fiscale}</p>
        </div>
        <div className="header-actions">
          {typeof onBack === 'function' && (
            <button className="btn-secondary" onClick={onBack}>
              ← Indietro
            </button>
          )}
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            Nuova Sede
          </button>
        </div>
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
              </div>
      </BaseModal>

      <div className="entity-grid">
        {loading ? (
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'center', padding: '2rem' }}>
            <LoadingSpinner message="Caricamento sedi..." size="medium" />
          </div>
        ) : sedi.length === 0 ? (
          <div className="empty-state">
            <p>Nessuna sede presente per questa azienda</p>
          </div>
        ) : (
          sedi.map(sede => (
            <div
              key={sede.id}
              className="entity-card"
            >
              <div className="entity-card-header">
                <h3 style={{ flex: 1 }}>{sede.nome}</h3>
                <span className="entity-badge">{sede.codice_stalla}</span>
                <div className="entity-actions">
                  <button className="btn-icon" onClick={(e) => handleEdit(e, sede)} title="Modifica">
                    ✏️
                  </button>
                  <button className="btn-icon btn-danger" onClick={(e) => handleDelete(e, sede.id)} title="Elimina">
                    🗑️
                  </button>
                </div>
              </div>
              <div className="entity-card-body">
                {sede.indirizzo && (
                  <p><strong>Indirizzo:</strong> {sede.indirizzo}</p>
                )}
              </div>
              <div className="entity-card-footer">
                <span className="entity-action" onClick={() => onSelectSede(sede)}>Clicca per vedere gli stabilimenti →</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SedeView;

