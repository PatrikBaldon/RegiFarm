/**
 * ContrattoSoccidaModal - Modal per creare/modificare contratti di soccida
 * Versione semplificata e riorganizzata
 */
import React, { useState, useEffect } from 'react';
import { amministrazioneService } from '../services/amministrazioneService';
import SmartSelect from '../../../components/SmartSelect';
import BaseModal from '../../../components/BaseModal';
import RegistrazioneAccontoSoccidaModal from './RegistrazioneAccontoSoccidaModal';
import './ContrattoSoccidaModal.css';

const TIPOLOGIE = [
  { value: 'semplice', label: 'Semplice' },
  { value: 'parziaria', label: 'Parziaria' },
  { value: 'con_pascolo', label: 'Con Pascolo' },
];

const MODALITA_REMUNERAZIONE = [
  { value: 'ripartizione_utili', label: 'Ripartizione Utili' },
  { value: 'quota_giornaliera', label: 'Quota Giornaliera' },
  { value: 'prezzo_kg', label: 'Prezzo per Kg' },
  { value: 'percentuale', label: 'Percentuale' },
];

const TIPO_ALLEVAMENTO = [
  { value: 'svezzamento', label: 'Svezzamento' },
  { value: 'ingrasso', label: 'Ingrasso' },
];

const QUOTA_DECESSO_TIPI = [
  { value: '', label: 'Nessuna' },
  { value: 'fissa', label: 'Fissa' },
  { value: 'per_capo', label: 'Per Capo' },
  { value: 'percentuale', label: 'Percentuale' },
];

const getTipologiaLabel = (value) => {
  return TIPOLOGIE.find(t => t.value === value)?.label || value;
};

const getModalitaLabel = (value) => {
  return MODALITA_REMUNERAZIONE.find(m => m.value === value)?.label || value;
};

