import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { alimentazioneService } from '../services/alimentazioneService';
import { useAzienda } from '../../../context/AziendaContext';
import BaseModal from '../../../components/BaseModal';
import RegistraAlimentazioneSingola from './RegistraAlimentazioneSingola';
import RegistraAlimentazioneGruppo from './RegistraAlimentazioneGruppo';
import './Alimentazione.css';
import {
  prefetchAlimentazioneStorico,
  getCachedAlimentazioneStorico,
} from '../prefetchers';

const Storico = () => {
  const { azienda } = useAzienda();
  const aziendaId = azienda?.id;

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [registro, setRegistro] = useState([]);
  const [piani, setPiani] = useState([]);
  const [componenti, setComponenti] = useState([]);
  const [mangimi, setMangimi] = useState([]);
  const [sedi, setSedi] = useState([]);

  const [showModalSingola, setShowModalSingola] = useState(false);
  const [showModalGruppo, setShowModalGruppo] = useState(false);
  const [gruppoPreviewLoading, setGruppoPreviewLoading] = useState(false);
  const [gruppoPreview, setGruppoPreview] = useState(null);
  const [gruppoSaving, setGruppoSaving] = useState(false);
  const formRefSingola = useRef(null);
  const formRefGruppo = useRef(null);
  const [expandedRowId, setExpandedRowId] = useState(null);

  const applyStoricoPayload = useCallback(
    (payload) => {
      if (!payload) return;
      setRegistro(payload.registro || []);
      setPiani(payload.piani || []);
      setComponenti(payload.componenti || []);
      setMangimi(payload.mangimi || []);
      if (Array.isArray(payload.sedi)) {
        setSedi(payload.sedi);
      }
      setDataLoaded(true); // Marca i dati come caricati, anche se sono array vuoti
    },
    [],
  );

  const hydrateStorico = useCallback(
    async ({ force = false, showErrors = true } = {}) => {
      if (!aziendaId) {
        setRegistro([]);
        setPiani([]);
        setComponenti([]);
        setMangimi([]);
        setSedi([]);
        setLoading(false);
        setDataLoaded(false);
        return null;
      }

      // Se i dati sono già stati caricati e non è forzato, non ricaricare
      // Usa dataLoaded invece di controllare length per gestire correttamente array vuoti
      if (!force && dataLoaded) {
        return null;
      }

      const cached = getCachedAlimentazioneStorico(aziendaId);
      if (!force && cached) {
        applyStoricoPayload(cached);
        setLoading(false);
        return cached;
      } else if (force) {
        setLoading(true);
      } else if (!cached) {
        setLoading(true);
      }

      try {
        const data = await prefetchAlimentazioneStorico(aziendaId, { force });
        if (data) {
          applyStoricoPayload(data);
        }
        return data;
      } catch (error) {

        if (showErrors) {
          showToast('Errore nel caricamento del registro alimentare', 'error');
        }
        return null;
      } finally {
        setLoading(false);
      }
    },
    [aziendaId, applyStoricoPayload, dataLoaded],
  );

  useEffect(() => {
    if (!aziendaId) {
      setRegistro([]);
      setPiani([]);
      setComponenti([]);
      setMangimi([]);
      setSedi([]);
      setDataLoaded(false);
      return;
    }
    hydrateStorico();
  }, [aziendaId, hydrateStorico]);

  function showToast(message, type = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  const handleNewAlimentazioneSingola = () => {
    setShowModalSingola(true);
  };

  const handleNewAlimentazioneGruppo = () => {
    setShowModalGruppo(true);
  };

  const handleCloseModalSingola = () => {
    setShowModalSingola(false);
    setRefreshKey(prev => prev + 1);
  };

  const handleCloseModalGruppo = () => {
    setShowModalGruppo(false);
    setGruppoPreview(null);
    setGruppoPreviewLoading(false);
    setGruppoSaving(false);
    setRefreshKey(prev => prev + 1);
  };

  const handleSuccessSingola = () => {
    setShowModalSingola(false);
    setRefreshKey(prev => prev + 1);
    hydrateStorico({ force: true });
  };

  const handleSuccessGruppo = () => {
    setShowModalGruppo(false);
    setRefreshKey(prev => prev + 1);
    hydrateStorico({ force: true });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Confermi l\'eliminazione della registrazione?')) return;
    try {
      await alimentazioneService.deleteVoceRegistro(id);
      showToast('Registrazione eliminata');
      await hydrateStorico({ force: true });
    } catch (error) {

      showToast('Errore durante l\'eliminazione', 'error');
    }
  };

  const handleEditNote = async (voce) => {
    const nuovaNota = window.prompt('Aggiorna nota', voce.note || '');
    if (nuovaNota === null) return;
    try {
      await alimentazioneService.updateVoceRegistro(voce.id, { note: nuovaNota });
      showToast('Nota aggiornata');
      await hydrateStorico({ force: true });
    } catch (error) {

      showToast('Errore nell\'aggiornamento della nota', 'error');
    }
  };

  const resolveAlimentoLabel = (voce) => {
    if (voce.tipo_alimento === 'piano') {
      const piano = piani.find((p) => p.id === voce.razione_id);
      return piano ? piano.nome : `Piano #${voce.razione_id}`;
    }
    if (voce.componente_alimentare_id) {
      const comp = componenti.find((c) => c.id === voce.componente_alimentare_id);
      return comp ? comp.nome : `Componente #${voce.componente_alimentare_id}`;
    }
    if (voce.mangime_confezionato_id) {
      const mangime = mangimi.find((m) => m.id === voce.mangime_confezionato_id);
      return mangime ? mangime.nome : `Mangime #${voce.mangime_confezionato_id}`;
    }
    return '—';
  };

  const resolveTargetLabel = (voce) => {
    if (voce.target_tipo === 'sede') {
      const sede = sedi.find((s) => s.id === voce.target_id);
      return sede ? `Sede ${sede.nome}` : `Sede #${voce.target_id}`;
    }
    if (voce.target_tipo === 'stabilimento') {
      const dettaglio = voce.dettagli.find((d) => d.stabilimento_id === voce.target_id) || voce.dettagli[0];
      return dettaglio?.stabilimento_nome ? `Stabilimento ${dettaglio.stabilimento_nome}` : `Stabilimento #${voce.target_id}`;
    }
    if (voce.target_tipo === 'box') {
      const dettaglio = voce.dettagli.find((d) => d.box_id === voce.target_id) || voce.dettagli[0];
      return dettaglio?.box_nome ? `Box ${dettaglio.box_nome}` : `Box #${voce.target_id}`;
    }
    return voce.target_tipo;
  };

  const formatDecimal = (value, decimals = 2) => {
    if (value === null || value === undefined) return '-';
    return Number(value).toFixed(decimals);
  };

  const registroOrdinato = useMemo(
    () => [...registro].sort((a, b) => new Date(b.data) - new Date(a.data)),
    [registro]
  );

  return (
    <div className="alimentazione-section">
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Registro Alimentazione</h3>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn-primary" onClick={handleNewAlimentazioneSingola} disabled={!aziendaId}>
            Alimentazione Singola
          </button>
          <button className="btn-primary" onClick={handleNewAlimentazioneGruppo} disabled={!aziendaId}>
            Alimentazione Gruppo
        </button>
        </div>
      </div>

      {!aziendaId && (
        <div className="empty-state">
          <p>Configura l'azienda dal modulo Allevamento per registrare le somministrazioni.</p>
        </div>
      )}

      {toast && (
        <div className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>{toast.message}</div>
      )}

      {loading ? (
        <div className="loading">Caricamento...</div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Alimento / Piano</th>
                <th>Quantità totale</th>
                <th>Capi</th>
                <th>Quota / capo</th>
                <th>Target</th>
                <th>Note</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {registroOrdinato.map((voce) => (
                <React.Fragment key={voce.id}>
                  <tr>
                    <td>{voce.data}</td>
                    <td>{resolveAlimentoLabel(voce)}</td>
                    <td>{formatDecimal(voce.quantita_totale)}</td>
                    <td>{voce.numero_capi || '-'}</td>
                    <td>{voce.quota_per_capo ? formatDecimal(voce.quota_per_capo, 4) : '-'}</td>
                    <td>{resolveTargetLabel(voce)}</td>
                    <td>{voce.note || '—'}</td>
                    <td className="actions">
                      <button className="btn-link" onClick={() => setExpandedRowId(expandedRowId === voce.id ? null : voce.id)}>
                        Dettagli
                      </button>
                      <button className="btn-link" onClick={() => handleEditNote(voce)}>
                        Modifica nota
                      </button>
                      <button className="btn-link danger" onClick={() => handleDelete(voce.id)}>
                        Elimina
                      </button>
                    </td>
                  </tr>
                  {expandedRowId === voce.id && (
                    <tr className="details-row">
                      <td colSpan={8}>
                        <div className="detail-panel">
                          <h4>Ripartizione</h4>
                          <table className="inner-table">
                            <thead>
                              <tr>
                                <th>Box</th>
                                <th>Stabilimento</th>
                                <th>Capi</th>
                                <th>Quantità</th>
                                <th>Note</th>
                              </tr>
                            </thead>
                            <tbody>
                              {voce.dettagli.map((dettaglio, idx) => (
                                <tr key={idx}>
                                  <td>{dettaglio.box_nome || (dettaglio.box_id ? `Box #${dettaglio.box_id}` : 'Senza box')}</td>
                                  <td>{dettaglio.stabilimento_nome || (dettaglio.stabilimento_id ? `Stabilimento #${dettaglio.stabilimento_id}` : '—')}</td>
                                  <td>{dettaglio.numero_capi}</td>
                                  <td>{formatDecimal(dettaglio.quantita)}</td>
                                  <td>{dettaglio.note || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {registroOrdinato.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty-state">
                    Nessuna registrazione presente
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <BaseModal
        isOpen={showModalSingola}
        onClose={handleCloseModalSingola}
        title="Alimentazione Singola"
        size="large"
        footerActions={
          <>
            <button className="btn btn-secondary" onClick={handleCloseModalSingola}>
              Annulla
            </button>
            <button 
              className="btn btn-primary" 
              onClick={() => {
                if (formRefSingola.current) {
                  formRefSingola.current.submit();
                }
              }}
            >
              Salva
            </button>
          </>
        }
      >
        <RegistraAlimentazioneSingola 
          ref={formRefSingola}
          onSuccess={handleSuccessSingola}
          onCancel={handleCloseModalSingola}
          isModal={true}
        />
      </BaseModal>

      <BaseModal
        isOpen={showModalGruppo}
        onClose={handleCloseModalGruppo}
        title="Alimentazione di Gruppo"
        size="xlarge"
        footerActions={
          <>
            <button className="btn btn-secondary" onClick={handleCloseModalGruppo} disabled={gruppoSaving || gruppoPreviewLoading}>
              Annulla
            </button>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  if (formRefGruppo.current) {
                    formRefGruppo.current.preview();
                  }
                }}
                disabled={gruppoPreviewLoading}
                type="button"
              >
                {gruppoPreviewLoading ? 'Calcolo...' : 'Calcola anteprima'}
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  if (formRefGruppo.current) {
                    formRefGruppo.current.submit();
                  }
                }}
                disabled={gruppoSaving || gruppoPreviewLoading || !gruppoPreview}
              >
                {gruppoSaving ? 'Salvataggio...' : 'Registra'}
              </button>
            </div>
          </>
        }
      >
        <RegistraAlimentazioneGruppo 
          ref={formRefGruppo}
          onSuccess={handleSuccessGruppo}
          onCancel={handleCloseModalGruppo}
          onPreviewChange={(preview) => setGruppoPreview(preview)}
          onStateChange={(state) => {
            if (state.previewLoading !== undefined) setGruppoPreviewLoading(state.previewLoading);
            if (state.saving !== undefined) setGruppoSaving(state.saving);
          }}
          isModal={true}
        />
      </BaseModal>
    </div>
  );
};

export default Storico;
