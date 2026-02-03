import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { terreniService } from '../services/terreniService';
import { alimentazioneService } from '../../alimentazione/services/alimentazioneService';
import SmartSelect from '../../../components/SmartSelect';
import { useAzienda } from '../../../context/AziendaContext';
import { useRequest } from '../../../context/RequestContext';
import '../../alimentazione/components/Alimentazione.css';
import { prefetchTerreni, getCachedTerreni } from '../prefetchers';
import CostiCicliPanel from './CostiCicliPanel';
import BaseModal from '../../../components/BaseModal';

const Terreni = () => {
  const [activeTab, setActiveTab] = useState('anagrafica');

  const [toast, setToast] = useState(null);
  function showToast(message, type = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  }

  // Anagrafica Terreni state
  const { azienda, loading: aziendaLoading } = useAzienda();
  const aziendaId = azienda?.id;
  const [terreni, setTerreni] = useState([]);
  const [loading, setLoading] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    azienda_id: '',
    denominazione: '',
    localita: '',
    superficie: '',
    unita_misura: 'ha',
    di_proprieta: true,
    in_affitto: false,
    canone_mensile: '',
    canone_annuale: '',
    note: ''
  });

  const affittoMode = useMemo(() => {
    if (form.di_proprieta && form.in_affitto) return 'affitto_out';
    if (!form.di_proprieta && form.in_affitto) return 'affitto_in';
    if (form.di_proprieta && !form.in_affitto) return 'uso_diretto';
    return 'altro';
  }, [form.di_proprieta, form.in_affitto]);

  const canoneFieldsDisabled = !(affittoMode === 'affitto_out' || affittoMode === 'affitto_in');
  const canoneLabel = affittoMode === 'affitto_out' ? 'Canone incassato' : 'Canone pagato';
  const canonePlaceholder =
    affittoMode === 'affitto_out'
      ? 'Importo che incassi dal conduttore'
      : affittoMode === 'affitto_in'
        ? 'Importo che paghi al proprietario'
        : 'Non applicabile per questo stato';
  const affittoMessage = useMemo(() => {
    switch (affittoMode) {
      case 'affitto_out':
        return {
          tone: '#2e7d32',
          text: 'Questo terreno è di tua proprietà ma lo hai dato in affitto: il canone registrato verrà conteggiato come ricavo.',
        };
      case 'affitto_in':
        return {
          tone: '#d32f2f',
          text: 'Questo terreno è in affitto: il canone registrato verrà conteggiato come costo.',
        };
      case 'uso_diretto':
        return {
          tone: '#455A64',
          text: 'Terreno di proprietà a uso diretto: non è previsto un canone periodico.',
        };
      default:
        return {
          tone: '#6D4C41',
          text: 'Gestione personalizzata (es. comodato gratuito). Il canone è opzionale e non incide automaticamente sui costi/ricavi.',
        };
    }
  }, [affittoMode]);

  const [selectedTerrenoId, setSelectedTerrenoId] = useState(null);
  const [lavorazioni, setLavorazioni] = useState([]);
  const [raccolti, setRaccolti] = useState([]);

  const [showLavModal, setShowLavModal] = useState(false);
  const [savingLav, setSavingLav] = useState(false);
  const [editingLavId, setEditingLavId] = useState(null);
  const [formLav, setFormLav] = useState({ terreno_id: '', data: '', tipo: '', fattura_id: '', costo_totale: '', note: '' });

  const [fatture, setFatture] = useState([]);
  const [fattureFilter, setFattureFilter] = useState('');

  const [showRacModal, setShowRacModal] = useState(false);
  const [savingRac, setSavingRac] = useState(false);
  const [editingRacId, setEditingRacId] = useState(null);
  const [formRac, setFormRac] = useState({ terreno_id: '', prodotto: '', data_inizio: '', data_fine: '', resa_quantita: '', unita_misura: 'q', destinazione: '', prezzo_vendita: '', note: '' });

  const [fatturaModal, setFatturaModal] = useState(null); // {id, numero, data, importo, note}
  const [fattureMap, setFattureMap] = useState({}); // id -> fattura

  // Riepilogo costi/ricavi
  const [riepilogo, setRiepilogo] = useState(null);
  const [loadingRiepilogo, setLoadingRiepilogo] = useState(false);
  const [selectedTerrenoRiepilogo, setSelectedTerrenoRiepilogo] = useState(null);
  
  // Salva l'ultimo terreno visualizzato per persistenza tra tab
  const getLastViewedTerrenoId = () => {
    try {
      const stored = localStorage.getItem('terreni_last_viewed_id');
      return stored ? Number(stored) : null;
    } catch {
      return null;
    }
  };
  
  const setLastViewedTerrenoId = (id) => {
    try {
      if (id) {
        localStorage.setItem('terreni_last_viewed_id', String(id));
      } else {
        localStorage.removeItem('terreni_last_viewed_id');
      }
    } catch {
      // Ignora errori di localStorage
    }
  };

  const normalizeTerreno = (t) => {
    const denominazione = t.denominazione || t.nome || '';
    const localita = t.localita || t.comune || '';
    return {
      ...t,
      denominazione,
      nome: t.nome || denominazione,
      localita,
      comune: t.comune || localita,
      di_proprieta: t.di_proprieta ?? true,
      in_affitto: t.in_affitto ?? false,
    };
  };

  const hydrateTerreni = useCallback(
    async ({ force = false, showErrors = true } = {}) => {
      if (!aziendaId) {
        setTerreni([]);
        setLoading(false);
        return null;
      }

      // Se i dati sono già nello state e non è forzato, non ricaricare
      if (!force && terreni.length > 0) {
        return null;
      }

      const cached = getCachedTerreni(aziendaId);
      if (!force && Array.isArray(cached)) {
        setTerreni(cached.map(normalizeTerreno));
        setLoading(false);
        return cached;
      } else if (force) {
        setLoading(true);
      } else if (!cached) {
        setLoading(true);
      }

      try {
        const data = await prefetchTerreni(aziendaId, { force });
        if (Array.isArray(data)) {
          const normalized = data.map(normalizeTerreno);
          setTerreni(normalized);
          return normalized;
        } else {
          setTerreni([]);
          return [];
        }
      } catch (e) {

        if (showErrors) {
          setToast({ message: 'Errore nel caricamento terreni', type: 'error' });
          setTimeout(() => setToast(null), 2500);
        }
        setTerreni([]);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [aziendaId, terreni.length],
  );

  useEffect(() => {
    if (aziendaId) {
      hydrateTerreni();
    } else {
      setTerreni([]);
    }
  }, [aziendaId, hydrateTerreni]);
  
  // Carica terreni quando cambia l'azienda anche nella tab costi-ricavi
  useEffect(() => {
    if (activeTab === 'costi-ricavi' && aziendaId) {
      hydrateTerreni();
    }
  }, [activeTab, aziendaId, hydrateTerreni]);

  // Seleziona automaticamente un terreno quando si passa alla tab costi-ricavi
  useEffect(() => {
    if (activeTab === 'costi-ricavi' && terreni.length > 0) {
      // Se non c'è selezione o il terreno selezionato non esiste più, seleziona uno
      const currentExists = selectedTerrenoRiepilogo && terreni.find(t => t.id === selectedTerrenoRiepilogo);
      if (!currentExists) {
        // Usa l'ultimo visualizzato o il primo disponibile
        const lastViewedId = getLastViewedTerrenoId();
        const terrenoToSelect = lastViewedId && terreni.find(t => t.id === lastViewedId)
          ? lastViewedId
          : terreni[0].id;
        setSelectedTerrenoRiepilogo(terrenoToSelect);
        loadRiepilogo(terrenoToSelect);
        setLastViewedTerrenoId(terrenoToSelect);
      }
    }
    // Per costi, la selezione viene gestita in CostiCicliPanel tramite props
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, terreni.length, terreni]);

  // Aggiorna l'ultimo terreno visualizzato quando cambia la selezione
  useEffect(() => {
    if (selectedTerrenoRiepilogo) {
      setLastViewedTerrenoId(selectedTerrenoRiepilogo);
    }
  }, [selectedTerrenoRiepilogo]);

  const formatDate = (d) => {
    if (!d) return '-';
    const dt = new Date(d);
    return isNaN(dt) ? d : dt.toLocaleDateString('it-IT');
  };

  const formatMoney = (v) => {
    if (v === null || v === undefined || v === '') return '-';
    const num = typeof v === 'number' ? v : parseFloat(v);
    if (isNaN(num)) return v;
    return num.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
  };

  async function loadDettagliTerreno(terrenoId) {
    try {
      const [lav, rac, fattAll] = await Promise.all([
        terreniService.getLavorazioni(terrenoId),
        terreniService.getRaccolti(terrenoId),
        alimentazioneService.getFatture(),
      ]);
      setLavorazioni(lav || []);
      setRaccolti(rac || []);
      const map = {};
      (fattAll || []).forEach(f => { map[f.id] = f; });
      setFattureMap(map);
    } catch (e) {

      showToast('Errore nel caricamento dettagli terreno', 'error');
    }
  }

  async function loadRiepilogo(terrenoId) {
    if (!terrenoId) return;
    setLoadingRiepilogo(true);
    try {
      const data = await terreniService.getRiepilogo(terrenoId);
      setRiepilogo(data);
    } catch (e) {

      showToast('Errore nel caricamento riepilogo', 'error');
    } finally {
      setLoadingRiepilogo(false);
    }
  }

  function openNew() {
    setEditingId(null);
    setForm({ azienda_id: aziendaId ? String(aziendaId) : '', denominazione: '', localita: '', superficie: '', unita_misura: 'ha', di_proprieta: true, in_affitto: false, canone_mensile: '', canone_annuale: '', note: '' });
    setShowModal(true);
  }

  function openEdit(t) {
    setEditingId(t.id);
    setForm({
      azienda_id: t.azienda_id ? String(t.azienda_id) : (aziendaId ? String(aziendaId) : ''),
      denominazione: t.denominazione || '',
      localita: t.localita || '',
      superficie: t.superficie ?? '',
      unita_misura: t.unita_misura || 'ha',
      di_proprieta: !!t.di_proprieta,
      in_affitto: !!t.in_affitto,
      canone_mensile: t.canone_mensile ?? '',
      canone_annuale: t.canone_annuale ?? '',
      note: t.note || '',
    });
    setShowModal(true);
  }

  const handleAffittoModeChange = useCallback((value) => {
    setForm(prev => {
      switch (value) {
        case 'affitto_out':
          return { ...prev, di_proprieta: true, in_affitto: true };
        case 'affitto_in':
          return { ...prev, di_proprieta: false, in_affitto: true };
        case 'uso_diretto':
          return { ...prev, di_proprieta: true, in_affitto: false, canone_mensile: '', canone_annuale: '' };
        default:
          return { ...prev, di_proprieta: false, in_affitto: false, canone_mensile: '', canone_annuale: '' };
      }
    });
  }, []);

  async function saveTerreno() {
    if (!aziendaId) {
      showToast('Configura l\'azienda prima di gestire i terreni', 'error');
      return;
    }
    setSaving(true);
    const payload = {
      ...form,
      azienda_id: form.azienda_id ? Number(form.azienda_id) : Number(aziendaId),
      nome: form.denominazione || form.nome || form.localita || '',
      comune: form.localita || form.comune || '',
      superficie: form.superficie === '' ? null : parseFloat(form.superficie),
      canone_mensile: form.canone_mensile === '' ? null : parseFloat(form.canone_mensile),
      canone_annuale: form.canone_annuale === '' ? null : parseFloat(form.canone_annuale),
    };
    try {
      if (editingId) {
        await terreniService.updateTerreno(editingId, payload);
        showToast('Terreno aggiornato');
      } else {
        await terreniService.createTerreno(payload);
        showToast('Terreno creato');
      }
      setShowModal(false);
      setEditingId(null);
      await hydrateTerreni({ force: true });
    } catch (e) {

      showToast('Errore salvataggio terreno', 'error');
    } finally {
      setSaving(false);
    }
  }

  function openNewLavorazione() {
    setEditingLavId(null);
    setFormLav({ terreno_id: selectedTerrenoId, data: '', tipo: '', fattura_id: '', costo_totale: '', note: '' });
    setFatture([]);
    setFattureFilter('');
    setShowLavModal(true);
    // carico fatture
    alimentazioneService.getFatture().then(setFatture).catch(() => showToast('Errore caricamento fatture', 'error'));
  }

  function openEditLavorazione(l) {
    setEditingLavId(l.id);
    setFormLav({ terreno_id: selectedTerrenoId, data: l.data || '', tipo: l.tipo || '', fattura_id: l.fattura_id ?? '', costo_totale: l.costo_totale ?? '', note: l.note || '' });
    setFatture([]);
    setFattureFilter('');
    setShowLavModal(true);
    alimentazioneService.getFatture().then(setFatture).catch(() => showToast('Errore caricamento fatture', 'error'));
  }

  async function saveLavorazione() {
    setSavingLav(true);
    const payload = {
      ...formLav,
      terreno_id: Number(selectedTerrenoId),
      fattura_id: formLav.fattura_id === '' ? null : Number(formLav.fattura_id),
      costo_totale: formLav.costo_totale === '' ? null : parseFloat(formLav.costo_totale),
      data: formLav.data || null,
    };
    try {
      if (editingLavId) {
        await terreniService.updateLavorazione(editingLavId, payload);
        showToast('Lavorazione aggiornata');
      } else {
        await terreniService.createLavorazione(payload);
        showToast('Lavorazione creata');
      }
      setShowLavModal(false);
      setEditingLavId(null);
      loadDettagliTerreno(selectedTerrenoId);
    } catch (e) {

      showToast('Errore salvataggio lavorazione', 'error');
    } finally {
      setSavingLav(false);
    }
  }

  function openNewRaccolto() {
    setEditingRacId(null);
    setFormRac({ terreno_id: selectedTerrenoId, prodotto: '', data_inizio: '', data_fine: '', resa_quantita: '', unita_misura: 'q', destinazione: '', prezzo_vendita: '', note: '' });
    setShowRacModal(true);
  }

  function openEditRaccolto(r) {
    setEditingRacId(r.id);
    setFormRac({ terreno_id: selectedTerrenoId, prodotto: r.prodotto || '', data_inizio: r.data_inizio || '', data_fine: r.data_fine || '', resa_quantita: r.resa_quantita ?? '', unita_misura: r.unita_misura || 'q', destinazione: r.destinazione || '', prezzo_vendita: r.prezzo_vendita ?? '', note: r.note || '' });
    setShowRacModal(true);
  }

  async function saveRaccolto() {
    setSavingRac(true);
    const payload = {
      ...formRac,
      terreno_id: Number(selectedTerrenoId),
      resa_quantita: formRac.resa_quantita === '' ? null : parseFloat(formRac.resa_quantita),
      prezzo_vendita: formRac.prezzo_vendita === '' ? null : parseFloat(formRac.prezzo_vendita),
      data_inizio: formRac.data_inizio || null,
      data_fine: formRac.data_fine || null,
    };
    try {
      if (editingRacId) {
        await terreniService.updateRaccolto(editingRacId, payload);
        showToast('Raccolto aggiornato');
      } else {
        await terreniService.createRaccolto(payload);
        showToast('Raccolto creato');
      }
      setShowRacModal(false);
      setEditingRacId(null);
      loadDettagliTerreno(selectedTerrenoId);
    } catch (e) {

      showToast('Errore salvataggio raccolto', 'error');
    } finally {
      setSavingRac(false);
    }
  }

  async function openFatturaDetails(id) {
    try {
      const data = await alimentazioneService.getFattura(id);
      setFatturaModal(data);
    } catch (e) {

      showToast('Impossibile caricare fattura', 'error');
    }
  }

  const fattureFiltered = fattureFilter
    ? (fatture || []).filter(f => {
        const term = fattureFilter.toLowerCase();
        const numero = (f.numero || '').toLowerCase();
        const dataStr = formatDate(f.data).toLowerCase();
        const importoStr = formatMoney(f.importo).toLowerCase();
        return numero.includes(term) || dataStr.includes(term) || importoStr.includes(term);
      })
    : (fatture || []);

  return (
    <div className="alimentazione-module">
      <div className="alimentazione-header">
        <h2>Modulo Terreni</h2>
      </div>

      <div className="alimentazione-tabs">
        {[
          { id: 'anagrafica', label: 'Anagrafica Terreni' },
          { id: 'costi-ricavi', label: 'Costi e Ricavi' },
          { id: 'costi', label: 'Costi e Cicli (Admin)' },
        ].map(tab => (
          <button key={tab.id} className={`tab-button ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>
        ))}
      </div>

      <div className="alimentazione-content">
        {activeTab === 'anagrafica' && (
          <div className="alimentazione-section">
            <div className="section-header" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <h3>Anagrafica Terreni</h3>
              <div style={{display:'flex', gap:12, alignItems:'center'}}>
                <button className="btn-primary" onClick={openNew} disabled={!aziendaId}>Nuovo Terreno</button>
              </div>
            </div>

            <section className="section-block">
              {loading ? (
                <div className="loading">Caricamento...</div>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Denominazione</th>
                        <th>Località</th>
                        <th>Superficie</th>
                        <th>Proprietà</th>
                        <th>Affitto</th>
                        <th>Canone</th>
                        <th>Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {terreni.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', color: '#6b7280' }}>
                            Nessun terreno registrato
                          </td>
                        </tr>
                      ) : (
                        terreni.map(t => (
                          <tr 
                            key={t.id}
                            onClick={() => openEdit(t)}
                            style={{ cursor: 'pointer' }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}
                          >
                            <td>{t.denominazione}</td>
                            <td>{t.localita || '-'}</td>
                            <td>{(t.superficie ?? '-') + ' ' + (t.unita_misura || '')}</td>
                            <td>{t.di_proprieta ? 'Sì' : 'No'}</td>
                            <td>{t.in_affitto ? 'Sì' : 'No'}</td>
                            <td>{t.canone_annuale ?? t.canone_mensile ?? '-'}</td>
                            <td>{t.note || '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {selectedTerrenoId && (
              <>
                <section className="section-block">
                  <div className="block-header">
                    <h4>Lavorazioni (terreno #{selectedTerrenoId})</h4>
                    <button className="btn-primary" onClick={openNewLavorazione}>Nuova Lavorazione</button>
                  </div>
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Data</th>
                          <th>Tipo</th>
                          <th>Fattura</th>
                          <th>Costo Totale</th>
                          <th>Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lavorazioni.map(l => (
                          <tr key={l.id}>
                            <td>{l.data || '-'}</td>
                            <td>{l.tipo || '-'}</td>
                            <td>{l.fattura_id ? (
                              <button className="btn-link" onClick={() => openFatturaDetails(l.fattura_id)} title="Dettaglio fattura">
                                {fattureMap[l.fattura_id]?.numero || l.fattura_id}
                              </button>
                            ) : '-'}</td>
                            <td>{formatMoney(l.costo_totale)}</td>
                            <td>{l.note || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="section-block">
                  <div className="block-header">
                    <h4>Raccolti (terreno #{selectedTerrenoId})</h4>
                    <button className="btn-primary" onClick={openNewRaccolto}>Nuovo Raccolto</button>
                  </div>
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Prodotto</th>
                          <th>Periodo</th>
                          <th>Resa</th>
                          <th>Destinazione</th>
                          <th>Prezzo/Vendita</th>
                          <th>Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {raccolti.map(r => (
                          <tr key={r.id}>
                            <td>{r.prodotto}</td>
                            <td>{formatDate(r.data_inizio) + ' → ' + formatDate(r.data_fine)}</td>
                            <td>{(r.resa_quantita ?? '-') + ' ' + (r.unita_misura || '')}</td>
                            <td>{r.destinazione || '-'}</td>
                            <td>{formatMoney(r.prezzo_vendita)}</td>
                            <td>{r.note || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}
          </div>
        )}

        {activeTab === 'costi-ricavi' && (
          <div className="alimentazione-section">
            <div className="section-header" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <h3>Costi e Ricavi per Terreno</h3>
              <div style={{display:'flex', gap:12, alignItems:'center'}}>
                <SmartSelect
                  options={terreni}
                  value={selectedTerrenoRiepilogo ? String(selectedTerrenoRiepilogo) : ''}
                  onChange={(e) => {
                    const terrenoId = e.target.value ? Number(e.target.value) : null;
                    if (terrenoId) {
                      setSelectedTerrenoRiepilogo(terrenoId);
                      loadRiepilogo(terrenoId);
                      setLastViewedTerrenoId(terrenoId);
                    } else if (terreni.length > 0) {
                      // Se viene deselezionato ma ci sono terreni, seleziona il primo
                      const firstTerrenoId = terreni[0].id;
                      setSelectedTerrenoRiepilogo(firstTerrenoId);
                      loadRiepilogo(firstTerrenoId);
                      setLastViewedTerrenoId(firstTerrenoId);
                    } else {
                      setSelectedTerrenoRiepilogo(null);
                      setRiepilogo(null);
                    }
                  }}
                  placeholder="Seleziona terreno..."
                  displayField="denominazione"
                  valueField="id"
                  showSelectedInInput={true}
                />
              </div>
            </div>

            <section className="section-block">
              {!selectedTerrenoRiepilogo ? (
                <p className="form-hint">Seleziona un terreno per visualizzare il riepilogo costi e ricavi.</p>
              ) : loadingRiepilogo ? (
                <div className="loading">Caricamento riepilogo...</div>
              ) : riepilogo ? (
                <>
                  <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '30px'}}>
                    <div style={{padding: '15px', backgroundColor: '#f0f0f0', borderRadius: '8px', textAlign: 'center'}}>
                      <div style={{fontSize: '0.9em', color: '#666', marginBottom: '5px'}}>Costi Totali</div>
                      <div style={{fontSize: '1.5em', fontWeight: 'bold', color: '#d32f2f'}}>
                        {formatMoney(riepilogo.costi_totali)}
                      </div>
                      <div style={{fontSize: '0.8em', color: '#999', marginTop: '5px'}}>
                        {riepilogo.numero_fatture_costi} fatture
                      </div>
                    </div>
                    <div style={{padding: '15px', backgroundColor: '#f0f0f0', borderRadius: '8px', textAlign: 'center'}}>
                      <div style={{fontSize: '0.9em', color: '#666', marginBottom: '5px'}}>Ricavi Totali</div>
                      <div style={{fontSize: '1.5em', fontWeight: 'bold', color: '#2e7d32'}}>
                        {formatMoney(riepilogo.ricavi_totali)}
                      </div>
                      <div style={{fontSize: '0.8em', color: '#999', marginTop: '5px'}}>
                        {riepilogo.numero_vendite} vendite
                      </div>
                    </div>
                    <div style={{padding: '15px', backgroundColor: '#f0f0f0', borderRadius: '8px', textAlign: 'center'}}>
                      <div style={{fontSize: '0.9em', color: '#666', marginBottom: '5px'}}>Margine</div>
                      <div style={{fontSize: '1.5em', fontWeight: 'bold', color: parseFloat(riepilogo.margine) >= 0 ? '#2e7d32' : '#d32f2f'}}>
                        {formatMoney(riepilogo.margine)}
                      </div>
                      <div style={{fontSize: '0.8em', color: '#999', marginTop: '5px'}}>
                        {parseFloat(riepilogo.margine) >= 0 ? 'Profitto' : 'Perdita'}
                      </div>
                    </div>
                    <div style={{padding: '15px', backgroundColor: '#f0f0f0', borderRadius: '8px', textAlign: 'center'}}>
                      <div style={{fontSize: '0.9em', color: '#666', marginBottom: '5px'}}>Prodotti</div>
                      <div style={{fontSize: '1.5em', fontWeight: 'bold'}}>
                        {riepilogo.prodotti_raccolti?.length || 0}
                      </div>
                      <div style={{fontSize: '0.8em', color: '#999', marginTop: '5px'}}>
                        tipologie
                      </div>
                    </div>
                  </div>

                  <h4 style={{marginTop: '30px', marginBottom: '15px'}}>Prodotti Raccolti</h4>
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Prodotto</th>
                          <th>Quantità Totale</th>
                          <th>Quantità Venduta</th>
                          <th>Quantità Disponibile</th>
                          <th>Prezzo Medio</th>
                          <th>Ricavi Totali</th>
                        </tr>
                      </thead>
                      <tbody>
                        {riepilogo.prodotti_raccolti && riepilogo.prodotti_raccolti.length > 0 ? (
                          riepilogo.prodotti_raccolti.map((p, idx) => (
                            <tr key={idx}>
                              <td>{p.prodotto}</td>
                              <td>{parseFloat(p.quantita_totale).toFixed(2)} {p.unita_misura}</td>
                              <td>{parseFloat(p.quantita_venduta).toFixed(2)} {p.unita_misura}</td>
                              <td>
                                <strong>{parseFloat(p.quantita_disponibile).toFixed(2)} {p.unita_misura}</strong>
                              </td>
                              <td>{p.prezzo_medio_vendita ? formatMoney(p.prezzo_medio_vendita) : '-'}</td>
                              <td>{formatMoney(p.ricavi_totali)}</td>
                            </tr>
                          ))
                        ) : (
                          <tr><td colSpan={6} style={{textAlign: 'center'}}>Nessun prodotto raccolto</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {riepilogo.prodotti_autoprodotti_disponibili && riepilogo.prodotti_autoprodotti_disponibili.length > 0 && (
                    <>
                      <h4 style={{marginTop: '30px', marginBottom: '15px'}}>Prodotti Autoprodotti Disponibili per Alimentazione</h4>
                      <div className="table-container">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Prodotto</th>
                              <th>Quantità Disponibile</th>
                              <th>Costo Unitario</th>
                              <th>Costo Totale</th>
                              <th>Note</th>
                            </tr>
                          </thead>
                          <tbody>
                            {riepilogo.prodotti_autoprodotti_disponibili.map((p, idx) => (
                              <tr key={idx}>
                                <td><strong>{p.prodotto}</strong></td>
                                <td>{p.quantita_disponibile.toFixed(2)} {p.unita_misura}</td>
                                <td>{formatMoney(p.costo_unitario)}</td>
                                <td>{formatMoney(p.costo_totale)}</td>
                                <td>
                                  <span style={{fontSize: '0.9em', color: '#666'}}>
                                    Disponibile per uso interno - Risparmio rispetto all'acquisto
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="form-hint" style={{marginTop: '15px'}}>
                        <strong>Nota:</strong> I prodotti autoprodotti disponibili possono essere utilizzati per l'alimentazione degli animali.
                        Il costo unitario è calcolato dividendo i costi totali del terreno per la quantità totale prodotta.
                        Questo permette di confrontare il costo dell'autoproduzione con il costo di acquisto dei mangimi.
                      </p>
                    </>
                  )}
                </>
              ) : (
                <p className="form-hint">Nessun dato disponibile per questo terreno.</p>
              )}
            </section>
          </div>
        )}

        {activeTab === 'costi' && (
          <CostiCicliPanel 
            terreni={terreni} 
            aziendaId={aziendaId} 
            showToast={showToast}
            initialSelectedTerrenoId={getLastViewedTerrenoId()}
            onTerrenoChange={setLastViewedTerrenoId}
          />
        )}
      </div>

      <BaseModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingId(null);
        }}
        title={editingId ? 'Modifica Terreno' : 'Nuovo Terreno'}
        size="medium"
        headerActions={
          editingId ? (
            <>
              <button
                className="btn btn-danger"
                onClick={async () => {
                  if (confirm('Eliminare il terreno?')) {
                    await terreniService.deleteTerreno(editingId);
                    await hydrateTerreni({ force: true });
                    showToast('Terreno eliminato');
                    setShowModal(false);
                    setEditingId(null);
                  }
                }}
              >
                Elimina
              </button>
            </>
          ) : null
        }
        footerActions={
          <>
            <button className="btn btn-secondary" onClick={() => {
              setShowModal(false);
              setEditingId(null);
            }}>
              Annulla
            </button>
            <button className="btn btn-primary" onClick={saveTerreno} disabled={saving}>
              {saving ? 'Salvataggio...' : 'Salva'}
            </button>
          </>
        }
      >
        <div className="form-row">
          <div className="form-group span-12">
            <label>Denominazione *</label>
            <input value={form.denominazione} onChange={e => setForm({ ...form, denominazione: e.target.value })} required />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group span-6">
            <label>Località</label>
            <input value={form.localita} onChange={e => setForm({ ...form, localita: e.target.value })} />
          </div>
          <div className="form-group span-4">
            <label>Superficie</label>
            <input value={form.superficie} onChange={e => setForm({ ...form, superficie: e.target.value })} />
          </div>
          <div className="form-group span-2">
            <label>Unità</label>
            <input value={form.unita_misura} onChange={e => setForm({ ...form, unita_misura: e.target.value })} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group span-12">
            <label>Tipologia di gestione</label>
            <SmartSelect
              options={[
                { value: 'uso_diretto', label: 'Di proprietà · uso diretto' },
                { value: 'affitto_out', label: 'Di proprietà · dato in affitto a terzi' },
                { value: 'affitto_in', label: 'In affitto da terzi (pago un canone)' },
                { value: 'altro', label: 'Altro (es. comodato gratuito)' }
              ]}
              value={affittoMode}
              onChange={(e) => handleAffittoModeChange(e.target.value)}
              displayField="label"
              valueField="value"
            />
            <small className="form-hint">La scelta imposta in automatico proprietà e affitto per il terreno e permette di classificare correttamente canoni, costi e ricavi.</small>
          </div>
        </div>
        <div
          style={{
            marginBottom: '18px',
            padding: '12px 14px',
            borderRadius: '8px',
            border: `1px solid ${affittoMessage.tone}33`,
            backgroundColor: `${affittoMessage.tone}0d`,
            color: affittoMessage.tone,
            fontSize: '0.95em',
            lineHeight: 1.4,
          }}
        >
          <strong>Effetto contabile:</strong> {affittoMessage.text}
        </div>
        <div className="form-row">
          <div className="form-group span-6">
            <label>{canoneLabel} mensile</label>
            <input
              value={form.canone_mensile}
              onChange={e => setForm({ ...form, canone_mensile: e.target.value })}
              placeholder={canonePlaceholder}
              disabled={canoneFieldsDisabled}
              style={canoneFieldsDisabled ? { backgroundColor: '#f5f7fa', color: '#94a3b8' } : undefined}
            />
          </div>
          <div className="form-group span-6">
            <label>{canoneLabel} annuale</label>
            <input
              value={form.canone_annuale}
              onChange={e => setForm({ ...form, canone_annuale: e.target.value })}
              placeholder={canonePlaceholder}
              disabled={canoneFieldsDisabled}
              style={canoneFieldsDisabled ? { backgroundColor: '#f5f7fa', color: '#94a3b8' } : undefined}
            />
          </div>
        </div>
        {canoneFieldsDisabled ? (
          <p className="form-hint">Il canone è disattivato per questa tipologia di gestione.</p>
        ) : (
          <p className="form-hint">
            Inserisci l&apos;importo del canone periodico. Verrà riportato automaticamente tra i{' '}
            {affittoMode === 'affitto_out' ? 'ricavi' : 'costi'} del terreno.
          </p>
        )}
        <div className="form-row">
          <div className="form-group span-12">
            <label>Note</label>
            <input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
          </div>
        </div>
      </BaseModal>

      {showLavModal && (
        <div className="modal-overlay" onClick={() => setShowLavModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingLavId ? 'Modifica Lavorazione' : 'Nuova Lavorazione'}</h3>
              <button className="close-btn" onClick={() => setShowLavModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label>Data</label>
                  <input type="date" value={formLav.data} onChange={e => setFormLav({ ...formLav, data: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Tipo</label>
                  <input value={formLav.tipo} onChange={e => setFormLav({ ...formLav, tipo: e.target.value })} placeholder="aratura, semina, trinciatura..." />
                </div>
              </div>
              <div className="form-group">
                <label>Fattura</label>
                <input placeholder="Cerca (numero, data, importo)" value={fattureFilter} onChange={e => setFattureFilter(e.target.value)} />
                <SmartSelect
                  options={[
                    { value: '', label: '(nessuna)' },
                    ...fattureFiltered.map(f => ({
                      value: String(f.id),
                      label: `${f.numero || 'S/N'} - ${formatDate(f.data)} - ${formatMoney(f.importo)}`
                    }))
                  ]}
                  value={formLav.fattura_id ? String(formLav.fattura_id) : ''}
                  onChange={(e) => setFormLav({ ...formLav, fattura_id: e.target.value })}
                  displayField="label"
                  valueField="value"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Costo totale</label>
                  <input value={formLav.costo_totale} onChange={e => setFormLav({ ...formLav, costo_totale: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Note</label>
                  <input value={formLav.note} onChange={e => setFormLav({ ...formLav, note: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowLavModal(false)}>Annulla</button>
              <button className="btn-primary" onClick={saveLavorazione} disabled={savingLav}>{savingLav ? 'Salvataggio...' : 'Salva'}</button>
            </div>
          </div>
        </div>
      )}

      {showRacModal && (
        <div className="modal-overlay" onClick={() => setShowRacModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingRacId ? 'Modifica Raccolto' : 'Nuovo Raccolto'}</h3>
              <button className="close-btn" onClick={() => setShowRacModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Prodotto *</label>
                <input value={formRac.prodotto} onChange={e => setFormRac({ ...formRac, prodotto: e.target.value })} required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Inizio</label>
                  <input type="date" value={formRac.data_inizio} onChange={e => setFormRac({ ...formRac, data_inizio: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Fine</label>
                  <input type="date" value={formRac.data_fine} onChange={e => setFormRac({ ...formRac, data_fine: e.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Resa</label>
                  <input value={formRac.resa_quantita} onChange={e => setFormRac({ ...formRac, resa_quantita: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Unità</label>
                  <input value={formRac.unita_misura} onChange={e => setFormRac({ ...formRac, unita_misura: e.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Destinazione</label>
                  <input value={formRac.destinazione} onChange={e => setFormRac({ ...formRac, destinazione: e.target.value })} placeholder="venduto/autoconsumo" />
                </div>
                <div className="form-group">
                  <label>Prezzo vendita</label>
                  <input value={formRac.prezzo_vendita} onChange={e => setFormRac({ ...formRac, prezzo_vendita: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label>Note</label>
                <input value={formRac.note} onChange={e => setFormRac({ ...formRac, note: e.target.value })} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowRacModal(false)}>Annulla</button>
              <button className="btn-primary" onClick={saveRaccolto} disabled={savingRac}>{savingRac ? 'Salvataggio...' : 'Salva'}</button>
            </div>
          </div>
        </div>
      )}

      {fatturaModal && (
        <div className="modal-overlay" onClick={() => setFatturaModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Dettaglio Fattura</h3>
              <button className="close-btn" onClick={() => setFatturaModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <p><strong>Numero:</strong> {fatturaModal.numero}</p>
              <p><strong>Data:</strong> {formatDate(fatturaModal.data)}</p>
              <p><strong>Importo:</strong> {formatMoney(fatturaModal.importo)}</p>
              <p><strong>Note:</strong> {fatturaModal.note || '-'}</p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setFatturaModal(null)}>Chiudi</button>
              <button className="btn-primary" onClick={() => { window.location.hash = `#/amministrazione?tab=fatture&id=${fatturaModal.id}`; }}>Apri in Amministrazione</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>{toast.message}</div>
      )}
    </div>
  );
};

export default Terreni;
