/**
 * GestioneAttrezzature - Gestione attrezzature con targhe, scadenze, ammortamenti
 * Migliorato con checkbox per veicolo, assicurazione, revisione
 */
import React, { useState, useEffect, useCallback, useMemo, useImperativeHandle, forwardRef } from 'react';
import { attrezzaturaService } from '../services/attrezzaturaService';
import { amministrazioneService } from '../../amministrazione/services/amministrazioneService';
import SmartSelect from '../../../components/SmartSelect';
import BaseModal from '../../../components/BaseModal';
import { useAzienda } from '../../../context/AziendaContext';
import { useRequest } from '../../../context/RequestContext';
import '../../alimentazione/components/Alimentazione.css';
import './GestioneAttrezzature.css';
import { prefetchAttrezzature, getCachedAttrezzature } from '../prefetchers';

const TIPI_ATTREZZATURA = [
  { value: 'veicolo', label: 'Veicolo' },
  { value: 'macchinario', label: 'Macchinario' },
  { value: 'strumento', label: 'Strumento' },
  { value: 'attrezzatura', label: 'Attrezzatura' },
  { value: 'altro', label: 'Altro' },
];

const TIPI_SCADENZA = [
  { value: 'revisione', label: 'Revisione' },
  { value: 'assicurazione', label: 'Assicurazione' },
  { value: 'bollo', label: 'Bollo' },
  { value: 'patente', label: 'Patente' },
  { value: 'certificazione', label: 'Certificazione' },
  { value: 'manutenzione', label: 'Manutenzione' },
  { value: 'altro', label: 'Altro' },
];

