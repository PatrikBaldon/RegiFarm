/**
 * PartiteAnagrafeModal - Modale professionale per gestire partite identificate dall'anagrafe
 * Permette di inserire peso e confermare partite una ad una
 */
import React, { useState, useEffect } from 'react';
import SmartSelect from '../../../components/SmartSelect';
import BaseModal from '../../../components/BaseModal';
import { amministrazioneService } from '../services/amministrazioneService';
import './PartiteAnagrafeModal.css';

const MODALITA_GESTIONE_OPTIONS = [
  { value: 'proprieta', label: 'Proprietà' },
  { value: 'soccida_monetizzata', label: 'Soccida monetizzata' },
  { value: 'soccida_fatturata', label: 'Soccida fatturata' },
];

const MODALITA_GESTIONE_LABELS = MODALITA_GESTIONE_OPTIONS.reduce(
  (acc, option) => ({ ...acc, [option.value]: option.label }),
  {}
);

// Chiave localStorage per ricordare l'ultima modalità gestione
const STORAGE_KEY_ULTIMA_MODALITA_GESTIONE = 'regifarm_ultima_modalita_gestione';

// Funzioni helper per salvare/caricare l'ultima modalità gestione
const salvaUltimaModalitaGestione = (modalita) => {
  try {
    if (modalita && ['proprieta', 'soccida_monetizzata', 'soccida_fatturata'].includes(modalita)) {
      localStorage.setItem(STORAGE_KEY_ULTIMA_MODALITA_GESTIONE, modalita);
    }
  } catch (error) {

  }
};

const caricaUltimaModalitaGestione = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_ULTIMA_MODALITA_GESTIONE);
    if (saved && ['proprieta', 'soccida_monetizzata', 'soccida_fatturata'].includes(saved)) {
      return saved;
    }
  } catch (error) {

  }
  return ''; // Vuoto se non c'è valore salvato
};

