/**
 * StoricoSomministrazioni - Visualizza storico somministrazioni
 */
import React, { useCallback, useEffect, useState } from 'react';
import { sanitarioService } from '../services/sanitarioService';
import { allevamentoService } from '../../allevamento/services/allevamentoService';
import SearchableSelect from '../../../components/SearchableSelect';
import BaseModal from '../../../components/BaseModal';
import { useAzienda } from '../../../context/AziendaContext';
import { useRequest } from '../../../context/RequestContext';
import './StoricoSomministrazioni.css';
import {
  prefetchSanitarioSomministrazioni,
  getCachedSanitarioSomministrazioni,
  prefetchSanitarioMagazzino,
  getCachedSanitarioMagazzino,
} from '../prefetchers';

const StoricoSomministrazioni = ({ onNewClick, onNewGruppoClick }) => {
  const { azienda, loading: aziendaLoading } = useAzienda();
  const aziendaId = azienda?.id;
  const [somministrazioni, setSomministrazioni] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSomministrazione, setEditingSomministrazione] = useState(null);
  const [animali, setAnimali] = useState([]);
  const [farmaci, setFarmaci] = useState([]);
  const [giacenze, setGiacenze] = useState([]);
  const [formData, setFormData] = useState({
    animale_id: '',
    farmaco_id: '',
    lotto_farmaco_id: '',
    quantita: '',
    data_ora: '',
    operatore_nome: '',
    veterinario: '',
    note: '',
    periodo_sospensione: ''
  });

  const applySomministrazioniPayload = useCallback((payload) => {
    if (!payload) return;
    setSomministrazioni(payload.somministrazioni || []);
    setAnimali(payload.animali || []);
    setFarmaci(payload.farmaci || []);
    setGiacenze((payload.giacenze || []).filter((l) => parseFloat(l.quantita_rimanente) > 0));
  }, []);

  const hydrateSomministrazioni = useCallback(
    async ({ force = false, showErrors = true } = {}) => {
      if (!aziendaId) {
        setSomministrazioni([]);
        setAnimali([]);
        setFarmaci([]);
        setGiacenze([]);
        setLoading(false);
        return null;
      }

      // Se i dati sono già nello state e non è forzato, non ricaricare
      if (!force && somministrazioni.length > 0) {
        return null;
      }

      const cached = getCachedSanitarioSomministrazioni(aziendaId);
      if (!force && cached) {
        applySomministrazioniPayload(cached);
        setLoading(false);
        return cached;
      } else if (force) {
        setLoading(true);
      } else if (!cached) {
        setLoading(true);
      }

      try {
        const data = await prefetchSanitarioSomministrazioni(aziendaId, { force });
        if (data) {
          applySomministrazioniPayload(data);
        }
        return data;
      } catch (err) {

        if (showErrors) {
          alert('Errore nel caricamento dello storico');
        }
        return null;
      } finally {
        setLoading(false);
      }
    },
    [aziendaId, applySomministrazioniPayload, somministrazioni.length],
  );

  useEffect(() => {
    if (aziendaId) {
      hydrateSomministrazioni();
    } else {
      setSomministrazioni([]);
      setAnimali([]);
      setFarmaci([]);
      setGiacenze([]);
    }
  }, [aziendaId, hydrateSomministrazioni]);

  // Rimuoviamo questo useEffect per evitare loop - carichiamo le giacenze manualmente quando necessario

  const loadGiacenze = async (farmacoId = null) => {
    const farmacoIdToUse = farmacoId || formData.farmaco_id;
    if (!aziendaId || !farmacoIdToUse) {
      setGiacenze([]);
      return;
    }
    try {
      const cachedMagazzino = getCachedSanitarioMagazzino(aziendaId);
      let data = cachedMagazzino?.lotti;
      if (!Array.isArray(data)) {
        const prefetched = await prefetchSanitarioMagazzino(aziendaId);
        data = prefetched?.lotti;
      }
      if (!Array.isArray(data)) {
        data = await sanitarioService.getGiacenzeAzienda(aziendaId);
      }
      const disponibili = (data || []).filter(l => 
        parseFloat(l.quantita_rimanente) > 0 && l.farmaco_id === parseInt(farmacoIdToUse)
      );
      setGiacenze(disponibili);
    } catch (err) {

      setGiacenze([]);
    }
  };

  const handleEdit = (somministrazione) => {
    setEditingSomministrazione(somministrazione);
    const dataOra = somministrazione.data_ora 
      ? new Date(somministrazione.data_ora).toISOString().slice(0, 16)
      : new Date().toISOString().slice(0, 16);
    
    setFormData({
      animale_id: somministrazione.animale_id ? somministrazione.animale_id.toString() : '',
      farmaco_id: somministrazione.farmaco_id ? somministrazione.farmaco_id.toString() : '',
      lotto_farmaco_id: somministrazione.lotto_farmaco_id ? somministrazione.lotto_farmaco_id.toString() : '',
      quantita: parseFloat(somministrazione.quantita).toString(),
      data_ora: dataOra,
      operatore_nome: somministrazione.operatore_nome || '',
      veterinario: somministrazione.veterinario || '',
      note: somministrazione.note || '',
      periodo_sospensione: somministrazione.periodo_sospensione ? somministrazione.periodo_sospensione.toString() : ''
    });
    setShowEditModal(true);
    // Carica giacenze se c'è un farmaco
    if (somministrazione.farmaco_id) {
      setTimeout(() => loadGiacenze(somministrazione.farmaco_id.toString()), 100);
    }
  };

  const handleUpdate = async () => {
    if (!formData.animale_id || !formData.farmaco_id || !formData.quantita || parseFloat(formData.quantita) <= 0) {
      alert('Compila tutti i campi obbligatori');
      return;
    }

    setLoading(true);
    try {
      await sanitarioService.updateSomministrazione(editingSomministrazione.id, {
        animale_id: parseInt(formData.animale_id),
        farmaco_id: parseInt(formData.farmaco_id),
        lotto_farmaco_id: formData.lotto_farmaco_id ? parseInt(formData.lotto_farmaco_id) : null,
        quantita: parseFloat(formData.quantita),
        periodo_sospensione: formData.periodo_sospensione ? parseInt(formData.periodo_sospensione) : null,
        data_ora: formData.data_ora ? new Date(formData.data_ora).toISOString() : new Date().toISOString(),
        operatore_nome: formData.operatore_nome,
        veterinario: formData.veterinario,
        note: formData.note
      });
      alert('Somministrazione aggiornata con successo!');
      setShowEditModal(false);
      setEditingSomministrazione(null);
      await hydrateSomministrazioni({ force: true });
      loadGiacenze(); // Ricarica giacenze per aggiornare quantità
    } catch (err) {

      alert(`Errore: ${err.message || 'Errore nell\'aggiornamento'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Sei sicuro di voler eliminare questa somministrazione? La quantità verrà ripristinata nel lotto se presente.')) {
      return;
    }

    setLoading(true);
    try {
      await sanitarioService.deleteSomministrazione(id);
      alert('Somministrazione eliminata con successo!');
      await hydrateSomministrazioni({ force: true });
    } catch (err) {

      alert(`Errore: ${err.message || 'Errore nell\'eliminazione'}`);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('it-IT');
  };

  return (
      <div className="storico-somministrazioni">
      <div className="storico-header">
        <h3>Storico Somministrazioni</h3>
        <div className="storico-header-actions">
          {onNewClick && (
            <>
              <button className="btn-primary" onClick={onNewClick}>
                Nuova Somministrazione
              </button>
              {onNewGruppoClick && (
                <button className="btn-secondary" onClick={onNewGruppoClick}>
                  Somministrazione di Gruppo
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {!aziendaId && (
        <div className="empty-state">
          <p>Configura l'azienda nelle impostazioni allevamento per visualizzare lo storico.</p>
        </div>
      )}

      {aziendaId && (
        <>
          {loading ? (
            <div className="loading">Caricamento...</div>
          ) : (
            <div className="table-container">
              <table className="data-table">
            <thead>
              <tr>
                <th>Data/Ora</th>
                <th>Animale</th>
                <th>Farmaco</th>
                <th>Quantità / Unità</th>
                <th>Operatore</th>
                <th>Veterinario</th>
                <th>Periodo Sospensione</th>
                <th>Note</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
                  {somministrazioni.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="empty-state">
                        Nessuna somministrazione registrata
                      </td>
                    </tr>
                  ) : (
                    somministrazioni.map(som => (
                <tr key={som.id}>
                  <td>{formatDateTime(som.data_ora)}</td>
                  <td>{som.animale?.auricolare || 'N/A'}</td>
                  <td>{som.farmaco?.nome_commerciale || 'N/A'}</td>
                  <td>
                    <span className="quantita-value">{parseFloat(som.quantita).toFixed(2)}</span>
                    <span className="unita-misura">{som.farmaco?.unita_misura || 'N/A'}</span>
                  </td>
                  <td>{som.operatore_nome || '-'}</td>
                  <td>{som.veterinario || '-'}</td>
                  <td>{som.periodo_sospensione ? `${som.periodo_sospensione} giorni` : '-'}</td>
                  <td className="note-cell">{som.note || '-'}</td>
                  <td className="actions-cell">
                    <button 
                            className="btn-icon" 
                      onClick={() => handleEdit(som)}
                      title="Modifica"
                    >
                      ✏️
                    </button>
                    <button 
                            className="btn-icon" 
                      onClick={() => handleDelete(som.id)}
                      title="Elimina"
                      disabled={loading}
                    >
                      🗑️
                    </button>
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

      <BaseModal
        isOpen={showEditModal && !!editingSomministrazione}
        onClose={() => setShowEditModal(false)}
        title="Modifica Somministrazione"
        size="xlarge"
        footerActions={
          <>
            <button className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Annulla</button>
            <button className="btn btn-primary" onClick={handleUpdate} disabled={loading}>
              {loading ? 'Salvataggio...' : 'Salva Modifiche'}
            </button>
          </>
        }
      >
        <div className="form-row">
          <div className="form-group">
            <label>Animale (Auricolare) *</label>
            <SearchableSelect
              options={animali}
              value={formData.animale_id ? String(formData.animale_id) : ''}
              onChange={(e) => setFormData({...formData, animale_id: e.target.value, lotto_farmaco_id: ''})}
              placeholder="Cerca animale (auricolare)..."
              displayField="auricolare"
              valueField="id"
              required
            />
          </div>
          <div className="form-group">
            <label>Farmaco *</label>
            <SearchableSelect
              options={farmaci}
              value={formData.farmaco_id ? String(formData.farmaco_id) : ''}
              onChange={(e) => {
                setFormData({...formData, farmaco_id: e.target.value, lotto_farmaco_id: ''});
                loadGiacenze(e.target.value);
              }}
              placeholder="Cerca farmaco..."
              displayField="nome_commerciale"
              valueField="id"
              required
            />
          </div>
        </div>
        {formData.farmaco_id && (
          <>
            {giacenze.length > 0 && (
              <div className="form-group">
                <label>Lotto Farmaco (opzionale)</label>
                <SearchableSelect
                  options={giacenze.map(lotto => {
                    const farmaco = farmaci.find(f => f.id === parseInt(formData.farmaco_id));
                    return {
                      ...lotto,
                      displayName: `Lotto: ${lotto.lotto} - Qty: ${parseFloat(lotto.quantita_rimanente).toFixed(2)} ${farmaco?.unita_misura || ''}`
                    };
                  })}
                  value={formData.lotto_farmaco_id ? String(formData.lotto_farmaco_id) : ''}
                  onChange={(e) => setFormData({...formData, lotto_farmaco_id: e.target.value})}
                  placeholder="Seleziona lotto (opzionale)..."
                  displayField="displayName"
                  valueField="id"
                />
              </div>
            )}
            <div className="form-group">
              <label>Unità di Misura</label>
              <input 
                type="text" 
                value={farmaci.find(f => f.id === parseInt(formData.farmaco_id))?.unita_misura || 'N/A'} 
                readOnly 
                className="readonly-input" 
              />
            </div>
          </>
        )}
        
        <div className="form-row">
          <div className="form-group">
            <label>Quantità * ({farmaci.find(f => f.id === parseInt(formData.farmaco_id))?.unita_misura || 'Unità di misura'})</label>
            <div className="quantita-input-group">
              <input
                type="number"
                step="0.01"
                value={formData.quantita}
                onChange={(e) => setFormData({...formData, quantita: e.target.value})}
                required
                className="quantita-input"
              />
              <span className="quantita-unit">{farmaci.find(f => f.id === parseInt(formData.farmaco_id))?.unita_misura || 'N/A'}</span>
            </div>
          </div>
          <div className="form-group">
            <label>Data e Ora *</label>
            <input
              type="datetime-local"
              value={formData.data_ora}
              onChange={(e) => setFormData({...formData, data_ora: e.target.value})}
              required
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Operatore</label>
            <input
              type="text"
              value={formData.operatore_nome}
              onChange={(e) => setFormData({...formData, operatore_nome: e.target.value})}
            />
          </div>
          <div className="form-group">
            <label>Veterinario</label>
            <input
              type="text"
              value={formData.veterinario}
              onChange={(e) => setFormData({...formData, veterinario: e.target.value})}
            />
          </div>
        </div>
        <div className="form-group">
          <label>Periodo Sospensione (giorni)</label>
          <input
            type="number"
            value={formData.periodo_sospensione}
            onChange={(e) => setFormData({...formData, periodo_sospensione: e.target.value})}
            placeholder="Giorni di attesa prima macellazione"
          />
        </div>
        <div className="form-group">
          <label>Note</label>
          <textarea
            value={formData.note}
            onChange={(e) => setFormData({...formData, note: e.target.value})}
            rows="3"
          />
        </div>
      </BaseModal>
    </div>
  );
};

export default StoricoSomministrazioni;

