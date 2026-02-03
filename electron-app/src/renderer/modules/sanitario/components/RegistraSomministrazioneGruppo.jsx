/**
 * RegistraSomministrazioneGruppo - Form per registrare somministrazioni di gruppo
 * Permette di selezionare box/stabilimento/sede e gestire esclusioni animali
 */
import React, { useState, useEffect, useMemo } from 'react';
import { sanitarioService } from '../services/sanitarioService';
import { allevamentoService } from '../../allevamento/services/allevamentoService';
import SmartSelect from '../../../components/SmartSelect';
import { useAzienda } from '../../../context/AziendaContext';
import './RegistraSomministrazioneGruppo.css';
import '../../alimentazione/components/Alimentazione.css';

const RegistraSomministrazioneGruppo = React.forwardRef(({ isModal = false, onSuccess, onCancel }, ref) => {
  const { azienda } = useAzienda();
  const [loading, setLoading] = useState(false);
  const [loadingAnimali, setLoadingAnimali] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Dati form
  const [farmaci, setFarmaci] = useState([]);
  const [giacenze, setGiacenze] = useState([]);
  const [sedi, setSedi] = useState([]);
  const [stabilimenti, setStabilimenti] = useState([]);
  const [box, setBox] = useState([]);
  const [animaliCandidati, setAnimaliCandidati] = useState(null);
  
  const [formData, setFormData] = useState({
    target_tipo: 'sede',
    target_id: '',
    sede_id: '', // Per stabilimento e box
    stabilimento_id: '', // Per box
    farmaco_id: '',
    lotto_farmaco_id: '',
    quantita_totale: '',
    data_ora: new Date().toISOString().slice(0, 16),
    operatore_nome: '',
    veterinario: '',
    note: '',
    periodo_sospensione: ''
  });
  
  // Esclusioni
  const [partiteEscluse, setPartiteEscluse] = useState(new Set());
  const [animaliEsclusi, setAnimaliEsclusi] = useState(new Set());
  const [animaliReinclusi, setAnimaliReinclusi] = useState(new Set());
  
  useEffect(() => {
    loadFarmaci();
    if (azienda?.id) {
      loadSedi();
      loadGiacenze();
    }
  }, [azienda?.id]);
  
  // Carica stabilimenti quando cambia sede (per target tipo stabilimento o box)
  useEffect(() => {
    if ((formData.target_tipo === 'stabilimento' || formData.target_tipo === 'box') && formData.sede_id) {
      loadStabilimenti();
    } else if (formData.target_tipo === 'sede' && formData.target_id) {
      loadStabilimenti();
    } else if (formData.target_tipo === 'sede') {
      setStabilimenti([]);
      setBox([]);
    }
  }, [formData.sede_id, formData.target_tipo, formData.target_id]);
  
  // Carica box quando cambia stabilimento (per target tipo box)
  useEffect(() => {
    if (formData.target_tipo === 'box' && formData.stabilimento_id) {
      loadBox();
    } else if (formData.target_tipo === 'box') {
      setBox([]);
    }
  }, [formData.stabilimento_id, formData.target_tipo]);
  
  // Reset animali candidati quando cambia target
  useEffect(() => {
    setAnimaliCandidati(null);
    resetEsclusioni();
  }, [formData.target_tipo, formData.target_id]);
  
  useEffect(() => {
    if (formData.farmaco_id && azienda?.id) {
      loadGiacenze();
    }
  }, [formData.farmaco_id, azienda?.id]);
  
  const loadFarmaci = async () => {
    try {
      const data = await sanitarioService.getFarmaci();
      setFarmaci(data || []);
    } catch (err) {
      console.error('Errore caricamento farmaci:', err);
    }
  };
  
  const loadGiacenze = async () => {
    if (!azienda?.id) return;
    try {
      const response = await sanitarioService.getGiacenzeAzienda(azienda.id);
      const data = response.data || [];
      const disponibili = data.filter(l => parseFloat(l.quantita_rimanente) > 0);
      if (formData.farmaco_id) {
        setGiacenze(disponibili.filter(l => l.farmaco_id === parseInt(formData.farmaco_id)));
      } else {
        setGiacenze(disponibili);
      }
    } catch (err) {
      console.error('Errore caricamento giacenze:', err);
    }
  };
  
  const loadSedi = async () => {
    if (!azienda?.id) return;
    try {
      const data = await allevamentoService.getSedi(azienda.id);
      setSedi(data || []);
    } catch (err) {
      console.error('Errore caricamento sedi:', err);
    }
  };
  
  const loadStabilimenti = async () => {
    const sedeId = formData.target_tipo === 'sede' ? formData.target_id : formData.sede_id;
    if (!sedeId) return;
    try {
      const data = await allevamentoService.getStabilimenti(parseInt(sedeId));
      setStabilimenti(data || []);
    } catch (err) {
      console.error('Errore caricamento stabilimenti:', err);
    }
  };
  
  const loadBox = async () => {
    const stabilimentoId = formData.target_tipo === 'stabilimento' ? formData.target_id : formData.stabilimento_id;
    if (!stabilimentoId) return;
    try {
      const data = await allevamentoService.getBox(parseInt(stabilimentoId));
      setBox(data || []);
    } catch (err) {
      console.error('Errore caricamento box:', err);
    }
  };
  
  const loadAnimaliCandidati = async () => {
    if (!formData.target_id || !formData.target_tipo) {
      alert('Seleziona prima un target (sede, stabilimento o box)');
      return;
    }
    
    setLoadingAnimali(true);
    try {
      const dataRiferimento = formData.data_ora 
        ? new Date(formData.data_ora).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];
      
      const data = await sanitarioService.getAnimaliCandidatiSomministrazione(
        formData.target_tipo,
        parseInt(formData.target_id),
        dataRiferimento
      );
      setAnimaliCandidati(data);
      resetEsclusioni();
    } catch (err) {
      console.error('Errore caricamento animali candidati:', err);
      alert(`Errore: ${err.response?.data?.detail || err.message || 'Errore nel caricamento animali'}`);
    } finally {
      setLoadingAnimali(false);
    }
  };
  
  const resetEsclusioni = () => {
    setPartiteEscluse(new Set());
    setAnimaliEsclusi(new Set());
    setAnimaliReinclusi(new Set());
  };
  
  const handleTogglePartita = (partitaId) => {
    const newSet = new Set(partiteEscluse);
    if (newSet.has(partitaId)) {
      newSet.delete(partitaId);
      // Rimuovi anche dalla lista reinclusi gli animali di questa partita
      const partita = animaliCandidati?.partite?.find(p => p.partita_id === partitaId);
      if (partita) {
        const newReinclusi = new Set(animaliReinclusi);
        partita.animali.forEach(a => newReinclusi.delete(a.animale_id));
        setAnimaliReinclusi(newReinclusi);
      }
    } else {
      newSet.add(partitaId);
    }
    setPartiteEscluse(newSet);
  };
  
  const handleToggleAnimale = (animaleId) => {
    const newSet = new Set(animaliEsclusi);
    if (newSet.has(animaleId)) {
      newSet.delete(animaleId);
    } else {
      newSet.add(animaleId);
    }
    setAnimaliEsclusi(newSet);
  };
  
  const handleToggleReincludi = (animaleId) => {
    const newSet = new Set(animaliReinclusi);
    if (newSet.has(animaleId)) {
      newSet.delete(animaleId);
    } else {
      newSet.add(animaleId);
      // Se l'animale è reincluso, rimuovilo anche dagli esclusi espliciti
      const newEsclusi = new Set(animaliEsclusi);
      newEsclusi.delete(animaleId);
      setAnimaliEsclusi(newEsclusi);
    }
    setAnimaliReinclusi(newSet);
  };
  
  const isAnimaleIncluso = (animale) => {
    // Escluso esplicitamente (a meno che non sia reincluso)
    if (animaliEsclusi.has(animale.animale_id) && !animaliReinclusi.has(animale.animale_id)) {
      return false;
    }
    
    // Se la partita è esclusa
    if (animale.partita_ingresso_id && partiteEscluse.has(animale.partita_ingresso_id)) {
      // L'animale è incluso solo se è reincluso
      return animaliReinclusi.has(animale.animale_id);
    }
    
    // Se non ci sono esclusioni, l'animale è incluso
    return true;
  };
  
  const getAnimaliInclusi = () => {
    if (!animaliCandidati) return [];
    
    const inclusi = [];
    
    // Animali da partite
    animaliCandidati.partite?.forEach(partita => {
      partita.animali.forEach(animale => {
        if (isAnimaleIncluso(animale)) {
          inclusi.push(animale);
        }
      });
    });
    
    // Animali senza partita
    animaliCandidati.animali_senza_partita?.forEach(animale => {
      if (isAnimaleIncluso(animale)) {
        inclusi.push(animale);
      }
    });
    
    return inclusi;
  };
  
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    
    if (!formData.target_id || !formData.farmaco_id || !formData.quantita_totale) {
      alert('Compila tutti i campi obbligatori');
      return;
    }
    
    if (!animaliCandidati) {
      alert('Carica prima gli animali candidati');
      return;
    }
    
    const inclusi = getAnimaliInclusi();
    if (inclusi.length === 0) {
      alert('Nessun animale incluso. Seleziona almeno un animale da includere.');
      return;
    }
    
    if (formData.lotto_farmaco_id) {
      const lotto = giacenze.find(l => l.id === parseInt(formData.lotto_farmaco_id));
      if (lotto && parseFloat(lotto.quantita_rimanente) < parseFloat(formData.quantita_totale)) {
        alert('Quantità insufficiente nel lotto selezionato');
        return;
      }
    }
    
    setSaving(true);
    try {
      await sanitarioService.createSomministrazioniGruppo({
        target_tipo: formData.target_tipo,
        target_id: parseInt(formData.target_id),
        farmaco_id: parseInt(formData.farmaco_id),
        lotto_farmaco_id: formData.lotto_farmaco_id ? parseInt(formData.lotto_farmaco_id) : null,
        quantita_totale: parseFloat(formData.quantita_totale),
        data_ora: formData.data_ora ? new Date(formData.data_ora).toISOString() : new Date().toISOString(),
        operatore_nome: formData.operatore_nome || null,
        veterinario: formData.veterinario || null,
        note: formData.note || null,
        periodo_sospensione: formData.periodo_sospensione ? parseInt(formData.periodo_sospensione) : null,
        partite_escluse: Array.from(partiteEscluse),
        animali_esclusi: Array.from(animaliEsclusi),
        animali_reinclusi: Array.from(animaliReinclusi)
      });
      
      alert(`Somministrazioni create con successo per ${inclusi.length} animali!`);
      
      // Reset form
      setFormData({
        ...formData,
        farmaco_id: '',
        lotto_farmaco_id: '',
        quantita_totale: '',
        operatore_nome: '',
        veterinario: '',
        note: '',
        periodo_sospensione: ''
      });
      setAnimaliCandidati(null);
      resetEsclusioni();
      loadGiacenze();
      
      if (isModal && onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Errore creazione somministrazioni:', err);
      alert(`Errore: ${err.response?.data?.detail || err.message || 'Errore nella creazione delle somministrazioni'}`);
    } finally {
      setSaving(false);
    }
  };
  
  const targetTipoOptions = [
    { value: 'sede', label: 'Sede' },
    { value: 'stabilimento', label: 'Stabilimento' },
    { value: 'box', label: 'Box' }
  ];
  
  const sedeOptions = useMemo(() => 
    sedi.map(s => ({ value: String(s.id), label: `${s.nome} (${s.codice_stalla})` })),
    [sedi]
  );
  
  const stabilimentoOptions = useMemo(() => 
    stabilimenti.map(s => ({ value: String(s.id), label: s.nome })),
    [stabilimenti]
  );
  
  const boxOptions = useMemo(() => 
    box.map(b => ({ value: String(b.id), label: b.nome })),
    [box]
  );
  
  const animaliInclusi = getAnimaliInclusi();
  const quotaPerCapo = animaliInclusi.length > 0 && formData.quantita_totale
    ? (parseFloat(formData.quantita_totale) / animaliInclusi.length).toFixed(2)
    : '0.00';
  
  const selectedFarmaco = farmaci.find(f => f.id === parseInt(formData.farmaco_id));
  
  // Espone handleSubmit tramite ref se fornito
  React.useImperativeHandle(ref, () => ({
    submit: () => handleSubmit(null)
  }));

  return (
    <div className={isModal ? "" : "registra-somministrazione-gruppo"}>
      {!isModal && <h3>Somministrazione di Gruppo</h3>}
      
      <form onSubmit={handleSubmit} className="somministrazione-gruppo-form">
        <div className="form-grid">
            <div className="form-group span-6">
              <label>Tipo Target *</label>
              <SmartSelect
                options={targetTipoOptions}
                value={formData.target_tipo}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  target_tipo: e.target.value, 
                  target_id: '',
                  sede_id: '',
                  stabilimento_id: ''
                })}
                displayField="label"
                valueField="value"
                required
              />
            </div>
            {formData.target_tipo === 'sede' && (
              <div className="form-group span-6">
                <label>Sede *</label>
                <SmartSelect
                  options={sedeOptions}
                  value={formData.target_id}
                  onChange={(e) => setFormData({ ...formData, target_id: e.target.value })}
                  displayField="label"
                  valueField="value"
                  required
                  placeholder="Seleziona sede..."
                />
              </div>
            )}
            {formData.target_tipo === 'stabilimento' && (
              <>
                <div className="form-group span-6">
                  <label>Sede *</label>
                  <SmartSelect
                    options={sedeOptions}
                    value={formData.sede_id || ''}
                    onChange={(e) => {
                      setFormData({ ...formData, sede_id: e.target.value, target_id: '' });
                      loadStabilimenti();
                    }}
                    displayField="label"
                    valueField="value"
                    required
                    placeholder="Seleziona sede..."
                  />
                </div>
                {formData.sede_id && (
                  <div className="form-group span-6">
                    <label>Stabilimento *</label>
                    <SmartSelect
                      options={stabilimentoOptions}
                      value={formData.target_id}
                      onChange={(e) => setFormData({ ...formData, target_id: e.target.value })}
                      displayField="label"
                      valueField="value"
                      required
                      placeholder="Seleziona stabilimento..."
                    />
                  </div>
                )}
              </>
            )}
            {formData.target_tipo === 'box' && (
              <>
                <div className="form-group span-4">
                  <label>Sede *</label>
                  <SmartSelect
                    options={sedeOptions}
                    value={formData.sede_id || ''}
                    onChange={async (e) => {
                      setFormData({ ...formData, sede_id: e.target.value, stabilimento_id: '', target_id: '' });
                      if (e.target.value) {
                        // Carica stabilimenti quando si seleziona una sede per box
                        try {
                          const data = await allevamentoService.getStabilimenti(parseInt(e.target.value));
                          setStabilimenti(data || []);
                        } catch (err) {
                          console.error('Errore caricamento stabilimenti:', err);
                        }
                      } else {
                        setStabilimenti([]);
                        setBox([]);
                      }
                    }}
                    displayField="label"
                    valueField="value"
                    required
                    placeholder="Seleziona sede..."
                  />
                </div>
                {formData.sede_id && (
                  <div className="form-group span-4">
                    <label>Stabilimento *</label>
                    <SmartSelect
                      options={stabilimentoOptions}
                      value={formData.stabilimento_id || ''}
                      onChange={(e) => {
                        setFormData({ ...formData, stabilimento_id: e.target.value, target_id: '' });
                        loadBox();
                      }}
                      displayField="label"
                      valueField="value"
                      required
                      placeholder="Seleziona stabilimento..."
                    />
                  </div>
                )}
                {formData.stabilimento_id && (
                  <div className="form-group span-4">
                    <label>Box *</label>
                    <SmartSelect
                      options={boxOptions}
                      value={formData.target_id}
                      onChange={(e) => setFormData({ ...formData, target_id: e.target.value })}
                      displayField="label"
                      valueField="value"
                      required
                      placeholder="Seleziona box..."
                    />
                  </div>
                )}
              </>
            )}
          </div>
          {formData.target_id && (
            <div className="form-group">
              <button
                type="button"
                className="btn-secondary"
                onClick={loadAnimaliCandidati}
                disabled={loadingAnimali}
              >
                {loadingAnimali ? 'Caricamento...' : 'Carica Animali Candidati'}
              </button>
            </div>
          )}
        
        {animaliCandidati && (
          <>
            <div className="form-group">
              <label>Selezione Animali ({animaliCandidati.totale_animali} totali)</label>
              {animaliCandidati.totale_animali === 0 ? (
                <div className="empty-state">
                  <p>Nessun animale presente per il target selezionato alla data di riferimento.</p>
                </div>
              ) : (
                <>
                  <div className="animali-selection-info">
                    <div className="info-box">
                      <strong>Animali inclusi:</strong> {animaliInclusi.length}
                      {formData.quantita_totale && animaliInclusi.length > 0 && (
                        <span className="quota-info"> (Quota per capo: {quotaPerCapo} {selectedFarmaco?.unita_misura || ''})</span>
                      )}
                    </div>
                  </div>
                  
                  {/* Partite */}
                  {animaliCandidati.partite && animaliCandidati.partite.length > 0 && (
                    <div className="partite-container">
                      <h5>Animali per Partita di Ingresso</h5>
                      {animaliCandidati.partite.map(partita => {
                        const animaliInclusiPartita = partita.animali.filter(a => isAnimaleIncluso(a));
                        const partitaEsclusa = partiteEscluse.has(partita.partita_id);
                        
                        return (
                          <div key={partita.partita_id} className={`partita-card ${partitaEsclusa ? 'esclusa' : ''}`}>
                            <div className="partita-header">
                              <label className="checkbox-label partita-checkbox">
                                <input
                                  type="checkbox"
                                  checked={!partitaEsclusa}
                                  onChange={() => handleTogglePartita(partita.partita_id)}
                                />
                                <span className="partita-title">
                                  Partita {partita.numero_partita || `#${partita.partita_id}`}
                                  {partita.data && ` - ${new Date(partita.data).toLocaleDateString('it-IT')}`}
                                  <span className="partita-capi">({partita.numero_capi} capi)</span>
                                </span>
                              </label>
                              <span className={`partita-status ${partitaEsclusa ? 'esclusa' : 'inclusa'}`}>
                                {partitaEsclusa ? 'Esclusa' : `${animaliInclusiPartita.length}/${partita.animali.length} inclusi`}
                              </span>
                            </div>
                            
                            {!partitaEsclusa && (
                              <div className="animali-list">
                                {partita.animali.map(animale => {
                                  const incluso = isAnimaleIncluso(animale);
                                  const esclusoEsplicito = animaliEsclusi.has(animale.animale_id);
                                  
                                  return (
                                    <div key={animale.animale_id} className={`animale-item ${incluso ? '' : 'escluso'}`}>
                                      <label className="checkbox-label">
                                        <input
                                          type="checkbox"
                                          checked={incluso}
                                          onChange={() => handleToggleAnimale(animale.animale_id)}
                                        />
                                        <span>{animale.auricolare}</span>
                                        {animale.box_nome && <span className="box-badge">{animale.box_nome}</span>}
                                      </label>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            {partitaEsclusa && (
                              <div className="animali-list">
                                <div className="partita-esclusa-note">
                                  Partita esclusa. Seleziona gli animali da reincludere:
                                </div>
                                {partita.animali.map(animale => {
                                  const reincluso = animaliReinclusi.has(animale.animale_id);
                                  
                                  return (
                                    <div key={animale.animale_id} className={`animale-item ${reincluso ? 'reincluso' : 'escluso'}`}>
                                      <label className="checkbox-label">
                                        <input
                                          type="checkbox"
                                          checked={reincluso}
                                          onChange={() => handleToggleReincludi(animale.animale_id)}
                                        />
                                        <span>{animale.auricolare}</span>
                                        {animale.box_nome && <span className="box-badge">{animale.box_nome}</span>}
                                      </label>
                                      {reincluso && (
                                        <span className="reincluso-badge">Reincluso</span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {/* Animali senza partita */}
                  {animaliCandidati.animali_senza_partita && animaliCandidati.animali_senza_partita.length > 0 && (
                    <div className="partite-container">
                      <h5>Animali senza Partita ({animaliCandidati.animali_senza_partita.length})</h5>
                      <div className="animali-list">
                        {animaliCandidati.animali_senza_partita.map(animale => {
                          const incluso = isAnimaleIncluso(animale);
                          
                          return (
                            <div key={animale.animale_id} className={`animale-item ${incluso ? '' : 'escluso'}`}>
                              <label className="checkbox-label">
                                <input
                                  type="checkbox"
                                  checked={incluso}
                                  onChange={() => handleToggleAnimale(animale.animale_id)}
                                />
                                <span>{animale.auricolare}</span>
                                {animale.box_nome && <span className="box-badge">{animale.box_nome}</span>}
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
        
        <div className="form-grid">
            <div className="form-group span-6">
              <label>Farmaco *</label>
              <SmartSelect
                options={farmaci}
                value={formData.farmaco_id ? String(formData.farmaco_id) : ''}
                onChange={(e) => {
                  setFormData({ ...formData, farmaco_id: e.target.value, lotto_farmaco_id: '' });
                  loadGiacenze();
                }}
                placeholder="Cerca farmaco..."
                displayField="nome_commerciale"
                valueField="id"
                required
              />
            </div>
            {selectedFarmaco && (
              <div className="form-group span-6">
                <label>Unità di Misura</label>
                <input type="text" value={selectedFarmaco.unita_misura} readOnly className="readonly-input" />
              </div>
            )}
          </div>
          
          {giacenze.length > 0 && formData.farmaco_id && (
            <div className="form-group">
              <label>Lotto Farmaco (opzionale)</label>
              <SmartSelect
                options={giacenze
                  .filter(l => l.farmaco_id === parseInt(formData.farmaco_id))
                  .map(lotto => ({ 
                    ...lotto, 
                    displayName: `Lotto: ${lotto.lotto} - Qty: ${parseFloat(lotto.quantita_rimanente).toFixed(2)} ${selectedFarmaco?.unita_misura || ''}` 
                  }))}
                value={formData.lotto_farmaco_id ? String(formData.lotto_farmaco_id) : ''}
                onChange={(e) => setFormData({ ...formData, lotto_farmaco_id: e.target.value })}
                placeholder="Seleziona lotto (opzionale)..."
                displayField="displayName"
                valueField="id"
              />
            </div>
          )}
          
          <div className="form-grid">
            <div className="form-group span-6">
              <label>Quantità Totale * {selectedFarmaco && `(${selectedFarmaco.unita_misura})`}</label>
              <input
                type="number"
                step="0.01"
                value={formData.quantita_totale}
                onChange={(e) => setFormData({ ...formData, quantita_totale: e.target.value })}
                required
                placeholder={selectedFarmaco ? `In ${selectedFarmaco.unita_misura}` : ''}
              />
              {animaliInclusi.length > 0 && formData.quantita_totale && (
                <div className="quota-preview">
                  Quota per capo: <strong>{quotaPerCapo} {selectedFarmaco?.unita_misura || ''}</strong>
                </div>
              )}
            </div>
            <div className="form-group span-6">
              <label>Data e Ora *</label>
              <input
                type="datetime-local"
                value={formData.data_ora}
                onChange={(e) => setFormData({ ...formData, data_ora: e.target.value })}
                required
              />
            </div>
          </div>
        
        <div className="form-grid">
            <div className="form-group span-6">
              <label>Operatore</label>
              <input
                type="text"
                value={formData.operatore_nome}
                onChange={(e) => setFormData({ ...formData, operatore_nome: e.target.value })}
              />
            </div>
            <div className="form-group span-6">
              <label>Veterinario</label>
              <input
                type="text"
                value={formData.veterinario}
                onChange={(e) => setFormData({ ...formData, veterinario: e.target.value })}
              />
            </div>
          </div>
          <div className="form-grid">
            <div className="form-group span-6">
              <label>Periodo Sospensione (giorni)</label>
              <input
                type="number"
                value={formData.periodo_sospensione}
                onChange={(e) => setFormData({ ...formData, periodo_sospensione: e.target.value })}
                placeholder="Giorni di attesa prima macellazione"
              />
            </div>
          </div>
          <div className="form-group span-12">
            <label>Note</label>
            <textarea
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              rows="3"
            />
          </div>
        
        {!isModal && (
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={saving || !animaliCandidati || animaliInclusi.length === 0}>
              {saving ? 'Creazione...' : `Crea Somministrazioni (${animaliInclusi.length} animali)`}
            </button>
          </div>
        )}
      </form>
    </div>
  );
});

export default RegistraSomministrazioneGruppo;

