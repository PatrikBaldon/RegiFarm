/**
 * AnimaleDetail - Scheda completa animale con possibilità di spostamento e modifica dati
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import SimpleSelect from '../../../components/SimpleSelect';
import BaseModal from '../../../components/BaseModal';
import { allevamentoService } from '../services/allevamentoService';
import { amministrazioneService } from '../../amministrazione/services/amministrazioneService';
import { alimentazioneService } from '../../alimentazione/services/alimentazioneService';
import './AnimaleDetail.css';


const AnimaleDetail = ({ animale, onClose, onUpdate, initialDetail = null }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [selectedStabilimento, setSelectedStabilimento] = useState('');
  const [selectedBox, setSelectedBox] = useState('');
  const [allStabilimenti, setAllStabilimenti] = useState([]);
  const [boxes, setBoxes] = useState([]);
  const [sedi, setSedi] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(null);
  const [loadingPosition, setLoadingPosition] = useState(false);
  const [currentSedeId, setCurrentSedeId] = useState(null);
  const [currentSedeName, setCurrentSedeName] = useState('');
  const [animaleDetail, setAnimaleDetail] = useState(initialDetail);
  const [editingValoreDecesso, setEditingValoreDecesso] = useState(false);
  const [valoreDecesso, setValoreDecesso] = useState('');
  const [savingValoreDecesso, setSavingValoreDecesso] = useState(false);
  const [responsabileDecesso, setResponsabileDecesso] = useState('soccidario');
  const [editingResponsabileDecesso, setEditingResponsabileDecesso] = useState(false);
  const [savingResponsabileDecesso, setSavingResponsabileDecesso] = useState(false);
  const [contrattiSoccida, setContrattiSoccida] = useState([]);
  const [loadingContratti, setLoadingContratti] = useState(false);
  const [contrattoDetail, setContrattoDetail] = useState(null);
  const [loadingContrattoDetail, setLoadingContrattoDetail] = useState(false);
  const [contractEditorOpen, setContractEditorOpen] = useState(false);
  const [pendingContrattoId, setPendingContrattoId] = useState(undefined);
  const [savingContratto, setSavingContratto] = useState(false);
  const currentContrattoId = animaleDetail?.contratto_soccida_id ?? animale?.contratto_soccida_id ?? null;
  const [soccidantiCache, setSoccidantiCache] = useState({});
  const [pesoModalOpen, setPesoModalOpen] = useState(false);
  const [pesoModalData, setPesoModalData] = useState({ peso: '', data_cambio: '', note: '' });
  const [pendingContractChange, setPendingContractChange] = useState(null);
  const [partitaUscita, setPartitaUscita] = useState(null);
  const [movimentazioni, setMovimentazioni] = useState([]);
  const [loadingMovimentazioni, setLoadingMovimentazioni] = useState(false);
  const [partiteAnimale, setPartiteAnimale] = useState([]);
  const [loadingPartite, setLoadingPartite] = useState(false);
  const [allPartiteIngresso, setAllPartiteIngresso] = useState([]);

  const filteredStabilimenti = useMemo(() => {
    if (!currentSedeId) {
      return allStabilimenti;
    }
    const filtered = allStabilimenti.filter(
      (stab) => stab.sede_id === currentSedeId,
    );
    return filtered.length > 0 ? filtered : allStabilimenti;
  }, [allStabilimenti, currentSedeId]);

  const stabilimentoOptions = useMemo(
    () =>
      filteredStabilimenti.map((stab) => ({
        value: String(stab.id),
        label: stab.nome,
      })),
    [filteredStabilimenti],
  );

  const boxOptions = useMemo(
    () =>
      boxes.map((box) => ({
        value: String(box.id),
        label: `${box.nome} - ${box.capacita} capi`,
      })),
    [boxes],
  );

  // Inizializza formData quando animale cambia o si entra in modalità edit
  useEffect(() => {
    // Usa animaleDetail se disponibile, altrimenti animale
    const sourceData = animaleDetail || animale;
    if (sourceData) {
      setFormData({
        specie: sourceData.specie || '',
        razza: sourceData.razza || '',
        sesso: sourceData.sesso || '',
        data_nascita: sourceData.data_nascita ? (sourceData.data_nascita.split('T')[0] || sourceData.data_nascita) : '',
        codice_elettronico: sourceData.codice_elettronico || '',
        codice_madre: sourceData.codice_madre || '',
        codice_assegnato_precedenza: sourceData.codice_assegnato_precedenza || '',
        codice_azienda_anagrafe: sourceData.codice_azienda_anagrafe || '',
        codice_provenienza: sourceData.codice_provenienza || '',
        identificativo_fiscale_provenienza: sourceData.identificativo_fiscale_provenienza || '',
        specie_allevata_provenienza: sourceData.specie_allevata_provenienza || '',
        motivo_ingresso: sourceData.motivo_ingresso || '',
        data_arrivo: sourceData.data_arrivo ? (sourceData.data_arrivo.split('T')[0] || sourceData.data_arrivo) : '',
        peso_arrivo: sourceData.peso_arrivo || '',
        numero_modello_ingresso: sourceData.numero_modello_ingresso || '',
        data_modello_ingresso: sourceData.data_modello_ingresso ? (sourceData.data_modello_ingresso.split('T')[0] || sourceData.data_modello_ingresso) : '',
        tipo_allevamento: sourceData.tipo_allevamento || '',
        peso_attuale: sourceData.peso_attuale || '',
        data_ultima_pesata: sourceData.data_ultima_pesata ? (sourceData.data_ultima_pesata.split('T')[0] || sourceData.data_ultima_pesata) : '',
        stato: sourceData.stato || 'presente',
        motivo_uscita: sourceData.motivo_uscita || '',
        data_uscita: sourceData.data_uscita ? (sourceData.data_uscita.split('T')[0] || sourceData.data_uscita) : '',
        numero_modello_uscita: sourceData.numero_modello_uscita || '',
        data_modello_uscita: sourceData.data_modello_uscita ? (sourceData.data_modello_uscita.split('T')[0] || sourceData.data_modello_uscita) : '',
        codice_azienda_destinazione: sourceData.codice_azienda_destinazione || '',
        codice_fiera_destinazione: sourceData.codice_fiera_destinazione || '',
        codice_stato_destinazione: sourceData.codice_stato_destinazione || '',
        regione_macello_destinazione: sourceData.regione_macello_destinazione || '',
        codice_macello_destinazione: sourceData.codice_macello_destinazione || '',
        codice_pascolo_destinazione: sourceData.codice_pascolo_destinazione || '',
        codice_circo_destinazione: sourceData.codice_circo_destinazione || '',
        data_macellazione: sourceData.data_macellazione ? (sourceData.data_macellazione.split('T')[0] || sourceData.data_macellazione) : '',
        abbattimento: sourceData.abbattimento || '',
        data_provvvedimento: sourceData.data_provvvedimento ? (sourceData.data_provvvedimento.split('T')[0] || sourceData.data_provvvedimento) : '',
        origine_dati: sourceData.origine_dati || 'manuale',
        valore: sourceData.valore ? parseFloat(sourceData.valore).toFixed(2) : '',
      });
    }
  }, [animale, animaleDetail, isEditing]);


  useEffect(() => {
    // Carica tutti i dati in parallelo quando possibile
    const loadDataInParallel = async () => {
      if (initialDetail && initialDetail.id === animale?.id) {
        setAnimaleDetail(initialDetail);
        if (initialDetail.decesso) {
          setValoreDecesso(initialDetail.decesso.valore_capo || '');
          setResponsabileDecesso(initialDetail.decesso.responsabile || 'soccidario');
        }
      } else if (animale?.id) {
        // Se abbiamo initialDetail, non ricaricare
        if (!initialDetail || initialDetail.id !== animale?.id) {
          loadAnimaleDetail();
        }
      }
      
      // Carica questi dati in parallelo
      const promises = [];
      if (animale?.azienda_id) {
        promises.push(
          loadStabilimentiForAzienda(animale.azienda_id).catch(() => {})
        );
      }
      if (animale?.box_id) {
        promises.push(
          loadCurrentPosition().catch(() => {})
        );
      } else {
        setCurrentPosition(null);
      }
      
      // Esegui tutte le chiamate in parallelo
      await Promise.allSettled(promises);
    };
    
    loadDataInParallel();
  }, [animale, initialDetail]);

  useEffect(() => {
    if (animale?.azienda_id) {
      loadContrattiSoccida();
    } else {
      setContrattiSoccida([]);
    }
  }, [animale?.azienda_id]);

  useEffect(() => {
    if (animale?.id) {
      loadMovimentazioni();
    } else {
      setMovimentazioni([]);
    }
  }, [animale?.id]);

  useEffect(() => {
    if (animale?.auricolare) {
      loadPartiteAnimale();
    } else {
      setPartiteAnimale([]);
    }
  }, [animale?.auricolare]);

  const loadAnimaleDetail = async () => {
    if (!animale?.id) return;
    try {
      const detail = await allevamentoService.getAnimaleDetail(animale.id);
      setAnimaleDetail(detail);
      if (detail.decesso) {
        setValoreDecesso(detail.decesso.valore_capo || '');
        setResponsabileDecesso(detail.decesso.responsabile || 'soccidario');
      }
    } catch (err) {

    }
  };

  const loadContrattiSoccida = async () => {
    if (!animale?.azienda_id) {
      setContrattiSoccida([]);
      return;
    }

    setLoadingContratti(true);
    try {
      const data = await amministrazioneService.getContrattiSoccidaRiepilogo({
        azienda_id: animale.azienda_id,
      });
      const normalized = Array.isArray(data) ? data : [];
      setContrattiSoccida(normalized.filter((contratto) => contratto.attivo !== false));
    } catch (err) {

    } finally {
      setLoadingContratti(false);
    }
  };

  const loadMovimentazioni = async () => {
    if (!animale?.id) {
      setMovimentazioni([]);
      return;
    }

    setLoadingMovimentazioni(true);
    try {
      const movs = await allevamentoService.getMovimentazioniAnimale(animale.id);
      if (!Array.isArray(movs)) {
        setMovimentazioni([]);
        return;
      }

      // Risolvi i codici stalla per ogni movimentazione
      const movsWithCodici = await Promise.all(
        movs.map(async (mov) => {
          let codiceStallaDa = null;
          let codiceStallaA = null;

          // Risolvi codice stalla da
          if (mov.da_box_id) {
            try {
              const boxDa = await allevamentoService.getBoxDetail(mov.da_box_id);
              if (boxDa?.stabilimento_id) {
                const stabDa = await allevamentoService.getStabilimento(boxDa.stabilimento_id);
                if (stabDa?.sede_id) {
                  const sedeDa = await allevamentoService.getSede(stabDa.sede_id);
                  if (sedeDa?.codice_stalla) {
                    codiceStallaDa = sedeDa.codice_stalla;
                  }
                }
              }
            } catch (err) {
              // Ignora errori
            }
          }

          // Risolvi codice stalla a
          if (mov.a_box_id) {
            try {
              const boxA = await allevamentoService.getBoxDetail(mov.a_box_id);
              if (boxA?.stabilimento_id) {
                const stabA = await allevamentoService.getStabilimento(boxA.stabilimento_id);
                if (stabA?.sede_id) {
                  const sedeA = await allevamentoService.getSede(stabA.sede_id);
                  if (sedeA?.codice_stalla) {
                    codiceStallaA = sedeA.codice_stalla;
                  }
                }
              }
            } catch (err) {
              // Ignora errori
            }
          }

          return {
            ...mov,
            codice_stalla_da: codiceStallaDa,
            codice_stalla_a: codiceStallaA,
          };
        })
      );

      // Ordina per data (più recente prima)
      movsWithCodici.sort((a, b) => {
        const dateA = new Date(a.data_ora || a.created_at || 0);
        const dateB = new Date(b.data_ora || b.created_at || 0);
        return dateB - dateA;
      });

      setMovimentazioni(movsWithCodici);
    } catch (err) {
      setMovimentazioni([]);
    } finally {
      setLoadingMovimentazioni(false);
    }
  };

  const loadPartiteAnimale = async () => {
    if (!animale?.auricolare) {
      setPartiteAnimale([]);
      setAllPartiteIngresso([]);
      return;
    }

    setLoadingPartite(true);
    try {
      const response = await amministrazioneService.getPartiteAnimale(animale.auricolare);
      if (response?.storico_partite) {
        // Ordina tutte le partite per data (più vecchia prima)
        const partiteOrdinate = [...response.storico_partite].sort((a, b) => {
          const dateA = new Date(a.data || a.created_at || 0);
          const dateB = new Date(b.data || b.created_at || 0);
          return dateA - dateB;
        });

        // Salva tutte le partite di ingresso
        const partiteIngresso = partiteOrdinate.filter(p => p.tipo === 'ingresso');
        setAllPartiteIngresso(partiteIngresso);

        // Filtra solo i trasferimenti interni (ingressi con is_trasferimento_interno = true)
        const trasferimentiInterni = partiteIngresso.filter(
          (partita) => partita.is_trasferimento_interno
        );
        setPartiteAnimale(trasferimentiInterni);

        // Trova la partita di uscita per animali macellati
        const partiteUscita = partiteOrdinate.filter(p => p.tipo === 'uscita');
        if (partiteUscita.length > 0) {
          // Prendi l'ultima partita di uscita (più recente)
          const ultimaUscita = partiteUscita[partiteUscita.length - 1];
          setPartitaUscita(ultimaUscita);
        } else {
          setPartitaUscita(null);
        }
      } else {
        setPartiteAnimale([]);
        setAllPartiteIngresso([]);
        setPartitaUscita(null);
      }
    } catch (err) {
      setPartiteAnimale([]);
      setAllPartiteIngresso([]);
      setPartitaUscita(null);
    } finally {
      setLoadingPartite(false);
    }
  };


  const loadContrattoInfo = async (contrattoId) => {
    if (!contrattoId) {
      setContrattoDetail(null);
      return;
    }

    setLoadingContrattoDetail(true);
    try {
      const detail = await amministrazioneService.getContrattoSoccida(contrattoId, {
        include_relations: true,
      });
      setContrattoDetail(detail);
    } catch (err) {

      setContrattoDetail(null);
    } finally {
      setLoadingContrattoDetail(false);
    }
  };

  const getCachedSoccidante = useCallback(
    (id) => {
      if (!id) return null;
      return soccidantiCache[id] || null;
    },
    [soccidantiCache],
  );

  const ensureSoccidanteLoaded = useCallback(
    async (soccidanteId) => {
      if (!soccidanteId || getCachedSoccidante(soccidanteId)) {
        return;
      }
      try {
        const fornitore = await amministrazioneService.getFornitore(soccidanteId);
        if (fornitore) {
          setSoccidantiCache((prev) => ({
            ...prev,
            [soccidanteId]: fornitore,
          }));
        }
      } catch (err) {

      }
    },
    [getCachedSoccidante],
  );

  const resolveContrattoById = useCallback(
    (id) => {
      if (!id) return null;
      const numericId = Number(id);
      if (Number.isNaN(numericId)) return null;
      return (
        contrattiSoccida.find((contratto) => contratto.id === numericId) ||
        (contrattoDetail?.id === numericId ? contrattoDetail : null)
      );
    },
    [contrattiSoccida, contrattoDetail],
  );

  const currentContrattoRecord = useMemo(
    () => resolveContrattoById(currentContrattoId),
    [resolveContrattoById, currentContrattoId],
  );

  const getSoccidanteInfo = useCallback(
    (contratto) => {
      if (!contratto) return null;
      return contratto.soccidante || getCachedSoccidante(contratto.soccidante_id);
    },
    [getCachedSoccidante],
  );

  const effectiveSoccidante = useMemo(() => {
    return getSoccidanteInfo(contrattoDetail) || getSoccidanteInfo(currentContrattoRecord) || null;
  }, [contrattoDetail, currentContrattoRecord, getSoccidanteInfo]);

  const effectiveSoccidanteName = effectiveSoccidante?.nome || 'Non indicato';

  const resolveContrattoLabel = useCallback(
    (contratto) => {
      if (!contratto) return 'Soccidante non indicato';
      const cached = getCachedSoccidante(contratto.soccidante_id);
      const name =
        contratto.soccidante?.nome ||
        cached?.nome ||
        (contrattoDetail?.soccidante_id === contratto?.soccidante_id
          ? effectiveSoccidante?.nome
          : null);
      return name || 'Soccidante non indicato';
    },
    [contrattoDetail, effectiveSoccidante, getCachedSoccidante],
  );

  useEffect(() => {
    if (selectedStabilimento) {
      loadBoxes(selectedStabilimento);
    } else {
      setBoxes([]);
    }
    setSelectedBox('');
  }, [selectedStabilimento]);

  useEffect(() => {
    if (currentContrattoId) {
      loadContrattoInfo(currentContrattoId);
    } else {
      setContrattoDetail(null);
    }
  }, [currentContrattoId]);

  useEffect(() => {
    const pendingId =
      (contrattoDetail && !contrattoDetail.soccidante && contrattoDetail.soccidante_id) ||
      (currentContrattoRecord &&
        !currentContrattoRecord.soccidante &&
        currentContrattoRecord.soccidante_id) ||
      null;
    if (pendingId) {
      ensureSoccidanteLoaded(pendingId);
    }
  }, [contrattoDetail, currentContrattoRecord, ensureSoccidanteLoaded]);

  useEffect(() => {
    if (!currentSedeId && animale?.codice_azienda_anagrafe && sedi.length > 0) {
      const match = sedi.find(
        (sede) =>
          sede.codice_stalla &&
          sede.codice_stalla.toUpperCase() === animale.codice_azienda_anagrafe.toUpperCase(),
      );
      if (match) {
        setCurrentSedeId(match.id);
        if (match.nome) {
          setCurrentSedeName(match.nome);
        }
      }
    } else if (currentSedeId && !currentSedeName && sedi.length > 0) {
      const match = sedi.find((sede) => sede.id === currentSedeId);
      if (match?.nome) {
        setCurrentSedeName(match.nome);
      }
    }
  }, [animale, currentSedeId, currentSedeName, sedi]);

  useEffect(() => {
    if (isEditing) {
      setPendingContrattoId(currentContrattoId ? String(currentContrattoId) : '');
    } else if (!contractEditorOpen) {
      setPendingContrattoId(undefined);
    }
  }, [isEditing, currentContrattoId, contractEditorOpen]);

  const loadStabilimentiForAzienda = async (aziendaId) => {
    try {
      const sediData = await allevamentoService.getSedi(aziendaId);
      setSedi(sediData || []);

      const stabilimentiPerSede = await Promise.all(
        (sediData || []).map(async (sede) => {
          try {
            const stab = await allevamentoService.getStabilimenti(sede.id);
            return stab || [];
          } catch (err) {

            return [];
          }
        }),
      );

      const flattened = stabilimentiPerSede.flat();
      setAllStabilimenti(flattened);
    } catch (err) {

      setSedi([]);
      setAllStabilimenti([]);
    }
  };

  const loadBoxes = async (stabilimentoId) => {
    try {
      const data = await allevamentoService.getBox(stabilimentoId);
      setBoxes(data || []);
    } catch (err) {

      setBoxes([]);
    }
  };

  const loadCurrentPosition = async () => {
    if (!animale?.box_id) {
      setCurrentPosition(null);
      return;
    }

    setLoadingPosition(true);
    try {
      // Carica il box
      const box = await allevamentoService.getBoxDetail(animale.box_id);
      
      // Carica lo stabilimento
      const stabilimento = await allevamentoService.getStabilimento(box.stabilimento_id);
      let sedeName = '';
      if (stabilimento?.sede_id) {
        setCurrentSedeId(stabilimento.sede_id);
        try {
          const sedeDetail = await allevamentoService.getSede(stabilimento.sede_id);
          if (sedeDetail?.nome) {
            sedeName = sedeDetail.nome;
            setCurrentSedeName(sedeDetail.nome);
          }
        } catch (err) {

        }
      }
      
      setCurrentPosition({
        sede: sedeName || null,
        stabilimento: stabilimento.nome,
        box: `${box.nome}`,
      });
    } catch (err) {

      setCurrentPosition(null);
    } finally {
      setLoadingPosition(false);
    }
  };

  const applyContractChange = async (
    targetValue,
    { silent = false, skipClose = false, refresh = true, peso_ingresso = null, data_cambio = null, note = null } = {}
  ) => {
    const normalizedCurrent = currentContrattoId ? Number(currentContrattoId) : null;
    const normalizedTarget = targetValue ? Number(targetValue) : null;

    if (normalizedCurrent === normalizedTarget) {
      if (!skipClose && !isEditing) {
        setContractEditorOpen(false);
        setPendingContrattoId(undefined);
      }
      return;
    }

    if (!animale?.id) {
      return;
    }

    setSavingContratto(true);
    try {
      if (normalizedTarget === null) {
        if (!normalizedCurrent) {
          return;
        }
        const options = {};
        if (peso_ingresso !== null && peso_ingresso !== '') {
          options.peso_ingresso = parseFloat(peso_ingresso);
        }
        if (data_cambio) {
          options.data_cambio = data_cambio;
        }
        if (note) {
          options.note = note;
        }
        await amministrazioneService.disassociaAnimaleContratto(normalizedCurrent, animale.id, options);
        if (!silent) {
          alert('Contratto di soccida rimosso: il capo è ora in proprietà.');
        }
      } else {
        const options = {};
        if (peso_ingresso !== null && peso_ingresso !== '') {
          options.pesi_animali = { [animale.id]: parseFloat(peso_ingresso) };
        }
        if (data_cambio) {
          options.data_cambio = data_cambio;
        }
        if (note) {
          options.note = note;
        }
        await amministrazioneService.associaAnimaliContratto(normalizedTarget, [animale.id], options);
        if (!silent) {
          alert('Contratto di soccida aggiornato con successo.');
        }
      }

      const appliedContratto = normalizedTarget ? resolveContrattoById(normalizedTarget) : null;

      setPendingContrattoId(targetValue ?? '');

      setAnimaleDetail((prev) => {
        if (!prev) return prev;
        const next = { ...prev, contratto_soccida_id: normalizedTarget };
        if (appliedContratto?.tipo_allevamento) {
          next.tipo_allevamento = appliedContratto.tipo_allevamento;
        }
        return next;
      });

      if (appliedContratto?.tipo_allevamento) {
        setFormData((prev) => ({
          ...prev,
          tipo_allevamento: appliedContratto.tipo_allevamento,
        }));
      }

      if (refresh) {
        await loadAnimaleDetail();
        if (onUpdate) {
          onUpdate();
        }
      } else {
        setAnimaleDetail((prev) =>
          prev ? { ...prev, contratto_soccida_id: normalizedTarget } : prev
        );
      }
    } catch (err) {

      if (!silent) {
        alert(`Errore nel cambio contratto: ${err.message || 'Errore sconosciuto'}`);
      }
      throw err;
    } finally {
      setSavingContratto(false);
      if (!skipClose && !isEditing) {
        setContractEditorOpen(false);
        setPendingContrattoId(undefined);
      }
    }
  };

  const handleOpenContractEditor = () => {
    if (!animale?.azienda_id) {
      alert('Impossibile caricare i contratti: azienda non disponibile.');
      return;
    }

    if (!contrattiSoccida.length && !loadingContratti) {
      loadContrattiSoccida();
    }

    setPendingContrattoId(currentContrattoId ? String(currentContrattoId) : '');
    setContractEditorOpen(true);
  };

  const handleCancelContractEditor = () => {
    setContractEditorOpen(false);
    setPendingContrattoId(undefined);
  };

  const handleStandaloneContractSave = async () => {
    const targetValue =
      pendingContrattoId !== undefined
        ? pendingContrattoId
        : currentContrattoId
        ? String(currentContrattoId)
        : '';
    
    const normalizedCurrent = currentContrattoId ? Number(currentContrattoId) : null;
    const normalizedTarget = targetValue ? Number(targetValue) : null;
    
    // Se c'è un cambio di gestione, apri il modal per il peso
    if (normalizedCurrent !== normalizedTarget) {
      setPendingContractChange({ targetValue, silent: false, skipClose: false, refresh: true });
      setPesoModalData({ 
        peso: animaleDetail?.peso_attuale ? String(animaleDetail.peso_attuale) : '', 
        data_cambio: new Date().toISOString().split('T')[0],
        note: '' 
      });
      setPesoModalOpen(true);
      return;
    }
    
    try {
      await applyContractChange(targetValue);
    } catch (err) {
      // Error already gestito in applyContractChange
    }
  };

  const handleConfirmPesoModal = async () => {
    if (!pendingContractChange) return;
    
    const { targetValue, silent, skipClose, refresh } = pendingContractChange;
    const peso = pesoModalData.peso.trim();
    const data_cambio = pesoModalData.data_cambio || null;
    const note = pesoModalData.note.trim() || null;
    
    setPesoModalOpen(false);
    setPendingContractChange(null);
    
    try {
      await applyContractChange(targetValue, {
        silent,
        skipClose,
        refresh,
        peso_ingresso: peso || null,
        data_cambio,
        note,
      });
    } catch (err) {
      // Error already gestito in applyContractChange
    }
  };

  const handleCancelPesoModal = () => {
    setPesoModalOpen(false);
    setPendingContractChange(null);
    setPesoModalData({ peso: '', data_cambio: '', note: '' });
  };


  const handleRemoveContratto = async () => {
    if (!currentContrattoId) {
      return;
    }
    if (
      !window.confirm(
        'Rimuovere il contratto di soccida da questo capo?\nL\'animale tornerà in modalità proprietà.'
      )
    ) {
      return;
    }
    setPendingContrattoId('');
    // Apri il modal per il peso anche quando si rimuove il contratto
    setPendingContractChange({ targetValue: '', silent: false, skipClose: false, refresh: true });
    setPesoModalData({ 
      peso: animaleDetail?.peso_attuale ? String(animaleDetail.peso_attuale) : '', 
      data_cambio: new Date().toISOString().split('T')[0],
      note: '' 
    });
    setPesoModalOpen(true);
  };

  const handleMoveAnimal = async () => {
    if (!selectedBox) {
      alert('Seleziona un box di destinazione');
      return;
    }

    if (!window.confirm(`Spostare l'animale ${animale.auricolare} nel box selezionato?`)) {
      return;
    }

    setLoading(true);
    try {
      await allevamentoService.createMovimentazione({
        animale_id: animale.id,
        a_box_id: parseInt(selectedBox),
      });
      alert('Animale spostato con successo!');
      if (onUpdate) onUpdate();
      onClose();
    } catch (err) {
      alert(`Errore nello spostamento: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('it-IT');
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingValoreDecesso(false);
    setEditingResponsabileDecesso(false);
    // Ripristina formData ai valori originali quando si annulla
    // Il useEffect si occuperà di ricaricare i dati
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const desiredContrattoValue =
        pendingContrattoId !== undefined ? pendingContrattoId : undefined;
      const currentContrattoValue = currentContrattoId ? String(currentContrattoId) : '';
      const shouldChangeContratto =
        desiredContrattoValue !== undefined &&
        desiredContrattoValue !== currentContrattoValue;

      // Prepara i dati per l'update, convertendo stringhe vuote in null e formattando le date
      const updateData = {};
      
      // Gestisci il valore animale separatamente
      const valoreAnimale = formData.valore;
      const valoreOriginale = animaleDetail?.valore || animale?.valore;
      const valoreOriginaleFormatted = valoreOriginale ? parseFloat(valoreOriginale).toFixed(2) : '';
      const valoreAnimaleChanged = valoreAnimale !== valoreOriginaleFormatted;
      
      Object.keys(formData).forEach((key) => {
        // Salta il valore animale, lo gestiamo separatamente
        if (key === 'valore') return;
        // Salta lo stato - non può essere modificato da qui
        if (key === 'stato') return;
        // Salta i campi fattura - vengono gestiti dalle fatture
        if (key === 'fattura_emessa_id' || key === 'fattura_amministrazione_id' || key === '_fattura_emessa_id' || key === '_fattura_amministrazione_id') return;
        
        const value = formData[key];
        if (value === '' || value === null || value === undefined) {
          updateData[key] = null;
        } else if (key.includes('data_') || key === 'data_nascita' || key === 'data_arrivo' || key === 'data_ultima_pesata' || key === 'data_uscita' || key === 'data_macellazione' || key === 'data_provvvedimento' || key === 'data_modello_ingresso' || key === 'data_modello_uscita') {
          // Le date devono essere nel formato YYYY-MM-DD
          updateData[key] = value || null;
        } else if (key === 'peso_arrivo' || key === 'peso_attuale') {
          // I pesi devono essere numeri
          const numValue = parseFloat(value);
          updateData[key] = isNaN(numValue) ? null : numValue;
        } else {
          updateData[key] = value;
        }
      });

      // Verifica impatto su partite prima di salvare
      let updatePartita = false;
      const campiSincronizzabili = ['peso_attuale', 'peso_arrivo', 'valore', 'data_arrivo', 'data_uscita', 'motivo_ingresso', 'motivo_uscita', 'numero_modello_ingresso', 'numero_modello_uscita'];
      const hasCampiSincronizzabili = Object.keys(updateData).some(key => campiSincronizzabili.includes(key));
      
      if (hasCampiSincronizzabili) {
        try {
          const impactResult = await allevamentoService.checkAnimaleUpdateImpact(animale.id, updateData);
          
          if (impactResult.partite_affected && impactResult.partite_affected.length > 0) {
            const partita = impactResult.partite_affected[0];
            const tipoPartitaNomi = {
              'ingresso_esterno': 'Ingresso esterno',
              'uscita_esterna': 'Uscita esterna',
              'trasferimento_recente': 'Trasferimento interno'
            };
            const tipoPartitaNome = tipoPartitaNomi[partita.partita_tipo] || 'Partita';
            const campiLista = partita.campi_impattati.join(', ');
            
            let messaggio = `Stai modificando un animale associato alla partita ${tipoPartitaNome} #${partita.partita_id}.\n\n`;
            messaggio += `Animali nella partita: ${partita.animali_count} capi\n\n`;
            messaggio += `Questa modifica impatterà tutti gli animali della partita:\n`;
            messaggio += `• Campi modificati: ${campiLista}\n\n`;
            
            if (partita.aggiorna_altri_animali) {
              messaggio += `⚠️ Attenzione: Questi campi verranno sincronizzati su tutti gli ${partita.animali_count} animali della partita.\n\n`;
            }
            
            messaggio += `Cosa vuoi fare?`;
            
            const scelta = window.confirm(
              messaggio + '\n\n' +
              'Clicca OK per modificare la partita e tutti gli animali\n' +
              'Clicca Annulla per modificare solo questo animale'
            );
            
            updatePartita = scelta;
          }
        } catch (err) {
          console.error('Errore verifica impatto partita:', err);
          // Continua senza sincronizzazione se c'è errore
        }
      }

      await allevamentoService.updateAnimale(animale.id, updateData, updatePartita);
      
      // Gestisci il valore animale se è stato modificato
      if (valoreAnimaleChanged) {
        if (valoreAnimale === '' || valoreAnimale === null) {
          // Se il valore è stato rimosso, aggiorna a null
          await allevamentoService.updateValoreAnimale(animale.id, null, false);
        } else {
          const valoreNum = parseFloat(valoreAnimale);
          if (!isNaN(valoreNum) && valoreNum >= 0) {
            // Chiedi se estendere agli altri animali della partita
            const extendToPartita = window.confirm(
              `Vuoi estendere il valore €${valoreNum.toFixed(2)} a tutti gli altri animali della stessa partita di ingresso?`
            );
            
            await allevamentoService.updateValoreAnimale(animale.id, valoreNum, extendToPartita);
          }
        }
      }

      if (shouldChangeContratto) {
        await applyContractChange(desiredContrattoValue, {
          silent: true,
          skipClose: true,
          refresh: false,
        });
      }

      // La gestione delle partite di uscita e fatture viene fatta dalla sincronizzazione anagrafe
      // Non gestiamo più qui la creazione di partite di uscita

      await loadAnimaleDetail();
      alert('Dati animale aggiornati con successo!');
      setIsEditing(false);
      if (onUpdate) onUpdate();
    } catch (err) {

      alert(`Errore nell'aggiornamento: ${err.message || 'Errore sconosciuto'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleFieldChange = (field, value) => {
    // Lo stato non può essere modificato da qui - viene gestito dalla sincronizzazione anagrafe
    if (field === 'stato') {
      return; // Non permettere la modifica dello stato
    }
    
    // Per tutti gli altri campi, aggiorna normalmente
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSaveValoreDecesso = async () => {
    if (!animale?.id) return;
    
    const valore = parseFloat(valoreDecesso);
    if (isNaN(valore) || valore < 0) {
      alert('Inserisci un valore numerico valido');
      return;
    }

    setSavingValoreDecesso(true);
    try {
      const response = await allevamentoService.updateValoreDecesso(animale.id, valore);
      alert(`Valore decesso aggiornato con successo!\nValore medio a capo partita: €${response.valore_medio_capo?.toFixed(2) || 'N/A'}`);
      setEditingValoreDecesso(false);
      await loadAnimaleDetail();
      if (onUpdate) onUpdate();
    } catch (err) {

      alert(`Errore nell'aggiornamento: ${err.message || 'Errore sconosciuto'}`);
    } finally {
      setSavingValoreDecesso(false);
    }
  };

  const handleSaveResponsabileDecesso = async () => {
    if (!animale?.id) return;
    
    if (!responsabileDecesso) {
      alert('Seleziona un responsabile');
      return;
    }

    setSavingResponsabileDecesso(true);
    try {
      await allevamentoService.updateResponsabileDecesso(animale.id, responsabileDecesso);
      alert('Responsabile decesso aggiornato con successo!');
      setEditingResponsabileDecesso(false);
      await loadAnimaleDetail();
      if (onUpdate) onUpdate();
    } catch (err) {

      alert(`Errore nell'aggiornamento: ${err.message || 'Errore sconosciuto'}`);
    } finally {
      setSavingResponsabileDecesso(false);
    }
  };

  // Helper per renderizzare un campo editabile o in sola lettura
  const renderField = (label, fieldName, type = 'text', options = null, spanClass = '') => {
    // Usa animaleDetail se disponibile, altrimenti animale
    const sourceData = animaleDetail || animale;
    
    if (isEditing) {
      if (type === 'select' && options) {
        return (
          <div className={`form-group ${spanClass}`}>
            <label>{label}</label>
            <SimpleSelect
              className="select-compact"
              options={options}
              value={formData[fieldName] || ''}
              onChange={(e) => handleFieldChange(fieldName, e.target.value)}
              displayField="label"
              valueField="value"
              placeholder={`Seleziona ${label.toLowerCase()}...`}
            />
          </div>
        );
      } else if (type === 'date') {
        return (
          <div className={`form-group ${spanClass}`}>
            <label>{label}</label>
            <input
              type="date"
              value={formData[fieldName] || ''}
              onChange={(e) => handleFieldChange(fieldName, e.target.value)}
            />
          </div>
        );
      } else if (type === 'number') {
        return (
          <div className={`form-group ${spanClass}`}>
            <label>{label}</label>
            <input
              type="number"
              step="0.01"
              value={formData[fieldName] || ''}
              onChange={(e) => handleFieldChange(fieldName, e.target.value)}
              placeholder={label}
            />
          </div>
        );
      } else {
        return (
          <div className={`form-group ${spanClass}`}>
            <label>{label}</label>
            <input
              type="text"
              value={formData[fieldName] || ''}
              onChange={(e) => handleFieldChange(fieldName, e.target.value)}
              placeholder={label}
            />
          </div>
        );
      }
      } else {
        const value = sourceData[fieldName];
        let displayValue = value;
        if (type === 'date') {
          displayValue = formatDate(value);
        } else if (type === 'number' && value != null && value !== '') {
          // Formatta diversamente per valore (€) vs peso (kg)
          if (fieldName === 'valore') {
            displayValue = `€${parseFloat(value).toFixed(2)}`;
          } else {
            displayValue = `${value} kg`;
          }
        } else if (type === 'select' && options) {
          const option = options.find(opt => opt.value === value);
          displayValue = option ? option.label : value;
        }
        const isStatus = fieldName === 'stato';
        const isEmpty = (value === null || value === undefined || value === '');
        const finalDisplayValue = isEmpty && fieldName === 'valore' ? 'Non impostato' : (displayValue || '-');
        return (
          <div className={`form-group ${spanClass}`}>
            <label>{label}</label>
            {isStatus ? (
              <span className={`status-badge ${value}`}>{finalDisplayValue}</span>
            ) : (
              <span>{finalDisplayValue}</span>
            )}
          </div>
        );
      }
  };

  const STATO_OPTIONS = [
    { value: 'presente', label: 'Presente' },
    { value: 'venduto', label: 'Venduto' },
    { value: 'deceduto', label: 'Deceduto' },
    { value: 'trasferito', label: 'Trasferito' },
    { value: 'macellato', label: 'Macellato' },
  ];

  const SESSO_OPTIONS = [
    { value: 'M', label: 'Maschio' },
    { value: 'F', label: 'Femmina' },
  ];

  const TIPO_ALLEVAMENTO_OPTIONS = [
    { value: 'svezzamento', label: 'Svezzamento' },
    { value: 'ingrasso', label: 'Ingrasso' },
    { value: 'universale', label: 'Universale' },
  ];

  const ORIGINE_DATI_OPTIONS = [
    { value: 'manuale', label: 'Manuale' },
    { value: 'anagrafe', label: 'Anagrafe' },
    { value: 'misto', label: 'Misto' },
  ];

  const contractSelectValue =
    pendingContrattoId !== undefined
      ? pendingContrattoId
      : currentContrattoId
      ? String(currentContrattoId)
      : '';

  const contractOptions = useMemo(() => {
    const options = [{ value: '', label: 'Nessun contratto (proprietà)' }];
    const seen = new Set();

    contrattiSoccida.forEach((contratto) => {
      options.push({
        value: String(contratto.id),
        label: `${contratto.numero_contratto || `#${contratto.id}`} · ${resolveContrattoLabel(contratto)}`,
      });
      seen.add(contratto.id);
    });

    if (currentContrattoId && !seen.has(Number(currentContrattoId)) && contrattoDetail) {
      options.push({
        value: String(contrattoDetail.id),
        label: `${contrattoDetail.numero_contratto || `#${contrattoDetail.id}`} · ${resolveContrattoLabel(
          contrattoDetail,
        )}`,
      });
    }

    return options;
  }, [contrattiSoccida, currentContrattoId, contrattoDetail, resolveContrattoLabel]);

  const currentContractStr = currentContrattoId != null ? String(currentContrattoId) : '';
  const hasPendingContractChange =
    pendingContrattoId !== undefined &&
    String(contractSelectValue || '') !== String(currentContractStr || '');

  const contractEditorVisible = isEditing || contractEditorOpen;
  const hasContrattoAssociato = !!currentContrattoId;

  if (!animale) {
    return null;
  }

  // Ottieni lo stato corrente
  const sourceData = animaleDetail || animale;
  const currentStato = sourceData.stato || 'presente';
  const statoOption = STATO_OPTIONS.find(opt => opt.value === currentStato);
  const statoLabel = statoOption ? statoOption.label : currentStato;

  return (
    <>
      <BaseModal
        isOpen={true}
        onClose={onClose}
        title={`Scheda Animale - ${animale.auricolare}`}
        size="xlarge"
        headerLeft={
          <span className={`status-badge ${currentStato}`}>{statoLabel}</span>
        }
        headerActions={
          !isEditing && !editingValoreDecesso && !editingResponsabileDecesso ? (
            <button className="btn btn-primary" onClick={handleEdit}>
              Modifica Dati
            </button>
          ) : null
        }
        footerActions={
          <>
            {!isEditing && !editingValoreDecesso && !editingResponsabileDecesso ? (
              <button className="btn btn-secondary" onClick={onClose}>
                Chiudi
              </button>
            ) : (
              <>
                <button className="btn btn-secondary" onClick={handleCancel} disabled={saving || savingValoreDecesso || savingResponsabileDecesso}>
                  Annulla
                </button>
                {isEditing && (
                  <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                    {saving ? 'Salvataggio...' : 'Salva'}
                  </button>
                )}
                {editingValoreDecesso && (
                  <button className="btn btn-primary" onClick={handleSaveValoreDecesso} disabled={savingValoreDecesso}>
                    {savingValoreDecesso ? 'Salvataggio...' : 'Salva'}
                  </button>
                )}
                {editingResponsabileDecesso && (
                  <button className="btn btn-primary" onClick={handleSaveResponsabileDecesso} disabled={savingResponsabileDecesso}>
                    {savingResponsabileDecesso ? 'Salvataggio...' : 'Salva'}
                  </button>
                )}
              </>
            )}
          </>
        }
      >
        {/* Sezione: Dati Anagrafici */}
        <div className="form-section">
          <h3 className="section-title">Dati Anagrafici</h3>
          <div className="form-grid">
            <div className="form-group span-4">
              <label>Auricolare</label>
              <span className="font-weight-bold">{animale.auricolare}</span>
            </div>
            {renderField('Specie', 'specie', 'text', null, 'span-4')}
            {renderField('Razza', 'razza', 'text', null, 'span-4')}
            {renderField('Sesso', 'sesso', 'select', SESSO_OPTIONS, 'span-4')}
            {renderField('Data nascita', 'data_nascita', 'date', null, 'span-4')}
            {renderField('Codice elettronico', 'codice_elettronico', 'text', null, 'span-4')}
            {renderField('Codice madre', 'codice_madre', 'text', null, 'span-4')}
            {renderField('Codice assegnato precedenza', 'codice_assegnato_precedenza', 'text', null, 'span-4')}
          </div>
        </div>

        {/* Sezione: Provenienza */}
        <div className="form-section" style={{ position: 'relative' }}>
          <h3 className="section-title">Provenienza Anagrafe</h3>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
            <div className="form-grid" style={{ flex: 1 }}>
              {(() => {
                // Determina l'allevamento di provenienza originale
                // Il vero luogo di origine è il codice_stalla della PRIMA partita di ingresso
                // (anche se è un trasferimento interno, perché quella è la vera origine)
                const sourceData = animaleDetail || animale;
                let allevamentoProvenienza = null;
                
                // Priorità 1: Prima partita di ingresso (vera origine)
                if (allPartiteIngresso.length > 0) {
                  const primaPartita = allPartiteIngresso[0];
                  allevamentoProvenienza = primaPartita.codice_stalla;
                }
                
                // Priorità 2: Partita ingresso esterno (se non ci sono partite caricate)
                if (!allevamentoProvenienza && animaleDetail?.partita_ingresso_esterno?.codice_stalla) {
                  allevamentoProvenienza = animaleDetail.partita_ingresso_esterno.codice_stalla;
                }
                
                // Priorità 3: Codice azienda anagrafe (solo se non ci sono partite)
                // NON usiamo codice_provenienza perché può essere errato nel DB
                if (!allevamentoProvenienza && sourceData?.codice_azienda_anagrafe) {
                  allevamentoProvenienza = sourceData.codice_azienda_anagrafe;
                }

                return (
                  <>
                    {renderField('Codice azienda anagrafe', 'codice_azienda_anagrafe', 'text', null, 'span-6')}
                    {(() => {
                      // Mostra il codice provenienza calcolato dalla prima partita invece del valore nel DB
                      const codiceProvenienzaCalcolato = allPartiteIngresso.length > 0 
                        ? allPartiteIngresso[0].codice_stalla 
                        : (sourceData?.codice_provenienza || null);
                      
                      return (
                        <div className="form-group span-6">
                          <label>Codice provenienza</label>
                          {isEditing ? (
                            <input
                              type="text"
                              value={formData.codice_provenienza || ''}
                              onChange={(e) => handleFieldChange('codice_provenienza', e.target.value)}
                              placeholder="Codice provenienza"
                            />
                          ) : (
                            <span>{codiceProvenienzaCalcolato || '-'}</span>
                          )}
                        </div>
                      );
                    })()}
                    {renderField('Identificativo fiscale provenienza', 'identificativo_fiscale_provenienza', 'text', null, 'span-6')}
                    {renderField('Specie allevata provenienza', 'specie_allevata_provenienza', 'text', null, 'span-6')}
                  </>
                );
              })()}
            </div>

            {/* Postilla trasferimenti interni - stile post-it */}
            {(() => {
              const hasTrasferimenti = partiteAnimale.length > 0;
              if (!hasTrasferimenti && !loadingPartite) return null;

              return (
                <div className="provenienza-postit">
                  <div className="postit-header">
                    <strong>Trasferimenti Interni</strong>
                  </div>
                  {loadingPartite ? (
                    <div className="postit-content">
                      <span className="color-muted font-size-small">Caricamento...</span>
                    </div>
                  ) : partiteAnimale.length > 0 ? (
                    <div className="postit-content">
                      {partiteAnimale.map((partita, idx) => (
                        <div key={partita.partita_id || idx} className="postit-transfer-item">
                          <div className="postit-transfer-date">
                            {formatDate(partita.data)}
                          </div>
                          <div className="postit-transfer-details">
                            da <strong>{partita.codice_stalla}</strong>
                            {partita.codice_stalla_azienda && (
                              <> → a <strong>{partita.codice_stalla_azienda}</strong></>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="postit-content">
                      <span className="color-muted font-size-small">Nessun trasferimento interno</span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Post-it Uscita/Decesso - Solo per animali non più in allevamento */}
            {(() => {
              const sourceData = animaleDetail || animale;
              const stato = sourceData?.stato;
              const statiUscita = ['deceduto', 'venduto', 'trasferito', 'macellato'];
              
              // Mostra solo se l'animale è uscito
              if (!statiUscita.includes(stato)) return null;
              
              const dataUscita = sourceData?.data_uscita;
              const motivoUscita = sourceData?.motivo_uscita;
              const numeroModelloUscita = sourceData?.numero_modello_uscita;
              
              // Determina destinazione/informazioni in base allo stato
              let destinazioneInfo = null;
              let postitColorClass = 'red'; // Default rosso per decessi
              
              if (stato === 'deceduto') {
                // Per decessi: mostra numero certificato/documento
                if (animaleDetail?.decesso?.gruppo_decessi?.numero_certificato_smaltimento) {
                  destinazioneInfo = `Cert. Smaltimento: ${animaleDetail.decesso.gruppo_decessi.numero_certificato_smaltimento}`;
                } else if (numeroModelloUscita) {
                  destinazioneInfo = `N. Documento: ${numeroModelloUscita}`;
                }
                postitColorClass = 'red';
              } else if (stato === 'macellato') {
                // Per macellati: mostra macello
                if (sourceData?.regione_macello_destinazione || sourceData?.codice_macello_destinazione) {
                  const regione = sourceData.regione_macello_destinazione || '';
                  const codice = sourceData.codice_macello_destinazione || '';
                  destinazioneInfo = `Macello: ${regione}${regione && codice ? ' - ' : ''}${codice}`.trim();
                } else if (partitaUscita?.codice_stalla) {
                  destinazioneInfo = `Destinazione: ${partitaUscita.codice_stalla}`;
                } else if (sourceData?.codice_azienda_destinazione) {
                  destinazioneInfo = `Destinazione: ${sourceData.codice_azienda_destinazione}`;
                }
                postitColorClass = 'orange';
              } else if (stato === 'venduto' || stato === 'trasferito') {
                // Per venduti/trasferiti: mostra destinazione
                if (sourceData?.codice_azienda_destinazione) {
                  destinazioneInfo = `Azienda: ${sourceData.codice_azienda_destinazione}`;
                } else if (sourceData?.codice_fiera_destinazione) {
                  destinazioneInfo = `Fiera: ${sourceData.codice_fiera_destinazione}`;
                } else if (sourceData?.codice_stato_destinazione) {
                  destinazioneInfo = `Stato: ${sourceData.codice_stato_destinazione}`;
                } else if (partitaUscita?.codice_stalla) {
                  destinazioneInfo = `Destinazione: ${partitaUscita.codice_stalla}`;
                }
                postitColorClass = 'blue';
              }
              
              // Costruisci il titolo in base allo stato
              let titoloPostit = '';
              if (stato === 'deceduto') {
                titoloPostit = 'Decesso';
              } else if (stato === 'macellato') {
                titoloPostit = 'Macellazione';
              } else if (stato === 'venduto') {
                titoloPostit = 'Vendita';
              } else if (stato === 'trasferito') {
                titoloPostit = 'Trasferimento';
              }
              
              return (
                <div className={`provenienza-postit ${postitColorClass}`} style={{ marginTop: '16px' }}>
                  <div className="postit-header">
                    <strong>{titoloPostit}</strong>
                  </div>
                  <div className="postit-content">
                    <div className="postit-transfer-item">
                      {dataUscita && (
                        <div className="postit-transfer-date">
                          {formatDate(dataUscita)}
                        </div>
                      )}
                      {destinazioneInfo && (
                        <div className="postit-transfer-details">
                          {destinazioneInfo}
                        </div>
                      )}
                      {numeroModelloUscita && stato !== 'deceduto' && (
                        <div className="postit-transfer-details" style={{ fontSize: '11px', marginTop: '4px', color: '#666' }}>
                          Modello: {numeroModelloUscita}
                        </div>
                      )}
                      {motivoUscita && (
                        <div className="postit-transfer-details" style={{ fontSize: '11px', marginTop: '4px', color: '#666' }}>
                          Motivo: {motivoUscita}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Sezione: Ingresso */}
        <div className="form-section">
          <h3 className="section-title">Dati Ingresso</h3>
          <div className="form-grid">
            {renderField('Data arrivo', 'data_arrivo', 'date', null, 'span-4')}
            <div className="form-group span-4">
              <label>Peso ingresso</label>
              <span className="font-weight-bold">
                {animaleDetail?.peso_arrivo || animale?.peso_arrivo || '—'} kg
              </span>
            </div>
            {renderField('Motivo ingresso', 'motivo_ingresso', 'text', null, 'span-4')}
            {renderField('Numero modello ingresso', 'numero_modello_ingresso', 'text', null, 'span-4')}
            {renderField('Data modello ingresso', 'data_modello_ingresso', 'date', null, 'span-4')}
            {!hasContrattoAssociato && renderField('Tipo allevamento', 'tipo_allevamento', 'select', TIPO_ALLEVAMENTO_OPTIONS, 'span-4')}
            {renderField('Valore animale (€)', 'valore', 'number', null, 'span-4')}
          </div>

          {/* Partita ingresso */}
          {animaleDetail?.partita_ingresso_esterno && (
            <div className="form-grid" style={{ marginTop: '12px' }}>
              <div className="form-group span-4">
                <label>Partita ingresso</label>
                <span className="partita-number">
                  {animaleDetail.partita_ingresso_esterno.numero_partita || `#${animaleDetail.partita_ingresso_esterno.id}`}
                </span>
              </div>
              {animaleDetail.partita_ingresso_esterno.valore_totale && (
                <div className="form-group span-4">
                  <label>Valore totale partita</label>
                  <span className="font-weight-bold">
                    €{parseFloat(animaleDetail.partita_ingresso_esterno.valore_totale).toFixed(2)}
                  </span>
                </div>
              )}
              {animaleDetail.partita_ingresso_esterno.fattura_numero && (
                <div className="form-group span-4">
                  <label>Fattura</label>
                  <span className="color-success font-weight-bold">
                    {animaleDetail.partita_ingresso_esterno.fattura_numero}
                    {animaleDetail.partita_ingresso_esterno.fattura_data && (
                      <span className="font-size-small color-muted">
                        {' '}({formatDate(animaleDetail.partita_ingresso_esterno.fattura_data.split('T')[0])})
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sezione: Contratto di Soccida */}
        <div className="form-section">
          <h3 className="section-title">Contratto di Soccida</h3>
          <div className="form-grid">
            <div className="form-group span-12">
              {loadingContrattoDetail ? (
                <span className="color-muted">Caricamento...</span>
              ) : contractEditorVisible ? (
                <div className="value-editor">
                  <SimpleSelect
                    className="select-compact"
                    options={contractOptions}
                    value={contractSelectValue}
                    onChange={(e) => setPendingContrattoId(e.target.value)}
                    displayField="label"
                    valueField="value"
                    placeholder="Seleziona contratto..."
                    disabled={savingContratto || loadingContratti}
                    allowEmpty={true}
                  />
                  {loadingContratti && (
                    <span className="contract-note">Caricamento contratti disponibili...</span>
                  )}
                  {!isEditing && (
                    <div className="value-editor-actions">
                      <button
                        className="btn btn-primary btn-small"
                        onClick={handleStandaloneContractSave}
                        disabled={!hasPendingContractChange || savingContratto || loadingContratti}
                      >
                        {savingContratto ? 'Salvataggio...' : 'Salva'}
                      </button>
                      <button
                        className="btn btn-secondary btn-small"
                        onClick={handleCancelContractEditor}
                        disabled={savingContratto}
                      >
                        Annulla
                      </button>
                    </div>
                  )}
                  {!isEditing && !contrattiSoccida.length && !loadingContratti && (
                    <div className="contract-warning">
                      Nessun contratto attivo disponibile per l'azienda.
                    </div>
                  )}
                </div>
              ) : contrattoDetail ? (
                <div className="contract-display">
                  <div className="contract-display-header">
                    <div className="contract-display-title">
                      <span className="font-weight-bold">
                        {contrattoDetail.numero_contratto || `#${contrattoDetail.id}`}
                        {contrattoDetail.tipologia && ` · ${contrattoDetail.tipologia}`}
                      </span>
                      <span className={`contract-status-badge ${contrattoDetail.attivo ? 'attivo' : 'chiuso'}`}>
                        {contrattoDetail.attivo ? 'Attivo' : 'Chiuso'}
                      </span>
                    </div>
                    {!isEditing && (
                      <div className="contract-display-actions">
                        <button
                          className="btn-edit-value"
                          onClick={handleOpenContractEditor}
                          disabled={loadingContratti || savingContratto}
                          title="Cambia contratto"
                        >
                          ✏️
                        </button>
                        <button
                          className="btn-edit-value btn-delete"
                          onClick={handleRemoveContratto}
                          disabled={savingContratto}
                          title="Rimuovi contratto"
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="contract-display-details">
                    <div className="contract-detail-item">
                      <strong>Soccidante:</strong> {effectiveSoccidanteName}
                    </div>
                    {contrattoDetail.tipo_allevamento && (
                      <div className="contract-detail-item">
                        <strong>Tipo:</strong> {contrattoDetail.tipo_allevamento}
                      </div>
                    )}
                    {contrattoDetail.modalita_remunerazione && (
                      <div className="contract-detail-item">
                        <strong>Remunerazione:</strong> {contrattoDetail.modalita_remunerazione}
                      </div>
                    )}
                    {contrattoDetail.prezzo_allevamento !== null &&
                      contrattoDetail.prezzo_allevamento !== undefined &&
                      !Number.isNaN(parseFloat(contrattoDetail.prezzo_allevamento)) && (
                        <div className="contract-detail-item">
                          <strong>Prezzo:</strong> €{parseFloat(contrattoDetail.prezzo_allevamento).toFixed(2)}
                        </div>
                      )}
                  </div>
                </div>
              ) : (
                <div className="value-with-action">
                  <span className="color-muted">Nessun contratto associato (in proprietà)</span>
                  {!isEditing && (
                    <button
                      className="btn-edit-value"
                      onClick={handleOpenContractEditor}
                      disabled={loadingContratti || savingContratto}
                      title="Associa contratto"
                    >
                      ✏️
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Sezione: Dati Attuali - Solo per animali presenti */}
        {animale.stato === 'presente' && (
          <div className="form-section">
            <h3 className="section-title">Dati Attuali</h3>
            <div className="form-grid">
              {renderField('Peso attuale', 'peso_attuale', 'number', null, 'span-4')}
              {renderField('Data ultima pesata', 'data_ultima_pesata', 'date', null, 'span-4')}
              <div className="form-group span-4">
                <label>Box attuale</label>
                <span>{animale.box_id ? `Box ID: ${animale.box_id}` : 'Nessun box assegnato'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Sezione: Storico Tipo Allevamento */}
        {animaleDetail?.storico_tipo_allevamento && animaleDetail.storico_tipo_allevamento.length > 0 && (
          <div className="form-section">
            <h3 className="section-title">Storico Tipo Allevamento</h3>
            <div className="form-grid">
              {animaleDetail.storico_tipo_allevamento.map((storico, index) => (
                <div key={storico.id} className="form-group span-6 storico-item">
                  <div className="storico-header">
                    <div>
                      <strong>Cambio #{index + 1}</strong>
                      {storico.annullato && (
                        <span className="color-danger font-size-small" style={{ marginLeft: '8px' }}>(Annullato)</span>
                      )}
                    </div>
                    <div className="font-size-small color-muted">
                      {formatDate(storico.data_cambio)}
                    </div>
                  </div>
                  <div className="storico-body">
                    <div><strong>Da:</strong> {storico.tipo_allevamento_precedente || 'Nessuno'} → <strong>A:</strong> {storico.tipo_allevamento_nuovo}</div>
                    {storico.peso_ingresso && (
                      <div className="storico-detail">
                        <strong>Peso ingresso:</strong> {storico.peso_ingresso} kg
                      </div>
                    )}
                    {storico.note && (
                      <div className="storico-note">{storico.note}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sezione: Decesso - Solo per animali deceduti */}
        {animale.stato === 'deceduto' && animaleDetail?.decesso && (
          <div className="form-section">
            <h3 className="section-title">Informazioni Decesso</h3>
            <div className="form-grid">
              <div className="form-group span-4">
                <label>Data decesso</label>
                <span>{formatDate(animaleDetail.decesso.data_ora)}</span>
              </div>
              {animaleDetail.decesso.causa && (
                <div className="form-group span-4">
                  <label>Causa</label>
                  <span>{animaleDetail.decesso.causa}</span>
                </div>
              )}
              <div className="form-group span-4">
                <label>Valore economico capo</label>
                {animaleDetail.partita_ingresso_esterno?.valore_da_fattura !== undefined ? (
                  <div>
                    <span className="color-success font-weight-bold">
                      €{animaleDetail.decesso.valore_capo ? parseFloat(animaleDetail.decesso.valore_capo).toFixed(2) : 'Non impostato'}
                    </span>
                    <span className="font-size-small color-muted" style={{ display: 'block', marginTop: '4px' }}>
                      (da fattura)
                    </span>
                  </div>
                ) : editingValoreDecesso ? (
                  <div className="value-editor">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={valoreDecesso}
                      onChange={(e) => setValoreDecesso(e.target.value)}
                      className="form-input-small"
                      placeholder="€"
                    />
                    <div className="value-editor-actions">
                      <button className="btn btn-primary btn-small" onClick={handleSaveValoreDecesso} disabled={savingValoreDecesso}>
                        {savingValoreDecesso ? 'Salvataggio...' : 'Salva'}
                      </button>
                      <button
                        className="btn btn-secondary btn-small"
                        onClick={() => { setEditingValoreDecesso(false); setValoreDecesso(animaleDetail.decesso.valore_capo || ''); }}
                        disabled={savingValoreDecesso}
                      >
                        Annulla
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="value-with-action">
                    <span>{animaleDetail.decesso.valore_capo ? `€${parseFloat(animaleDetail.decesso.valore_capo).toFixed(2)}` : 'Non impostato'}</span>
                    {!isEditing && (
                      <button className="btn-edit-value" onClick={() => setEditingValoreDecesso(true)} title="Modifica valore">✏️</button>
                    )}
                  </div>
                )}
              </div>
              
              {/* Responsabile decesso - Solo se c'è un contratto di soccida */}
              {hasContrattoAssociato && (
                <div className="form-group span-4">
                  <label>Capo a carico di</label>
                  {editingResponsabileDecesso ? (
                    <div className="value-editor">
                      <SimpleSelect
                        className="select-compact select-small"
                        options={[
                          { value: 'soccidante', label: 'Soccidante' },
                          { value: 'soccidario', label: 'Soccidario' }
                        ]}
                        value={responsabileDecesso}
                        onChange={(e) => setResponsabileDecesso(e.target.value)}
                        displayField="label"
                        valueField="value"
                      />
                      <div className="value-editor-actions">
                        <button className="btn btn-primary btn-small" onClick={handleSaveResponsabileDecesso} disabled={savingResponsabileDecesso}>
                          {savingResponsabileDecesso ? 'Salvataggio...' : 'Salva'}
                        </button>
                        <button
                          className="btn btn-secondary btn-small"
                          onClick={() => { setEditingResponsabileDecesso(false); setResponsabileDecesso(animaleDetail.decesso.responsabile || 'soccidario'); }}
                          disabled={savingResponsabileDecesso}
                        >
                          Annulla
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="value-with-action">
                      <span className="font-weight-bold">{responsabileDecesso === 'soccidante' ? 'Soccidante' : 'Soccidario'}</span>
                      {!isEditing && (
                        <button className="btn-edit-value" onClick={() => setEditingResponsabileDecesso(true)} title="Modifica responsabile">✏️</button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {animaleDetail.decesso.note && (
                <div className="form-group span-8">
                  <label>Note</label>
                  <span>{animaleDetail.decesso.note}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sezione: Uscita - Solo per animali usciti (venduto, trasferito, macellato) */}
        {['venduto', 'trasferito', 'macellato'].includes(animale.stato) && (
          <div className="form-section">
            <h3 className="section-title">Dati Uscita</h3>
            <div className="form-grid">
              {renderField('Motivo uscita', 'motivo_uscita', 'text', null, 'span-4')}
              {renderField('Data uscita', 'data_uscita', 'date', null, 'span-4')}
              {renderField('Numero modello uscita', 'numero_modello_uscita', 'text', null, 'span-4')}
              {renderField('Data modello uscita', 'data_modello_uscita', 'date', null, 'span-4')}
              {renderField('Codice azienda destinazione', 'codice_azienda_destinazione', 'text', null, 'span-4')}
              {renderField('Codice fiera destinazione', 'codice_fiera_destinazione', 'text', null, 'span-4')}
              {renderField('Codice stato destinazione', 'codice_stato_destinazione', 'text', null, 'span-4')}
              {renderField('Regione macello destinazione', 'regione_macello_destinazione', 'text', null, 'span-4')}
              {renderField('Codice macello destinazione', 'codice_macello_destinazione', 'text', null, 'span-4')}
              {renderField('Codice pascolo destinazione', 'codice_pascolo_destinazione', 'text', null, 'span-4')}
              {renderField('Codice circo destinazione', 'codice_circo_destinazione', 'text', null, 'span-4')}
            </div>

            {animale.stato === 'macellato' && (
              <div className="form-grid" style={{ marginTop: '12px' }}>
                {renderField('Data macellazione', 'data_macellazione', 'date', null, 'span-4')}
                {renderField('Abbattimento', 'abbattimento', 'text', null, 'span-4')}
                {renderField('Data provvedimento', 'data_provvvedimento', 'date', null, 'span-4')}
              </div>
            )}
          </div>
        )}

        {/* Sezione: Dati Sistema */}
        <div className="form-section">
          <h3 className="section-title">Dati Sistema</h3>
          <div className="form-grid">
            {renderField('Stato', 'stato', 'select', STATO_OPTIONS, 'span-4')}
            {renderField('Origine dati', 'origine_dati', 'select', ORIGINE_DATI_OPTIONS, 'span-4')}
          </div>
        </div>

        {/* Sezione: Spostamento */}
        <div className="form-section">
          <h3 className="section-title">Posizione e Spostamento</h3>
          <div className="move-section">
            {animale.stato !== 'presente' && (
              <div className="alert alert-warning">
                <p>
                  Lo spostamento è disponibile solo per animali con stato "presente". 
                  Stato attuale: <strong>{animale.stato}</strong>
                </p>
              </div>
            )}
            
            {animale.box_id && (
              <div className="current-position position-info">
                <div className="position-header">Posizione Attuale</div>
                {loadingPosition ? (
                  <p className="position-loading">Caricamento...</p>
                ) : currentPosition ? (
                  <div className="position-details">
                    {currentPosition.sede && <p><strong>Sede:</strong> {currentPosition.sede}</p>}
                    <p><strong>Stabilimento:</strong> {currentPosition.stabilimento}</p>
                    <p><strong>Box:</strong> {currentPosition.box}</p>
                  </div>
                ) : (
                  <p className="position-error">Errore nel caricamento della posizione</p>
                )}
              </div>
            )}

            {animale.stato === 'presente' && (
              <>
                {!animale.box_id && (
                  <div className="current-position position-warning">
                    <p><strong>Posizione attuale:</strong> Nessun box assegnato</p>
                    {currentSedeName && (
                      <p className="position-note">Stabilimenti filtrati sulla sede <strong>{currentSedeName}</strong></p>
                    )}
                  </div>
                )}

                <div className="move-controls">
                  {currentSedeId && (
                    <div className="move-info">
                      Mostro solo gli stabilimenti della sede <strong>{currentSedeName || `ID ${currentSedeId}`}</strong>
                    </div>
                  )}
                  <div className="move-filter-group">
                    <label>Stabilimento</label>
                    <SimpleSelect
                      className="select-compact"
                      options={stabilimentoOptions}
                      value={selectedStabilimento}
                      onChange={(e) => {
                        setSelectedStabilimento(e.target.value);
                        setSelectedBox('');
                        if (e.target.value) {
                          loadBoxes(e.target.value);
                        } else {
                          setBoxes([]);
                        }
                      }}
                      displayField="label"
                      valueField="value"
                      placeholder="Seleziona stabilimento..."
                      disabled={filteredStabilimenti.length === 0}
                    />
                  </div>

                  <div className="move-filter-group">
                    <label>Box</label>
                    <SimpleSelect
                      className="select-compact"
                      options={boxOptions}
                      value={selectedBox}
                      onChange={(e) => setSelectedBox(e.target.value)}
                      displayField="label"
                      valueField="value"
                      placeholder="Seleziona box..."
                      disabled={!selectedStabilimento}
                    />
                  </div>

                  <button className="btn btn-primary btn-move" onClick={handleMoveAnimal} disabled={!selectedBox || loading}>
                    {loading ? 'Spostamento...' : 'Sposta'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </BaseModal>

      {/* Modal per richiedere peso quando si cambia contratto */}
      <BaseModal
        isOpen={pesoModalOpen}
        onClose={handleCancelPesoModal}
        title="Cambio Gestione - Peso di Riferimento"
        size="small"
        footerActions={
          <>
            <button type="button" className="btn btn-secondary" onClick={handleCancelPesoModal} disabled={savingContratto}>
              Annulla
            </button>
            <button type="button" className="btn btn-primary" onClick={handleConfirmPesoModal} disabled={savingContratto}>
              {savingContratto ? 'Salvataggio...' : 'Conferma'}
            </button>
          </>
        }
      >
        <p className="modal-description">
          Inserisci il peso di riferimento per l'inizio del nuovo conteggio. Questo peso verrà registrato nel log degli eventi.
        </p>
        <div className="form-grid">
            <div className="form-group span-6">
            <label>Peso (kg)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={pesoModalData.peso}
              onChange={(e) => setPesoModalData({ ...pesoModalData, peso: e.target.value })}
              placeholder="Es: 350.50"
              autoFocus
            />
          </div>
          <div className="form-group span-6">
            <label>Data cambio</label>
            <input
              type="date"
              value={pesoModalData.data_cambio}
              onChange={(e) => setPesoModalData({ ...pesoModalData, data_cambio: e.target.value })}
            />
          </div>
          <div className="form-group span-12">
            <label>Note (opzionale)</label>
            <textarea
              value={pesoModalData.note}
              onChange={(e) => setPesoModalData({ ...pesoModalData, note: e.target.value })}
              rows="2"
              placeholder="Note aggiuntive per il log..."
            />
          </div>
        </div>
      </BaseModal>

    </>
  );
};

export default AnimaleDetail;