const GestioneAttrezzature = forwardRef((props, ref) => {
  const [selectedAziendaId, setSelectedAziendaId] = useState(null);
  const [attrezzature, setAttrezzature] = useState([]);
  const [fornitori, setFornitori] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showModalScadenza, setShowModalScadenza] = useState(false);
  const [showModalAmmortamento, setShowModalAmmortamento] = useState(false);
  const [selectedAttrezzatura, setSelectedAttrezzatura] = useState(null);
  const [selectedAttrezzaturaForScadenza, setSelectedAttrezzaturaForScadenza] = useState(null);
  const [selectedAttrezzaturaForAmmortamento, setSelectedAttrezzaturaForAmmortamento] = useState(null);
  const [attrezzaturaDetails, setAttrezzaturaDetails] = useState(null);
  const [costiRiepilogo, setCostiRiepilogo] = useState([]);
  const [costiLoading, setCostiLoading] = useState(false);
  const [costiError, setCostiError] = useState(null);
  
  // Nuovi stati per checkbox e campi condizionali
  const [isVeicolo, setIsVeicolo] = useState(false);
  const [hasAssicurazione, setHasAssicurazione] = useState(false);
  const [hasRevisione, setHasRevisione] = useState(false);
  const [ammortamentoDilazionato, setAmmortamentoDilazionato] = useState(true);
  
  const [formData, setFormData] = useState({
    azienda_id: null,
    nome: '',
    tipo: 'altro',
    marca: '',
    modello: '',
    numero_serie: '',
    targa: '',
    data_acquisto: '',
    costo_acquisto: '',
    fornitore_id: null,
    valore_residuo: '',
    durata_ammortamento_anni: '',
    metodo_ammortamento: 'lineare',
    attiva: true,
    note: '',
    // Nuovi campi per assicurazione veicolo
    assicurazione_data_scadenza: '',
    assicurazione_premio: '',
    assicurazione_numero_polizza: '',
    // Nuovo campo per revisione veicolo
    revisione_data_scadenza: '',
  });
  
  const [formDataScadenza, setFormDataScadenza] = useState({
    tipo: 'revisione',
    descrizione: '',
    data_scadenza: '',
    data_ultimo_rinnovo: '',
    costo: '',
    numero_polizza: '',
    note: '',
  });
  
  const [formDataAmmortamento, setFormDataAmmortamento] = useState({
    azienda_id: null,
    anno: new Date().getFullYear(),
    mese: null,
    quota_ammortamento: '',
    valore_residuo: '',
    note: '',
  });

  const { azienda, loading: aziendaLoading } = useAzienda();
  const canOperate = Boolean(azienda?.id);

  const formatCurrencyValue = useCallback((value) => {
    if (value === null || value === undefined) return '—';
    const numberValue = Number(value);
    if (Number.isNaN(numberValue)) return '—';
    return `€${numberValue.toFixed(2)}`;
  }, []);

  const costiById = useMemo(() => {
    const map = new Map();
    (costiRiepilogo || []).forEach((item) => {
      map.set(item.attrezzatura_id, item);
    });
    return map;
  }, [costiRiepilogo]);

  const applyAttrezzaturePayload = useCallback((payload) => {
    if (!payload) return;
    setAttrezzature(payload.attrezzature || []);
    setFornitori(payload.fornitori || []);
  }, []);

  const fetchCostiRiepilogo = useCallback(
    async (aziendaTargetId, { silent = false } = {}) => {
      if (!aziendaTargetId) {
        setCostiRiepilogo([]);
        return;
      }
      if (!silent) {
        setCostiLoading(true);
        setCostiError(null);
      }
      try {
        const response = await amministrazioneService.getAttrezzatureCosti(aziendaTargetId);
        const elenco = Array.isArray(response)
          ? response
          : response?.data || response?.items || [];
        setCostiRiepilogo(elenco || []);
      } catch (error) {

        setCostiRiepilogo([]);
        setCostiError('Impossibile recuperare il riepilogo costi.');
      } finally {
        if (!silent) {
          setCostiLoading(false);
        }
      }
    },
    [],
  );

  const hydrateAttrezzature = useCallback(
    async ({ aziendaId: overrideId, force = false, showErrors = true } = {}) => {
      const targetId = overrideId ?? selectedAziendaId ?? azienda?.id;
      if (!targetId) {
        setAttrezzature([]);
        setFornitori([]);
        setCostiRiepilogo([]);
        setCostiError(null);
        setCostiLoading(false);
        setLoading(false);
        return null;
      }

      // Se i dati sono già nello state e non è forzato, non ricaricare
      if (!force && attrezzature.length > 0) {
        return null;
      }

      const cached = getCachedAttrezzature(targetId);
      if (!force && cached) {
        applyAttrezzaturePayload(cached);
        setLoading(false);
        return cached;
      } else if (force) {
        setLoading(true);
      } else if (!cached) {
        setLoading(true);
      }

      try {
        const data = await prefetchAttrezzature(targetId, { force });
        if (data) {
          applyAttrezzaturePayload(data);
        }
        await fetchCostiRiepilogo(targetId, { silent: !force && Boolean(cached) });
        return data;
      } catch (error) {

        if (showErrors) {
          alert('Errore nel caricamento dei dati');
        }
        return null;
      } finally {
        setLoading(false);
      }
    },
    [selectedAziendaId, azienda?.id, applyAttrezzaturePayload, fetchCostiRiepilogo, attrezzature.length],
  );

  useEffect(() => {
    if (!azienda?.id) {
      setSelectedAziendaId(null);
      setAttrezzature([]);
      setFornitori([]);
      setCostiRiepilogo([]);
      setCostiError(null);
      setCostiLoading(false);
      setFormData((prev) => ({ ...prev, azienda_id: null }));
      setFormDataAmmortamento((prev) => ({ ...prev, azienda_id: null }));
      return;
    }
    
    setSelectedAziendaId(azienda.id);
    setFormData((prev) => ({ ...prev, azienda_id: azienda.id }));
    setFormDataAmmortamento((prev) => ({ ...prev, azienda_id: azienda.id }));
    hydrateAttrezzature({ aziendaId: azienda.id });
  }, [azienda?.id, hydrateAttrezzature]);

  // Aggiorna tipo quando cambia checkbox veicolo
  useEffect(() => {
    if (isVeicolo) {
      setFormData(prev => ({ ...prev, tipo: 'veicolo' }));
    }
  }, [isVeicolo]);

  // Aggiorna hasRevisione quando cambia isVeicolo
  useEffect(() => {
    if (!isVeicolo) {
      setHasRevisione(false);
      setFormData(prev => ({ ...prev, revisione_data_scadenza: '' }));
    }
  }, [isVeicolo]);

  const loadAttrezzaturaDetails = async (id) => {
    try {
      const details = await attrezzaturaService.getAttrezzatura(id);
      setAttrezzaturaDetails(details);
      return details;
    } catch (error) {

    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAziendaId) {
      alert('Configura l\'azienda prima di registrare un\'attrezzatura.');
      return;
    }
    try {
      const dataToSend = {
        ...formData,
        azienda_id: selectedAziendaId,
        costo_acquisto: formData.costo_acquisto ? parseFloat(formData.costo_acquisto) : null,
        valore_residuo: formData.valore_residuo ? parseFloat(formData.valore_residuo) : null,
        durata_ammortamento_anni: formData.durata_ammortamento_anni ? parseInt(formData.durata_ammortamento_anni) : null,
        fornitore_id: formData.fornitore_id || null,
        data_acquisto: formData.data_acquisto || null,
        // Rimuovi campi temporanei prima di inviare
        assicurazione_data_scadenza: undefined,
        assicurazione_premio: undefined,
        assicurazione_numero_polizza: undefined,
        revisione_data_scadenza: undefined,
      };

      let attrezzaturaId;
      if (selectedAttrezzatura) {
        await attrezzaturaService.updateAttrezzatura(selectedAttrezzatura.id, dataToSend);
        attrezzaturaId = selectedAttrezzatura.id;
      } else {
        const created = await attrezzaturaService.createAttrezzatura(dataToSend);
        attrezzaturaId = created.id;
      }

      // Crea scadenze se necessario
      if (hasAssicurazione && formData.assicurazione_data_scadenza) {
        await attrezzaturaService.createScadenzaAttrezzatura(attrezzaturaId, {
          tipo: 'assicurazione',
          descrizione: 'Assicurazione veicolo',
          data_scadenza: formData.assicurazione_data_scadenza,
          costo: formData.assicurazione_premio ? parseFloat(formData.assicurazione_premio) : null,
          numero_polizza: formData.assicurazione_numero_polizza || null,
        });
      }

      if (hasRevisione && isVeicolo && formData.revisione_data_scadenza) {
        await attrezzaturaService.createScadenzaAttrezzatura(attrezzaturaId, {
          tipo: 'revisione',
          descrizione: 'Revisione veicolo',
          data_scadenza: formData.revisione_data_scadenza,
        });
      }

      // Gestione ammortamento (solo se non è in modifica, altrimenti l'utente può gestirlo manualmente)
      if (!selectedAttrezzatura && formData.costo_acquisto && formData.data_acquisto) {
        if (ammortamentoDilazionato && formData.durata_ammortamento_anni) {
          // Calcola ammortamento dilazionato
          const costo = parseFloat(formData.costo_acquisto);
          const valoreResiduo = formData.valore_residuo ? parseFloat(formData.valore_residuo) : 0;
          const durata = parseInt(formData.durata_ammortamento_anni);
          const quotaAnnua = (costo - valoreResiduo) / durata;
          const dataAcquisto = new Date(formData.data_acquisto);
          const annoAcquisto = dataAcquisto.getFullYear();

          // Crea una quota per ogni anno
          for (let i = 0; i < durata; i++) {
            await attrezzaturaService.createAmmortamento(attrezzaturaId, {
              azienda_id: selectedAziendaId,
              anno: annoAcquisto + i,
              quota_ammortamento: quotaAnnua,
              valore_residuo: i === durata - 1 ? valoreResiduo : null,
            });
          }
        } else if (!ammortamentoDilazionato) {
          // Ammortamento unico periodo
          const costo = parseFloat(formData.costo_acquisto);
          const valoreResiduo = formData.valore_residuo ? parseFloat(formData.valore_residuo) : 0;
          const dataAcquisto = new Date(formData.data_acquisto);
          const annoAcquisto = dataAcquisto.getFullYear();
          const meseAcquisto = dataAcquisto.getMonth() + 1;

          await attrezzaturaService.createAmmortamento(attrezzaturaId, {
            azienda_id: selectedAziendaId,
            anno: annoAcquisto,
            mese: meseAcquisto,
            quota_ammortamento: costo - valoreResiduo,
            valore_residuo: valoreResiduo,
          });
        }
      }

      setShowModal(false);
      resetForm();
      hydrateAttrezzature({ force: true, aziendaId: selectedAziendaId ?? azienda?.id });
    } catch (error) {

      alert('Errore nel salvataggio');
    }
  };

  const handleSubmitScadenza = async (e) => {
    e.preventDefault();
    try {
      const dataToSend = {
        ...formDataScadenza,
        costo: formDataScadenza.costo ? parseFloat(formDataScadenza.costo) : null,
        data_ultimo_rinnovo: formDataScadenza.data_ultimo_rinnovo || null,
      };

      await attrezzaturaService.createScadenzaAttrezzatura(selectedAttrezzaturaForScadenza.id, dataToSend);
      setShowModalScadenza(false);
      resetFormScadenza();
      if (attrezzaturaDetails?.id === selectedAttrezzaturaForScadenza.id) {
        await loadAttrezzaturaDetails(selectedAttrezzaturaForScadenza.id);
      }
    } catch (error) {

      alert('Errore nel salvataggio');
    }
  };

  const handleSubmitAmmortamento = async (e) => {
    e.preventDefault();
    if (!selectedAziendaId) {
      alert('Configura l\'azienda prima di registrare un ammortamento.');
      return;
    }
    try {
      const dataToSend = {
        ...formDataAmmortamento,
        azienda_id: selectedAziendaId,
        quota_ammortamento: parseFloat(formDataAmmortamento.quota_ammortamento),
        valore_residuo: formDataAmmortamento.valore_residuo ? parseFloat(formDataAmmortamento.valore_residuo) : null,
        mese: formDataAmmortamento.mese || null,
      };

      await attrezzaturaService.createAmmortamento(selectedAttrezzaturaForAmmortamento.id, dataToSend);
      setShowModalAmmortamento(false);
      resetFormAmmortamento();
      if (attrezzaturaDetails?.id === selectedAttrezzaturaForAmmortamento.id) {
        await loadAttrezzaturaDetails(selectedAttrezzaturaForAmmortamento.id);
      }
    } catch (error) {

      alert('Errore nel salvataggio');
    }
  };

  const handleEdit = async (attrezzatura) => {
    if (!attrezzatura) return;
    setSelectedAttrezzatura(attrezzatura);
    const isVeicoloType = attrezzatura.tipo === 'veicolo';
    setIsVeicolo(isVeicoloType);
    
    // Controlla se ha assicurazione o revisione
    const details = await loadAttrezzaturaDetails(attrezzatura.id);
    const hasAssicurazioneScadenza = details?.scadenze?.some(s => s.tipo === 'assicurazione');
    const hasRevisioneScadenza = details?.scadenze?.some(s => s.tipo === 'revisione');
    
    setHasAssicurazione(hasAssicurazioneScadenza);
    setHasRevisione(hasRevisioneScadenza && isVeicoloType);
    
    if (hasAssicurazioneScadenza) {
      const assicurazione = details.scadenze.find(s => s.tipo === 'assicurazione');
      setFormData({
        ...attrezzatura,
        data_acquisto: attrezzatura.data_acquisto ? attrezzatura.data_acquisto.split('T')[0] : '',
        costo_acquisto: attrezzatura.costo_acquisto?.toString() || '',
        valore_residuo: attrezzatura.valore_residuo?.toString() || '',
        durata_ammortamento_anni: attrezzatura.durata_ammortamento_anni?.toString() || '',
        assicurazione_data_scadenza: assicurazione?.data_scadenza?.split('T')[0] || '',
        assicurazione_premio: assicurazione?.costo?.toString() || '',
        assicurazione_numero_polizza: assicurazione?.numero_polizza || '',
      });
    } else {
      setFormData({
        ...attrezzatura,
        data_acquisto: attrezzatura.data_acquisto ? attrezzatura.data_acquisto.split('T')[0] : '',
        costo_acquisto: attrezzatura.costo_acquisto?.toString() || '',
        valore_residuo: attrezzatura.valore_residuo?.toString() || '',
        durata_ammortamento_anni: attrezzatura.durata_ammortamento_anni?.toString() || '',
      });
    }
    
    if (hasRevisioneScadenza && isVeicoloType) {
      const revisione = details.scadenze.find(s => s.tipo === 'revisione');
      setFormData(prev => ({
        ...prev,
        revisione_data_scadenza: revisione?.data_scadenza?.split('T')[0] || '',
      }));
    }
    
    setShowModal(true);
  };

  const handleViewDetails = async (attrezzatura) => {
    const details = await loadAttrezzaturaDetails(attrezzatura.id);
    setSelectedAttrezzatura(attrezzatura);
    setAttrezzaturaDetails(details);
  };

  const handleDelete = async (id) => {
    if (!confirm('Sei sicuro di voler eliminare questa attrezzatura?')) return;
    
    try {
      await attrezzaturaService.deleteAttrezzatura(id);
      hydrateAttrezzature({ force: true, aziendaId: selectedAziendaId ?? azienda?.id });
    } catch (error) {

      alert('Errore nell\'eliminazione');
    }
  };

  const handleDeleteScadenza = async (id) => {
    if (!confirm('Sei sicuro di voler eliminare questa scadenza?')) return;
    
    try {
      await attrezzaturaService.deleteScadenzaAttrezzatura(id);
      if (attrezzaturaDetails) {
        await loadAttrezzaturaDetails(attrezzaturaDetails.id);
      }
    } catch (error) {

      alert('Errore nell\'eliminazione');
    }
  };

  const resetForm = () => {
    setFormData({
      azienda_id: selectedAziendaId || null,
      nome: '',
      tipo: 'altro',
      marca: '',
      modello: '',
      numero_serie: '',
      targa: '',
      data_acquisto: '',
      costo_acquisto: '',
      fornitore_id: null,
      valore_residuo: '',
      durata_ammortamento_anni: '',
      metodo_ammortamento: 'lineare',
      attiva: true,
      note: '',
      assicurazione_data_scadenza: '',
      assicurazione_premio: '',
      assicurazione_numero_polizza: '',
      revisione_data_scadenza: '',
    });
    setIsVeicolo(false);
    setHasAssicurazione(false);
    setHasRevisione(false);
    setAmmortamentoDilazionato(true);
    setSelectedAttrezzatura(null);
  };

  const resetFormScadenza = () => {
    setFormDataScadenza({
      tipo: 'revisione',
      descrizione: '',
      data_scadenza: '',
      data_ultimo_rinnovo: '',
      costo: '',
      numero_polizza: '',
      note: '',
    });
    setSelectedAttrezzaturaForScadenza(null);
  };

  const resetFormAmmortamento = () => {
    setFormDataAmmortamento({
      azienda_id: selectedAziendaId || null,
      anno: new Date().getFullYear(),
      mese: null,
      quota_ammortamento: '',
      valore_residuo: '',
      note: '',
    });
    setSelectedAttrezzaturaForAmmortamento(null);
  };

  const getFornitoreName = (fornitoreId) => {
    if (!fornitoreId) return '-';
    const fornitore = fornitori.find(f => f.id === fornitoreId);
    return fornitore ? fornitore.nome : 'N/A';
  };

  // Espone metodi pubblici tramite ref
  useImperativeHandle(ref, () => ({
    openScadenza: async (scadenzaId, attrezzaturaId) => {
      try {
        // Carica l'attrezzatura e poi la scadenza
        if (attrezzaturaId) {
          const attrezzatura = await attrezzaturaService.getAttrezzatura(attrezzaturaId);
          if (attrezzatura) {
            const details = await loadAttrezzaturaDetails(attrezzaturaId);
            setSelectedAttrezzatura(attrezzatura);
            setAttrezzaturaDetails(details);
            // Apri la modale dell'attrezzatura
            setShowModal(true);
            
            // Se c'è una scadenza specifica, apri anche la modale della scadenza
            if (scadenzaId && details?.scadenze) {
              const scadenza = details.scadenze.find(s => s.id === scadenzaId);
              if (scadenza) {
                // Imposta l'attrezzatura per la scadenza e apri la modale
                setSelectedAttrezzaturaForScadenza(attrezzatura);
                setFormDataScadenza({
                  attrezzatura_id: attrezzaturaId,
                  tipo: scadenza.tipo || 'altro',
                  descrizione: scadenza.descrizione || '',
                  data_scadenza: scadenza.data_scadenza ? scadenza.data_scadenza.split('T')[0] : '',
                  data_ultimo_rinnovo: scadenza.data_ultimo_rinnovo ? scadenza.data_ultimo_rinnovo.split('T')[0] : '',
                  costo: scadenza.costo?.toString() || '',
                  numero_polizza: scadenza.numero_polizza || '',
                  note: scadenza.note || '',
                });
                setShowModalScadenza(true);
              }
            }
          }
        }
      } catch (error) {
        console.error('Errore nel caricamento scadenza:', error);
        alert('Impossibile aprire la scadenza');
      }
    }
  }));

  return (
    <div className="gestione-attrezzature">
      <div className="header-actions">
        <button
          className="btn btn-primary"
          onClick={() => { resetForm(); setShowModal(true); }}
          disabled={!canOperate}
          style={!canOperate ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
        >
          Nuova Attrezzatura
        </button>
      </div>

      {loading ? (
        <div>Caricamento...</div>
      ) : !canOperate ? (
        <div className="empty-state">
          Configura l&apos;azienda nelle impostazioni per gestire le attrezzature.
        </div>
      ) : (
        <>
          {costiLoading && (
            <div style={{ marginBottom: '10px', color: '#555' }}>
              Aggiornamento costi attrezzature in corso...
            </div>
          )}
          {costiError && (
            <div className="alert warning" style={{ marginBottom: '10px' }}>
              {costiError}
            </div>
          )}
          {loading ? (
            <div className="loading">Caricamento...</div>
          ) : (
            <div className="table-container">
              <table className="data-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Tipo</th>
              <th>Targa</th>
              <th>Marca</th>
              <th>Modello</th>
              <th>Costo Acquisto</th>
                  <th>Costi totali</th>
                  <th>Anno corrente</th>
                  <th>Mese corrente</th>
                  <th>Stato</th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
                  {attrezzature.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="empty-state">
                        Nessuna attrezzatura trovata
                      </td>
                    </tr>
                  ) : (
                    attrezzature.filter(att => att).map(attrezzatura => (
              <tr key={attrezzatura.id}>
                <td>{attrezzatura.nome}</td>
                <td>{attrezzatura.tipo || '-'}</td>
                <td>{attrezzatura.targa || '-'}</td>
                <td>{attrezzatura.marca || '-'}</td>
                <td>{attrezzatura.modello || '-'}</td>
                <td>{attrezzatura.costo_acquisto ? `€${parseFloat(attrezzatura.costo_acquisto).toFixed(2)}` : '-'}</td>
                <td>
                  {(() => {
                    const riepilogo = costiById.get(attrezzatura.id);
                    return riepilogo ? formatCurrencyValue(riepilogo.totale?.totale) : '—';
                  })()}
                </td>
                <td>
                  {(() => {
                    const riepilogo = costiById.get(attrezzatura.id);
                    return riepilogo ? formatCurrencyValue(riepilogo.anno_corrente?.totale) : '—';
                  })()}
                </td>
                <td>
                  {(() => {
                    const riepilogo = costiById.get(attrezzatura.id);
                    return riepilogo ? formatCurrencyValue(riepilogo.mese_corrente?.totale) : '—';
                  })()}
                </td>
                <td>
                  <span className={`badge ${attrezzatura.attiva ? 'badge-success' : 'badge-secondary'}`}>
                    {attrezzatura.attiva ? 'Attiva' : 'Inattiva'}
                  </span>
                </td>
                <td>
                  <button className="btn-icon" onClick={() => handleViewDetails(attrezzatura)} title="Dettagli">👁️</button>
                  <button className="btn-icon" onClick={() => handleEdit(attrezzatura)} title="Modifica">✏️</button>
                  <button className="btn-icon" onClick={() => handleDelete(attrezzatura.id)} title="Elimina">🗑️</button>
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
        isOpen={showModal}
        onClose={() => { setShowModal(false); resetForm(); }}
        title={selectedAttrezzatura ? 'Modifica Attrezzatura' : 'Nuova Attrezzatura'}
        size="xlarge"
        footerActions={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => { setShowModal(false); resetForm(); }}>
              Annulla
            </button>
            <button type="submit" form="attrezzatura-form" className="btn btn-primary">Salva</button>
          </>
        }
      >
        <form id="attrezzatura-form" onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Nome *</label>
                  <input
                    type="text"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Tipo *</label>
                  <SmartSelect
                    className="select-compact"
                    options={TIPI_ATTREZZATURA}
                    value={formData.tipo}
                    onChange={(e) => {
                      setFormData({ ...formData, tipo: e.target.value });
                      setIsVeicolo(e.target.value === 'veicolo');
                    }}
                    displayField="label"
                    valueField="value"
                    required
                  />
                </div>
              </div>

              {/* Toggle Veicolo */}
              <div className="form-row">
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      id="toggle-veicolo"
                      className={`toggle-button ${isVeicolo ? 'active' : ''}`}
                      onClick={() => {
                        const newValue = !isVeicolo;
                        setIsVeicolo(newValue);
                        if (newValue) {
                          setFormData({ ...formData, tipo: 'veicolo' });
                        }
                      }}
                      aria-label="È un veicolo"
                    />
                    <span>È un veicolo</span>
                  </label>
                </div>
              </div>

              {/* Campo Targa (visibile se veicolo) */}
              {isVeicolo && (
                <div className="form-row">
                  <div className="form-group">
                    <label>Targa *</label>
                    <input
                      type="text"
                      value={formData.targa}
                      onChange={(e) => setFormData({ ...formData, targa: e.target.value.toUpperCase() })}
                      placeholder="AB123CD"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label>Marca</label>
                  <input
                    type="text"
                    value={formData.marca}
                    onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Modello</label>
                  <input
                    type="text"
                    value={formData.modello}
                    onChange={(e) => setFormData({ ...formData, modello: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Numero Serie</label>
                  <input
                    type="text"
                    value={formData.numero_serie}
                    onChange={(e) => setFormData({ ...formData, numero_serie: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Data Acquisto</label>
                  <input
                    type="date"
                    value={formData.data_acquisto}
                    onChange={(e) => setFormData({ ...formData, data_acquisto: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Costo Acquisto (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.costo_acquisto}
                    onChange={(e) => setFormData({ ...formData, costo_acquisto: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Fornitore</label>
                  <SmartSelect
                    className="select-compact"
                    options={fornitori}
                    value={formData.fornitore_id || ''}
                    onChange={(e) => setFormData({ ...formData, fornitore_id: e.target.value ? parseInt(e.target.value) : null })}
                    displayField="nome"
                    valueField="id"
                    placeholder="Seleziona fornitore"
                    allowEmpty
                  />
                </div>
              </div>

                  {/* Toggle Assicurazione */}
                  {isVeicolo && (
                    <>
                      <div className="form-row">
                        <div className="form-group">
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                              type="button"
                              id="toggle-assicurazione"
                              className={`toggle-button ${hasAssicurazione ? 'active' : ''}`}
                              onClick={() => setHasAssicurazione(!hasAssicurazione)}
                              aria-label="Ha assicurazione"
                            />
                            <span>Ha assicurazione</span>
                          </label>
                        </div>
                      </div>

                  {/* Campi Assicurazione (visibili se checkbox assicurazione selezionata) */}
                  {hasAssicurazione && (
                    <div className="form-row">
                      <div className="form-group">
                        <label>Data Scadenza Assicurazione *</label>
                        <input
                          type="date"
                          value={formData.assicurazione_data_scadenza}
                          onChange={(e) => setFormData({ ...formData, assicurazione_data_scadenza: e.target.value })}
                          required={hasAssicurazione}
                        />
                      </div>
                      <div className="form-group">
                        <label>Premio Annuale (€)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.assicurazione_premio}
                          onChange={(e) => setFormData({ ...formData, assicurazione_premio: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Numero Polizza</label>
                        <input
                          type="text"
                          value={formData.assicurazione_numero_polizza}
                          onChange={(e) => setFormData({ ...formData, assicurazione_numero_polizza: e.target.value })}
                        />
                      </div>
                    </div>
                  )}

                  {/* Toggle Revisione (solo se veicolo) */}
                  <div className="form-row">
                    <div className="form-group">
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          id="toggle-revisione"
                          className={`toggle-button ${hasRevisione ? 'active' : ''}`}
                          onClick={() => setHasRevisione(!hasRevisione)}
                          disabled={!isVeicolo}
                          aria-label="Richiede revisione"
                        />
                        <span>Richiede revisione</span>
                      </label>
                    </div>
                  </div>

                  {/* Campo Revisione (visibile se checkbox revisione selezionata) */}
                  {hasRevisione && (
                    <div className="form-row">
                      <div className="form-group">
                        <label>Data Scadenza Revisione *</label>
                        <input
                          type="date"
                          value={formData.revisione_data_scadenza}
                          onChange={(e) => setFormData({ ...formData, revisione_data_scadenza: e.target.value })}
                          required={hasRevisione}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="section-title">Ammortamento</div>
              
              {/* Scelta tipo ammortamento */}
              <div className="form-row">
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      id="toggle-ammortamento-dilazionato"
                      className={`toggle-button ${ammortamentoDilazionato ? 'active' : ''}`}
                      onClick={() => setAmmortamentoDilazionato(!ammortamentoDilazionato)}
                      aria-label="Dilaziona il costo nel tempo"
                    />
                    <span>Dilaziona il costo nel tempo</span>
                  </label>
                </div>
              </div>

              {ammortamentoDilazionato ? (
                <div className="form-row">
                  <div className="form-group">
                    <label>Valore Residuo (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.valore_residuo}
                      onChange={(e) => setFormData({ ...formData, valore_residuo: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Durata Ammortamento (anni) *</label>
                    <input
                      type="number"
                      value={formData.durata_ammortamento_anni}
                      onChange={(e) => setFormData({ ...formData, durata_ammortamento_anni: e.target.value })}
                      required={ammortamentoDilazionato}
                    />
                  </div>
                  <div className="form-group">
                    <label>Metodo Ammortamento</label>
                    <SmartSelect
                      className="select-compact"
                      options={[
                        { value: 'lineare', label: 'Lineare' },
                        { value: 'degressivo', label: 'Degressivo' }
                      ]}
                      value={formData.metodo_ammortamento}
                      onChange={(e) => setFormData({ ...formData, metodo_ammortamento: e.target.value })}
                      displayField="label"
                      valueField="value"
                    />
                  </div>
                </div>
              ) : (
                <div className="form-row">
                  <div className="form-group">
                    <label>Valore Residuo (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.valore_residuo}
                      onChange={(e) => setFormData({ ...formData, valore_residuo: e.target.value })}
                    />
                  </div>
                  <p style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
                    Il costo completo verrà attribuito al periodo di acquisto
                  </p>
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      id="toggle-attiva"
                      className={`toggle-button ${formData.attiva ? 'active' : ''}`}
                      onClick={() => setFormData({ ...formData, attiva: !formData.attiva })}
                      aria-label="Attiva"
                    />
                    <span>Attiva</span>
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label>Note</label>
                <textarea
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                />
              </div>

        </form>
      </BaseModal>

      {/* Resto del codice per modali scadenze e ammortamenti rimane uguale */}
      <BaseModal
        isOpen={!!attrezzaturaDetails}
        onClose={() => { setAttrezzaturaDetails(null); setSelectedAttrezzatura(null); }}
        title={attrezzaturaDetails ? `Dettagli Attrezzatura: ${attrezzaturaDetails.nome}` : ''}
        size="xlarge"
        footerActions={
          <button className="btn btn-secondary" onClick={() => { setAttrezzaturaDetails(null); setSelectedAttrezzatura(null); }}>
            Chiudi
          </button>
        }
      >
            {attrezzaturaDetails && (
            <div className="attrezzatura-details">
              <div className="details-section">
                <h4>Informazioni Generali</h4>
                <p><strong>Tipo:</strong> {attrezzaturaDetails.tipo || '-'}</p>
                <p><strong>Marca:</strong> {attrezzaturaDetails.marca || '-'}</p>
                <p><strong>Modello:</strong> {attrezzaturaDetails.modello || '-'}</p>
                {attrezzaturaDetails.targa && <p><strong>Targa:</strong> {attrezzaturaDetails.targa}</p>}
                {attrezzaturaDetails.costo_acquisto && <p><strong>Costo Acquisto:</strong> €{parseFloat(attrezzaturaDetails.costo_acquisto).toFixed(2)}</p>}
              </div>

              <div className="details-section">
                <div className="section-header">
                  <h4>Scadenze</h4>
                  <button 
                    className="btn btn-sm btn-primary"
                    onClick={() => {
                      setSelectedAttrezzaturaForScadenza(attrezzaturaDetails);
                      resetFormScadenza();
                      setShowModalScadenza(true);
                    }}
                  >
                    + Aggiungi Scadenza
                  </button>
                </div>
                <div className="table-container">
                  <table className="data-table">
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Descrizione</th>
                      <th>Data Scadenza</th>
                      <th>Costo</th>
                      <th>Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                      {attrezzaturaDetails.scadenze && attrezzaturaDetails.scadenze.length > 0 ? (
                        attrezzaturaDetails.scadenze.map(scadenza => (
                      <tr key={scadenza.id}>
                        <td>{scadenza.tipo}</td>
                        <td>{scadenza.descrizione}</td>
                        <td>{new Date(scadenza.data_scadenza).toLocaleDateString('it-IT')}</td>
                        <td>{scadenza.costo ? `€${parseFloat(scadenza.costo).toFixed(2)}` : '-'}</td>
                        <td>
                          <button className="btn-icon" onClick={() => handleDeleteScadenza(scadenza.id)} title="Elimina">🗑️</button>
                        </td>
                      </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="empty-state">
                            Nessuna scadenza registrata
                          </td>
                        </tr>
                      )}
                  </tbody>
                </table>
                </div>
              </div>

              <div className="details-section">
                <div className="section-header">
                  <h4>Ammortamenti</h4>
                  <button 
                    className="btn btn-sm btn-primary"
                    onClick={() => {
                      setSelectedAttrezzaturaForAmmortamento(attrezzaturaDetails);
                      resetFormAmmortamento();
                      setShowModalAmmortamento(true);
                    }}
                  >
                    + Aggiungi Ammortamento
                  </button>
                </div>
                <div className="table-container">
                  <table className="data-table">
                  <thead>
                    <tr>
                      <th>Anno</th>
                      <th>Mese</th>
                      <th>Quota</th>
                      <th>Valore Residuo</th>
                    </tr>
                  </thead>
                  <tbody>
                      {attrezzaturaDetails.ammortamenti && attrezzaturaDetails.ammortamenti.length > 0 ? (
                        attrezzaturaDetails.ammortamenti.map(ammortamento => (
                      <tr key={ammortamento.id}>
                        <td>{ammortamento.anno}</td>
                        <td>{ammortamento.mese || '-'}</td>
                        <td>€{parseFloat(ammortamento.quota_ammortamento).toFixed(2)}</td>
                        <td>{ammortamento.valore_residuo ? `€${parseFloat(ammortamento.valore_residuo).toFixed(2)}` : '-'}</td>
                      </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="empty-state">
                            Nessun ammortamento registrato
                          </td>
                        </tr>
                      )}
                  </tbody>
                </table>
                </div>
              </div>
            </div>
            )}
      </BaseModal>

      <BaseModal
        isOpen={showModalScadenza}
        onClose={() => { setShowModalScadenza(false); resetFormScadenza(); }}
        title="Nuova Scadenza"
        size="medium"
        footerActions={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => { setShowModalScadenza(false); resetFormScadenza(); }}>
              Annulla
            </button>
            <button type="submit" form="scadenza-form" className="btn btn-primary">Salva</button>
          </>
        }
      >
        <form id="scadenza-form" onSubmit={handleSubmitScadenza}>
              <div className="form-row">
                <div className="form-group">
                  <label>Tipo *</label>
                  <SmartSelect
                    className="select-compact"
                    options={TIPI_SCADENZA}
                    value={formDataScadenza.tipo}
                    onChange={(e) => setFormDataScadenza({ ...formDataScadenza, tipo: e.target.value })}
                    displayField="label"
                    valueField="value"
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Descrizione *</label>
                <input
                  type="text"
                  value={formDataScadenza.descrizione}
                  onChange={(e) => setFormDataScadenza({ ...formDataScadenza, descrizione: e.target.value })}
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Data Scadenza *</label>
                  <input
                    type="date"
                    value={formDataScadenza.data_scadenza}
                    onChange={(e) => setFormDataScadenza({ ...formDataScadenza, data_scadenza: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Data Ultimo Rinnovo</label>
                  <input
                    type="date"
                    value={formDataScadenza.data_ultimo_rinnovo}
                    onChange={(e) => setFormDataScadenza({ ...formDataScadenza, data_ultimo_rinnovo: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Costo (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formDataScadenza.costo}
                    onChange={(e) => setFormDataScadenza({ ...formDataScadenza, costo: e.target.value })}
                  />
                </div>
                {formDataScadenza.tipo === 'assicurazione' && (
                  <div className="form-group">
                    <label>Numero Polizza</label>
                    <input
                      type="text"
                      value={formDataScadenza.numero_polizza}
                      onChange={(e) => setFormDataScadenza({ ...formDataScadenza, numero_polizza: e.target.value })}
                    />
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>Note</label>
                <textarea
                  value={formDataScadenza.note}
                  onChange={(e) => setFormDataScadenza({ ...formDataScadenza, note: e.target.value })}
                />
              </div>
        </form>
      </BaseModal>

      <BaseModal
        isOpen={showModalAmmortamento}
        onClose={() => { setShowModalAmmortamento(false); resetFormAmmortamento(); }}
        title="Nuovo Ammortamento"
        size="medium"
        footerActions={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => { setShowModalAmmortamento(false); resetFormAmmortamento(); }}>
              Annulla
            </button>
            <button type="submit" form="ammortamento-form" className="btn btn-primary">Salva</button>
          </>
        }
      >
        <form id="ammortamento-form" onSubmit={handleSubmitAmmortamento}>
              <div className="form-row">
                <div className="form-group">
                  <label>Anno *</label>
                  <input
                    type="number"
                    value={formDataAmmortamento.anno}
                    onChange={(e) => setFormDataAmmortamento({ ...formDataAmmortamento, anno: parseInt(e.target.value) })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Mese (opzionale)</label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={formDataAmmortamento.mese || ''}
                    onChange={(e) => setFormDataAmmortamento({ ...formDataAmmortamento, mese: e.target.value ? parseInt(e.target.value) : null })}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Quota Ammortamento (€) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formDataAmmortamento.quota_ammortamento}
                    onChange={(e) => setFormDataAmmortamento({ ...formDataAmmortamento, quota_ammortamento: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Valore Residuo (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formDataAmmortamento.valore_residuo}
                    onChange={(e) => setFormDataAmmortamento({ ...formDataAmmortamento, valore_residuo: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Note</label>
                <textarea
                  value={formDataAmmortamento.note}
                  onChange={(e) => setFormDataAmmortamento({ ...formDataAmmortamento, note: e.target.value })}
                />
              </div>
        </form>
      </BaseModal>
    </div>
  );
});

GestioneAttrezzature.displayName = 'GestioneAttrezzature';

export default GestioneAttrezzature;

