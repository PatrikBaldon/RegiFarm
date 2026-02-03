/**
 * GestioneContrattiSoccida - Gestione contratti di soccida
 */
import React, { useState, useEffect, useCallback } from 'react';
import { amministrazioneService } from '../services/amministrazioneService';
import { useAzienda } from '../../../context/AziendaContext';
import ContrattoSoccidaModal from './ContrattoSoccidaModal';
import AssociaPartiteModal from './AssociaPartiteModal';
import './GestioneContrattiSoccida.css';

const TIPOLOGIE = [
  { value: 'semplice', label: 'Semplice' },
  { value: 'parziaria', label: 'Parziaria' },
  { value: 'con_pascolo', label: 'Con Pascolo' },
  { value: 'monetizzato', label: 'Monetizzato' },
];

const MODALITA_REMUNERAZIONE = [
  { value: 'ripartizione_utili', label: 'Ripartizione Utili' },
  { value: 'quota_giornaliera', label: 'Quota Giornaliera' },
  { value: 'prezzo_kg', label: 'Prezzo per Kg' },
  { value: 'percentuale', label: 'Percentuale' },
];

const GestioneContrattiSoccida = () => {
  const { azienda } = useAzienda();
  const [contratti, setContratti] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showAssociaModal, setShowAssociaModal] = useState(false);
  const [selectedContratto, setSelectedContratto] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [filterAttivo, setFilterAttivo] = useState(null);

  const fetchContratti = useCallback(async () => {
    if (!azienda?.id) return;
    
    setLoading(true);
    try {
      const data = await amministrazioneService.getContrattiSoccidaRiepilogo({
        azienda_id: azienda.id,
      });
      setContratti(data || []);
    } catch (error) {
      // Per errori 503, gestisci silenziosamente
      if (error?.status === 503 || error?.isServiceUnavailable) {
        setContratti([]);
      } else {

      alert('Errore nel caricamento dei contratti');
        setContratti([]);
      }
    } finally {
      setLoading(false);
    }
  }, [azienda?.id]);

  useEffect(() => {
    fetchContratti();
  }, [fetchContratti]);

  const handleShowModal = (contratto = null, edit = false) => {
    setSelectedContratto(contratto);
    setIsEditing(edit || !contratto);
    setShowModal(true);
  };

  const handleCreate = () => {
    handleShowModal(null, true);
  };

  const handleDelete = async (contratto) => {
    if (!window.confirm(`Sei sicuro di voler eliminare il contratto "${contratto.numero_contratto || contratto.id}"?`)) {
      return;
    }

    try {
      await amministrazioneService.deleteContrattoSoccida(contratto.id);
      alert('Contratto eliminato con successo');
      setShowModal(false);
      setSelectedContratto(null);
      fetchContratti();
    } catch (error) {

      alert(`Errore nell'eliminazione del contratto: ${error.message}`);
    }
  };

  const handleAssociaAnimali = () => {
    if (!selectedContratto) return;
    setShowModal(false);
    setShowAssociaModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setSelectedContratto(null);
    setIsEditing(false);
    fetchContratti();
  };

  const handleAssociaModalClose = () => {
    setShowAssociaModal(false);
    setSelectedContratto(null);
    fetchContratti();
  };


  const filteredContratti = filterAttivo === null 
    ? contratti 
    : contratti.filter(c => c.attivo === filterAttivo);

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('it-IT');
  };

  const getTipologiaLabel = (value) => {
    return TIPOLOGIE.find(t => t.value === value)?.label || value;
  };

  const getModalitaLabel = (value) => {
    return MODALITA_REMUNERAZIONE.find(m => m.value === value)?.label || value;
  };

  return (
    <div className="gestione-contratti-soccida">
      <div className="header-actions">
        <div className="filters">
          <label>
            <input
              type="radio"
              name="filterAttivo"
              checked={filterAttivo === null}
              onChange={() => setFilterAttivo(null)}
            />
            Tutti
          </label>
          <label>
            <input
              type="radio"
              name="filterAttivo"
              checked={filterAttivo === true}
              onChange={() => setFilterAttivo(true)}
            />
            Attivi
          </label>
          <label>
            <input
              type="radio"
              name="filterAttivo"
              checked={filterAttivo === false}
              onChange={() => setFilterAttivo(false)}
            />
            Non Attivi
          </label>
        </div>
        <div className="header-actions-buttons">
          <button className="btn btn-primary" onClick={handleCreate}>
            Nuovo Contratto
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading">Caricamento...</div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>N. Contratto</th>
                <th>Soccidante</th>
                <th>Tipologia</th>
                <th>Modalità</th>
                <th>Data Inizio</th>
                <th>Data Fine</th>
                <th>Animali</th>
                <th>Stato</th>
              </tr>
            </thead>
            <tbody>
              {filteredContratti.length === 0 ? (
                <tr>
                  <td colSpan={8} className="empty-state">
                    Nessun contratto trovato
                  </td>
                </tr>
              ) : (
                filteredContratti.map((contratto) => (
                  <tr 
                    key={contratto.id} 
                    className="table-row-clickable" 
                    onClick={() => handleShowModal(contratto, false)}
                  >
                    <td>{contratto.numero_contratto || `#${contratto.id}`}</td>
                    <td>{contratto.soccidante?.nome || '—'}</td>
                    <td>{getTipologiaLabel(contratto.tipologia)}</td>
                    <td>{getModalitaLabel(contratto.modalita_remunerazione)}</td>
                    <td>{formatDate(contratto.data_inizio)}</td>
                    <td>{formatDate(contratto.data_fine)}</td>
                    <td>{contratto.numero_animali || 0}</td>
                    <td>
                      <span className={`badge ${contratto.attivo ? 'badge-success' : 'badge-secondary'}`}>
                        {contratto.attivo ? 'Attivo' : 'Non Attivo'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <ContrattoSoccidaModal
          contratto={selectedContratto}
          aziendaId={azienda?.id}
          isEditing={isEditing}
          onEdit={() => setIsEditing(true)}
          onDelete={() => selectedContratto && handleDelete(selectedContratto)}
          onAssociaAnimali={handleAssociaAnimali}
          onClose={handleModalClose}
        />
      )}

      {showAssociaModal && selectedContratto && (
        <AssociaPartiteModal
          contratto={selectedContratto}
          aziendaId={azienda?.id}
          onClose={handleAssociaModalClose}
        />
      )}
    </div>
  );
};

export default GestioneContrattiSoccida;

