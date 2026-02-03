/**
 * GestioneFarmaci - Gestione anagrafe farmaci
 */
import React, { useCallback, useEffect, useState } from 'react';
import SearchableSelect from '../../../components/SearchableSelect';
import BaseModal from '../../../components/BaseModal';
import { sanitarioService } from '../services/sanitarioService';
import './GestioneFarmaci.css';
import {
  prefetchSanitarioFarmaci,
  getCachedSanitarioFarmaci,
} from '../prefetchers';
import { useAzienda } from '../../../context/AziendaContext';

const GestioneFarmaci = () => {
  const { azienda } = useAzienda();
  const [farmaci, setFarmaci] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingFarmaco, setEditingFarmaco] = useState(null);
  const [formData, setFormData] = useState({
    nome_commerciale: '',
    principio_attivo: '',
    unita_misura: 'ml',
    descrizione: '',
    note: ''
  });

  const UNITA_MISURA_OPTIONS = [
    { value: 'ml', label: 'ml' },
    { value: 'gr', label: 'gr' },
    { value: 'confezioni', label: 'Confezioni' },
    { value: 'unità', label: 'Unità' },
  ];

  const hydrateFarmaci = useCallback(
    async ({ force = false } = {}) => {
      // Se c'è un searchTerm, sempre ricaricare (ricerca dinamica)
      // Se i dati sono già nello state e non è forzato e non c'è ricerca, non ricaricare
      if (!force && !searchTerm && farmaci.length > 0) {
        return null;
      }

      setLoading(true);
      try {
        if (searchTerm && searchTerm.trim()) {
          const data = await sanitarioService.getFarmaci(searchTerm);
          setFarmaci(data || []);
        } else {
          const cached = getCachedSanitarioFarmaci('');
          if (!force && Array.isArray(cached)) {
            setFarmaci(cached);
            setLoading(false);
            return cached;
          }
          const data = await prefetchSanitarioFarmaci({ force });
          if (Array.isArray(data)) {
            setFarmaci(data);
          }
          return data;
        }
      } catch (err) {

        alert('Errore nel caricamento dei farmaci');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [searchTerm, farmaci.length],
  );

  useEffect(() => {
    hydrateFarmaci();
  }, [hydrateFarmaci]);

  const handleSave = async () => {
    if (!formData.nome_commerciale) {
      alert('Inserisci il nome commerciale');
      return;
    }

    if (!azienda?.id) {
      alert('Nessuna azienda selezionata');
      return;
    }

    setLoading(true);
    try {
      if (editingFarmaco) {
        await sanitarioService.updateFarmaco(editingFarmaco.id, formData);
        alert('Farmaco aggiornato con successo!');
      } else {
        await sanitarioService.createFarmaco({ ...formData, azienda_id: azienda.id });
        alert('Farmaco creato con successo!');
      }
      setShowModal(false);
      setEditingFarmaco(null);
      setFormData({
        nome_commerciale: '',
        principio_attivo: '',
        unita_misura: 'ml',
        descrizione: '',
        note: ''
      });
      hydrateFarmaci({ force: true });
    } catch (err) {

      alert(`Errore: ${err.message || 'Errore nel salvataggio'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (farmaco) => {
    setEditingFarmaco(farmaco);
    setFormData({
      nome_commerciale: farmaco.nome_commerciale || '',
      principio_attivo: farmaco.principio_attivo || '',
      unita_misura: farmaco.unita_misura || 'ml',
      descrizione: farmaco.descrizione || '',
      note: farmaco.note || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo farmaco?')) return;

    setLoading(true);
    try {
      await sanitarioService.deleteFarmaco(id);
      alert('Farmaco eliminato con successo!');
      hydrateFarmaci({ force: true });
    } catch (err) {

      alert(`Errore: ${err.message || 'Errore nell\'eliminazione'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="gestione-farmaci">
      <div className="farmaci-header">
        <h3>Gestione Farmaci</h3>
        <div className="header-controls">
          <input
            type="text"
            placeholder="Cerca farmaco..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <button className="btn-primary" onClick={() => {
            setEditingFarmaco(null);
            setFormData({
              nome_commerciale: '',
              principio_attivo: '',
              unita_misura: 'ml',
              descrizione: '',
              note: ''
            });
            setShowModal(true);
          }}>
            Nuovo Farmaco
          </button>
        </div>
      </div>

      {loading && <div className="loading">Caricamento...</div>}

      <div className="farmaci-grid">
        {farmaci.map(farmaco => (
          <div key={farmaco.id} className="farmaco-card">
            <div className="farmaco-header-card">
              <h4>{farmaco.nome_commerciale}</h4>
              <div className="card-actions">
                <button className="btn-icon" onClick={() => handleEdit(farmaco)} title="Modifica">✏️</button>
                <button className="btn-icon" onClick={() => handleDelete(farmaco.id)} title="Elimina">🗑️</button>
              </div>
            </div>
            <div className="farmaco-details">
              {farmaco.principio_attivo && (
                <p><strong>Principio attivo:</strong> {farmaco.principio_attivo}</p>
              )}
              <p><strong>Unità di misura:</strong> {farmaco.unita_misura}</p>
              {farmaco.descrizione && (
                <p className="descrizione">{farmaco.descrizione}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <BaseModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingFarmaco ? 'Modifica Farmaco' : 'Nuovo Farmaco'}
        size="large"
        footerActions={
          <>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Annulla</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
              {loading ? 'Salvataggio...' : 'Salva'}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label>Nome Commerciale *</label>
          <input
            type="text"
            value={formData.nome_commerciale}
            onChange={(e) => setFormData({...formData, nome_commerciale: e.target.value})}
            required
          />
        </div>
        <div className="form-group">
          <label>Principio Attivo</label>
          <input
            type="text"
            value={formData.principio_attivo}
            onChange={(e) => setFormData({...formData, principio_attivo: e.target.value})}
          />
        </div>
        <div className="form-group">
          <label>Unità di Misura</label>
          <SearchableSelect
            className="select-compact"
            options={UNITA_MISURA_OPTIONS}
            value={formData.unita_misura}
            onChange={(e) => setFormData({ ...formData, unita_misura: e.target.value })}
            displayField="label"
            valueField="value"
            placeholder="Seleziona unità"
          />
        </div>
        <div className="form-group">
          <label>Descrizione</label>
          <textarea
            value={formData.descrizione}
            onChange={(e) => setFormData({...formData, descrizione: e.target.value})}
            rows="3"
          />
        </div>
        <div className="form-group">
          <label>Note</label>
          <textarea
            value={formData.note}
            onChange={(e) => setFormData({...formData, note: e.target.value})}
            rows="2"
          />
        </div>
      </BaseModal>
    </div>
  );
};

export default GestioneFarmaci;

