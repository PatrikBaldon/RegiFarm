/**
 * RegistraAlimentazioneGruppo - Form per registrare alimentazione di gruppo
 * Permette di selezionare box/stabilimento/sede e distribuire automaticamente
 */
import React, { useState, useEffect, useCallback } from 'react';
import { alimentazioneService } from '../services/alimentazioneService';
import { allevamentoService } from '../../allevamento/services/allevamentoService';
import { useAzienda } from '../../../context/AziendaContext';
import SearchableSelect from '../../../components/SearchableSelect';
import SimpleSelect from '../../../components/SimpleSelect';
import SmartSelect from '../../../components/SmartSelect';
import './RegistraAlimentazione.css';
import '../components/Alimentazione.css';

const todayIso = new Date().toISOString().slice(0, 10);

const targetOptions = [
  { value: 'box', label: 'Box specifico' },
  { value: 'stabilimento', label: 'Stabilimento' },
  { value: 'sede', label: 'Sede' },
];

const tipoAlimentoOptions = [
  { value: 'piano', label: 'Piano alimentare' },
  { value: 'singolo', label: 'Alimento singolo' },
];

const singoloTipoOptions = [
  { value: 'componente', label: 'Componente alimentare' },
  { value: 'mangime', label: 'Mangime confezionato' },
];

