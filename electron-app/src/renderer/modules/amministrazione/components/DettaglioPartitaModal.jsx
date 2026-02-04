/**
 * DettaglioPartitaModal - Modale per visualizzare e gestire i dettagli di una partita
 */
import React, { useState, useEffect, useMemo } from 'react';
import SmartSelect from '../../../components/SmartSelect';
import SimpleSelect from '../../../components/SimpleSelect';
import BaseModal from '../../../components/BaseModal';
import { amministrazioneService } from '../services/amministrazioneService';
import { allevamentoService } from '../../allevamento/services/allevamentoService';
import hybridDataService from '../../../services/hybridDataService';
import '../../alimentazione/components/Alimentazione.css';
import './DettaglioPartitaModal.css';

const DettaglioPartitaModal = ({ isOpen, onClose, partitaId, onUpdate, onDelete }) => {
  const [partita, setPartita] = useState(null);
  const [animali, setAnimali] = useState([]);
  const [sedi, setSedi] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [showAnimaliModal, setShowAnimaliModal] = useState(false);

  const MODALITA_GESTIONE_OPTIONS = [
    { value: 'proprieta', label: 'Proprietà' },
    { value: 'soccida_monetizzata', label: 'Soccida monetizzata' },
    { value: 'soccida_fatturata', label: 'Soccida fatturata' },
  ];

  const sediOptions = useMemo(
    () =>
      sedi.map((sede) => ({
        value: sede.codice_stalla || '',
        label: sede.nome ? `${sede.codice_stalla} - ${sede.nome}` : sede.codice_stalla,
      })),
    [sedi]
  );

  useEffect(() => {
    if (isOpen && partitaId) {
      loadPartitaDetails();
    }
  }, [isOpen, partitaId]);

  const loadPartitaDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Carica dettagli partita
      const partitaData = await amministrazioneService.getPartita(partitaId);
      if (!partitaData) {
        setError('Partita non trovata. Potrebbe essere stata eliminata o non ancora sincronizzata.');
        setLoading(false);
        return;
      }
      setPartita(partitaData);
      setFormData({
        data: partitaData.data ? new Date(partitaData.data).toISOString().split('T')[0] : '',
        codice_stalla: partitaData.codice_stalla || '',
        nome_stalla: partitaData.nome_stalla || '',
        numero_capi: partitaData.numero_capi || '',
        peso_totale: partitaData.peso_totale || '',
        peso_medio: partitaData.peso_medio || '',
        is_trasferimento_interno: partitaData.is_trasferimento_interno || false,
        codice_stalla_azienda: partitaData.codice_stalla_azienda || '',
        note: partitaData.note || '',
        modalita_gestione: partitaData.modalita_gestione || 'proprieta',
        costo_unitario: partitaData.costo_unitario || '',
        valore_totale: partitaData.valore_totale || '',
        motivo: partitaData.motivo || '',
        numero_modello: partitaData.numero_modello || '',
        numero_partita: partitaData.numero_partita || '',
      });

      // Carica sedi disponibili per l'azienda della partita
      if (partitaData.azienda_id) {
        try {
          const sediData = await allevamentoService.getSedi(partitaData.azienda_id);
          setSedi(sediData || []);
        } catch (err) {

          setSedi([]);
        }
      }

      // Carica animali associati tramite join partita_animale_animali
      const animaliJoinResponse = await amministrazioneService.getPartitaAnimali(partitaId);
      const animaliDaPartita = (animaliJoinResponse && animaliJoinResponse.animali) || [];
      setAnimali(animaliDaPartita);
    } catch (err) {

      setError(err.message || 'Errore nel caricamento dei dettagli');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    try {
      setSaving(true);
      setError(null);
      
      // Calcola le differenze per verificare se ci sono cambiamenti problematici
      const oldPeso = partita.peso_totale ? parseFloat(partita.peso_totale) : null;
      const newPeso = formData.peso_totale ? parseFloat(formData.peso_totale) : null;
      const pesoRidotto = oldPeso && newPeso && newPeso < oldPeso * 0.9; // Riduzione > 10%
      
      const oldCosto = partita.costo_unitario ? parseFloat(partita.costo_unitario) : null;
      const newCosto = formData.costo_unitario ? parseFloat(formData.costo_unitario) : null;
      const costoRidotto = oldCosto && newCosto && newCosto < oldCosto * 0.9; // Riduzione > 10%
      
      const oldValore = partita.valore_totale ? parseFloat(partita.valore_totale) : null;
      const newValore = formData.valore_totale ? parseFloat(formData.valore_totale) : null;
      const valoreRidotto = oldValore && newValore && newValore < oldValore * 0.9; // Riduzione > 10%
      
      // Chiedi conferma se ci sono riduzioni significative
      if (pesoRidotto || costoRidotto || valoreRidotto) {
        let messaggio = 'Attenzione: stai per applicare modifiche che riducono significativamente:\n\n';
        if (pesoRidotto) {
          messaggio += `• Peso totale: da ${oldPeso.toFixed(2)} kg a ${newPeso.toFixed(2)} kg\n`;
        }
        if (costoRidotto) {
          messaggio += `• Costo unitario: da ${oldCosto.toFixed(2)} € a ${newCosto.toFixed(2)} €\n`;
        }
        if (valoreRidotto) {
          messaggio += `• Valore totale: da ${oldValore.toFixed(2)} € a ${newValore.toFixed(2)} €\n`;
        }
        messaggio += '\nQueste modifiche verranno applicate anche ai singoli animali associati a questa partita.\n\n';
        messaggio += 'Sei sicuro di voler procedere?';
        
        if (!window.confirm(messaggio)) {
          setSaving(false);
          return;
        }
      }
      
      const updateData = {
        data: formData.data ? new Date(formData.data).toISOString().split('T')[0] : partita.data,
        codice_stalla: formData.codice_stalla?.trim() || null,
        nome_stalla: formData.nome_stalla?.trim() || null,
        numero_capi: parseInt(formData.numero_capi) || partita.numero_capi,
        peso_totale: formData.peso_totale ? parseFloat(formData.peso_totale) : null,
        peso_medio: formData.peso_medio ? parseFloat(formData.peso_medio) : null,
        is_trasferimento_interno: formData.is_trasferimento_interno,
        codice_stalla_azienda: formData.codice_stalla_azienda?.trim() || null,
        note: formData.note || null,
        modalita_gestione: formData.modalita_gestione || 'proprieta',
        motivo: formData.motivo || null,
        numero_modello: formData.numero_modello?.trim() || null,
        numero_partita: formData.numero_partita?.trim() || null,
        azienda_id: partita?.azienda_id, // Include azienda_id per invalidare cache
      };

      // Aggiungi costo_unitario e valore_totale solo se non c'è fattura collegata
      if (!partita.fattura_amministrazione_id && !partita.fattura_emessa_id) {
        if (formData.costo_unitario) {
          updateData.costo_unitario = parseFloat(formData.costo_unitario);
        }
        if (formData.valore_totale) {
          updateData.valore_totale = parseFloat(formData.valore_totale);
        }
      }

      await amministrazioneService.updatePartita(partitaId, updateData);
      setShowEditForm(false);
      if (onUpdate) {
        onUpdate();
      }
      // Feedback all'utente sulla sincronizzazione
      let feedbackMsg = 'Partita aggiornata con successo.\n\n';
      if (animali.length > 0) {
        feedbackMsg += 'Le modifiche sono state applicate anche ai singoli animali associati:\n';
        if (newPeso !== oldPeso) {
          feedbackMsg += `• Pesi aggiornati\n`;
        }
        if (newCosto !== oldCosto || newValore !== oldValore) {
          feedbackMsg += `• Valori economici aggiornati\n`;
        }
      }
      alert(feedbackMsg);
      loadPartitaDetails();
    } catch (err) {

      setError(err.message || 'Errore nell\'aggiornamento della partita');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!partita) return;

    let eliminaAnimali = false;
    let messaggioConferma = '';

    // Gestione diversa a seconda del tipo di partita
    if (partita.tipo === 'ingresso') {
      // Partita di ingresso: chiedi se eliminare anche gli animali
      if (animali.length > 0) {
        messaggioConferma = `Stai per eliminare una partita di INGRESSO con ${animali.length} animale/i associato/i.\n\n`;
        messaggioConferma += 'Cosa vuoi fare con gli animali?\n\n';
        messaggioConferma += '• Scegli "OK" per eliminare anche tutti gli animali associati\n';
        messaggioConferma += '• Scegli "Annulla" per mantenere gli animali (la partita verrà comunque eliminata)';
        
        const conferma = window.confirm(messaggioConferma);
        if (!conferma) {
          return; // L'utente ha annullato
        }
        
        // Chiedi conferma finale per eliminare animali
        if (conferma) {
          const confermaFinale = window.confirm(
            `ATTENZIONE: Stai per eliminare definitivamente ${animali.length} animale/i.\n\n` +
            'Questa operazione NON può essere annullata.\n\n' +
            'Sei assolutamente sicuro?'
          );
          if (!confermaFinale) {
            return;
          }
          eliminaAnimali = true;
        }
      } else {
        // Nessun animale associato, conferma semplice
        if (!window.confirm('Sei sicuro di voler eliminare questa partita di ingresso? Questa operazione non può essere annullata.')) {
          return;
        }
      }
    } else {
      // Partita di uscita o trasferimento: ripristina gli animali
      if (animali.length > 0) {
        messaggioConferma = `Stai per eliminare una partita di ${partita.is_trasferimento_interno ? 'TRASFERIMENTO INTERNO' : 'USCITA'} con ${animali.length} animale/i associato/i.\n\n`;
        messaggioConferma += 'Gli animali verranno ripristinati:\n';
        if (partita.is_trasferimento_interno) {
          messaggioConferma += '• Stato: "presente"\n';
          messaggioConferma += '• Verranno rimossi i dati di uscita\n';
          messaggioConferma += '• Verranno mantenuti i dati di ingresso e anagrafici\n';
        } else {
          messaggioConferma += '• Stato: "presente"\n';
          messaggioConferma += '• Verranno rimossi i dati di uscita\n';
        }
        messaggioConferma += '\nSei sicuro di voler procedere?';
        
        if (!window.confirm(messaggioConferma)) {
          return;
        }
      } else {
        if (!window.confirm('Sei sicuro di voler eliminare questa partita? Questa operazione non può essere annullata.')) {
          return;
        }
      }
    }

    try {
      setSaving(true);
      setError(null);

      // Se è una partita di ingresso e dobbiamo eliminare gli animali
      if (partita.tipo === 'ingresso' && eliminaAnimali && animali.length > 0) {
        // Elimina prima gli animali, poi la partita
        // Nota: Il backend dovrebbe gestire la cascata, ma per sicurezza eliminiamo esplicitamente
        for (const animale of animali) {
          try {
            await hybridDataService.deleteAnimale(animale.id);
          } catch (err) {
            console.error(`Errore eliminazione animale ${animale.id}:`, err);
            // Continua anche se un animale fallisce
          }
        }
      } else if ((partita.tipo === 'uscita' || partita.is_trasferimento_interno) && animali.length > 0) {
        // Ripristina gli animali per partita di uscita/trasferimento
        for (const animale of animali) {
          try {
            // Prepara i dati per ripristinare l'animale
            const updateData = {
              stato: 'presente',
              motivo_uscita: null,
              data_uscita: null,
              numero_modello_uscita: null,
              data_modello_uscita: null,
              codice_azienda_destinazione: null,
              codice_fiera_destinazione: null,
              codice_stato_destinazione: null,
              regione_macello_destinazione: null,
              codice_macello_destinazione: null,
              codice_pascolo_destinazione: null,
              codice_circo_destinazione: null,
              data_macellazione: null,
              abbattimento: null,
              data_provvvedimento: null,
            };

            // Se è un trasferimento interno, ripristina anche codice_azienda_anagrafe se presente
            if (partita.is_trasferimento_interno && partita.codice_stalla_azienda) {
              updateData.codice_azienda_anagrafe = partita.codice_stalla_azienda;
            }

            await allevamentoService.updateAnimale(animale.id, updateData);
          } catch (err) {
            console.error(`Errore ripristino animale ${animale.id}:`, err);
            // Continua anche se un animale fallisce
          }
        }
      }

      // Elimina la partita
      await amministrazioneService.deletePartita(partitaId, partita?.azienda_id);
      
      if (onDelete) {
        onDelete();
      }
      
      let feedbackMsg = 'Partita eliminata con successo.';
      if (partita.tipo === 'ingresso' && eliminaAnimali) {
        feedbackMsg += `\n\n${animali.length} animale/i eliminato/i.`;
      } else if (partita.tipo === 'uscita' && animali.length > 0) {
        feedbackMsg += `\n\n${animali.length} animale/i ripristinato/i nello stato "presente".`;
      }
      alert(feedbackMsg);
      
      onClose();
    } catch (err) {
      setError(err.message || 'Errore nell\'eliminazione della partita');
    } finally {
      setSaving(false);
    }
  };

  const identifier = partita ? `Partita #${partita.id}` : null;
  const headerActions = !showEditForm && partita ? (
    <>
      {animali.length > 0 && (
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setShowAnimaliModal(true)}
          style={{ fontSize: '13px', padding: '6px 12px' }}
        >
          Visualizza Animali ({animali.length})
        </button>
      )}
      <button
        className="btn btn-secondary"
        onClick={() => {
          // Assicura che formData sia aggiornato quando si entra in modifica
          setFormData({
            data: partita.data ? new Date(partita.data).toISOString().split('T')[0] : '',
            codice_stalla: partita.codice_stalla || '',
            nome_stalla: partita.nome_stalla || '',
            numero_capi: partita.numero_capi || '',
            peso_totale: partita.peso_totale || '',
            peso_medio: partita.peso_medio || '',
            is_trasferimento_interno: partita.is_trasferimento_interno || false,
            codice_stalla_azienda: partita.codice_stalla_azienda || '',
            note: partita.note || '',
            modalita_gestione: partita.modalita_gestione || 'proprieta',
            costo_unitario: partita.costo_unitario || '',
            valore_totale: partita.valore_totale || '',
            motivo: partita.motivo || '',
            numero_modello: partita.numero_modello || '',
            numero_partita: partita.numero_partita || '',
          });
          setShowEditForm(true);
        }}
      >
        Modifica
      </button>
      <button
        className="btn btn-danger"
        onClick={handleDelete}
        disabled={saving}
      >
        Elimina
      </button>
    </>
  ) : null;

  const footerActions = showEditForm ? (
    <>
      <button
        className="btn btn-primary"
        onClick={handleUpdate}
        disabled={saving}
      >
        {saving ? 'Salvataggio...' : 'Salva Modifiche'}
      </button>
      <button
        className="btn btn-secondary"
        onClick={() => {
          setShowEditForm(false);
          setFormData({
            data: partita?.data ? new Date(partita.data).toISOString().split('T')[0] : '',
            codice_stalla: partita?.codice_stalla || '',
            nome_stalla: partita?.nome_stalla || '',
            numero_capi: partita?.numero_capi || '',
            peso_totale: partita?.peso_totale || '',
            peso_medio: partita?.peso_medio || '',
            is_trasferimento_interno: partita?.is_trasferimento_interno || false,
            codice_stalla_azienda: partita?.codice_stalla_azienda || '',
            note: partita?.note || '',
            modalita_gestione: partita?.modalita_gestione || 'proprieta',
            costo_unitario: partita?.costo_unitario || '',
            valore_totale: partita?.valore_totale || '',
            motivo: partita?.motivo || '',
            numero_modello: partita?.numero_modello || '',
            numero_partita: partita?.numero_partita || '',
          });
        }}
        disabled={saving}
      >
        Annulla
      </button>
      <button className="btn btn-secondary" onClick={onClose}>
        Chiudi
      </button>
    </>
  ) : (
    <button className="btn btn-secondary" onClick={onClose}>
      Chiudi
    </button>
  );

  return (
    <>
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={partita ? 'Dettagli Partita' : 'Caricamento...'}
      identifier={identifier}
      headerActions={headerActions}
      footerActions={footerActions}
      size="large"
      className="dettaglio-partita-modal"
    >
        {loading && (
            <div className="loading">Caricamento dettagli...</div>
        )}

        {error && (
            <div className="error-message">{error}</div>
        )}

        {!loading && !error && partita && (
          <>
              {/* Informazioni generali */}
              <div className="form-section">
                <div className="form-grid">
                  <div className="form-group span-6">
                    <label>Tipo</label>
                    <span>{partita.tipo === 'ingresso' ? 'Ingresso' : 'Uscita'}</span>
                  </div>
                  <div className="form-group span-6">
                    <label>Data</label>
                    {showEditForm ? (
                      <input
                        type="date"
                        value={formData.data}
                        onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                      />
                    ) : (
                      <span>{new Date(partita.data).toLocaleDateString('it-IT', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}</span>
                    )}
                  </div>
                  {partita.tipo === 'ingresso' ? (
                    <>
                      <div className="form-group span-6">
                        <label>Codice Stalla Provenienza (Esterna)</label>
                        {showEditForm ? (
                          <input
                            type="text"
                            maxLength="20"
                            value={formData.codice_stalla || ''}
                            onChange={(e) => setFormData({ ...formData, codice_stalla: e.target.value })}
                            placeholder="Codice stalla esterna"
                            style={{ fontFamily: 'monospace' }}
                          />
                        ) : (
                          <span>{partita.codice_stalla}</span>
                        )}
                      </div>
                      <div className="form-group span-6">
                        <label>Codice Stalla Destinazione (Mio Allevamento)</label>
                        {showEditForm ? (
                          <>
                            {sedi.length > 0 ? (
                              <SmartSelect
                                className="select-compact"
                                options={[{ value: '', label: '-- Seleziona codice stalla --' }, ...sediOptions]}
                                value={formData.codice_stalla_azienda || ''}
                                onChange={(e) => setFormData({ ...formData, codice_stalla_azienda: e.target.value })}
                                displayField="label"
                                valueField="value"
                                placeholder="-- Seleziona codice stalla --"
                              />
                            ) : (
                              <input
                                type="text"
                                maxLength="20"
                                placeholder="Es: 021PD003 (nessuna sede disponibile)"
                                value={formData.codice_stalla_azienda || ''}
                                onChange={(e) => setFormData({ ...formData, codice_stalla_azienda: e.target.value })}
                                style={{ fontFamily: 'monospace' }}
                                disabled
                              />
                            )}
                            <small style={{ fontSize: '12px', color: '#666', display: 'block', marginTop: '4px' }}>
                              Questo codice identifica la sede del tuo allevamento dove gli animali sono stati assegnati.
                              {!formData.codice_stalla_azienda && (
                                <span style={{ color: '#dc2626', display: 'block', marginTop: '4px' }}>
                                  ⚠️ Senza questo codice, gli animali potrebbero non essere visibili in allevamento.
                                </span>
                              )}
                            </small>
                          </>
                        ) : (
                          <span className="highlight">
                            {partita.codice_stalla_azienda || (
                              <span style={{ color: '#dc2626', fontStyle: 'italic' }}>
                                ⚠️ Non specificato - Gli animali potrebbero non essere visibili in allevamento
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                      {!showEditForm && !partita.codice_stalla_azienda && (
                        <div className="form-group span-12" style={{ marginTop: '8px', padding: '8px', backgroundColor: '#fef3c7', borderRadius: '4px', borderLeft: '3px solid #f59e0b' }}>
                          <p style={{ margin: 0, fontSize: '13px', color: '#92400e' }}>
                            <strong>Attenzione:</strong> Senza codice stalla destinazione, gli animali potrebbero non essere assegnati alla sede corretta e quindi non essere visibili nella sezione Allevamento.
                            Gli animali devono essere assegnati manualmente alla sede/stabilimento/box corretto.
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="form-group span-6">
                        <label>Codice Stalla Provenienza (Mio Allevamento)</label>
                        {showEditForm ? (
                          <>
                            {sedi.length > 0 ? (
                              <SmartSelect
                                className="select-compact"
                                options={[{ value: '', label: '-- Seleziona codice stalla --' }, ...sediOptions]}
                                value={formData.codice_stalla_azienda || ''}
                                onChange={(e) => setFormData({ ...formData, codice_stalla_azienda: e.target.value })}
                                displayField="label"
                                valueField="value"
                                placeholder="-- Seleziona codice stalla --"
                              />
                            ) : (
                              <input
                                type="text"
                                maxLength="20"
                                placeholder="Es: 021PD003 (nessuna sede disponibile)"
                                value={formData.codice_stalla_azienda || ''}
                                onChange={(e) => setFormData({ ...formData, codice_stalla_azienda: e.target.value })}
                                style={{ fontFamily: 'monospace' }}
                                disabled
                              />
                            )}
                            <small style={{ fontSize: '12px', color: '#666', display: 'block', marginTop: '4px' }}>
                              Questo codice identifica la sede del tuo allevamento da dove sono usciti i capi.
                              {!formData.codice_stalla_azienda && (
                                <span style={{ color: '#dc2626', display: 'block', marginTop: '4px' }}>
                                  ⚠️ Senza questo codice, gli animali potrebbero non essere visibili in allevamento.
                                </span>
                              )}
                            </small>
                          </>
                        ) : (
                          <span className="highlight">
                            {partita.codice_stalla_azienda || (
                              <span style={{ color: '#dc2626', fontStyle: 'italic' }}>
                                ⚠️ Non specificato
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                      <div className="form-group span-6">
                        <label>Codice Stalla Destinazione (Esterna)</label>
                        {showEditForm ? (
                          <input
                            type="text"
                            maxLength="20"
                            value={formData.codice_stalla || ''}
                            onChange={(e) => setFormData({ ...formData, codice_stalla: e.target.value })}
                            placeholder="Codice stalla esterna"
                            style={{ fontFamily: 'monospace' }}
                          />
                        ) : (
                          <span>{partita.codice_stalla}</span>
                        )}
                      </div>
                    </>
                  )}
                  <div className="form-group span-6">
                    <label>Nome Stalla {partita.tipo === 'ingresso' ? 'Provenienza' : 'Destinazione'}</label>
                    {showEditForm ? (
                      <input
                        type="text"
                        maxLength="200"
                        value={formData.nome_stalla || ''}
                        onChange={(e) => setFormData({ ...formData, nome_stalla: e.target.value })}
                        placeholder="Nome stalla"
                      />
                    ) : (
                      <span>{partita.nome_stalla || '—'}</span>
                    )}
                  </div>
                  <div className="form-group span-6">
                    <label>Numero Capi</label>
                    {showEditForm ? (
                      <input
                        type="number"
                        min="1"
                        value={formData.numero_capi}
                        onChange={(e) => setFormData({ ...formData, numero_capi: e.target.value })}
                      />
                    ) : (
                      <span className="highlight">{partita.numero_capi}</span>
                    )}
                  </div>
                  <div className="form-group span-6">
                    <label>Modalità gestione</label>
                    {showEditForm ? (
                      <SimpleSelect
                        options={MODALITA_GESTIONE_OPTIONS}
                        value={formData.modalita_gestione || 'proprieta'}
                        onChange={(e) =>
                          setFormData({ ...formData, modalita_gestione: e.target.value })
                        }
                        displayField="label"
                        valueField="value"
                        placeholder="Seleziona modalità"
                      />
                    ) : (
                      <span>{partita.modalita_gestione || '—'}</span>
                    )}
                  </div>
                  <div className="form-group span-6">
                    <label>Costo unitario</label>
                    {showEditForm && !partita.fattura_amministrazione_id && !partita.fattura_emessa_id ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.costo_unitario}
                        onChange={(e) => {
                          const newCosto = e.target.value;
                          setFormData(prev => {
                            const updated = { ...prev, costo_unitario: newCosto };
                            // Se viene modificato costo_unitario e c'è numero_capi, ricalcola valore_totale
                            if (newCosto && prev.numero_capi) {
                              const newValore = parseFloat(newCosto) * parseInt(prev.numero_capi);
                              if (!isNaN(newValore)) {
                                updated.valore_totale = newValore.toFixed(2);
                              }
                            }
                            return updated;
                          });
                        }}
                        placeholder="€"
                      />
                    ) : (
                      <span className="highlight">
                        {partita.costo_unitario
                          ? `${parseFloat(partita.costo_unitario).toFixed(2)} €`
                          : 'Non disponibile'}
                        {partita.fattura_amministrazione_id || partita.fattura_emessa_id ? (
                          <small style={{ display: 'block', fontSize: '11px', color: '#666', marginTop: '4px' }}>
                            Non modificabile (fattura collegata)
                          </small>
                        ) : null}
                      </span>
                    )}
                  </div>
                  <div className="form-group span-6">
                    <label>Valore totale</label>
                    {showEditForm && !partita.fattura_amministrazione_id && !partita.fattura_emessa_id ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.valore_totale}
                        onChange={(e) => {
                          const newValore = e.target.value;
                          setFormData(prev => {
                            const updated = { ...prev, valore_totale: newValore };
                            // Se viene modificato valore_totale e c'è numero_capi, ricalcola costo_unitario
                            if (newValore && prev.numero_capi) {
                              const newCosto = parseFloat(newValore) / parseInt(prev.numero_capi);
                              if (!isNaN(newCosto)) {
                                updated.costo_unitario = newCosto.toFixed(2);
                              }
                            }
                            return updated;
                          });
                        }}
                        placeholder="€"
                      />
                    ) : (
                      <span className="highlight">
                        {partita.valore_totale
                          ? `${parseFloat(partita.valore_totale).toFixed(2)} €`
                          : 'Non disponibile'}
                        {partita.fattura_amministrazione_id || partita.fattura_emessa_id ? (
                          <small style={{ display: 'block', fontSize: '11px', color: '#666', marginTop: '4px' }}>
                            Non modificabile (fattura collegata)
                          </small>
                        ) : null}
                      </span>
                    )}
                  </div>
                  <div className="form-group span-6">
                    <label>Fattura collegata</label>
                    <span>
                      {partita.fattura_amministrazione_id
                        ? `Fattura acquisto #${partita.fattura_amministrazione_id}`
                        : partita.fattura_emessa_id
                          ? `Fattura emessa #${partita.fattura_emessa_id}`
                          : '—'}
                    </span>
                  </div>
                  <div className="form-group span-6">
                    <label>Peso Totale</label>
                    {showEditForm ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.peso_totale}
                        onChange={(e) => setFormData({ ...formData, peso_totale: e.target.value })}
                        placeholder="kg"
                      />
                    ) : (
                      <span className="highlight">
                        {partita.peso_totale 
                          ? `${parseFloat(partita.peso_totale).toFixed(2)} kg`
                          : 'Non disponibile'}
                      </span>
                    )}
                  </div>
                  <div className="form-group span-6">
                    <label>Peso Medio</label>
                    {showEditForm ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.peso_medio}
                        onChange={(e) => setFormData({ ...formData, peso_medio: e.target.value })}
                        placeholder="kg"
                      />
                    ) : (
                      <span className="highlight">
                        {partita.peso_medio 
                          ? `${parseFloat(partita.peso_medio).toFixed(2)} kg`
                          : 'Non disponibile'}
                      </span>
                    )}
                  </div>
                  <div className="form-group span-6">
                    <label>Trasferimento</label>
                    {showEditForm ? (
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          className={`toggle-button ${formData.is_trasferimento_interno ? 'active' : ''}`}
                          onClick={() => setFormData({ ...formData, is_trasferimento_interno: !formData.is_trasferimento_interno })}
                          aria-label="Trasferimento interno"
                        />
                        <span>Trasferimento interno</span>
                      </label>
                    ) : (
                      <span>{partita.is_trasferimento_interno ? 'Interno' : 'Esterno'}</span>
                    )}
                  </div>
                  <div className="form-group span-6">
                    <label>Motivo</label>
                    {showEditForm ? (
                      <SimpleSelect
                        options={[
                          { value: '', label: '-- Seleziona motivo --' },
                          { value: 'A', label: 'A - Acquisto' },
                          { value: 'V', label: 'V - Vendita' },
                          { value: 'T', label: 'T - Trasferimento' },
                          { value: 'M', label: 'M - Macellazione' },
                          { value: 'D', label: 'D - Decesso' },
                        ]}
                        value={formData.motivo || ''}
                        onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
                        displayField="label"
                        valueField="value"
                        placeholder="Seleziona motivo"
                      />
                    ) : (
                      <span>{partita.motivo || '—'}</span>
                    )}
                  </div>
                  <div className="form-group span-6">
                    <label>Numero Modello</label>
                    {showEditForm ? (
                      <input
                        type="text"
                        maxLength="50"
                        value={formData.numero_modello || ''}
                        onChange={(e) => setFormData({ ...formData, numero_modello: e.target.value })}
                        placeholder="Numero modello"
                      />
                    ) : (
                      <span>{partita.numero_modello || '—'}</span>
                    )}
                  </div>
                  <div className="form-group span-6">
                    <label>Numero Partita</label>
                    {showEditForm ? (
                      <input
                        type="text"
                        maxLength="50"
                        value={formData.numero_partita || ''}
                        onChange={(e) => setFormData({ ...formData, numero_partita: e.target.value })}
                        placeholder="Numero partita"
                        style={{ fontFamily: 'monospace' }}
                      />
                    ) : (
                      <span className="monospace">{partita.numero_partita || '—'}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* File origine anagrafe */}
              {partita.file_anagrafe_origine && (
                <div className="form-section">
                  <div className="form-grid">
                    <div className="form-group span-12">
                      <label>File Anagrafe</label>
                      <span className="monospace file-name">{partita.file_anagrafe_origine}</span>
                    </div>
                    {partita.data_importazione && (
                      <div className="form-group span-6">
                        <label>Data Importazione</label>
                        <span>{new Date(partita.data_importazione).toLocaleString('it-IT')}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Pesi individuali (solo se non abbiamo ancora animali collegati, per compatibilità con partite vecchie) */}
              {animali.length === 0 &&
               partita.pesi_individuali &&
               Array.isArray(partita.pesi_individuali) &&
               partita.pesi_individuali.length > 0 && (
                <div className="partita-section">
                  <h4>Pesi Individuali</h4>
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Codice Auricolare</th>
                          <th>Peso (kg)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {partita.pesi_individuali.map((peso, index) => (
                          <tr key={index}>
                            <td className="monospace">{peso.auricolare}</td>
                            <td>{parseFloat(peso.peso).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Animali associati - solo conteggio, tabella in modale separata */}
              {animali.length > 0 && (
                <div className="form-section">
                  <div className="form-grid">
                    <div className="form-group span-12">
                      <label>Animali Associati</label>
                      <span>{animali.length} capi associati a questa partita</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Note */}
              <div className="form-section">
                <div className="form-grid">
                  <div className="form-group span-12">
                    <label>Note</label>
                    {showEditForm ? (
                      <textarea
                        value={formData.note || ''}
                        onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                        rows="3"
                        placeholder="Note aggiuntive"
                      />
                    ) : (
                      <div className="note-content">{partita.note || '—'}</div>
                    )}
                  </div>
                </div>
              </div>
                  </>
                )}

      {/* Modale per visualizzare la tabella degli animali */}
      {showAnimaliModal && partita && animali.length > 0 && (
        <BaseModal
          isOpen={showAnimaliModal}
          onClose={() => setShowAnimaliModal(false)}
          title={`Animali Associati alla Partita (${animali.length})`}
          size="xlarge"
          footerActions={
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowAnimaliModal(false)}
            >
              Chiudi
            </button>
          }
        >
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead style={{ background: '#f9fafb', position: 'sticky', top: 0, zIndex: 1 }}>
                <tr>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', fontWeight: 600 }}>Codice Auricolare</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', fontWeight: 600 }}>Razza</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', fontWeight: 600 }}>Sesso</th>
                  <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #e5e7eb', fontWeight: 600 }}>Peso Partita</th>
                  <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #e5e7eb', fontWeight: 600 }}>Peso Attuale</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', fontWeight: 600 }}>Stato</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', fontWeight: 600 }}>Box</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', fontWeight: 600 }}>Codice Stalla</th>
                </tr>
              </thead>
              <tbody>
                {animali.map(animale => (
                  <tr key={animale.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '12px', fontFamily: 'monospace', fontSize: '13px' }}>{animale.auricolare}</td>
                    <td style={{ padding: '12px' }}>{animale.razza || '-'}</td>
                    <td style={{ padding: '12px' }}>{animale.sesso || '-'}</td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      {animale.peso_partita 
                        ? `${parseFloat(animale.peso_partita).toFixed(2)} kg`
                        : '-'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      {animale.peso_attuale 
                        ? `${parseFloat(animale.peso_attuale).toFixed(2)} kg`
                        : '-'}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span className={`badge badge-${animale.stato}`}>
                        {animale.stato}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      {animale.box_id ? `Box #${animale.box_id}` : (
                        <span style={{ color: '#dc2626', fontStyle: 'italic' }}>Non assegnato</span>
                      )}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span className="monospace">
                        {animale.codice_azienda_anagrafe || animale.codice_provenienza || '-'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </BaseModal>
      )}
    </BaseModal>
    </>
  );
};

export default DettaglioPartitaModal;