const ContrattoSoccidaModal = ({ contratto, aziendaId, isEditing: initialIsEditing = false, onEdit, onDelete, onAssociaAnimali, onClose }) => {
  // Se non c'è contratto, siamo sempre in modalità editing (nuovo contratto)
  // Altrimenti usa initialIsEditing passato come prop
  const [isEditing, setIsEditing] = useState(() => {
    if (!contratto) return true; // Nuovo contratto, sempre in editing
    return initialIsEditing; // Contratto esistente, usa il valore passato
  });

  // Sincronizza lo stato interno con la prop quando cambia
  useEffect(() => {
    if (contratto) {
      setIsEditing(initialIsEditing);
    }
  }, [initialIsEditing, contratto]);
  const [soccidanti, setSoccidanti] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('base'); // 'base', 'remunerazione', 'gestione'
  const [showAccontoModal, setShowAccontoModal] = useState(false);
  
  const [formData, setFormData] = useState({
    numero_contratto: '',
    azienda_id: aziendaId,
    soccidante_id: '',
    data_inizio: '',
    data_fine: '',
    tipologia: 'monetizzato',
    modalita_remunerazione: 'quota_giornaliera',
    specie_bestiame: 'bovino',
    numero_capi_previsti: '',
    direzione_tecnica_soccidante: true,
    monetizzata: true,
    // Parametri remunerazione
    quota_giornaliera: '',
    prezzo_per_kg: '',
    percentuale_remunerazione: '',
    percentuale_soccidante: '',
    percentuale_riparto_base: '',
    // Gestione costi
    mangimi_a_carico_soccidante: false,
    medicinali_a_carico_soccidante: false,
    // Gestione decessi
    quota_decesso_tipo: '',
    quota_decesso_valore: '',
    termine_responsabilita_soccidario_giorni: '',
    copertura_totale_soccidante: false,
    franchigia_mortalita_giorni: '',
    // Aggiunte/sottrazioni (per calcolo kg netti)
    percentuale_aggiunta_arrivo: '0',
    percentuale_sottrazione_uscita: '0',
    // Tipo allevamento
    tipo_allevamento: '',
    prezzo_allevamento: '',
    // Altri campi
    bonus_mortalita_attivo: false,
    bonus_mortalita_percentuale: '',
    bonus_incremento_attivo: false,
    bonus_incremento_kg_soglia: '350',
    bonus_incremento_percentuale: '1',
    traccia_iva_indetraibile: true,
    data_prima_consegna: '',
    rinnovo_per_consegna: true,
    preavviso_disdetta_giorni: '90',
    giorni_gestione_previsti: '',
    note: '',
    condizioni_particolari: '',
    attivo: true,
  });

  useEffect(() => {
    fetchSoccidanti();
    if (contratto) {
      // Carica tutti i dati del contratto nel form
      setFormData({
        numero_contratto: contratto.numero_contratto || '',
        azienda_id: contratto.azienda_id || aziendaId,
        soccidante_id: contratto.soccidante_id || '',
        data_inizio: contratto.data_inizio ? contratto.data_inizio.split('T')[0] : '',
        data_fine: contratto.data_fine ? contratto.data_fine.split('T')[0] : '',
        tipologia: contratto.tipologia || 'monetizzato',
        modalita_remunerazione: contratto.modalita_remunerazione || 'quota_giornaliera',
        specie_bestiame: contratto.specie_bestiame || 'bovino',
        numero_capi_previsti: contratto.numero_capi_previsti || '',
        direzione_tecnica_soccidante: contratto.direzione_tecnica_soccidante !== undefined ? contratto.direzione_tecnica_soccidante : true,
        monetizzata: contratto.monetizzata !== undefined ? contratto.monetizzata : true,
        quota_giornaliera: contratto.quota_giornaliera || '',
        prezzo_per_kg: contratto.prezzo_per_kg || '',
        percentuale_remunerazione: contratto.percentuale_remunerazione || '',
        percentuale_soccidante: contratto.percentuale_soccidante || '',
        percentuale_riparto_base: contratto.percentuale_riparto_base || '',
        mangimi_a_carico_soccidante: contratto.mangimi_a_carico_soccidante || false,
        medicinali_a_carico_soccidante: contratto.medicinali_a_carico_soccidante || false,
        quota_decesso_tipo: contratto.quota_decesso_tipo || '',
        quota_decesso_valore: contratto.quota_decesso_valore || '',
        termine_responsabilita_soccidario_giorni: contratto.termine_responsabilita_soccidario_giorni || '',
        copertura_totale_soccidante: contratto.copertura_totale_soccidante || false,
        franchigia_mortalita_giorni: contratto.franchigia_mortalita_giorni || '',
        percentuale_aggiunta_arrivo: contratto.percentuale_aggiunta_arrivo !== undefined ? String(contratto.percentuale_aggiunta_arrivo) : '0',
        percentuale_sottrazione_uscita: contratto.percentuale_sottrazione_uscita !== undefined ? String(contratto.percentuale_sottrazione_uscita) : '0',
        tipo_allevamento: contratto.tipo_allevamento || '',
        prezzo_allevamento: contratto.prezzo_allevamento !== undefined ? String(contratto.prezzo_allevamento) : '',
        bonus_mortalita_attivo: contratto.bonus_mortalita_attivo || false,
        bonus_mortalita_percentuale: contratto.bonus_mortalita_percentuale || '',
        bonus_incremento_attivo: contratto.bonus_incremento_attivo || false,
        bonus_incremento_kg_soglia: contratto.bonus_incremento_kg_soglia || '350',
        bonus_incremento_percentuale: contratto.bonus_incremento_percentuale || '1',
        traccia_iva_indetraibile: contratto.traccia_iva_indetraibile !== undefined ? contratto.traccia_iva_indetraibile : true,
        data_prima_consegna: contratto.data_prima_consegna ? contratto.data_prima_consegna.split('T')[0] : '',
        rinnovo_per_consegna: contratto.rinnovo_per_consegna !== undefined ? contratto.rinnovo_per_consegna : true,
        preavviso_disdetta_giorni: contratto.preavviso_disdetta_giorni || '90',
        giorni_gestione_previsti: contratto.giorni_gestione_previsti || '',
        note: contratto.note || '',
        condizioni_particolari: contratto.condizioni_particolari || '',
        attivo: contratto.attivo !== undefined ? contratto.attivo : true,
      });
    }
  }, [contratto, aziendaId]);

  const fetchSoccidanti = async () => {
    try {
      const data = await amministrazioneService.getSoccidanti();
      setSoccidanti(data || []);
    } catch (error) {

      alert('Errore nel caricamento dei soccidanti');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...formData,
        azienda_id: aziendaId,
        numero_capi_previsti: formData.numero_capi_previsti ? parseInt(formData.numero_capi_previsti) : null,
        quota_giornaliera: formData.quota_giornaliera ? parseFloat(formData.quota_giornaliera) : null,
        // Se c'è tipo_allevamento, usa prezzo_allevamento anche per prezzo_per_kg
        prezzo_per_kg: formData.tipo_allevamento && formData.prezzo_allevamento 
          ? parseFloat(formData.prezzo_allevamento) 
          : (formData.prezzo_per_kg ? parseFloat(formData.prezzo_per_kg) : null),
        percentuale_remunerazione: formData.percentuale_remunerazione ? parseFloat(formData.percentuale_remunerazione) : null,
        percentuale_soccidante: formData.percentuale_soccidante ? parseFloat(formData.percentuale_soccidante) : null,
        percentuale_riparto_base: formData.percentuale_riparto_base ? parseFloat(formData.percentuale_riparto_base) : null,
        quota_decesso_valore: formData.quota_decesso_valore ? parseFloat(formData.quota_decesso_valore) : null,
        termine_responsabilita_soccidario_giorni: formData.termine_responsabilita_soccidario_giorni ? parseInt(formData.termine_responsabilita_soccidario_giorni) : null,
        franchigia_mortalita_giorni: formData.franchigia_mortalita_giorni ? parseInt(formData.franchigia_mortalita_giorni) : null,
        percentuale_aggiunta_arrivo: parseFloat(formData.percentuale_aggiunta_arrivo) || 0,
        percentuale_sottrazione_uscita: parseFloat(formData.percentuale_sottrazione_uscita) || 0,
        quota_decesso_tipo: formData.quota_decesso_tipo || null,
        data_prima_consegna: formData.data_prima_consegna || null,
        preavviso_disdetta_giorni: formData.preavviso_disdetta_giorni ? parseInt(formData.preavviso_disdetta_giorni) : 90,
        giorni_gestione_previsti: formData.giorni_gestione_previsti ? parseInt(formData.giorni_gestione_previsti) : null,
        tipo_allevamento: formData.tipo_allevamento || null,
        prezzo_allevamento: formData.prezzo_allevamento ? parseFloat(formData.prezzo_allevamento) : null,
        bonus_mortalita_attivo: formData.bonus_mortalita_attivo || false,
        bonus_mortalita_percentuale: formData.bonus_mortalita_percentuale ? parseFloat(formData.bonus_mortalita_percentuale) : null,
        bonus_incremento_attivo: formData.bonus_incremento_attivo || false,
        bonus_incremento_kg_soglia: formData.bonus_incremento_kg_soglia ? parseFloat(formData.bonus_incremento_kg_soglia) : null,
        bonus_incremento_percentuale: formData.bonus_incremento_percentuale ? parseFloat(formData.bonus_incremento_percentuale) : null,
      };

      if (contratto) {
        await amministrazioneService.updateContrattoSoccida(contratto.id, payload);
        alert('Contratto aggiornato con successo');
      } else {
        await amministrazioneService.createContrattoSoccida(payload);
        alert('Contratto creato con successo');
      }
      onClose();
    } catch (error) {

      alert(`Errore nel salvataggio del contratto: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({ ...formData, [field]: value });
  };

  const identifier = contratto && formData.numero_contratto ? `Contratto ${formData.numero_contratto}` : null;
  const headerActions = !isEditing && contratto ? (
              <>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => {
                    setIsEditing(true);
                    if (onEdit) {
                      onEdit();
                    }
                  }}
                >
                  Modifica
                </button>
                {contratto.attivo && (
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => {
                      if (onAssociaAnimali) {
                        onAssociaAnimali();
                      }
                    }}
                  >
                    Associa Partite
                  </button>
                )}
                {contratto.attivo && contratto.monetizzata && (
                  <button 
                    className="btn btn-primary" 
                    onClick={() => setShowAccontoModal(true)}
                  >
                    Registra Acconto
                  </button>
                )}
                <button
                  className="btn btn-danger" 
                  onClick={async () => {
                    if (onDelete) {
                      onDelete();
                    }
                  }}
                >
                  Elimina
                </button>
              </>
  ) : null;

  const footerActions = isEditing ? (
    <>
      <button type="button" className="btn btn-secondary" onClick={() => {
        setIsEditing(false);
        if (contratto) {
          // Ricarica i dati del contratto
          setFormData({
            numero_contratto: contratto.numero_contratto || '',
            azienda_id: contratto.azienda_id || aziendaId,
            soccidante_id: contratto.soccidante_id || '',
            data_inizio: contratto.data_inizio ? contratto.data_inizio.split('T')[0] : '',
            data_fine: contratto.data_fine ? contratto.data_fine.split('T')[0] : '',
            tipologia: contratto.tipologia || 'monetizzato',
            modalita_remunerazione: contratto.modalita_remunerazione || 'quota_giornaliera',
            specie_bestiame: contratto.specie_bestiame || 'bovino',
            numero_capi_previsti: contratto.numero_capi_previsti || '',
            direzione_tecnica_soccidante: contratto.direzione_tecnica_soccidante !== undefined ? contratto.direzione_tecnica_soccidante : true,
            monetizzata: contratto.monetizzata !== undefined ? contratto.monetizzata : true,
            quota_giornaliera: contratto.quota_giornaliera || '',
            prezzo_per_kg: contratto.prezzo_per_kg || '',
            percentuale_remunerazione: contratto.percentuale_remunerazione || '',
            percentuale_soccidante: contratto.percentuale_soccidante || '',
            percentuale_riparto_base: contratto.percentuale_riparto_base || '',
            mangimi_a_carico_soccidante: contratto.mangimi_a_carico_soccidante || false,
            medicinali_a_carico_soccidante: contratto.medicinali_a_carico_soccidante || false,
            quota_decesso_tipo: contratto.quota_decesso_tipo || '',
            quota_decesso_valore: contratto.quota_decesso_valore || '',
            termine_responsabilita_soccidario_giorni: contratto.termine_responsabilita_soccidario_giorni || '',
            copertura_totale_soccidante: contratto.copertura_totale_soccidante || false,
            franchigia_mortalita_giorni: contratto.franchigia_mortalita_giorni || '',
            percentuale_aggiunta_arrivo: contratto.percentuale_aggiunta_arrivo || '0',
            percentuale_sottrazione_uscita: contratto.percentuale_sottrazione_uscita || '0',
            tipo_allevamento: contratto.tipo_allevamento || '',
            prezzo_allevamento: contratto.prezzo_allevamento || '',
            bonus_mortalita_attivo: contratto.bonus_mortalita_attivo || false,
            bonus_mortalita_percentuale: contratto.bonus_mortalita_percentuale || '',
            bonus_incremento_attivo: contratto.bonus_incremento_attivo || false,
            bonus_incremento_kg_soglia: contratto.bonus_incremento_kg_soglia || '350',
            bonus_incremento_percentuale: contratto.bonus_incremento_percentuale || '1',
            traccia_iva_indetraibile: contratto.traccia_iva_indetraibile !== undefined ? contratto.traccia_iva_indetraibile : true,
            data_prima_consegna: contratto.data_prima_consegna ? contratto.data_prima_consegna.split('T')[0] : '',
            rinnovo_per_consegna: contratto.rinnovo_per_consegna !== undefined ? contratto.rinnovo_per_consegna : true,
            preavviso_disdetta_giorni: contratto.preavviso_disdetta_giorni || '90',
            giorni_gestione_previsti: contratto.giorni_gestione_previsti || '',
            note: contratto.note || '',
            condizioni_particolari: contratto.condizioni_particolari || '',
            attivo: contratto.attivo !== undefined ? contratto.attivo : true,
          });
        }
      }} disabled={loading}>
        Annulla
      </button>
      <button type="submit" form="contratto-soccida-form" className="btn btn-primary" disabled={loading}>
        {loading ? 'Salvataggio...' : 'Salva'}
      </button>
    </>
  ) : (
    <button type="button" className="btn btn-secondary" onClick={onClose}>
      Chiudi
    </button>
  );

  return (
    <>
    <BaseModal
      isOpen={true}
      onClose={onClose}
      headerActions={headerActions}
      footerActions={footerActions}
      size="xlarge"
      className="contratto-soccida-modal compact"
      tabs={
        <div className="base-modal-tabs">
          <button
            type="button"
            className={`tab ${activeTab === 'base' ? 'active' : ''}`}
            onClick={() => setActiveTab('base')}
          >
            Dati Base
          </button>
          <button
            type="button"
            className={`tab ${activeTab === 'remunerazione' ? 'active' : ''}`}
            onClick={() => setActiveTab('remunerazione')}
          >
            Remunerazione
          </button>
          <button
            type="button"
            className={`tab ${activeTab === 'gestione' ? 'active' : ''}`}
            onClick={() => setActiveTab('gestione')}
          >
            Gestione
          </button>
        </div>
      }
    >
        <form id="contratto-soccida-form" onSubmit={handleSubmit}>

            {/* Tab Dati Base */}
            {activeTab === 'base' && (
              <div className="tab-content">
                <div className="form-row">
                  <div className="form-group span-4">
                    <label>Numero Contratto</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={formData.numero_contratto}
                        onChange={handleChange('numero_contratto')}
                        placeholder="Opzionale"
                      />
                    ) : (
                      <span>{formData.numero_contratto || '—'}</span>
                    )}
                  </div>
                  <div className="form-group span-8">
                    <label>Soccidante *</label>
                    {isEditing ? (
                      <SmartSelect
                        options={soccidanti.map(s => ({ value: s.id, label: s.nome }))}
                        value={formData.soccidante_id}
                        onChange={(e) => setFormData({ ...formData, soccidante_id: parseInt(e.target.value) })}
                        placeholder="Seleziona soccidante..."
                        displayField="label"
                        valueField="value"
                        showSelectedInInput={true}
                      />
                    ) : (
                      <span>
                        {soccidanti.find(s => s.id === formData.soccidante_id)?.nome || '—'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group span-4">
                    <label>Data Inizio *</label>
                    {isEditing ? (
                      <input
                        type="date"
                        value={formData.data_inizio}
                        onChange={handleChange('data_inizio')}
                        required
                      />
                    ) : (
                      <span>{formData.data_inizio ? new Date(formData.data_inizio).toLocaleDateString('it-IT') : '—'}</span>
                    )}
                  </div>
                  <div className="form-group span-4">
                    <label>Data Fine</label>
                    {isEditing ? (
                      <input
                        type="date"
                        value={formData.data_fine}
                        onChange={handleChange('data_fine')}
                      />
                    ) : (
                      <span>{formData.data_fine ? new Date(formData.data_fine).toLocaleDateString('it-IT') : '—'}</span>
                    )}
                  </div>
                  <div className="form-group span-4">
                    <label>Specie Bestiame</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={formData.specie_bestiame}
                        onChange={handleChange('specie_bestiame')}
                      />
                    ) : (
                      <span>{formData.specie_bestiame || '—'}</span>
                    )}
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group span-6">
                    <label>Tipologia *</label>
                    {isEditing ? (
                      <SmartSelect
                        options={TIPOLOGIE}
                        value={formData.tipologia}
                        onChange={handleChange('tipologia')}
                        displayField="label"
                        valueField="value"
                        placeholder="Seleziona tipologia..."
                      />
                    ) : (
                      <span>{getTipologiaLabel(formData.tipologia)}</span>
                    )}
                  </div>
                  <div className="form-group span-6">
                    <label>Numero Capi Previsti</label>
                    {isEditing ? (
                      <input
                        type="number"
                        value={formData.numero_capi_previsti}
                        onChange={handleChange('numero_capi_previsti')}
                      />
                    ) : (
                      <span>{formData.numero_capi_previsti || '—'}</span>
                    )}
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group span-6">
                    <label>Tipo Allevamento</label>
                    {isEditing ? (
                      <SmartSelect
                        options={TIPO_ALLEVAMENTO}
                        value={formData.tipo_allevamento}
                        onChange={handleChange('tipo_allevamento')}
                        displayField="label"
                        valueField="value"
                        placeholder="Seleziona tipo allevamento..."
                        allowEmpty={false}
                      />
                    ) : (
                      <span>
                        {TIPO_ALLEVAMENTO.find(t => t.value === formData.tipo_allevamento)?.label || '—'}
                      </span>
                    )}
                  </div>
                  <div className="form-group span-6">
                    <label>Prezzo (€, esclusa IVA)</label>
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.01"
                        value={formData.prezzo_allevamento}
                        onChange={handleChange('prezzo_allevamento')}
                        placeholder="0.00"
                      />
                    ) : (
                      <span>
                        {formData.prezzo_allevamento ? `€${parseFloat(formData.prezzo_allevamento).toFixed(2)}` : '—'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group span-6">
                    <label>Contratto attivo</label>
                    {isEditing ? (
                      <button
                        type="button"
                        className={`toggle-button ${formData.attivo ? 'active' : ''}`}
                        onClick={() => setFormData({ ...formData, attivo: !formData.attivo })}
                        aria-label={formData.attivo ? 'Attivo' : 'Non Attivo'}
                      />
                    ) : (
                      <button
                        type="button"
                        className={`toggle-button ${formData.attivo ? 'active' : ''}`}
                        disabled
                        aria-label={formData.attivo ? 'Attivo' : 'Non Attivo'}
                      />
                    )}
                  </div>
                  <div className="form-group span-6">
                    <label>Soccida monetizzata</label>
                    {isEditing ? (
                      <button
                        type="button"
                        className={`toggle-button ${formData.monetizzata ? 'active' : ''}`}
                        onClick={() => setFormData({ ...formData, monetizzata: !formData.monetizzata })}
                        aria-label={formData.monetizzata ? 'Sì' : 'No'}
                      />
                    ) : (
                      <button
                        type="button"
                        className={`toggle-button ${formData.monetizzata ? 'active' : ''}`}
                        disabled
                        aria-label={formData.monetizzata ? 'Sì' : 'No'}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Tab Remunerazione */}
            {activeTab === 'remunerazione' && (
              <div className="tab-content">
                <div className="form-row">
                  <div className="form-group span-6">
                    <label>Modalità Remunerazione *</label>
                    {isEditing ? (
                      <SmartSelect
                        options={MODALITA_REMUNERAZIONE}
                        value={formData.modalita_remunerazione}
                        onChange={handleChange('modalita_remunerazione')}
                        displayField="label"
                        valueField="value"
                        placeholder="Seleziona modalità..."
                      />
                    ) : (
                      <span>{getModalitaLabel(formData.modalita_remunerazione)}</span>
                    )}
                  </div>
                </div>

                {formData.modalita_remunerazione === 'quota_giornaliera' && (
                  <div className="form-row">
                    <div className="form-group span-4">
                      <label>Quota Giornaliera (€) *</label>
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          value={formData.quota_giornaliera}
                          onChange={handleChange('quota_giornaliera')}
                          required
                        />
                      ) : (
                        <span>
                          {formData.quota_giornaliera ? `€${parseFloat(formData.quota_giornaliera).toFixed(2)}` : '—'}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {formData.modalita_remunerazione === 'prezzo_kg' && !formData.tipo_allevamento && (
                  <div className="form-row">
                    <div className="form-group span-4">
                      <label>Prezzo per Kg (€) *</label>
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          value={formData.prezzo_per_kg}
                          onChange={handleChange('prezzo_per_kg')}
                          required
                        />
                      ) : (
                        <span>
                          {formData.prezzo_per_kg ? `€${parseFloat(formData.prezzo_per_kg).toFixed(2)}` : '—'}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                
                {formData.modalita_remunerazione === 'prezzo_kg' && formData.tipo_allevamento && (
                  <div className="form-row">
                    <div className="form-group span-12">
                      <div className="info-box">
                        Il prezzo è già impostato nel campo "Prezzo" della sezione Dati Base
                      </div>
                    </div>
                  </div>
                )}

                {formData.modalita_remunerazione === 'percentuale' && (
                  <div className="form-row">
                    <div className="form-group span-4">
                      <label>Percentuale Remunerazione (%) *</label>
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          value={formData.percentuale_remunerazione}
                          onChange={handleChange('percentuale_remunerazione')}
                          required
                        />
                      ) : (
                        <span>
                          {formData.percentuale_remunerazione ? `${parseFloat(formData.percentuale_remunerazione).toFixed(2)}%` : '—'}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {formData.modalita_remunerazione === 'ripartizione_utili' && (
                  <div className="form-row">
                    <div className="form-group span-4">
                      <label>Percentuale Soccidante (%) *</label>
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          value={formData.percentuale_soccidante}
                          onChange={handleChange('percentuale_soccidante')}
                          required
                        />
                      ) : (
                        <span>
                          {formData.percentuale_soccidante ? `${parseFloat(formData.percentuale_soccidante).toFixed(2)}%` : '—'}
                        </span>
                      )}
                    </div>
                    <div className="form-group span-4">
                      <label>Percentuale Riparto Base (%)</label>
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          value={formData.percentuale_riparto_base}
                          onChange={handleChange('percentuale_riparto_base')}
                        />
                      ) : (
                        <span>
                          {formData.percentuale_riparto_base ? `${parseFloat(formData.percentuale_riparto_base).toFixed(2)}%` : '—'}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className="form-section">
                  <h3>Aggiunte/Sottrazioni (per calcolo kg netti)</h3>
                  <div className="form-row">
                    <div className="form-group span-4">
                      <label>% Aggiunta all'Arrivo</label>
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          value={formData.percentuale_aggiunta_arrivo}
                          onChange={handleChange('percentuale_aggiunta_arrivo')}
                        />
                      ) : (
                        <span>
                          {formData.percentuale_aggiunta_arrivo ? `${parseFloat(formData.percentuale_aggiunta_arrivo).toFixed(2)}%` : '—'}
                        </span>
                      )}
                    </div>
                    <div className="form-group span-4">
                      <label>% Sottrazione all'Uscita</label>
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          value={formData.percentuale_sottrazione_uscita}
                          onChange={handleChange('percentuale_sottrazione_uscita')}
                        />
                      ) : (
                        <span>
                          {formData.percentuale_sottrazione_uscita ? `${parseFloat(formData.percentuale_sottrazione_uscita).toFixed(2)}%` : '—'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab Gestione */}
            {activeTab === 'gestione' && (
              <div className="tab-content">
                {/* Gestione Costi */}
                <div className="form-section">
                  <h3>Gestione Costi</h3>
                  <div className="form-row">
                    <div className="form-group span-6">
                      <label>Mangimi a carico soccidante</label>
                      {isEditing ? (
                      <button
                        type="button"
                        className={`toggle-button ${formData.mangimi_a_carico_soccidante ? 'active' : ''}`}
                        onClick={() => setFormData({ ...formData, mangimi_a_carico_soccidante: !formData.mangimi_a_carico_soccidante })}
                        aria-label={formData.mangimi_a_carico_soccidante ? 'Sì' : 'No'}
                      />
                      ) : (
                        <button
                          type="button"
                          className={`toggle-button ${formData.mangimi_a_carico_soccidante ? 'active' : ''}`}
                          disabled
                          aria-label={formData.mangimi_a_carico_soccidante ? 'Sì' : 'No'}
                        />
                      )}
                    </div>
                    <div className="form-group span-6">
                      <label>Medicinali a carico soccidante</label>
                      {isEditing ? (
                      <button
                        type="button"
                        className={`toggle-button ${formData.medicinali_a_carico_soccidante ? 'active' : ''}`}
                        onClick={() => setFormData({ ...formData, medicinali_a_carico_soccidante: !formData.medicinali_a_carico_soccidante })}
                        aria-label={formData.medicinali_a_carico_soccidante ? 'Sì' : 'No'}
                      />
                      ) : (
                        <button
                          type="button"
                          className={`toggle-button ${formData.medicinali_a_carico_soccidante ? 'active' : ''}`}
                          disabled
                          aria-label={formData.medicinali_a_carico_soccidante ? 'Sì' : 'No'}
                        />
                      )}
                    </div>
                    <div className="form-group span-6">
                      <label>Direzione tecnica soccidante</label>
                      {isEditing ? (
                      <button
                        type="button"
                        className={`toggle-button ${formData.direzione_tecnica_soccidante ? 'active' : ''}`}
                        onClick={() => setFormData({ ...formData, direzione_tecnica_soccidante: !formData.direzione_tecnica_soccidante })}
                        aria-label={formData.direzione_tecnica_soccidante ? 'Sì' : 'No'}
                      />
                      ) : (
                        <button
                          type="button"
                          className={`toggle-button ${formData.direzione_tecnica_soccidante ? 'active' : ''}`}
                          disabled
                          aria-label={formData.direzione_tecnica_soccidante ? 'Sì' : 'No'}
                        />
                      )}
                    </div>
                    <div className="form-group span-6">
                      <label>Traccia IVA indetraibile</label>
                      {isEditing ? (
                      <button
                        type="button"
                        className={`toggle-button ${formData.traccia_iva_indetraibile ? 'active' : ''}`}
                        onClick={() => setFormData({ ...formData, traccia_iva_indetraibile: !formData.traccia_iva_indetraibile })}
                        aria-label={formData.traccia_iva_indetraibile ? 'Sì' : 'No'}
                      />
                      ) : (
                        <button
                          type="button"
                          className={`toggle-button ${formData.traccia_iva_indetraibile ? 'active' : ''}`}
                          disabled
                          aria-label={formData.traccia_iva_indetraibile ? 'Sì' : 'No'}
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Gestione Decessi */}
                <div className="form-section">
                  <h3>Gestione Decessi</h3>
                  <div className="form-row">
                    <div className="form-group span-6">
                      <label>Copertura totale soccidante</label>
                      {isEditing ? (
                      <button
                        type="button"
                        className={`toggle-button ${formData.copertura_totale_soccidante ? 'active' : ''}`}
                        onClick={() => setFormData({ ...formData, copertura_totale_soccidante: !formData.copertura_totale_soccidante })}
                        aria-label={formData.copertura_totale_soccidante ? 'Sì' : 'No'}
                      />
                      ) : (
                        <button
                          type="button"
                          className={`toggle-button ${formData.copertura_totale_soccidante ? 'active' : ''}`}
                          disabled
                          aria-label={formData.copertura_totale_soccidante ? 'Sì' : 'No'}
                        />
                      )}
                    </div>
                    <div className="form-group span-6">
                      <label>Tipo Quota Decesso</label>
                      {isEditing ? (
                        <SmartSelect
                          options={QUOTA_DECESSO_TIPI}
                          value={formData.quota_decesso_tipo || ''}
                          onChange={handleChange('quota_decesso_tipo')}
                          displayField="label"
                          valueField="value"
                          placeholder="Tipo quota decesso..."
                          disabled={!!formData.copertura_totale_soccidante}
                          allowEmpty={false}
                        />
                      ) : (
                        <span>
                          {QUOTA_DECESSO_TIPI.find(t => t.value === formData.quota_decesso_tipo)?.label || '—'}
                        </span>
                      )}
                    </div>
                  </div>

                  {!formData.copertura_totale_soccidante && formData.quota_decesso_tipo && (
                    <div className="form-row">
                      <div className="form-group span-4">
                        <label>Valore Quota Decesso</label>
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.01"
                            value={formData.quota_decesso_valore}
                            onChange={handleChange('quota_decesso_valore')}
                          />
                        ) : (
                          <span>{formData.quota_decesso_valore || '—'}</span>
                        )}
                      </div>
                      <div className="form-group span-4">
                        <label>Termine Responsabilità (giorni)</label>
                        {isEditing ? (
                          <input
                            type="number"
                            value={formData.termine_responsabilita_soccidario_giorni}
                            onChange={handleChange('termine_responsabilita_soccidario_giorni')}
                          />
                        ) : (
                          <span>{formData.termine_responsabilita_soccidario_giorni || '—'}</span>
                        )}
                      </div>
                      <div className="form-group span-4">
                        <label>Franchigia Mortalità (giorni)</label>
                        {isEditing ? (
                          <input
                            type="number"
                            value={formData.franchigia_mortalita_giorni}
                            onChange={handleChange('franchigia_mortalita_giorni')}
                          />
                        ) : (
                          <span>{formData.franchigia_mortalita_giorni || '—'}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Bonus Performance */}
                <div className="form-section">
                  <h3>Bonus Performance</h3>
                  
                  {/* Bonus Mortalità */}
                  <div className="form-row">
                    <div className="form-group span-6">
                      <label>Bonus mortalità attivo</label>
                      {isEditing ? (
                      <button
                        type="button"
                        className={`toggle-button ${formData.bonus_mortalita_attivo ? 'active' : ''}`}
                        onClick={() => setFormData({ ...formData, bonus_mortalita_attivo: !formData.bonus_mortalita_attivo })}
                        aria-label={formData.bonus_mortalita_attivo ? 'Sì' : 'No'}
                      />
                      ) : (
                        <button
                          type="button"
                          className={`toggle-button ${formData.bonus_mortalita_attivo ? 'active' : ''}`}
                          disabled
                          aria-label={formData.bonus_mortalita_attivo ? 'Sì' : 'No'}
                        />
                      )}
                    </div>
                  </div>
                  {formData.bonus_mortalita_attivo && (
                    <div className="form-row">
                      <div className="form-group span-6">
                        <label>Percentuale Bonus Mortalità (%)</label>
                        {isEditing ? (
                          <>
                            <input
                              type="number"
                              step="0.01"
                              value={formData.bonus_mortalita_percentuale}
                              onChange={handleChange('bonus_mortalita_percentuale')}
                              placeholder="2.00"
                            />
                            <span className="helper-text">
                              Percentuale di bonus applicata per mortalità zero
                            </span>
                          </>
                        ) : (
                          <span>{formData.bonus_mortalita_percentuale || '—'}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Bonus Incremento Peso */}
                  <div className={`form-row ${formData.bonus_mortalita_attivo ? 'form-row-spaced' : ''}`}>
                    <div className="form-group span-6">
                      <label>Bonus incremento peso attivo</label>
                      {isEditing ? (
                      <button
                        type="button"
                        className={`toggle-button ${formData.bonus_incremento_attivo ? 'active' : ''}`}
                        onClick={() => setFormData({ ...formData, bonus_incremento_attivo: !formData.bonus_incremento_attivo })}
                        aria-label={formData.bonus_incremento_attivo ? 'Sì' : 'No'}
                      />
                      ) : (
                        <button
                          type="button"
                          className={`toggle-button ${formData.bonus_incremento_attivo ? 'active' : ''}`}
                          disabled
                          aria-label={formData.bonus_incremento_attivo ? 'Sì' : 'No'}
                        />
                      )}
                    </div>
                  </div>
                  {formData.bonus_incremento_attivo && (
                    <div className="form-row">
                      <div className="form-group span-4">
                        <label>Soglia Incremento Peso (kg)</label>
                        {isEditing ? (
                          <>
                            <input
                              type="number"
                              step="0.01"
                              value={formData.bonus_incremento_kg_soglia}
                              onChange={handleChange('bonus_incremento_kg_soglia')}
                              placeholder="350"
                            />
                            <span className="helper-text">
                              Soglia di eccedenza per attivare il bonus
                            </span>
                          </>
                        ) : (
                          <span>{formData.bonus_incremento_kg_soglia || '—'}</span>
                        )}
                      </div>
                      <div className="form-group span-4">
                        <label>Percentuale Bonus Incremento (%)</label>
                        {isEditing ? (
                          <>
                            <input
                              type="number"
                              step="0.01"
                              value={formData.bonus_incremento_percentuale}
                              onChange={handleChange('bonus_incremento_percentuale')}
                              placeholder="1.00"
                            />
                            <span className="helper-text">
                              Percentuale di bonus applicata per eccedenza
                            </span>
                          </>
                        ) : (
                          <span>{formData.bonus_incremento_percentuale || '—'}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Durata e Rinnovo */}
                <div className="form-section">
                  <h3>Durata e Rinnovo</h3>
                  <div className="form-row">
                    <div className="form-group span-4">
                      <label>Rinnovo per consegna</label>
                      {isEditing ? (
                      <button
                        type="button"
                        className={`toggle-button ${formData.rinnovo_per_consegna ? 'active' : ''}`}
                        onClick={() => setFormData({ ...formData, rinnovo_per_consegna: !formData.rinnovo_per_consegna })}
                        aria-label={formData.rinnovo_per_consegna ? 'Sì' : 'No'}
                      />
                      ) : (
                        <button
                          type="button"
                          className={`toggle-button ${formData.rinnovo_per_consegna ? 'active' : ''}`}
                          disabled
                          aria-label={formData.rinnovo_per_consegna ? 'Sì' : 'No'}
                        />
                      )}
                    </div>
                    <div className="form-group span-4">
                      <label>Preavviso Disdetta (giorni)</label>
                      {isEditing ? (
                        <input
                          type="number"
                          value={formData.preavviso_disdetta_giorni}
                          onChange={handleChange('preavviso_disdetta_giorni')}
                          placeholder="90"
                        />
                      ) : (
                        <span>{formData.preavviso_disdetta_giorni || '—'}</span>
                      )}
                    </div>
                    <div className="form-group span-4">
                      <label>Giorni Gestione Previsti</label>
                      {isEditing ? (
                        <>
                          <input
                            type="number"
                            value={formData.giorni_gestione_previsti}
                            onChange={handleChange('giorni_gestione_previsti')}
                            placeholder="180"
                          />
                          <span className="helper-text">
                            Durata prevista dalla data di arrivo (es. 180, 150, 200...)
                          </span>
                        </>
                      ) : (
                        <span>{formData.giorni_gestione_previsti || '—'}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Note */}
                <div className="form-section">
                  <h3>Note</h3>
                  <div className="form-row">
                    <div className="form-group span-6">
                      <label>Note</label>
                      {isEditing ? (
                        <textarea
                          value={formData.note}
                          onChange={handleChange('note')}
                          rows={3}
                          placeholder="Note aggiuntive sul contratto..."
                        />
                      ) : (
                        <span style={{ whiteSpace: 'pre-wrap' }}>{formData.note || '—'}</span>
                      )}
                    </div>
                    <div className="form-group span-6">
                      <label>Condizioni Particolari</label>
                      {isEditing ? (
                        <textarea
                          value={formData.condizioni_particolari}
                          onChange={handleChange('condizioni_particolari')}
                          rows={3}
                          placeholder="Condizioni particolari del contratto..."
                        />
                      ) : (
                        <span style={{ whiteSpace: 'pre-wrap' }}>{formData.condizioni_particolari || '—'}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
        </form>
    </BaseModal>
    {showAccontoModal && (
      <RegistrazioneAccontoSoccidaModal
        isOpen={showAccontoModal}
        onClose={() => setShowAccontoModal(false)}
        contratto={contratto}
        onSuccess={() => {
          setShowAccontoModal(false);
          // Ricarica i dati del contratto se necessario
          if (contratto) {
            // Potresti voler ricaricare i dati del contratto qui
          }
        }}
      />
    )}
    </>
  );
};

export default ContrattoSoccidaModal;