const RegistraAlimentazioneGruppo = React.forwardRef(({ isModal = false, onSuccess, onCancel, onPreviewChange, onStateChange }, ref) => {
  const { azienda } = useAzienda();
  const [piani, setPiani] = useState([]);
  const [componenti, setComponenti] = useState([]);
  const [mangimi, setMangimi] = useState([]);
  const [sedi, setSedi] = useState([]);
  const [stabilimenti, setStabilimenti] = useState([]);
  const [box, setBox] = useState([]);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stockWarning, setStockWarning] = useState(null);

  const [formData, setFormData] = useState({
    data: todayIso,
    tipo_alimento: 'piano',
    piano_id: '',
    singolo_tipo: 'componente',
    componente_id: '',
    mangime_id: '',
    quantita_totale: '',
    target_tipo: 'box',
    sede_id: '',
    stabilimento_id: '',
    target_id: '',
    giorni_min: '',
    giorni_max: '',
    note: ''
  });

  const loadPiani = useCallback(async () => {
    try {
      const data = await alimentazioneService.getPiani();
      setPiani(data || []);
    } catch (err) {
      console.error('Errore caricamento piani:', err);
    }
  }, []);

  const loadComponenti = useCallback(async () => {
    try {
      const data = await alimentazioneService.getComponenti();
      setComponenti(data || []);
    } catch (err) {
      console.error('Errore caricamento componenti:', err);
    }
  }, []);

  const loadMangimi = useCallback(async () => {
    try {
      const data = await alimentazioneService.getMangimi();
      setMangimi(data || []);
    } catch (err) {
      console.error('Errore caricamento mangimi:', err);
    }
  }, []);

  const loadSedi = useCallback(async () => {
    if (!azienda?.id) return;
    try {
      const data = await allevamentoService.getSedi(azienda.id);
      setSedi(data || []);
    } catch (err) {
      console.error('Errore caricamento sedi:', err);
    }
  }, [azienda?.id]);

  const loadStabilimenti = useCallback(async () => {
    const sedeId = formData.target_tipo === 'sede' ? formData.target_id : formData.sede_id;
    if (!sedeId) return;
    try {
      const data = await allevamentoService.getStabilimenti(parseInt(sedeId));
      setStabilimenti(data || []);
    } catch (err) {
      console.error('Errore caricamento stabilimenti:', err);
    }
  }, [formData.target_tipo, formData.target_id, formData.sede_id]);

  const loadBox = useCallback(async () => {
    const stabilimentoId = formData.target_tipo === 'stabilimento' ? formData.target_id : formData.stabilimento_id;
    if (!stabilimentoId) return;
    try {
      const data = await allevamentoService.getBox(parseInt(stabilimentoId));
      setBox(data || []);
    } catch (err) {
      console.error('Errore caricamento box:', err);
    }
  }, [formData.target_tipo, formData.target_id, formData.stabilimento_id]);

  useEffect(() => {
    loadPiani();
    loadComponenti();
    loadMangimi();
    if (azienda?.id) {
      loadSedi();
    }
  }, [azienda?.id, loadPiani, loadComponenti, loadMangimi, loadSedi]);

  // Carica stabilimenti quando cambia sede
  useEffect(() => {
    if ((formData.target_tipo === 'stabilimento' || formData.target_tipo === 'box') && formData.sede_id) {
      loadStabilimenti();
    } else if (formData.target_tipo === 'sede' && formData.target_id) {
      loadStabilimenti();
    } else if (formData.target_tipo === 'sede') {
      setStabilimenti([]);
      setBox([]);
    }
  }, [formData.sede_id, formData.target_tipo, formData.target_id, loadStabilimenti]);

  // Carica box quando cambia stabilimento
  useEffect(() => {
    if (formData.target_tipo === 'box' && formData.stabilimento_id) {
      loadBox();
    } else if (formData.target_tipo === 'box') {
      setBox([]);
    }
  }, [formData.stabilimento_id, formData.target_tipo, loadBox]);

  const validateForm = () => {
    if (!formData.data) {
      return 'La data è obbligatoria';
    }
    if (!formData.quantita_totale || Number(formData.quantita_totale) <= 0) {
      return 'Inserisci una quantità valida';
    }
    if (!formData.target_id) {
      return 'Seleziona il target della distribuzione';
    }
    if (formData.tipo_alimento === 'piano' && !formData.piano_id) {
      return 'Seleziona un piano alimentare';
    }
    if (formData.tipo_alimento === 'singolo') {
      if (formData.singolo_tipo === 'componente' && !formData.componente_id) {
        return 'Seleziona il componente alimentare';
      }
      if (formData.singolo_tipo === 'mangime' && !formData.mangime_id) {
        return 'Seleziona il mangime confezionato';
      }
    }
    return null;
  };

  const buildPayload = () => {
    const error = validateForm();
    if (error) {
      throw new Error(error);
    }
    const targetId = parseInt(formData.target_id, 10);
    const payload = {
      data: formData.data,
      quantita_totale: Number(formData.quantita_totale),
      target_tipo: formData.target_tipo,
      target_id: targetId,
      tipo_alimento: formData.tipo_alimento,
      razione_id: formData.tipo_alimento === 'piano' ? parseInt(formData.piano_id, 10) : null,
      componente_alimentare_id:
        formData.tipo_alimento === 'singolo' && formData.singolo_tipo === 'componente' && formData.componente_id
          ? parseInt(formData.componente_id, 10)
          : null,
      mangime_confezionato_id:
        formData.tipo_alimento === 'singolo' && formData.singolo_tipo === 'mangime' && formData.mangime_id
          ? parseInt(formData.mangime_id, 10)
          : null,
      giorni_permanenza_min: formData.giorni_min ? parseInt(formData.giorni_min, 10) : null,
      giorni_permanenza_max: formData.giorni_max ? parseInt(formData.giorni_max, 10) : null,
      note: formData.note || null,
    };
    return payload;
  };

  const handlePreview = async () => {
    try {
      const payload = buildPayload();
      setPreviewLoading(true);
      if (onStateChange) onStateChange({ previewLoading: true });
      const response = await alimentazioneService.previewVoceRegistro(payload);
      setPreview(response);
      setStockWarning(response?.stock_warning || null);
      if (onPreviewChange) onPreviewChange(response);
    } catch (error) {
      const message = error?.response?.detail || error.message || 'Errore nel calcolo dell\'anteprima';
      alert(message);
      if (onPreviewChange) onPreviewChange(null);
    } finally {
      setPreviewLoading(false);
      if (onStateChange) onStateChange({ previewLoading: false });
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    
    if (!preview) {
      alert('Calcola prima l\'anteprima per verificare la distribuzione');
      return;
    }

    try {
      const payload = buildPayload();
      setSaving(true);
      if (onStateChange) onStateChange({ saving: true });
      const response = await alimentazioneService.createVoceRegistro(payload);
      alert('Alimentazione registrata con successo!');
      if (response?.stock_warning) {
        alert(response.stock_warning);
      }
      
      // Reset form
      setFormData({
        data: todayIso,
        tipo_alimento: 'piano',
        piano_id: '',
        singolo_tipo: 'componente',
        componente_id: '',
        mangime_id: '',
        quantita_totale: '',
        target_tipo: 'box',
        sede_id: '',
        stabilimento_id: '',
        target_id: '',
        giorni_min: '',
        giorni_max: '',
        note: ''
      });
      setPreview(null);
      setStockWarning(null);
      if (onPreviewChange) onPreviewChange(null);
      
      if (isModal && onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Errore registrazione alimentazione:', err);
      const message = err?.response?.data?.detail || err.message || 'Errore nella registrazione';
      alert(`Errore: ${message}`);
    } finally {
      setSaving(false);
      if (onStateChange) onStateChange({ saving: false });
    }
  };

  const handleTargetTipoChange = (value) => {
    setFormData({
      ...formData,
      target_tipo: value,
      sede_id: '',
      stabilimento_id: '',
      target_id: '',
    });
    setStabilimenti([]);
    setBox([]);
    setPreview(null);
  };

  const handleSedeChange = async (value) => {
    setFormData({
      ...formData,
      sede_id: value,
      stabilimento_id: '',
      target_id: value && formData.target_tipo === 'sede' ? value : '',
    });
    setPreview(null);
    setStockWarning(null);
    setStabilimenti([]);
    setBox([]);
    if (!value) return;
    try {
      const stabData = await allevamentoService.getStabilimenti(value);
      setStabilimenti(stabData || []);
    } catch (error) {
      console.error('Errore caricamento stabilimenti:', error);
    }
  };

  const handleStabilimentoChange = async (value) => {
    setFormData({
      ...formData,
      stabilimento_id: value,
      target_id: value && formData.target_tipo === 'stabilimento' ? value : '',
    });
    setPreview(null);
    setStockWarning(null);
    setBox([]);
    if (!value) return;
    try {
      const boxData = await allevamentoService.getBox(value);
      setBox(boxData || []);
    } catch (error) {
      console.error('Errore caricamento box:', error);
    }
  };

  const handleBoxChange = (value) => {
    setFormData({ ...formData, target_id: value });
    setPreview(null);
    setStockWarning(null);
  };

  const formatDecimal = (value, decimals = 2) => {
    if (value === null || value === undefined) return '-';
    return Number(value).toFixed(decimals);
  };

  // Espone handleSubmit, handlePreview e stati tramite ref se fornito
  React.useImperativeHandle(ref, () => ({
    submit: () => handleSubmit(null),
    preview: () => handlePreview(),
    getPreview: () => preview,
    getPreviewLoading: () => previewLoading,
    getSaving: () => saving
  }));

  return (
    <div className={isModal ? "" : "registra-alimentazione-gruppo"}>
      {!isModal && <h3>Alimentazione di Gruppo</h3>}
      
      <form onSubmit={handleSubmit} className="alimentazione-gruppo-form">
        <div className="form-grid">
          <div className="form-group span-4">
            <label>Data *</label>
            <input
              type="date"
              value={formData.data}
              onChange={(e) => {
                setFormData({ ...formData, data: e.target.value });
                setPreview(null);
              }}
              required
            />
          </div>
          <div className="form-group span-4">
            <label>Quantità totale *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.quantita_totale}
              onChange={(e) => {
                setFormData({ ...formData, quantita_totale: e.target.value });
                setPreview(null);
              }}
              placeholder="Es. 150"
              required
            />
          </div>
          <div className="form-group span-4">
            <label>Tipo alimento *</label>
            <SmartSelect
              className="select-compact"
              options={tipoAlimentoOptions}
              value={formData.tipo_alimento}
              onChange={(e) => {
                const value = e.target.value;
                setFormData({
                  ...formData,
                  tipo_alimento: value,
                  piano_id: '',
                  componente_id: '',
                  mangime_id: '',
                });
                setPreview(null);
              }}
              displayField="label"
              valueField="value"
              placeholder="Seleziona tipologia"
            />
          </div>
        </div>

        {formData.tipo_alimento === 'piano' ? (
          piani.length > 0 && (
            <div className="form-group span-12">
              <label>Piano alimentare *</label>
              <SearchableSelect
                options={piani.map((piano) => ({ value: piano.id, label: piano.nome }))}
                value={formData.piano_id}
                onChange={(event) => {
                  setFormData({ ...formData, piano_id: event.target.value });
                  setPreview(null);
                }}
                placeholder="Seleziona piano..."
              />
            </div>
          )
        ) : (
          <div className="form-grid">
            <div className="form-group span-6">
              <label>Tipo alimento singolo</label>
              <SmartSelect
                className="select-compact"
                options={singoloTipoOptions}
                value={formData.singolo_tipo}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData({
                    ...formData,
                    singolo_tipo: value,
                    componente_id: '',
                    mangime_id: '',
                  });
                  setPreview(null);
                }}
                displayField="label"
                valueField="value"
                placeholder="Seleziona tipologia"
              />
            </div>
            <div className="form-group span-6">
              {formData.singolo_tipo === 'componente' ? (
                componenti.length > 0 && (
                  <>
                    <label>Componente *</label>
                    <SearchableSelect
                      options={componenti.map((comp) => ({ value: comp.id, label: comp.nome }))}
                      value={formData.componente_id}
                      onChange={(event) => {
                        setFormData({ ...formData, componente_id: event.target.value });
                        setPreview(null);
                      }}
                      placeholder="Seleziona componente..."
                    />
                  </>
                )
              ) : (
                mangimi.length > 0 && (
                  <>
                    <label>Mangime *</label>
                    <SimpleSelect
                      options={mangimi.map((item) => ({ value: item.id, label: item.nome }))}
                      value={formData.mangime_id}
                      onChange={(event) => {
                        setFormData({ ...formData, mangime_id: event.target.value });
                        setPreview(null);
                      }}
                      placeholder="Seleziona mangime..."
                      displayField="label"
                      valueField="value"
                      required
                    />
                  </>
                )
              )}
            </div>
          </div>
        )}

        <div className="form-grid">
          <div className="form-group span-6">
            <label>Distribuzione *</label>
            <SmartSelect
              className="select-compact"
              options={targetOptions}
              value={formData.target_tipo}
              onChange={(e) => handleTargetTipoChange(e.target.value)}
              displayField="label"
              valueField="value"
              placeholder="Seleziona destinazione"
            />
          </div>
          {sedi.length > 0 && (
            <div className="form-group span-6">
              <label>Sede</label>
              <SmartSelect
                options={sedi.map((sede) => ({ value: sede.id, label: sede.nome }))}
                value={formData.sede_id}
                onChange={(event) => handleSedeChange(event.target.value)}
                placeholder="Seleziona sede..."
                displayField="label"
                valueField="value"
              />
            </div>
          )}
        </div>

        {(formData.target_tipo === 'stabilimento' || formData.target_tipo === 'box') && stabilimenti.length > 0 && (
          <div className="form-grid">
            <div className="form-group span-6">
              <label>Stabilimento</label>
              <SmartSelect
                options={stabilimenti.map((stab) => ({ value: stab.id, label: stab.nome }))}
                value={formData.stabilimento_id}
                onChange={(event) => handleStabilimentoChange(event.target.value)}
                placeholder="Seleziona stabilimento..."
                displayField="label"
                valueField="value"
              />
            </div>
            {formData.target_tipo === 'box' ? (
              box.length > 0 && (
                <div className="form-group span-6">
                  <label>Box</label>
                  <SmartSelect
                    options={box.map((b) => ({ value: b.id, label: b.nome }))}
                    value={formData.target_id}
                    onChange={(event) => handleBoxChange(event.target.value)}
                    placeholder="Seleziona box..."
                    displayField="label"
                    valueField="value"
                  />
                </div>
              )
            ) : (
              <div className="form-group span-6" style={{ visibility: 'hidden' }}>
                <label>Box</label>
                <div style={{ minHeight: '36px' }}></div>
              </div>
            )}
          </div>
        )}

        <div className="form-grid">
          <div className="form-group span-6">
            <label>Escludi capi presenti da meno di (giorni)</label>
            <input
              type="number"
              min="0"
              value={formData.giorni_min}
              onChange={(e) => {
                setFormData({ ...formData, giorni_min: e.target.value });
                setPreview(null);
              }}
              placeholder="Es. 15"
            />
          </div>
          <div className="form-group span-6">
            <label>Includi solo capi presenti da massimo (giorni)</label>
            <input
              type="number"
              min="0"
              value={formData.giorni_max}
              onChange={(e) => {
                setFormData({ ...formData, giorni_max: e.target.value });
                setPreview(null);
              }}
              placeholder="Es. 30"
            />
          </div>
        </div>

        <div className="form-group span-12">
          <label>Note</label>
          <textarea
            value={formData.note}
            onChange={(e) => setFormData({ ...formData, note: e.target.value })}
            placeholder="Annotazioni facoltative"
            rows="3"
          />
        </div>

        {stockWarning && (
          <div className="alert warning" style={{ marginTop: '16px' }}>
            {stockWarning}
          </div>
        )}

        {preview && (
          <div className="preview-panel">
            <h4>Anteprima distribuzione</h4>
            <p>
              Capi coinvolti: <strong>{preview.numero_capi}</strong> — Quota per capo:{' '}
              <strong>{formatDecimal(preview.quota_per_capo, 4)}</strong>
            </p>
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
                {preview.dettagli.map((dettaglio, idx) => (
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
        )}

        {!isModal && (
          <div className="form-actions">
            <button 
              type="button" 
              className="btn-secondary" 
              onClick={handlePreview} 
              disabled={previewLoading}
            >
              {previewLoading ? 'Calcolo...' : 'Calcola anteprima'}
            </button>
            <button 
              type="submit" 
              className="btn-primary" 
              disabled={saving || !preview}
            >
              {saving ? 'Salvataggio...' : 'Registra'}
            </button>
          </div>
        )}
        
        {/* Quando in modal mode, mostra un hint per calcolare l'anteprima */}
        {isModal && !preview && (
          <div className="info-text" style={{ marginTop: '16px', padding: '12px', background: '#eff6ff', borderRadius: '6px' }}>
            💡 Compila tutti i campi e clicca "Calcola anteprima" per vedere la distribuzione prima di salvare.
          </div>
        )}
      </form>
    </div>
  );
});

export default RegistraAlimentazioneGruppo;

