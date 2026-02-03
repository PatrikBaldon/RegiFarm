/**
 * RegistrazioneAccontoSoccidaModal - Modal per registrare acconto per soccida monetizzata
 */
import React, { useState, useEffect, useMemo } from 'react';
import SmartSelect from '../../../components/SmartSelect';
import BaseModal from '../../../components/BaseModal';
import { amministrazioneService } from '../services/amministrazioneService';
import { useAzienda } from '../../../context/AziendaContext';
import '../../alimentazione/components/Alimentazione.css';
import './RegistrazioneAccontoSoccidaModal.css';

const RegistrazioneAccontoSoccidaModal = ({ isOpen, onClose, onSuccess, contratto: initialContratto = null }) => {
  const { azienda } = useAzienda();
  const aziendaId = azienda?.id;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [contratti, setContratti] = useState([]);
  const [partite, setPartite] = useState([]);
  const [formData, setFormData] = useState({
    contratto_id: initialContratto ? String(initialContratto.id) : '',
    tipo: 'acconto', // 'acconto' | 'saldo' - saldo a chiusura marca le partite come chiuse
    importo: '',
    data: new Date().toISOString().split('T')[0],
    partita_ids: [],
    note: '',
  });

  // Carica contratti soccida monetizzati attivi
  useEffect(() => {
    if (isOpen && aziendaId) {
      loadContratti();
    }
  }, [isOpen, aziendaId]);

  // Pre-seleziona il contratto se passato come prop
  useEffect(() => {
    if (isOpen && initialContratto && initialContratto.id) {
      setFormData(prev => ({
        ...prev,
        contratto_id: String(initialContratto.id),
      }));
    }
  }, [isOpen, initialContratto]);

  // Carica partite quando viene selezionato un contratto
  useEffect(() => {
    if (isOpen && formData.contratto_id) {
      loadPartite();
    } else {
      setPartite([]);
      setFormData(prev => ({ ...prev, partita_ids: [] }));
    }
  }, [isOpen, formData.contratto_id]);

  const loadContratti = async () => {
    try {
      setLoading(true);
      const data = await amministrazioneService.getContrattiSoccida({
        azienda_id: aziendaId,
        attivo: true,
      });
      
      // Filtra solo contratti monetizzati
      let contrattiMonetizzati = Array.isArray(data)
        ? data.filter(c => c.monetizzata === true)
        : [];
      
      // Se c'è un contratto iniziale passato come prop, assicurati che sia nella lista
      if (initialContratto && initialContratto.id && initialContratto.monetizzata) {
        const contrattoEsiste = contrattiMonetizzati.some(c => c.id === initialContratto.id);
        if (!contrattoEsiste) {
          contrattiMonetizzati = [initialContratto, ...contrattiMonetizzati];
        }
      }
      
      setContratti(contrattiMonetizzati);
    } catch (err) {
      setError('Errore nel caricamento dei contratti');
    } finally {
      setLoading(false);
    }
  };

  const loadPartite = async () => {
    if (!formData.contratto_id) return;
    
    try {
      setLoading(true);
      const data = await amministrazioneService.getPartiteContratto(formData.contratto_id);
      setPartite(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('Errore nel caricamento delle partite');
    } finally {
      setLoading(false);
    }
  };

  const contrattiOptions = useMemo(
    () =>
      contratti.map((c) => ({
        value: String(c.id),
        label: c.numero_contratto
          ? `${c.numero_contratto} - ${c.soccidante?.nome || 'N/A'}`
          : `Contratto #${c.id} - ${c.soccidante?.nome || 'N/A'}`,
      })),
    [contratti]
  );

  const partiteOptions = useMemo(
    () =>
      partite.map((p) => ({
        value: String(p.id),
        label: p.numero_partita
          ? `Partita ${p.numero_partita} - ${p.numero_capi} capi (${p.data ? new Date(p.data).toLocaleDateString('it-IT') : 'N/A'})`
          : `Partita #${p.id} - ${p.numero_capi} capi`,
        numero_capi: p.numero_capi || 0,
      })),
    [partite]
  );

  // Calcola importo per partita e acconto per capo (distribuzione proporzionale ai capi)
  const { importoPerPartita, accontoPerCapo } = useMemo(() => {
    if (!formData.importo || formData.partita_ids.length === 0) {
      return { importoPerPartita: {}, accontoPerCapo: {} };
    }

    const importo = parseFloat(formData.importo) || 0;
    
    // Calcola totale capi delle partite selezionate
    const totaleCapiSelezionati = formData.partita_ids.reduce((acc, partitaId) => {
      const partita = partite.find((p) => String(p.id) === partitaId);
      return acc + (partita?.numero_capi || 0);
    }, 0);

    const resultImporto = {};
    const resultPerCapo = {};

    formData.partita_ids.forEach((partitaId) => {
      const partita = partite.find((p) => String(p.id) === partitaId);
      const numeroCapi = partita?.numero_capi || 0;
      
      if (totaleCapiSelezionati > 0 && numeroCapi > 0) {
        // Distribuzione proporzionale al numero di capi
        const importoPartita = (importo * numeroCapi) / totaleCapiSelezionati;
        resultImporto[partitaId] = importoPartita.toFixed(2);
        resultPerCapo[partitaId] = (importoPartita / numeroCapi).toFixed(2);
      } else {
        // Fallback: divisione equa se non ci sono dati sui capi
        const importoPartita = importo / formData.partita_ids.length;
        resultImporto[partitaId] = importoPartita.toFixed(2);
        resultPerCapo[partitaId] = numeroCapi > 0 ? (importoPartita / numeroCapi).toFixed(2) : '0.00';
      }
    });

    return { importoPerPartita: resultImporto, accontoPerCapo: resultPerCapo };
  }, [formData.importo, formData.partita_ids, partite]);

  const handleContrattoChange = (e) => {
    const contrattoId = e.target.value;
    setFormData({
      ...formData,
      contratto_id: contrattoId,
      partita_ids: [], // Reset partite quando cambia contratto
    });
  };

  const handlePartiteChange = (e) => {
    const selectedOptions = Array.from(e.target.selectedOptions, (opt) => opt.value);
    setFormData({
      ...formData,
      partita_ids: selectedOptions,
    });
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.contratto_id || !formData.importo || !formData.data) {
      setError('Compila tutti i campi obbligatori');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        contratto_id: parseInt(formData.contratto_id),
        tipo: formData.tipo || 'acconto',
        importo: parseFloat(formData.importo),
        data: formData.data,
        partita_ids: formData.partita_ids.length > 0
          ? formData.partita_ids.map((id) => parseInt(id))
          : null,
        note: formData.note || null,
      };

      await amministrazioneService.registraAccontoSoccida(payload);
      
      if (onSuccess) {
        onSuccess();
      }
      
      // Reset form (mantieni il contratto se passato come prop)
      setFormData({
        contratto_id: initialContratto ? String(initialContratto.id) : '',
        tipo: 'acconto',
        importo: '',
        data: new Date().toISOString().split('T')[0],
        partita_ids: [],
        note: '',
      });
      
      onClose();
    } catch (err) {
      setError(err.message || 'Errore nella registrazione dell\'acconto');
    } finally {
      setLoading(false);
    }
  };

  const selectedContratto = contratti.find((c) => String(c.id) === formData.contratto_id);

  const isSaldo = formData.tipo === 'saldo';

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={isSaldo ? 'Registra Saldo a chiusura' : 'Registra Acconto Soccida Monetizzata'}
      size="medium"
      className="registrazione-acconto-modal"
      footerActions={
        <>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={loading}
          >
            Annulla
          </button>
          <button
            type="submit"
            form="acconto-form"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? 'Salvataggio...' : isSaldo ? 'Registra Saldo a chiusura' : 'Registra Acconto'}
          </button>
        </>
      }
    >
      <form id="acconto-form" onSubmit={handleSubmit}>
        {error && (
          <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        <div className="form-group">
          <label>Tipo movimento *</label>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="radio"
                name="tipo"
                value="acconto"
                checked={formData.tipo === 'acconto'}
                onChange={() => setFormData({ ...formData, tipo: 'acconto' })}
                disabled={loading}
              />
              <span>Acconto</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="radio"
                name="tipo"
                value="saldo"
                checked={formData.tipo === 'saldo'}
                onChange={() => setFormData({ ...formData, tipo: 'saldo' })}
                disabled={loading}
              />
              <span>Saldo a chiusura</span>
            </label>
          </div>
          {isSaldo && (
            <p className="form-hint" style={{ marginTop: '0.5rem', color: '#b45309' }}>
              Le partite selezionate saranno marcate come chiuse e non compariranno più in acconti/saldi.
            </p>
          )}
        </div>

        <div className="form-group">
          <label>Contratto Soccida Monetizzata *</label>
          <SmartSelect
            options={contrattiOptions}
            value={formData.contratto_id}
            onChange={handleContrattoChange}
            placeholder="Seleziona contratto..."
            disabled={loading || !!initialContratto}
            required
          />
          {initialContratto && (
            <p className="form-hint" style={{ marginTop: '4px', fontSize: '12px', color: '#666' }}>
              Contratto pre-selezionato dalla modale di gestione
            </p>
          )}
        </div>

        <div className="form-row">
          <div className="form-group span-6">
            <label>Importo (€) *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.importo}
              onChange={(e) => setFormData({ ...formData, importo: e.target.value })}
              required
              disabled={loading}
            />
          </div>
          <div className="form-group span-6">
            <label>Data *</label>
            <input
              type="date"
              value={formData.data}
              onChange={(e) => setFormData({ ...formData, data: e.target.value })}
              required
              disabled={loading}
            />
          </div>
        </div>

        {formData.contratto_id && (
          <>
            <div className="form-group">
              <label>Partite (opzionale - seleziona per associare l'acconto)</label>
              <select
                multiple
                size={Math.min(partiteOptions.length, 5)}
                value={formData.partita_ids}
                onChange={handlePartiteChange}
                disabled={loading || partiteOptions.length === 0}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                }}
              >
                {partiteOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {partiteOptions.length === 0 && (
                <p className="form-hint">Nessuna partita disponibile per questo contratto</p>
              )}
              {formData.partita_ids.length > 0 && (
                <p className="form-hint" style={{ marginTop: '0.5rem', color: '#059669' }}>
                  ✓ L'importo sarà distribuito proporzionalmente al numero di capi di ogni partita
                </p>
              )}
            </div>

            {formData.partita_ids.length > 0 && formData.importo && (
              <div className="acconto-preview" style={{
                marginTop: '1rem',
                padding: '1rem',
                backgroundColor: '#f5f5f5',
                borderRadius: '4px',
                border: '1px solid #ddd',
              }}>
                <h4 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Preview Distribuzione (proporzionale ai capi)</h4>
                <table style={{ width: '100%', fontSize: '0.9rem' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>Partita</th>
                      <th style={{ textAlign: 'right' }}>N° Capi</th>
                      <th style={{ textAlign: 'right' }}>Importo Partita</th>
                      <th style={{ textAlign: 'right' }}>Acconto per Capo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.partita_ids.map((partitaId) => {
                      const partita = partite.find((p) => String(p.id) === partitaId);
                      const partitaOption = partiteOptions.find((opt) => opt.value === partitaId);
                      const importoPartitaCalc = importoPerPartita[partitaId] || '0.00';
                      const perCapo = accontoPerCapo[partitaId] || '0.00';

                      return (
                        <tr key={partitaId}>
                          <td>{partitaOption?.label || `Partita #${partitaId}`}</td>
                          <td style={{ textAlign: 'right' }}>{partita?.numero_capi || 0}</td>
                          <td style={{ textAlign: 'right' }}>€ {importoPartitaCalc}</td>
                          <td style={{ textAlign: 'right' }}>€ {perCapo}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: 'bold', borderTop: '1px solid #ddd' }}>
                      <td>Totale</td>
                      <td style={{ textAlign: 'right' }}>
                        {formData.partita_ids.reduce((acc, partitaId) => {
                          const partita = partite.find((p) => String(p.id) === partitaId);
                          return acc + (partita?.numero_capi || 0);
                        }, 0)} capi
                      </td>
                      <td style={{ textAlign: 'right' }}>€ {parseFloat(formData.importo || 0).toFixed(2)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </>
        )}

        <div className="form-group">
          <label>Note (opzionale)</label>
          <textarea
            value={formData.note}
            onChange={(e) => setFormData({ ...formData, note: e.target.value })}
            rows={3}
            disabled={loading}
            placeholder="Note aggiuntive sull'acconto..."
          />
        </div>
      </form>
    </BaseModal>
  );
};

export default RegistrazioneAccontoSoccidaModal;