const PartiteAnagrafeModal = ({ isOpen, onClose, partite, aziendaId, onConfirm }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [allPartite, setAllPartite] = useState([]);
  const [currentPartita, setCurrentPartita] = useState(null);
  const [pesoTotale, setPesoTotale] = useState('');
  const [isTrasferimentoInterno, setIsTrasferimentoInterno] = useState(false);
  const [pesoPerCapo, setPesoPerCapo] = useState(0);
  // Gestione economica eliminata dalla modale di creazione partite (default lato backend: 'proprieta')
  const [costoUnitario, setCostoUnitario] = useState('');
  const [valoreTotale, setValoreTotale] = useState('');
  // Aggiornamento a cascata sugli animali
  const [aggiornaPesoCapi, setAggiornaPesoCapi] = useState(true);
  const [animaliDatiConPeso, setAnimaliDatiConPeso] = useState(null);
  const [pesiIndividuali, setPesiIndividuali] = useState(null); // [{ auricolare, peso }]
  // Campi per gruppi decessi
  const [numeroCertificatoSmaltimento, setNumeroCertificatoSmaltimento] = useState('');
  const [fatturaSmaltimentoId, setFatturaSmaltimentoId] = useState('');
  const [valoreEconomicoTotale, setValoreEconomicoTotale] = useState('');
  // Stato per gestire a_carico per ogni capo (array di oggetti { auricolare, a_carico, valore_capo, note })
  const [capiDecesso, setCapiDecesso] = useState([]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmedCount, setConfirmedCount] = useState(0);

  useEffect(() => {
    if (isOpen && partite) {
      // Unisci partite ingresso, uscita e gruppi decessi in un array unico
      const tuttePartite = [
        ...(partite.ingresso || []).map(p => ({ ...p, tipo: 'ingresso', tipo_oggetto: 'partita' })),
        ...(partite.uscita || []).map(p => ({ ...p, tipo: 'uscita', tipo_oggetto: 'partita' })),
        ...(partite.gruppi_decessi || partite.decessi || []).map(d => ({ 
          ...d, 
          tipo: 'decesso', 
          tipo_oggetto: 'gruppo_decessi',
          // Mantieni compatibilità con vecchio formato
          data_decesso: d.data_uscita || d.data_decesso
        }))
      ];
      
      // Ordina per data in ordine crescente (meno recente → più recente)
      tuttePartite.sort((a, b) => {
        // Per le partite usa 'data', per i gruppi decessi usa 'data_uscita' o 'data_decesso'
        const dataA = a.tipo_oggetto === 'partita' ? a.data : (a.data_uscita || a.data_decesso);
        const dataB = b.tipo_oggetto === 'partita' ? b.data : (b.data_uscita || b.data_decesso);
        
        // Converte le date in oggetti Date per il confronto
        const dateA = dataA ? new Date(dataA) : new Date(0); // Se manca data, usa epoch
        const dateB = dataB ? new Date(dataB) : new Date(0);
        
        // Ordinamento crescente (più vecchia → più recente)
        return dateA.getTime() - dateB.getTime();
      });
      
      setAllPartite(tuttePartite);
      setCurrentIndex(0);
      setConfirmedCount(0);
      if (tuttePartite.length > 0) {
        loadPartita(tuttePartite[0]);
      }
    }
  }, [isOpen, partite]);

  const loadPartita = (partita) => {
    setCurrentPartita(partita);
    // reset override animali
    setAnimaliDatiConPeso(null);
    setPesiIndividuali(null);
    setCapiDecesso([]);
    if (partita.tipo_oggetto === 'partita') {
      // is_trasferimento_interno viene determinato dinamicamente dal backend
      // basandosi sui codici stalla gestiti nella tabella sedi (non valori fissi)
      setIsTrasferimentoInterno(partita.is_trasferimento_interno || false);
      setPesoTotale(partita.peso_totale ? String(partita.peso_totale) : '');
      calculatePesoPerCapo(partita.peso_totale || '', partita.numero_capi || 0);
      // Prepara una base per animali_dati con eventuali campi esistenti
      if (partita.codici_capi && partita.codici_capi.length > 0) {
        const base = (partita.animali_dati && Array.isArray(partita.animali_dati) && partita.animali_dati.length === partita.codici_capi.length)
          ? partita.animali_dati
          : partita.codici_capi.map((codice) => ({ auricolare: codice }));
        setAnimaliDatiConPeso(base);
      } else if (partita.animali_dati && Array.isArray(partita.animali_dati)) {
        setAnimaliDatiConPeso(partita.animali_dati);
      }
      // Se esiste un dizionario animali_dati (backend format), inizializza pesiIndividuali da lì
      if (partita.animali_dati && !Array.isArray(partita.animali_dati) && typeof partita.animali_dati === 'object') {
        const list = Object.entries(partita.animali_dati).map(([auricolare, dati]) => ({
          auricolare,
          peso: dati && typeof dati === 'object' ? (dati.peso ?? null) : null,
        }));
        setPesiIndividuali(list);
      }
      
      // Gestione economica non gestita in questa modale
      setCostoUnitario(partita.costo_unitario ? String(partita.costo_unitario) : '');
      setValoreTotale(partita.valore_totale ? String(partita.valore_totale) : '');
    } else if (partita.tipo_oggetto === 'gruppo_decessi') {
      setNumeroCertificatoSmaltimento(partita.numero_certificato_smaltimento || '');
      setFatturaSmaltimentoId(partita.fattura_smaltimento_id || '');
      setValoreEconomicoTotale(partita.valore_economico_totale ? String(partita.valore_economico_totale) : '');
      setNote(partita.note || '');
      setCostoUnitario('');
      setValoreTotale('');
      
      // Inizializza capiDecesso con a_carico per ogni capo
      const codiciCapi = partita.codici_capi || [];
      const animaliDati = partita.animali_dati || {};
      const capi = codiciCapi.map((codice) => {
        const dati = animaliDati[codice] || {};
        return {
          auricolare: codice,
          a_carico: dati.a_carico !== undefined ? Boolean(dati.a_carico) : (partita.a_carico !== undefined ? Boolean(partita.a_carico) : true),
          valore_capo: dati.valore_capo !== undefined ? (typeof dati.valore_capo === 'number' ? String(dati.valore_capo) : dati.valore_capo) : '',
          note: dati.note || '',
        };
      });
      setCapiDecesso(capi);
    }
  };

  const calculatePesoPerCapo = (peso, numCapi) => {
    if (peso && numCapi > 0) {
      const pesoValue = parseFloat(peso);
      if (!isNaN(pesoValue)) {
        setPesoPerCapo((pesoValue / numCapi).toFixed(2));
      } else {
        setPesoPerCapo(0);
      }
    } else {
      setPesoPerCapo(0);
    }
  };

  const handlePesoChange = (e) => {
    const value = e.target.value;
    setPesoTotale(value);
    if (currentPartita) {
      calculatePesoPerCapo(value, currentPartita.numero_capi || 0);
      // Aggiorna peso capi a cascata se richiesto
      if (aggiornaPesoCapi) {
        const numCapi = currentPartita.numero_capi || (currentPartita.codici_capi ? currentPartita.codici_capi.length : 0);
        if (numCapi > 0) {
          const v = parseFloat(value);
          if (!isNaN(v) && v > 0) {
            const pesoMedio = v / numCapi;
            const rounded = (x) => Math.round(x * 100) / 100;
            const elenco = animaliDatiConPeso
              ? animaliDatiConPeso
              : (currentPartita.codici_capi || []).map((cod) => ({ auricolare: cod }));
            const aggiornati = elenco.map((a) => ({
              ...a,
              peso: rounded(pesoMedio),
            }));
            setAnimaliDatiConPeso(aggiornati);
            const pesi = aggiornati
              .filter(a => a.auricolare)
              .map(a => ({ auricolare: a.auricolare, peso: a.peso }));
            setPesiIndividuali(pesi);
          }
        }
      }
    }
  };


  const handleNext = () => {
    if (currentIndex < allPartite.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      loadPartita(allPartite[nextIndex]);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      setCurrentIndex(prevIndex);
      loadPartita(allPartite[prevIndex]);
    }
  };

  const handleConfirm = async () => {
    setSaving(true);
    try {
      if (currentPartita.tipo_oggetto === 'partita') {
        // Validazione per partite
        if (!isTrasferimentoInterno && !pesoTotale) {
          alert('Il peso è obbligatorio per trasferimenti esterni');
          setSaving(false);
          return;
        }

        if (!pesoTotale || parseFloat(pesoTotale) <= 0) {
          if (!isTrasferimentoInterno) {
            alert('Inserire un peso valido per trasferimenti esterni');
            setSaving(false);
            return;
          }
        }

        // Converte data in formato stringa se necessario
        let dataValue = currentPartita.data;
        if (dataValue instanceof Date) {
          dataValue = dataValue.toISOString().split('T')[0];
        } else if (typeof dataValue === 'string') {
          dataValue = dataValue.split('T')[0];
        }
        
        // Calcola peso totale - assicurati che sia un numero valido o null
        let pesoTotaleValue = null;
        if (pesoTotale && pesoTotale.trim() !== '') {
          const parsedPeso = parseFloat(pesoTotale);
          if (!isNaN(parsedPeso) && parsedPeso > 0) {
            pesoTotaleValue = parsedPeso;
          }
        }

        const costoUnitarioValue = costoUnitario && costoUnitario.trim() !== ''
          ? parseFloat(costoUnitario)
          : null;
        const valoreTotaleValue = valoreTotale && valoreTotale.trim() !== ''
          ? parseFloat(valoreTotale)
          : null;
        
        // Nessuna gestione economica inviata dalla modale
        
        const partitaData = {
          azienda_id: aziendaId,
          tipo: currentPartita.tipo,
          data: dataValue,
          codice_stalla: currentPartita.codice_stalla,
          codice_stalla_azienda: currentPartita.codice_stalla_azienda || null,  // Codice stalla dell'allevamento dell'utente
          numero_capi: (() => {
            const parsed = parseInt(currentPartita.numero_capi, 10);
            if (!isNaN(parsed) && parsed > 0) return parsed;
            const count = Array.isArray(currentPartita.codici_capi) ? currentPartita.codici_capi.filter(Boolean).length : 0;
            return count;
          })(),
          peso_totale: pesoTotaleValue,
          is_trasferimento_interno: isTrasferimentoInterno,
          codici_capi: Array.isArray(currentPartita.codici_capi)
            ? currentPartita.codici_capi.filter(Boolean).map(String)
            : [],
          motivo: currentPartita.motivo,
          numero_modello: currentPartita.numero_modello,
          file_anagrafe_origine: currentPartita.file_anagrafe_origine,
          // Invia animali_dati solo se è nel formato atteso: dizionario di dizionari con soli valori stringa o date
          animali_dati: (() => {
            const src = currentPartita.animali_dati;
            if (!src || Array.isArray(src) || typeof src !== 'object') return null;
            const cleaned = {};
            Object.entries(src).forEach(([auricolare, dati]) => {
              if (!auricolare) return;
              if (!dati || Array.isArray(dati) || typeof dati !== 'object') return;
              const cleanedInner = {};
              Object.entries(dati).forEach(([k, v]) => {
                if (v instanceof Date) {
                  cleanedInner[k] = v.toISOString().split('T')[0];
                } else if (typeof v === 'string') {
                  cleanedInner[k] = v;
                } else if (v && typeof v === 'object' && 'toDate' in v && typeof v.toDate === 'function') {
                  // Gestione eventuali wrapper date (es. dayjs/moment)
                  const d = v.toDate();
                  if (d instanceof Date && !isNaN(d.getTime())) {
                    cleanedInner[k] = d.toISOString().split('T')[0];
                  }
                }
                // Ignora numeri (es. peso) e altri tipi non string/date per rispettare lo schema backend
              });
              if (Object.keys(cleanedInner).length > 0) {
                cleaned[auricolare] = cleanedInner;
              }
            });
            return Object.keys(cleaned).length > 0 ? cleaned : null;
          })(),
          // Invia la lista pesi individuali nel formato supportato dallo schema
          pesi_individuali: (() => {
            if (!pesiIndividuali || !Array.isArray(pesiIndividuali) || pesiIndividuali.length === 0) return null;
            const valid = pesiIndividuali.filter(
              (p) =>
                p &&
                typeof p.auricolare === 'string' &&
                p.auricolare.trim() !== '' &&
                p.peso !== null &&
                p.peso !== undefined &&
                isFinite(Number(p.peso))
            );
            return valid.length > 0 ? valid : null;
          })(),
          costo_unitario:
            costoUnitarioValue !== null && !Number.isNaN(costoUnitarioValue)
              ? costoUnitarioValue
              : null,
          valore_totale:
            valoreTotaleValue !== null && !Number.isNaN(valoreTotaleValue)
              ? valoreTotaleValue
              : null,
        };

        // Debug mirato per 422: osserva il payload inviato
        //

        // Non includere modalita_gestione nel payload
        const response = await amministrazioneService.confirmPartita(partitaData);
        
        const animaliInfo = response.animali_aggiornati !== undefined 
          ? ` - ${response.animali_aggiornati} animali aggiornati`
          : '';
        
        setConfirmedCount(confirmedCount + 1);
        
        // Rimuovi dalla lista
        const updatedPartite = allPartite.filter((_, idx) => idx !== currentIndex);
        setAllPartite(updatedPartite);
        
        if (updatedPartite.length > 0) {
          if (currentIndex >= updatedPartite.length) {
            setCurrentIndex(updatedPartite.length - 1);
            loadPartita(updatedPartite[updatedPartite.length - 1]);
          } else {
            loadPartita(updatedPartite[currentIndex]);
          }
        } else {
          alert(`Tutti gli elementi sono stati confermati con successo!${animaliInfo}`);
          onConfirm && onConfirm();
          onClose();
        }
      } else if (currentPartita.tipo_oggetto === 'gruppo_decessi') {
        // Validazione per gruppi decessi
        if (!currentPartita.codici_capi || currentPartita.codici_capi.length === 0) {
          alert('Nessun capo presente nel gruppo decessi.');
          setSaving(false);
          return;
        }

        // Converte data in formato stringa se necessario
        let dataUscitaValue = currentPartita.data_uscita || currentPartita.data_decesso;
        if (dataUscitaValue instanceof Date) {
          dataUscitaValue = dataUscitaValue.toISOString().split('T')[0];
        } else if (typeof dataUscitaValue === 'string') {
          dataUscitaValue = dataUscitaValue.split('T')[0];
        }
        
        // Calcola valore economico totale
        let valoreEconomicoValue = null;
        if (valoreEconomicoTotale && valoreEconomicoTotale.trim() !== '') {
          const parsedValore = parseFloat(valoreEconomicoTotale);
          if (!isNaN(parsedValore) && parsedValore >= 0) {
            valoreEconomicoValue = parsedValore;
          }
        }
        
        // Gestisci fattura smaltimento
        let fatturaSmaltimentoValue = null;
        if (fatturaSmaltimentoId && fatturaSmaltimentoId.trim() !== '') {
          const parsedFattura = parseInt(fatturaSmaltimentoId);
          if (!isNaN(parsedFattura) && parsedFattura > 0) {
            fatturaSmaltimentoValue = parsedFattura;
          }
        }
        
        // Costruisci animali_dati con a_carico per ogni capo
        const animaliDatiMap = {};
        capiDecesso.forEach((capo) => {
          if (capo.auricolare && capo.auricolare.trim()) {
            const valore = capo.valore_capo ? parseFloat(capo.valore_capo) : null;
            animaliDatiMap[capo.auricolare.trim()] = {
              valore_capo: !Number.isNaN(valore) ? valore : null,
              note: capo.note || null,
              a_carico: capo.a_carico !== undefined ? Boolean(capo.a_carico) : true,
            };
          }
        });
        
        const gruppoData = {
          azienda_id: currentPartita.azienda_id || aziendaId,
          data_uscita: dataUscitaValue,
          codice_stalla_decesso: currentPartita.codice_stalla_decesso || null,
          numero_certificato_smaltimento: numeroCertificatoSmaltimento || null,
          fattura_smaltimento_id: fatturaSmaltimentoValue,
          valore_economico_totale: valoreEconomicoValue,
          a_carico: true, // Default, ma ogni capo può avere il proprio valore in animali_dati
          note: note || null,
          file_anagrafe_origine: currentPartita.file_anagrafe_origine || null,
          codici_capi: currentPartita.codici_capi || [],
          animali_dati: Object.keys(animaliDatiMap).length > 0 ? animaliDatiMap : null,
        };

        const response = await amministrazioneService.confirmGruppoDecessi(gruppoData);
        
        const animaliInfo = response.animali_aggiornati !== undefined 
          ? ` - ${response.animali_aggiornati} animali aggiornati, ${response.decessi_creati || 0} decessi creati`
          : '';
        
        if (response.animali_non_trovati && response.animali_non_trovati.length > 0) {
          alert(`Gruppo decessi creato con successo!${animaliInfo}\n\nAttenzione: ${response.animali_non_trovati.length} animali non trovati: ${response.animali_non_trovati.join(', ')}`);
        } else {
          alert(`Gruppo decessi creato con successo!${animaliInfo}`);
        }
        
        setConfirmedCount(confirmedCount + 1);
        
        // Rimuovi dalla lista
        const updatedPartite = allPartite.filter((_, idx) => idx !== currentIndex);
        setAllPartite(updatedPartite);
        
        if (updatedPartite.length > 0) {
          if (currentIndex >= updatedPartite.length) {
            setCurrentIndex(updatedPartite.length - 1);
            loadPartita(updatedPartite[updatedPartite.length - 1]);
          } else {
            loadPartita(updatedPartite[currentIndex]);
          }
        } else {
          alert('Tutti gli elementi sono stati confermati con successo!');
          onConfirm && onConfirm();
          onClose();
        }
      }
    } catch (error) {
      console.error('Errore nel salvataggio partita:', error);
      
      let detail = '';
      let errorMessage = 'Errore sconosciuto';
      
      try {
        // Supporta fetch/axios-like
        const data = error?.response?.data || error?.data || null;
        if (data) {
          if (typeof data === 'string') {
            detail = data;
            errorMessage = data;
          } else if (Array.isArray(data)) {
            // Se è un array di errori di validazione
            const messages = data.map(err => {
              if (typeof err === 'string') return err;
              if (err.msg) return err.msg;
              if (err.message) return err.message;
              return JSON.stringify(err);
            }).filter(Boolean);
            errorMessage = messages.length > 0 ? messages.join('\n') : JSON.stringify(data);
            detail = errorMessage;
          } else if (data.detail) {
            if (Array.isArray(data.detail)) {
              // Array di errori di validazione
              const messages = data.detail.map(err => {
                if (typeof err === 'string') return err;
                if (err.msg) return `${err.loc?.join('.') || ''}: ${err.msg}`;
                if (err.message) return err.message;
                return JSON.stringify(err);
              }).filter(Boolean);
              errorMessage = messages.length > 0 ? messages.join('\n') : JSON.stringify(data.detail);
            } else if (typeof data.detail === 'string') {
              errorMessage = data.detail;
            } else {
              errorMessage = JSON.stringify(data.detail);
            }
            detail = errorMessage;
          } else if (data.message) {
            errorMessage = data.message;
            detail = data.message;
          } else {
            errorMessage = JSON.stringify(data);
            detail = errorMessage;
          }
        } else if (error?.message) {
          errorMessage = error.message;
          detail = error.message;
        }
      } catch (parseError) {
        console.error('Errore nel parsing dell\'errore:', parseError);
        errorMessage = 'Errore durante il salvataggio. Controlla i dati inseriti e riprova.';
      }
      
      // Mostra un messaggio più user-friendly
      alert(`Errore nel salvataggio:\n\n${errorMessage}\n\nVerifica che tutti i campi obbligatori siano compilati correttamente.`);
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    // Passa alla partita successiva senza confermare
    if (currentIndex < allPartite.length - 1) {
      handleNext();
    } else if (currentIndex === allPartite.length - 1) {
      // Ultima partita, passa alla prima
      setCurrentIndex(0);
      loadPartita(allPartite[0]);
    }
  };

  if (!isOpen || !currentPartita) {
    return null;
  }

  const operazioniRimanenti = allPartite.length;
  const identifier = `Elemento ${currentIndex + 1} di ${allPartite.length}${confirmedCount > 0 ? ` • ${confirmedCount} confermati` : ''}`;

  const footerActions = (
    <>
      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          className="btn btn-secondary"
          onClick={handlePrevious}
          disabled={currentIndex === 0}
        >
          ← Precedente
        </button>
        <button
          className="btn btn-secondary"
          onClick={handleSkip}
          disabled={allPartite.length <= 1}
        >
          Salta
        </button>
      </div>
      <button
        className="btn btn-primary"
        onClick={handleConfirm}
        disabled={
          saving || 
          (currentPartita?.tipo_oggetto === 'partita' && !isTrasferimentoInterno && !pesoTotale) ||
          (currentPartita?.tipo_oggetto === 'gruppo_decessi' && (!currentPartita?.codici_capi || currentPartita.codici_capi.length === 0))
        }
      >
        {saving ? 'Salvataggio...' : currentPartita?.tipo_oggetto === 'gruppo_decessi' ? 'Conferma Decessi' : 'Conferma Partita'}
      </button>
    </>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Gestione Partite e Decessi Anagrafe"
      identifier={identifier}
      size="large"
      footerActions={footerActions}
      className="partite-anagrafe-modal"
    >
          {currentPartita && currentPartita.tipo_oggetto === 'partita' && (
          <div className="partita-header-badge" style={{ 
            marginBottom: '15px', 
            padding: '10px 14px',
            borderRadius: '6px',
            backgroundColor: isTrasferimentoInterno ? '#fef3c7' : (currentPartita.tipo === 'ingresso' ? '#d1fae5' : '#fee2e2'),
            border: `2px solid ${isTrasferimentoInterno ? '#f59e0b' : (currentPartita.tipo === 'ingresso' ? '#10b981' : '#ef4444')}`,
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            flexWrap: 'wrap'
          }}>
            <strong style={{ 
              color: isTrasferimentoInterno ? '#92400e' : (currentPartita.tipo === 'ingresso' ? '#065f46' : '#991b1b'),
              fontSize: '14px'
            }}>
              {isTrasferimentoInterno
                ? (currentPartita.tipo === 'ingresso' ? '🔁 TRASFERIMENTO IN INGRESSO' : '🔁 TRASFERIMENTO IN USCITA')
                : (currentPartita.tipo === 'ingresso' ? '📥 INGRESSO' : '📤 USCITA')}
            </strong>
            <span className="partita-header-meta">
              <span className="partita-header-meta-label">Data:</span>{' '}
              {currentPartita.data
                ? (typeof currentPartita.data === 'string'
                    ? new Date(currentPartita.data).toLocaleDateString('it-IT')
                    : new Date(currentPartita.data).toLocaleDateString('it-IT'))
                : '—'}
            </span>
            <span className="partita-header-meta">
              <span className="partita-header-meta-label">Capi:</span>{' '}
              <strong>{currentPartita.numero_capi ?? 0}</strong>
            </span>
          </div>
        )}
        
        {currentPartita && currentPartita.tipo_oggetto === 'gruppo_decessi' && (
          <div className="partita-header-badge" style={{ 
            marginBottom: '15px', 
            padding: '10px 14px',
            borderRadius: '6px',
            backgroundColor: '#fef3c7',
            border: '2px solid #f59e0b',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            flexWrap: 'wrap'
          }}>
            <strong style={{ 
              color: '#92400e',
              fontSize: '14px'
            }}>
              ⚠️ GRUPPO DECESSI
            </strong>
            <span className="partita-header-meta">
              <span className="partita-header-meta-label">Data:</span>{' '}
              {(currentPartita.data_uscita || currentPartita.data_decesso)
                ? new Date(currentPartita.data_uscita || currentPartita.data_decesso).toLocaleDateString('it-IT')
                : '—'}
            </span>
            <span className="partita-header-meta">
              <span className="partita-header-meta-label">Capi:</span>{' '}
              <strong>{currentPartita.codici_capi ? currentPartita.codici_capi.length : 0}</strong>
            </span>
          </div>
        )}

      <div className="partite-anagrafe-rimanenti" style={{ marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid #e0e0e0' }}>
          <span className="partite-anagrafe-rimanenti-label">Operazioni rimanenti:</span>
          <strong className="partite-anagrafe-rimanenti-numero">{operazioniRimanenti}</strong>
        </div>

          {currentPartita.tipo_oggetto === 'partita' ? (
            <div className={`partita-info-section ${currentPartita.tipo === 'ingresso' ? 'partita-ingresso' : 'partita-uscita'}`}>
              
              
              <div className="info-grid">
                <div className="info-item">
                  <label>
                    {currentPartita.tipo === 'ingresso' ? 'Provenienza (esterno):' : (isTrasferimentoInterno ? 'Destinazione (interna):' : 'Destinazione (esterno):')}
                  </label>
                  <span>
                    {currentPartita.codice_stalla || '-'}
                    {currentPartita.nome_stalla ? ` — ${currentPartita.nome_stalla}` : ''}
                  </span>
                </div>
                <div className="info-item">
                  <label>
                    {currentPartita.tipo === 'ingresso' ? 'Inserimento (azienda):' : 'Partenza (azienda):'}
                  </label>
                  <span>{currentPartita.codice_stalla_azienda || '-'}</span>
                </div>
                <div className="info-item">
                  <label>Motivo:</label>
                  <span>{currentPartita.motivo || '-'}</span>
                </div>
                {currentPartita.numero_modello && (
                  <div className="info-item">
                    <label>Numero Modello:</label>
                    <span>{currentPartita.numero_modello}</span>
                  </div>
                )}
              </div>
            </div>
          ) : currentPartita.tipo_oggetto === 'gruppo_decessi' ? (
            <div className="partita-info-section partita-uscita">
              {currentPartita.numero_certificato_smaltimento && (
                <div className="info-grid">
                  <div className="info-item">
                    <label>Certificato Smaltimento:</label>
                    <span>{currentPartita.numero_certificato_smaltimento}</span>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {currentPartita.tipo_oggetto === 'partita' ? (
            <div className="partita-form-section partita-form-section--partita">
              {/* Campo 'Modalità di gestione' rimosso: default backend = 'proprieta' */}
              <div className="form-group">
                <label>Costo unitario (€)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={costoUnitario}
                  onChange={(e) => setCostoUnitario(e.target.value)}
                  placeholder="Costo medio per capo (opzionale)"
                />
              </div>
              <div className="form-group">
                <label>Valore totale (€)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={valoreTotale}
                  onChange={(e) => setValoreTotale(e.target.value)}
                  placeholder="Valore economico complessivo (opzionale)"
                />
              </div>
              <div className="form-group form-group--full">
                <label>Trasferimento interno (peso opzionale)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <button
                    type="button"
                    className={`toggle-button ${isTrasferimentoInterno ? 'active' : ''}`}
                    onClick={() => setIsTrasferimentoInterno(prev => !prev)}
                    aria-label={isTrasferimentoInterno ? 'Sì' : 'No'}
                  />
                </div>
                <small style={{ display: 'block', marginTop: '4px' }}>
                  {isTrasferimentoInterno 
                    ? 'Trasferimento tra sedi della stessa azienda - peso opzionale'
                    : 'Trasferimento ad altro allevamento - peso obbligatorio'}
                </small>
              </div>

              <div className="form-group">
                <label>
                  Peso Totale (kg) {!isTrasferimentoInterno && <span className="required">*</span>}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={pesoTotale}
                  onChange={handlePesoChange}
                  placeholder="Inserisci peso totale partita"
                  required={!isTrasferimentoInterno}
                  className={!isTrasferimentoInterno && !pesoTotale ? 'error' : ''}
                />
                <div style={{ marginTop: '8px' }}>
                  <label style={{ display: 'block', marginBottom: '4px' }}>Aggiorna automaticamente il peso per ogni capo</label>
                  <button
                    type="button"
                    className={`toggle-button ${aggiornaPesoCapi ? 'active' : ''}`}
                    onClick={() => setAggiornaPesoCapi(prev => !prev)}
                    aria-label={aggiornaPesoCapi ? 'Sì' : 'No'}
                  />
                </div>
                {pesoTotale && currentPartita.numero_capi > 0 && (
                  <div className="calculated-weight">
                    <span>Peso medio per capo: <strong>{pesoPerCapo} kg</strong></span>
                  </div>
                )}
              </div>

              {currentPartita.codici_capi && currentPartita.codici_capi.length > 0 && (
                <div className="capi-list">
                  <label>Capi nella partita ({currentPartita.codici_capi.length}):</label>
                  <div className="capi-grid">
                    {currentPartita.codici_capi.slice(0, 20).map((codice, idx) => (
                      <span key={idx} className="capo-badge">{codice}</span>
                    ))}
                    {currentPartita.codici_capi.length > 20 && (
                      <span className="capo-badge more">
                        +{currentPartita.codici_capi.length - 20} altri
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : currentPartita.tipo_oggetto === 'gruppo_decessi' ? (
            <div className="partita-form-section partita-form-section--decessi">
              <div className="form-group">
                <label>
                  Numero Certificato Smaltimento <span style={{ fontSize: '12px', color: '#666', fontWeight: 'normal' }}>(Opzionale)</span>
                </label>
                <input
                  type="text"
                  maxLength="100"
                  value={numeroCertificatoSmaltimento}
                  onChange={(e) => setNumeroCertificatoSmaltimento(e.target.value)}
                  placeholder="Inserisci numero certificato di smaltimento"
                />
                <small style={{ fontSize: '12px', color: '#666', display: 'block', marginTop: '4px' }}>
                  Numero del certificato di smaltimento rilasciato
                </small>
              </div>

              <div className="form-group">
                <label>
                  ID Fattura Smaltimento <span style={{ fontSize: '12px', color: '#666', fontWeight: 'normal' }}>(Opzionale)</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={fatturaSmaltimentoId}
                  onChange={(e) => setFatturaSmaltimentoId(e.target.value)}
                  placeholder="Inserisci ID fattura di smaltimento"
                />
                <small style={{ fontSize: '12px', color: '#666', display: 'block', marginTop: '4px' }}>
                  ID della fattura di smaltimento collegata (se presente)
                </small>
              </div>

              <div className="form-group">
                <label>
                  Valore Economico Totale (€) <span style={{ fontSize: '12px', color: '#666', fontWeight: 'normal' }}>(Opzionale)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={valoreEconomicoTotale}
                  onChange={(e) => setValoreEconomicoTotale(e.target.value)}
                  placeholder="Inserisci valore economico totale del gruppo"
                />
                <small style={{ fontSize: '12px', color: '#666', display: 'block', marginTop: '4px' }}>
                  Valore economico totale del gruppo di decessi (es. per assicurazione o ammortamento)
                </small>
              </div>

              <div className="form-group form-group--full">
                <label>
                  Note <span style={{ fontSize: '12px', color: '#666', fontWeight: 'normal' }}>(Opzionale)</span>
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Note aggiuntive sul gruppo decessi"
                  rows="2"
                />
              </div>

              {capiDecesso.length > 0 && (
                <div className="capi-decessi-section">
                  <label style={{ display: 'block', marginBottom: '12px', fontWeight: 600, fontSize: '14px' }}>
                    Capi deceduti ({capiDecesso.length}) - Gestione "A carico"
                  </label>
                  <div style={{ 
                    border: '1px solid #e5e7eb', 
                    borderRadius: '8px', 
                    overflow: 'hidden',
                    maxHeight: '400px',
                    overflowY: 'auto'
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead style={{ background: '#f9fafb', position: 'sticky', top: 0 }}>
                        <tr>
                          <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '13px', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>Auricolare</th>
                          <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '13px', fontWeight: 600, borderBottom: '1px solid #e5e7eb', width: '120px' }}>A carico</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '13px', fontWeight: 600, borderBottom: '1px solid #e5e7eb', width: '120px' }}>Valore (€)</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '13px', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {capiDecesso.map((capo, index) => (
                          <tr key={index} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '10px 12px', fontSize: '13px', fontFamily: 'monospace' }}>
                              {capo.auricolare}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', justifyContent: 'center' }}>
                                <button
                                  type="button"
                                  className={`toggle-button ${(capo.a_carico !== undefined ? capo.a_carico : true) ? 'active' : ''}`}
                                  onClick={() => {
                                    const updated = [...capiDecesso];
                                    const current = updated[index].a_carico !== undefined ? updated[index].a_carico : true;
                                    updated[index] = { ...updated[index], a_carico: !current };
                                    setCapiDecesso(updated);
                                  }}
                                  aria-label={(capo.a_carico !== undefined ? capo.a_carico : true) ? 'A carico' : 'Non a carico'}
                                />
                              </div>
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={capo.valore_capo}
                                onChange={(e) => {
                                  const updated = [...capiDecesso];
                                  updated[index] = { ...updated[index], valore_capo: e.target.value };
                                  setCapiDecesso(updated);
                                }}
                                placeholder="Opzionale"
                                style={{ width: '100%', padding: '6px 8px', fontSize: '13px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                              />
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <input
                                type="text"
                                value={capo.note}
                                onChange={(e) => {
                                  const updated = [...capiDecesso];
                                  updated[index] = { ...updated[index], note: e.target.value };
                                  setCapiDecesso(updated);
                                }}
                                placeholder="Note opzionali"
                                style={{ width: '100%', padding: '6px 8px', fontSize: '13px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <small style={{ display: 'block', marginTop: '8px', fontSize: '12px', color: '#6b7280' }}>
                    Seleziona se ogni capo è a carico dell'allevamento (spuntato) o non a carico (non spuntato)
                  </small>
                </div>
              )}
            </div>
          ) : null}
    </BaseModal>
  );
};

export default PartiteAnagrafeModal;

