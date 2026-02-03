/**
 * MagazzinoMedicinali - Gestione magazzino medicinali per azienda
 */
import React, { useCallback, useEffect, useState } from 'react';
import SearchableSelect from '../../../components/SearchableSelect';
import BaseModal from '../../../components/BaseModal';
import { sanitarioService } from '../services/sanitarioService';
import { useAzienda } from '../../../context/AziendaContext';
import { useRequest } from '../../../context/RequestContext';
import '../../alimentazione/components/Alimentazione.css';
import './MagazzinoMedicinali.css';
import {
  prefetchSanitarioMagazzino,
  prefetchSanitarioFarmaci,
  getCachedSanitarioMagazzino,
  getCachedSanitarioFarmaci,
} from '../prefetchers';

const MagazzinoMedicinali = () => {
  const { azienda, loading: aziendaLoading } = useAzienda();
  const aziendaId = azienda?.id;
  const [lotti, setLotti] = useState([]);
  const [farmaci, setFarmaci] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    farmaco_id: '',
    lotto: '',
    scadenza: '',
    quantita_iniziale: '',
    fornitore: '',
    numero_fattura: '',
    data_acquisto: '',
    note: ''
  });

  const applyMagazzinoPayload = useCallback((payload) => {
    if (!payload) return;
    setLotti(payload.lotti || []);
    setFarmaci(payload.farmaci || []);
  }, []);

  const hydrateFarmaci = useCallback(
    async ({ force = false } = {}) => {
      // Se i dati sono già nello state e non è forzato, non ricaricare
      if (!force && farmaci.length > 0) {
        return null;
      }

      const cached = getCachedSanitarioFarmaci('');
      if (!force && Array.isArray(cached)) {
        setFarmaci(cached);
        return cached;
      }
      try {
        const data = await prefetchSanitarioFarmaci({ force });
        if (Array.isArray(data)) {
          setFarmaci(data);
        }
        return data;
      } catch (err) {

        return null;
      }
    },
    [farmaci.length],
  );

  const hydrateMagazzino = useCallback(
    async ({ force = false } = {}) => {
      if (!aziendaId) {
        setLotti([]);
        setLoading(false);
        return null;
      }

      // Se i dati sono già nello state e non è forzato, non ricaricare
      if (!force && lotti.length > 0) {
        return null;
      }

      const cached = getCachedSanitarioMagazzino(aziendaId);
      if (!force && cached) {
        applyMagazzinoPayload(cached);
        setLoading(false);
        return cached;
      } else if (force) {
        setLoading(true);
      } else if (!cached) {
        setLoading(true);
      }

      try {
        const data = await prefetchSanitarioMagazzino(aziendaId, { force });
        if (data) {
          applyMagazzinoPayload(data);
        }
        return data;
      } catch (err) {

        alert('Errore nel caricamento del magazzino');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [aziendaId, applyMagazzinoPayload, lotti.length],
  );

  useEffect(() => {
    hydrateFarmaci();
  }, [hydrateFarmaci]);

  useEffect(() => {
    if (aziendaId) {
      hydrateMagazzino();
    } else {
      setLotti([]);
    }
  }, [aziendaId, hydrateMagazzino]);

  const handleAddLotto = async () => {
    if (!formData.farmaco_id || !formData.lotto || !formData.quantita_iniziale) {
      alert('Compila tutti i campi obbligatori');
      return;
    }

    setLoading(true);
    try {
      await sanitarioService.createLottoFarmaco({
        ...formData,
        farmaco_id: parseInt(formData.farmaco_id),
        azienda_id: aziendaId,
        quantita_iniziale: parseFloat(formData.quantita_iniziale),
        quantita_rimanente: parseFloat(formData.quantita_iniziale),
        scadenza: formData.scadenza || null,
        data_acquisto: formData.data_acquisto || null
      });
      alert('Lotto aggiunto con successo!');
      setShowAddModal(false);
      setFormData({
        farmaco_id: '',
        lotto: '',
        scadenza: '',
        quantita_iniziale: '',
        fornitore: '',
        numero_fattura: '',
        data_acquisto: '',
        note: ''
      });
      hydrateMagazzino({ force: true });
    } catch (err) {

      alert(`Errore: ${err.message || 'Errore nell\'aggiunta del lotto'}`);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('it-IT');
  };

  const isExpiringSoon = (scadenza) => {
    if (!scadenza) return false;
    const scad = new Date(scadenza);
    const oggi = new Date();
    const giorniMancanti = Math.ceil((scad - oggi) / (1000 * 60 * 60 * 24));
    return giorniMancanti <= 90 && giorniMancanti >= 0;
  };

  const isExpired = (scadenza) => {
    if (!scadenza) return false;
    const scad = new Date(scadenza);
    const oggi = new Date();
    return scad < oggi;
  };

  return (
    <div className="magazzino-medicinali">
      <div className="magazzino-header">
        <h3>Magazzino Medicinali</h3>
        <div className="header-controls">
          <button
            className="btn-primary"
            onClick={() => setShowAddModal(true)}
            disabled={!aziendaId || loading}
          >
            Aggiungi Farmaco
          </button>
        </div>
      </div>

      {!aziendaId && (
         <div className="empty-state">
          <p>Configura l'azienda nelle impostazioni allevamento per abilitare il magazzino.</p>
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
                <th>Farmaco</th>
                <th>Lotto</th>
                <th>Scadenza</th>
                <th>Quantità Iniziale</th>
                <th>Quantità Rimanente</th>
                <th>Fornitore</th>
                <th>Fattura</th>
                <th>Stato</th>
              </tr>
            </thead>
            <tbody>
                  {lotti.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="empty-state">
                        Nessun farmaco presente nel magazzino
                      </td>
                    </tr>
                  ) : (
                    lotti.map(lotto => {
                const farmaco = farmaci.find(f => f.id === lotto.farmaco_id);
                const scadenza = lotto.scadenza ? new Date(lotto.scadenza) : null;
                const expiring = scadenza && isExpiringSoon(lotto.scadenza);
                const expired = scadenza && isExpired(lotto.scadenza);
                
                return (
                  <tr key={lotto.id} className={expired ? 'expired' : expiring ? 'expiring' : ''}>
                    <td>{farmaco ? farmaco.nome_commerciale : 'N/A'}</td>
                    <td>{lotto.lotto}</td>
                    <td>{formatDate(lotto.scadenza)}</td>
                    <td>{parseFloat(lotto.quantita_iniziale).toFixed(2)} {farmaco?.unita_misura || ''}</td>
                    <td className={parseFloat(lotto.quantita_rimanente) === 0 ? 'quantita-zero' : ''}>
                      {parseFloat(lotto.quantita_rimanente).toFixed(2)} {farmaco?.unita_misura || ''}
                    </td>
                    <td>{lotto.fornitore || '-'}</td>
                    <td>{lotto.numero_fattura || '-'}</td>
                    <td>
                      {expired && <span className="badge badge-danger">Scaduto</span>}
                      {!expired && expiring && <span className="badge badge-warning">In Scadenza</span>}
                      {!expired && !expiring && parseFloat(lotto.quantita_rimanente) > 0 && (
                        <span className="badge badge-success">Disponibile</span>
                      )}
                      {parseFloat(lotto.quantita_rimanente) === 0 && (
                        <span className="badge badge-secondary">Esaurito</span>
                      )}
                    </td>
                  </tr>
                );
                    })
                  )}
            </tbody>
          </table>
        </div>
          )}
        </>
      )}

      <BaseModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Aggiungi Farmaco al Magazzino"
        size="large"
        footerActions={
          <>
            <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Annulla</button>
            <button className="btn btn-primary" onClick={handleAddLotto} disabled={loading}>
              {loading ? 'Salvataggio...' : 'Aggiungi'}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label>Farmaco *</label>
          <SearchableSelect
            className="select-compact"
            options={farmaci.map((f) => ({ value: String(f.id), label: f.nome_commerciale }))}
            value={formData.farmaco_id ? String(formData.farmaco_id) : ''}
            onChange={(e) =>
              setFormData({
                ...formData,
                farmaco_id: e.target.value ? parseInt(e.target.value, 10) : '',
              })
            }
            displayField="label"
            valueField="value"
            placeholder="Seleziona farmaco..."
            required
          />
        </div>
        <div className="form-group">
          <label>Numero Lotto *</label>
          <input
            type="text"
            value={formData.lotto}
            onChange={(e) => setFormData({...formData, lotto: e.target.value})}
            required
          />
        </div>
        <div className="form-grid">
          <div className="form-group span-6">
            <label>Quantità *</label>
            <input
              type="number"
              step="0.01"
              value={formData.quantita_iniziale}
              onChange={(e) => setFormData({...formData, quantita_iniziale: e.target.value})}
              required
            />
          </div>
          <div className="form-group span-6">
            <label>Scadenza</label>
            <input
              type="date"
              value={formData.scadenza}
              onChange={(e) => setFormData({...formData, scadenza: e.target.value})}
            />
          </div>
        </div>
        <div className="form-grid">
          <div className="form-group span-6">
            <label>Fornitore</label>
            <input
              type="text"
              value={formData.fornitore}
              onChange={(e) => setFormData({...formData, fornitore: e.target.value})}
            />
          </div>
          <div className="form-group span-6">
            <label>Numero Fattura</label>
            <input
              type="text"
              value={formData.numero_fattura}
              onChange={(e) => setFormData({...formData, numero_fattura: e.target.value})}
            />
          </div>
        </div>
        <div className="form-group">
          <label>Data Acquisto</label>
          <input
            type="date"
            value={formData.data_acquisto}
            onChange={(e) => setFormData({...formData, data_acquisto: e.target.value})}
          />
        </div>
        <div className="form-group span-12">
          <label>Note</label>
          <textarea
            value={formData.note}
            onChange={(e) => setFormData({...formData, note: e.target.value})}
            rows="3"
          />
        </div>
        <p className="form-hint">
          💡 <strong>Nota:</strong> Se aggiungi lo stesso farmaco con lo stesso numero di lotto, 
          la quantità verrà automaticamente aumentata.
        </p>
      </BaseModal>
    </div>
  );
};

export default MagazzinoMedicinali;

