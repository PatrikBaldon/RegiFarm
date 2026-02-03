/**
 * AssociaPartiteFatturaModal - consente di associare partite di ingresso/uscite a una fattura
 * Quando categoria='animali', permette di collegare partite tramite PartitaMovimentoFinanziario
 * Tutte le fatture hanno lo stesso valore e vengono gestite tramite movimenti finanziari
 */
import React, { useEffect, useMemo, useState } from 'react';
import { amministrazioneService } from '../services/amministrazioneService';
import BaseModal from '../../../components/BaseModal';
import SmartSelect from '../../../components/SmartSelect';
import './AssociaPartiteModal.css';

const PARTITE_FETCH_LIMIT = 1000;

// Opzioni tipo movimento finanziario
const TIPO_MOVIMENTO_OPTIONS = [
  { value: 'acconto', label: 'Acconto' },
  { value: 'saldo', label: 'Saldo' },
  { value: 'altro', label: 'Altro' },
];

const formatDate = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('it-IT');
  } catch {
    return value;
  }
};

const formatCurrency = (value) => {
  if (!value) return '€0.00';
  try {
    return `€${parseFloat(value).toFixed(2)}`;
  } catch {
    return `€${value}`;
  }
};

const AssociaPartiteFatturaModal = ({ fattura, aziendaId, onClose, onSuccess }) => {
  const [partite, setPartite] = useState([]);
  const [partiteAssociate, setPartiteAssociate] = useState([]); // Array di { partita, movimento } per partite già associate
  const [selectedPartite, setSelectedPartite] = useState([]); // Array di { partitaId, tipoMovimento }
  const [tipoMovimentoDefault, setTipoMovimentoDefault] = useState('acconto'); // Tipo movimento di default
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  const fatturaLabel = fattura?.numero || `#${fattura?.id ?? ''}`;
  const isFatturaEmessa = fattura?.tipo === 'entrata' || fattura?.sourceType === 'emessa' || fattura?.isEmessa;
  const fatturaImporto = parseFloat(fattura?.importo_totale || 0);
  const fatturaData = fattura?.data_fattura || new Date().toISOString().split('T')[0];

  // Determina quali tipi di partite mostrare in base al tipo di fattura
  const tipiPartiteDaMostrare = useMemo(() => {
    if (isFatturaEmessa) {
      // Fattura emessa: mostra partite di ingresso (acconti al soccidante) e uscita (vendite)
      return ['ingresso', 'uscita'];
    } else {
      // Fattura ricevuta: mostra solo partite di ingresso (acquisti)
      return ['ingresso'];
    }
  }, [isFatturaEmessa]);

  const loadPartiteDisponibili = async () => {
    if (!aziendaId) return;
    try {
      setLoading(true);
      
      // Carica tutte le partite dei tipi rilevanti
      const promises = tipiPartiteDaMostrare.map(async (tipo) => {
        const filters = {
          azienda_id: aziendaId,
          tipo: tipo,
          limit: PARTITE_FETCH_LIMIT,
        };
        return amministrazioneService.getPartite(filters);
      });

      const results = await Promise.all(promises);
      const allPartite = results.flat().filter(Boolean);
      setPartite(Array.isArray(allPartite) ? allPartite : []);
    } catch (error) {
      console.error('Errore nel caricamento delle partite:', error);
      setErrorMessage(error.message || 'Errore nel caricamento delle partite');
    } finally {
      setLoading(false);
    }
  };

  const loadPartiteAssociate = async () => {
    if (!fattura?.id || !aziendaId) return;
    try {
      // Carica tutte le partite dei tipi rilevanti con i loro movimenti finanziari
      const promises = tipiPartiteDaMostrare.map(async (tipo) => {
        const filters = {
          azienda_id: aziendaId,
          tipo: tipo,
          limit: PARTITE_FETCH_LIMIT,
        };
        return amministrazioneService.getPartite(filters);
      });

      const results = await Promise.all(promises);
      const allPartite = results.flat().filter(Boolean);

      // Filtra le partite che hanno movimenti finanziari che referenziano questa fattura
      const associate = [];
      for (const partita of allPartite) {
        if (partita.movimenti_finanziari && Array.isArray(partita.movimenti_finanziari)) {
          for (const movimento of partita.movimenti_finanziari) {
            if (movimento.attivo !== false) {
              if (isFatturaEmessa && movimento.fattura_emessa_id === fattura.id) {
                associate.push({ partita, movimento });
                break;
              } else if (!isFatturaEmessa && movimento.fattura_amministrazione_id === fattura.id) {
                associate.push({ partita, movimento });
                break;
              }
            }
          }
        }
      }

      setPartiteAssociate(associate);
    } catch (error) {
      console.error('Errore nel caricamento delle partite associate:', error);
    }
  };

  useEffect(() => {
    if (aziendaId) {
      loadPartiteDisponibili();
    }
  }, [aziendaId, tipiPartiteDaMostrare.join(',')]);

  useEffect(() => {
    if (fattura?.id && aziendaId) {
      loadPartiteAssociate();
    }
  }, [fattura?.id, aziendaId, isFatturaEmessa, tipiPartiteDaMostrare.join(',')]);

  const partiteAssociateIds = useMemo(
    () => new Set(partiteAssociate.map(({ partita }) => partita.id)),
    [partiteAssociate]
  );

  const partiteDisponibili = useMemo(() => {
    const filtered = partite.filter((partita) => {
      // Escludi quelle già associate a questa fattura
      if (partiteAssociateIds.has(partita.id)) {
        return false;
      }

      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        partita.numero_partita?.toLowerCase().includes(term) ||
        partita.codice_stalla?.toLowerCase().includes(term) ||
        partita.nome_stalla?.toLowerCase().includes(term)
      );
    });

    return filtered;
  }, [partite, partiteAssociateIds, searchTerm]);

  const handleTogglePartita = (partitaId) => {
    setSelectedPartite((prev) => {
      if (prev.find(p => p.partitaId === partitaId)) {
        return prev.filter(p => p.partitaId !== partitaId);
      } else {
        return [...prev, { partitaId, tipoMovimento: tipoMovimentoDefault }];
      }
    });
  };

  const handleTipoMovimentoChange = (partitaId, tipoMovimento) => {
    setSelectedPartite((prev) =>
      prev.map(p => p.partitaId === partitaId ? { ...p, tipoMovimento } : p)
    );
  };

  const handleSelectAll = () => {
    setSelectedPartite(partiteDisponibili.map(p => ({ partitaId: p.id, tipoMovimento: tipoMovimentoDefault })));
  };

  const handleDeselectAll = () => {
    setSelectedPartite([]);
  };

  const handleAssocia = async () => {
    if (selectedPartite.length === 0) {
      alert('Seleziona almeno una partita da associare');
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    try {
      // Crea un PartitaMovimentoFinanziario per ogni partita selezionata
      const createPromises = selectedPartite.map(async ({ partitaId, tipoMovimento }) => {
        const partita = partite.find(p => p.id === partitaId);
        if (!partita) return;

        const movimentoData = {
          direzione: isFatturaEmessa ? 'entrata' : 'uscita',
          tipo: tipoMovimento,
          data: fatturaData,
          importo: fatturaImporto,
          note: `Fattura ${fatturaLabel} - ${tipoMovimento}`,
        };

        if (isFatturaEmessa) {
          movimentoData.fattura_emessa_id = fattura.id;
        } else {
          movimentoData.fattura_amministrazione_id = fattura.id;
        }

        return amministrazioneService.createPartitaMovimentoFinanziario(partitaId, movimentoData);
      });

      await Promise.all(createPromises);

      alert(`${selectedPartite.length} partita/e associata/e con successo alla fattura ${fatturaLabel}`);

      if (onSuccess) {
        onSuccess();
      }

      setSelectedPartite([]);
      await loadPartiteDisponibili();
      await loadPartiteAssociate();
    } catch (error) {
      console.error('Errore nell\'associazione delle partite:', error);
      setErrorMessage(error.message || 'Errore nell\'associazione delle partite');
    } finally {
      setSaving(false);
    }
  };

  const handleDisassocia = async (movimentoId) => {
    if (!window.confirm('Rimuovere l\'associazione di questa partita dalla fattura?')) {
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    try {
      await amministrazioneService.deletePartitaMovimentoFinanziario(movimentoId);

      await loadPartiteDisponibili();
      await loadPartiteAssociate();
    } catch (error) {
      console.error('Errore nella disassociazione della partita:', error);
      setErrorMessage(error.message || 'Errore nella disassociazione della partita');
    } finally {
      setSaving(false);
    }
  };

  const getPartitaLabel = (partita) => {
    const tipoLabel = partita.tipo === 'ingresso' ? 'Ingresso' : 'Uscita';
    return `${partita.numero_partita || `Partita #${partita.id}`} (${tipoLabel})`;
  };

  return (
    <BaseModal
      isOpen={true}
      onClose={onClose}
      title={`Associa Partite - Fattura ${fatturaLabel}`}
      size="large"
      footerActions={
        <>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={saving}
          >
            Chiudi
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleAssocia}
            disabled={selectedPartite.length === 0 || saving || loading}
          >
            {saving ? 'Salvataggio...' : `Associa ${selectedPartite.length > 0 ? `(${selectedPartite.length})` : ''}`}
          </button>
        </>
      }
    >
      <div className="associa-partite-modal">
        {errorMessage && (
          <div className="alert alert-error" style={{ marginBottom: '16px' }}>
            {errorMessage}
          </div>
        )}

        {/* Info fattura */}
        <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
          <strong>Fattura:</strong> {fatturaLabel} - {formatCurrency(fatturaImporto)} - {formatDate(fatturaData)}
        </div>

        {/* Tipo movimento di default */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Tipo Movimento (per nuove associazioni):
          </label>
          <SmartSelect
            className="select-compact"
            options={TIPO_MOVIMENTO_OPTIONS}
            value={tipoMovimentoDefault}
            onChange={(e) => {
              setTipoMovimentoDefault(e.target.value);
              // Aggiorna anche i tipi delle partite già selezionate
              setSelectedPartite(prev => prev.map(p => ({ ...p, tipoMovimento: e.target.value })));
            }}
            displayField="label"
            valueField="value"
          />
          <small className="color-muted" style={{ display: 'block', marginTop: '4px' }}>
            Il tipo movimento verrà applicato a tutte le partite selezionate. Puoi modificarlo singolarmente dopo la selezione.
          </small>
        </div>

        {/* Partite già associate */}
        {partiteAssociate.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ marginBottom: '12px' }}>Partite Già Associate</h4>
            <div className="partite-list">
              {partiteAssociate.map(({ partita, movimento }) => (
                <div key={partita.id} className="partita-item partita-associata">
                  <div className="partita-info" style={{ flex: 1 }}>
                    <div className="partita-header">
                      <strong>{getPartitaLabel(partita)}</strong>
                      <span className="partita-badge associata">Associata</span>
                    </div>
                    <div className="partita-details">
                      <span>Data: {formatDate(partita.data)}</span>
                      {partita.tipo === 'ingresso' ? (
                        <span>Provenienza: {partita.codice_stalla} {partita.nome_stalla ? `(${partita.nome_stalla})` : ''}</span>
                      ) : (
                        <span>Destinazione: {partita.codice_stalla} {partita.nome_stalla ? `(${partita.nome_stalla})` : ''}</span>
                      )}
                      <span>Capi: {partita.numero_capi}</span>
                      {partita.peso_totale && <span>Peso: {parseFloat(partita.peso_totale).toFixed(2)} kg</span>}
                      {partita.contratto_soccida_id && <span>Contratto: #{partita.contratto_soccida_id}</span>}
                      <span>Movimento: {movimento.tipo} - {formatCurrency(movimento.importo)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-small"
                    onClick={() => handleDisassocia(movimento.id)}
                    disabled={saving}
                  >
                    Rimuovi
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ricerca partite disponibili */}
        <div style={{ marginBottom: '16px' }}>
          <h4 style={{ marginBottom: '12px' }}>Partite Disponibili</h4>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Cerca partita (numero, codice stalla...)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ flex: 1 }}
            />
            <button
              type="button"
              className="btn btn-secondary btn-small"
              onClick={handleSelectAll}
              disabled={partiteDisponibili.length === 0}
            >
              Seleziona Tutte
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-small"
              onClick={handleDeselectAll}
              disabled={selectedPartite.length === 0}
            >
              Deseleziona Tutte
            </button>
          </div>

          {loading ? (
            <div className="loading-placeholder">Caricamento partite...</div>
          ) : partiteDisponibili.length === 0 ? (
            <div className="empty-state">
              {searchTerm ? 'Nessuna partita trovata con i criteri di ricerca' : `Nessuna partita ${tipiPartiteDaMostrare.join('/')} disponibile`}
            </div>
          ) : (
            <div className="partite-list" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {partiteDisponibili.map((partita) => {
                const selected = selectedPartite.find(p => p.partitaId === partita.id);
                const isSelected = !!selected;

                return (
                  <div
                    key={partita.id}
                    className={`partita-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleTogglePartita(partita.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="partita-checkbox">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleTogglePartita(partita.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="partita-info" style={{ flex: 1 }}>
                      <div className="partita-header">
                        <strong>{getPartitaLabel(partita)}</strong>
                        {partita.movimenti_finanziari && partita.movimenti_finanziari.length > 0 && (
                          <span className="partita-badge warning">
                            {partita.movimenti_finanziari.length} movimento/i finanziario/i
                          </span>
                        )}
                      </div>
                      <div className="partita-details">
                        <span>Data: {formatDate(partita.data)}</span>
                        {partita.tipo === 'ingresso' ? (
                          <span>Provenienza: {partita.codice_stalla} {partita.nome_stalla ? `(${partita.nome_stalla})` : ''}</span>
                        ) : (
                          <span>Destinazione: {partita.codice_stalla} {partita.nome_stalla ? `(${partita.nome_stalla})` : ''}</span>
                        )}
                        <span>Capi: {partita.numero_capi}</span>
                        {partita.peso_totale && <span>Peso: {parseFloat(partita.peso_totale).toFixed(2)} kg</span>}
                        {partita.contratto_soccida_id && <span>Contratto: #{partita.contratto_soccida_id}</span>}
                        {partita.motivo && <span>Motivo: {partita.motivo}</span>}
                      </div>
                      {isSelected && (
                        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #ddd' }}>
                          <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>
                            Tipo Movimento per questa partita:
                          </label>
                          <SmartSelect
                            className="select-compact"
                            options={TIPO_MOVIMENTO_OPTIONS}
                            value={selected.tipoMovimento}
                            onChange={(e) => {
                              handleTipoMovimentoChange(partita.id, e.target.value);
                              e.stopPropagation();
                            }}
                            displayField="label"
                            valueField="value"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {selectedPartite.length > 0 && (
          <div className="selection-summary">
            <strong>{selectedPartite.length}</strong> partita/e selezionata/e
          </div>
        )}
      </div>
    </BaseModal>
  );
};

export default AssociaPartiteFatturaModal;
