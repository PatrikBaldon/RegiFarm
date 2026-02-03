/**
 * GestioneFornitori - Gestione fornitori per mangimi, lavorazione terreni, spese mediche
 */
import React, { useState, useEffect, useMemo, useCallback, useDeferredValue } from 'react';
import { amministrazioneService } from '../services/amministrazioneService';
import api from '../../../services/api';
import SmartSelect from '../../../components/SmartSelect';
import BaseModal from '../../../components/BaseModal';
import '../../alimentazione/components/Alimentazione.css';
import '../../allevamento/components/AnimaleDetail.css';
import './GestioneFornitori.css';
import { getCachedFornitori, setCachedFornitori } from '../prefetchers';
import { useAzienda } from '../../../context/AziendaContext';
import { useRequest } from '../../../context/RequestContext';

const MACROCATEGORIE_OPTIONS = [
  { value: 'nessuna', label: 'Nessuna' },
  { value: 'alimento', label: 'Alimento' },
  { value: 'terreno', label: 'Terreno' },
  { value: 'attrezzatura', label: 'Attrezzatura' },
  { value: 'sanitario', label: 'Sanitario' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'personale', label: 'Personale' },
  { value: 'servizi', label: 'Servizi' },
  { value: 'assicurazioni', label: 'Assicurazioni' },
  { value: 'finanziario', label: 'Finanziario' },
  { value: 'amministrativo', label: 'Amministrativo' },
];

const FORNITORI_PER_PAGINA = 10;

const GestioneFornitori = () => {
  const { azienda } = useAzienda();
  const [fornitori, setFornitori] = useState([]);
  const [fornitoriTipi, setFornitoriTipi] = useState([]);
  const [rows, setRows] = useState([]);
  const [filterText, setFilterText] = useState('');
  const [filterTipo, setFilterTipo] = useState('tutti'); // 'tutti', 'fornitore', 'cliente', 'entrambi'
  const deferredFilterText = useDeferredValue(filterText);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalFornitori, setTotalFornitori] = useState(0);
  const [showFornitoreModal, setShowFornitoreModal] = useState(false);
  const [fornitoreModalData, setFornitoreModalData] = useState(null);
  const [fornitoreModalLoading, setFornitoreModalLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [fornitoreForm, setFornitoreForm] = useState({
    nome: '',
    partita_iva: '',
    indirizzo: '',
    indirizzo_cap: '',
    indirizzo_comune: '',
    indirizzo_provincia: '',
    indirizzo_nazione: '',
    telefono: '',
    fax: '',
    email: '',
    pec: '',
    regime_fiscale: '',
    rea_ufficio: '',
    rea_numero: '',
    rea_capitale_sociale: '',
    note: '',
    categoria: '',
    macrocategoria: '',
    categoria_note: '',
    is_fornitore: true,
    is_cliente: false,
  });

  const fetchFornitoriData = useCallback(
    async ({ force = false, showErrors = true } = {}) => {
      // Se i dati sono già nello state e non è forzato, non ricaricare
      if (!force && fornitori.length > 0) {
        return null;
      }

      if (!force) {
        const cached = getCachedFornitori();
        if (cached) {
          applyFornitoriPayload(cached);
          setLoading(false);
          return cached;
        }
      }

      setLoading(true);
      try {
        const [fornitoriData, tipiData] = await Promise.all([
          amministrazioneService.getFornitori({ skip: 0, limit: 10000 }),
          amministrazioneService.getFornitoriTipi(null, null, { force }),
        ]);

        const payload = {
          fornitori: Array.isArray(fornitoriData) ? fornitoriData : [],
          tipi: Array.isArray(tipiData) ? tipiData : [],
        };

        applyFornitoriPayload(payload);
        setCachedFornitori(payload);
        return payload;
      } catch (error) {
        // Per errori 503, gestisci silenziosamente
        if (error?.status === 503 || error?.isServiceUnavailable) {
          // Prova a usare i dati cached
          const cached = getCachedFornitori();
          if (cached) {
            applyFornitoriPayload(cached);
            return cached;
          }
          // Se non ci sono dati cached, mostra lista vuota
          applyFornitoriPayload({ fornitori: [], tipi: [] });
          return null;
        }

        if (showErrors) {
          alert('Errore nel caricamento dei dati');
        }
        // In caso di errore, mostra lista vuota
        applyFornitoriPayload({ fornitori: [], tipi: [] });
        return null;
      } finally {
        setLoading(false);
      }
    },
    [applyFornitoriPayload, fornitori.length],
  );

  useEffect(() => {
    fetchFornitoriData();
  }, [fetchFornitoriData]);
  
  // Reset alla prima pagina quando cambiano i filtri
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [filterText, filterTipo]);

  // Sincronizza selectedRow con rows quando rows cambia (es. dopo il salvataggio)
  useEffect(() => {
    if (showFornitoreModal && selectedRow?.id && rows.length > 0) {
      const updatedRowInRows = rows.find(r => r.id === selectedRow.id);
      if (updatedRowInRows && (
        updatedRowInRows.macrocategoria !== selectedRow.macrocategoria ||
        updatedRowInRows.tipoId !== selectedRow.tipoId ||
        updatedRowInRows.tipoNote !== selectedRow.tipoNote
      )) {
        // I rows sono stati aggiornati, sincronizza selectedRow e fornitoreForm
        setSelectedRow(updatedRowInRows);
        setFornitoreForm(prev => ({
          ...prev,
          macrocategoria: updatedRowInRows.macrocategoria || 'nessuna',
          categoria_note: updatedRowInRows.tipoNote || '',
        }));
      }
    }
  }, [rows, showFornitoreModal, selectedRow?.id]);


  const buildRows = useCallback((fornitoriData, tipiData) => {
    const tipiMap = new Map(tipiData.map((tipo) => [tipo.fornitore_id, tipo]));
    const combined = fornitoriData
      .map((fornitore) => {
        const tipo = tipiMap.get(fornitore.id);
        const searchable = [
          fornitore.nome,
          fornitore.partita_iva,
          fornitore.indirizzo,
          fornitore.indirizzo_cap,
          fornitore.indirizzo_comune,
          fornitore.indirizzo_provincia,
          fornitore.indirizzo_nazione,
          fornitore.telefono,
          fornitore.email,
          fornitore.pec,
          tipo?.macrocategoria,
          tipo?.note,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return {
          ...fornitore,
          tipoId: tipo?.id || null,
          macrocategoria: tipo?.macrocategoria || 'nessuna',
          tipoNote: tipo?.note || '',
          searchIndex: searchable,
        };
      })
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'it', { sensitivity: 'base' }));
    setRows(combined);
  }, []);

  const applyFornitoriPayload = useCallback(
    (payload = {}) => {
      const fornitoriArray = Array.isArray(payload.fornitori) ? payload.fornitori : [];
      const tipiArray = Array.isArray(payload.tipi) ? payload.tipi : [];
      setFornitori(fornitoriArray);
      setFornitoriTipi(tipiArray);
      setTotalFornitori(fornitoriArray.length);
      buildRows(fornitoriArray, tipiArray);
    },
    [buildRows],
  );

  const openFornitoreModal = async (row = null) => {
    setShowFornitoreModal(true);
    setFornitoreModalLoading(true);
    setIsEditing(false);
    setFornitoreModalData(null);
    setSelectedRow(row);
    
    if (row) {
      // Carica dati completi del fornitore
      try {
        const response = await api.get(`/amministrazione/fornitori/${row.id}`);

        
        // La risposta potrebbe essere response.data o direttamente response
        const fornitoreData = response.data || response;
        
        // Verifica che i dati siano validi
        if (!fornitoreData || typeof fornitoreData !== 'object') {
          throw new Error('Dati fornitore non validi');
        }
        
        setFornitoreModalData(fornitoreData);
        setFornitoreForm({
          nome: fornitoreData.nome || row.nome || '',
          partita_iva: fornitoreData.partita_iva || '',
          indirizzo: fornitoreData.indirizzo || '',
          indirizzo_cap: fornitoreData.indirizzo_cap || '',
          indirizzo_comune: fornitoreData.indirizzo_comune || '',
          indirizzo_provincia: fornitoreData.indirizzo_provincia || '',
          indirizzo_nazione: fornitoreData.indirizzo_nazione || 'IT',
          telefono: fornitoreData.telefono || '',
          fax: fornitoreData.fax || '',
          email: fornitoreData.email || '',
          pec: fornitoreData.pec || '',
          regime_fiscale: fornitoreData.regime_fiscale || '',
          rea_ufficio: fornitoreData.rea_ufficio || '',
          rea_numero: fornitoreData.rea_numero || '',
          rea_capitale_sociale: fornitoreData.rea_capitale_sociale || '',
          note: fornitoreData.note || '',
          categoria: '', // Non più usata, mantenuta per retrocompatibilità
          macrocategoria: row.macrocategoria || '',
          categoria_note: row.tipoNote || '',
          is_fornitore: fornitoreData.is_fornitore !== undefined ? fornitoreData.is_fornitore : (row.is_fornitore !== undefined ? row.is_fornitore : true),
          is_cliente: fornitoreData.is_cliente !== undefined ? fornitoreData.is_cliente : (row.is_cliente !== undefined ? row.is_cliente : false),
        });
      } catch (error) {


        alert(`Errore nel caricamento dei dettagli del fornitore: ${error.message || 'Errore sconosciuto'}`);
        setShowFornitoreModal(false);
        setFornitoreModalLoading(false);
        return;
      }
    } else {
      // Nuovo
      setFornitoreForm({
        nome: '',
        partita_iva: '',
        indirizzo: '',
        indirizzo_cap: '',
        indirizzo_comune: '',
        indirizzo_provincia: '',
        indirizzo_nazione: 'IT',
        telefono: '',
        fax: '',
        email: '',
        pec: '',
        regime_fiscale: '',
        rea_ufficio: '',
        rea_numero: '',
        rea_capitale_sociale: '',
        note: '',
        categoria: '',
        macrocategoria: '',
        categoria_note: '',
        is_fornitore: true,
        is_cliente: false,
      });
      setIsEditing(true);
    }
    setFornitoreModalLoading(false);
  };

  const handleStartEdit = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    // Se si sta creando un nuovo fornitore (fornitoreModalData è null), chiudi direttamente la modale
    if (!fornitoreModalData) {
      setShowFornitoreModal(false);
      setFornitoreModalData(null);
      setIsEditing(false);
      setSelectedRow(null);
      return;
    }
    
    // Se si sta modificando un fornitore esistente, ripristina i dati originali
    setFornitoreForm({
      nome: fornitoreModalData.nome || selectedRow?.nome || '',
      partita_iva: fornitoreModalData.partita_iva || '',
      indirizzo: fornitoreModalData.indirizzo || '',
      indirizzo_cap: fornitoreModalData.indirizzo_cap || '',
      indirizzo_comune: fornitoreModalData.indirizzo_comune || '',
      indirizzo_provincia: fornitoreModalData.indirizzo_provincia || '',
      indirizzo_nazione: fornitoreModalData.indirizzo_nazione || 'IT',
      telefono: fornitoreModalData.telefono || '',
      fax: fornitoreModalData.fax || '',
      email: fornitoreModalData.email || '',
      pec: fornitoreModalData.pec || '',
      regime_fiscale: fornitoreModalData.regime_fiscale || '',
      rea_ufficio: fornitoreModalData.rea_ufficio || '',
      rea_numero: fornitoreModalData.rea_numero || '',
      rea_capitale_sociale: fornitoreModalData.rea_capitale_sociale || '',
      note: fornitoreModalData.note || '',
      categoria: selectedRow?.categoria || '',
      macrocategoria: selectedRow?.macrocategoria || '',
      categoria_note: selectedRow?.tipoNote || '',
      is_fornitore: fornitoreModalData.is_fornitore !== undefined ? fornitoreModalData.is_fornitore : (selectedRow?.is_fornitore !== undefined ? selectedRow.is_fornitore : true),
      is_cliente: fornitoreModalData.is_cliente !== undefined ? fornitoreModalData.is_cliente : (selectedRow?.is_cliente !== undefined ? selectedRow.is_cliente : false),
    });
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (!fornitoreModalData || !confirm(`Eliminare definitivamente il fornitore "${fornitoreModalData.nome}"?`)) return;
    try {
      await api.delete(`/amministrazione/fornitori/${fornitoreModalData.id}`);
      setShowFornitoreModal(false);
      setFornitoreModalData(null);
      await fetchFornitoriData({ force: true });
    } catch (error) {

      alert('Impossibile eliminare il fornitore');
    }
  };

  const handleSaveFornitore = async () => {
    const payload = Object.fromEntries(
      Object.entries(fornitoreForm).map(([key, value]) => [key, value === '' ? null : value])
    );

    if (payload.indirizzo_provincia) {
      payload.indirizzo_provincia = payload.indirizzo_provincia.toUpperCase();
    }
    if (payload.indirizzo_nazione) {
      payload.indirizzo_nazione = payload.indirizzo_nazione.toUpperCase();
    }

    // Aggiungi azienda_id dall'azienda loggata
    payload.azienda_id = azienda?.id;

    if (!payload.azienda_id) {
      alert('Errore: nessuna azienda selezionata');
      return;
    }

    try {
      let fornitoreId;
      
      if (fornitoreModalData) {
        // Modifica
        await api.put(`/amministrazione/fornitori/${fornitoreModalData.id}`, payload);
        fornitoreId = fornitoreModalData.id;
      } else {
        // Creazione
        const response = await amministrazioneService.createFornitore(payload);
        fornitoreId = response.id;
      }

      // Gestione macrocategoria
      if (fornitoreForm.macrocategoria && fornitoreForm.macrocategoria !== 'nessuna') {
        const macrocategoriaPayload = {
          fornitore_id: fornitoreId,
          categoria: 'generale', // Categoria generica per mantenere compatibilità con il modello
          macrocategoria: fornitoreForm.macrocategoria,
          note: fornitoreForm.categoria_note || '',
        };

        if (selectedRow?.tipoId) {
          await amministrazioneService.updateFornitoreTipo(selectedRow.tipoId, macrocategoriaPayload);
        } else {
          await amministrazioneService.createFornitoreTipo(macrocategoriaPayload);
        }
      } else if (selectedRow?.tipoId) {
        await amministrazioneService.deleteFornitoreTipo(selectedRow.tipoId);
      }

      setIsEditing(false);
      
      // Prima ricarica tutti i dati (fornitori + tipi) dal server
      const freshData = await fetchFornitoriData({ force: true });
      
      // Poi aggiorna la modale con i dati freschi
      if (fornitoreModalData && freshData) {
        const response = await api.get(`/amministrazione/fornitori/${fornitoreModalData.id}`);
        setFornitoreModalData(response.data);
        
        // Trova il tipo aggiornato dai dati freschi appena caricati
        const tipo = freshData.tipi?.find(t => t.fornitore_id === fornitoreModalData.id);
        
        const updatedRow = {
          ...response.data,
          tipoId: tipo?.id || null,
          macrocategoria: tipo?.macrocategoria || 'nessuna',
          tipoNote: tipo?.note || '',
        };
        setSelectedRow(updatedRow);
        
        // Aggiorna anche il form con la macrocategoria corretta
        setFornitoreForm(prev => ({
          ...prev,
          macrocategoria: tipo?.macrocategoria || 'nessuna',
          categoria_note: tipo?.note || '',
        }));
      } else {
        setShowFornitoreModal(false);
        setFornitoreModalData(null);
      }
    } catch (error) {

      alert(`Errore nel salvataggio: ${error.message || 'Errore sconosciuto'}`);
    }
  };

  const renderMacrocategoria = (row) => {
      return (
      <span className={getMacrocategoriaBadgeClass(row.macrocategoria)}>
        {getMacrocategoriaLabel(row.macrocategoria)}
        </span>
      );
  };

  // Modal Render with Unified Structure (same as GestioneFatture)
  const renderModalContent = () => {
    return (
      <BaseModal
        isOpen={showFornitoreModal}
        onClose={() => {
          if (!isEditing) {
            setShowFornitoreModal(false);
            setFornitoreModalData(null);
            setIsEditing(false);
            setSelectedRow(null);
          }
        }}
        title={fornitoreModalData ? (isEditing ? 'Modifica Fornitore/Cliente' : 'Dettagli Fornitore/Cliente') : 'Nuovo Fornitore/Cliente'}
        size="xlarge"
        headerActions={
          <>
            {!isEditing && fornitoreModalData && (
              <>
                <button className="btn btn-secondary" onClick={handleStartEdit}>
                  Modifica
                </button>
                <button className="btn btn-danger" onClick={handleDelete}>
                  Elimina
                </button>
              </>
            )}
          </>
        }
        footerActions={
          isEditing ? (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCancelEdit}
              >
                Annulla
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={(e) => {
                  e.preventDefault();
                  handleSaveFornitore();
                }}
              >
                Salva
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setShowFornitoreModal(false);
                setFornitoreModalData(null);
                setIsEditing(false);
                setSelectedRow(null);
              }}
            >
              Chiudi
            </button>
          )
        }
      >
        {fornitoreModalLoading && <div className="loading">Caricamento dettagli...</div>}
        {!fornitoreModalLoading && (
          <form onSubmit={(e) => { e.preventDefault(); handleSaveFornitore(); }} className="movimento-form">
            <div className="form-grid">
              <div className="form-group span-12">
                <label>Nome *</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={fornitoreForm.nome}
                    onChange={(e) => setFornitoreForm({ ...fornitoreForm, nome: e.target.value })}
                    placeholder="Nome"
                    required
                  />
                ) : (
                  <span>{fornitoreForm.nome || '-'}</span>
                )}
              </div>

              <div className="form-group">
                <label>Tipo</label>
                {isEditing ? (
                  <SmartSelect
                    className="select-compact"
                    options={[
                      { value: 'fornitore', label: 'Fornitore' },
                      { value: 'cliente', label: 'Cliente' },
                      { value: 'entrambi', label: 'Fornitore + Cliente' }
                    ]}
                    value={
                      fornitoreForm.is_fornitore && fornitoreForm.is_cliente
                        ? 'entrambi'
                        : fornitoreForm.is_fornitore
                        ? 'fornitore'
                        : fornitoreForm.is_cliente
                        ? 'cliente'
                        : 'fornitore'
                    }
                    onChange={(e) => {
                      const tipo = e.target.value;
                      setFornitoreForm({
                        ...fornitoreForm,
                        is_fornitore: tipo === 'fornitore' || tipo === 'entrambi',
                        is_cliente: tipo === 'cliente' || tipo === 'entrambi',
                      });
                    }}
                    displayField="label"
                    valueField="value"
                  />
                ) : (
                  <span>
                    {fornitoreForm.is_fornitore && fornitoreForm.is_cliente ? 'Fornitore + Cliente' :
                     fornitoreForm.is_fornitore ? 'Fornitore' :
                     fornitoreForm.is_cliente ? 'Cliente' : '-'}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label>Macrocategoria</label>
                {isEditing ? (
                  <SmartSelect
                    className="select-compact"
                    options={MACROCATEGORIE_OPTIONS}
                    value={fornitoreForm.macrocategoria || 'nessuna'}
                    onChange={(e) => setFornitoreForm({ ...fornitoreForm, macrocategoria: e.target.value })}
                    displayField="label"
                    valueField="value"
                  />
                ) : (
                  <span>{getMacrocategoriaLabel(fornitoreForm.macrocategoria)}</span>
                )}
              </div>

              <div className="form-group">
                <label>Partita IVA</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={fornitoreForm.partita_iva}
                    onChange={(e) => setFornitoreForm({ ...fornitoreForm, partita_iva: e.target.value })}
                    placeholder="Partita IVA"
                  />
                ) : (
                  <span>{fornitoreForm.partita_iva || '-'}</span>
                )}
              </div>

              <div className="form-group">
                <label>Telefono</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={fornitoreForm.telefono}
                    onChange={(e) => setFornitoreForm({ ...fornitoreForm, telefono: e.target.value })}
                    placeholder="Telefono"
                  />
                ) : (
                  <span>{fornitoreForm.telefono || '-'}</span>
                )}
              </div>

              <div className="form-group">
                <label>Email</label>
                {isEditing ? (
                  <input
                    type="email"
                    value={fornitoreForm.email}
                    onChange={(e) => setFornitoreForm({ ...fornitoreForm, email: e.target.value })}
                    placeholder="Email"
                  />
                ) : (
                  <span>{fornitoreForm.email || '-'}</span>
                )}
              </div>

              <div className="form-group span-12">
                <label>Indirizzo</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={fornitoreForm.indirizzo}
                    onChange={(e) => setFornitoreForm({ ...fornitoreForm, indirizzo: e.target.value })}
                    placeholder="Indirizzo"
                  />
                ) : (
                  <span>{fornitoreForm.indirizzo || '-'}</span>
                )}
              </div>

              <div className="form-group">
                <label>CAP</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={fornitoreForm.indirizzo_cap}
                    onChange={(e) => setFornitoreForm({ ...fornitoreForm, indirizzo_cap: e.target.value })}
                    placeholder="CAP"
                  />
                ) : (
                  <span>{fornitoreForm.indirizzo_cap || '-'}</span>
                )}
              </div>

              <div className="form-group">
                <label>Comune</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={fornitoreForm.indirizzo_comune}
                    onChange={(e) => setFornitoreForm({ ...fornitoreForm, indirizzo_comune: e.target.value })}
                    placeholder="Comune"
                  />
                ) : (
                  <span>{fornitoreForm.indirizzo_comune || '-'}</span>
                )}
              </div>

              <div className="form-group">
                <label>Provincia</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={fornitoreForm.indirizzo_provincia}
                    onChange={(e) => setFornitoreForm({ ...fornitoreForm, indirizzo_provincia: e.target.value })}
                    placeholder="Provincia"
                  />
                ) : (
                  <span>{fornitoreForm.indirizzo_provincia || '-'}</span>
                )}
              </div>

              <div className="form-group">
                <label>Nazione</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={fornitoreForm.indirizzo_nazione}
                    onChange={(e) => setFornitoreForm({ ...fornitoreForm, indirizzo_nazione: e.target.value })}
                    placeholder="Nazione"
                  />
                ) : (
                  <span>{fornitoreForm.indirizzo_nazione || '-'}</span>
                )}
              </div>

              <div className="form-group">
                <label>PEC</label>
                {isEditing ? (
                  <input
                    type="email"
                    value={fornitoreForm.pec}
                    onChange={(e) => setFornitoreForm({ ...fornitoreForm, pec: e.target.value })}
                    placeholder="PEC"
                  />
                ) : (
                  <span>{fornitoreForm.pec || '-'}</span>
                )}
              </div>

              <div className="form-group">
                <label>Fax</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={fornitoreForm.fax}
                    onChange={(e) => setFornitoreForm({ ...fornitoreForm, fax: e.target.value })}
                    placeholder="Fax"
                  />
                ) : (
                  <span>{fornitoreForm.fax || '-'}</span>
                )}
              </div>

              {(fornitoreForm.regime_fiscale || isEditing) && (
                <div className="form-group">
                  <label>Regime Fiscale</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={fornitoreForm.regime_fiscale}
                      onChange={(e) => setFornitoreForm({ ...fornitoreForm, regime_fiscale: e.target.value })}
                      placeholder="Regime Fiscale"
                    />
                  ) : (
                    <span>{fornitoreForm.regime_fiscale || '-'}</span>
                  )}
                </div>
              )}

              {(fornitoreForm.rea_ufficio || isEditing) && (
                <div className="form-group">
                  <label>REA Ufficio</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={fornitoreForm.rea_ufficio}
                      onChange={(e) => setFornitoreForm({ ...fornitoreForm, rea_ufficio: e.target.value })}
                      placeholder="REA Ufficio"
                    />
                  ) : (
                    <span>{fornitoreForm.rea_ufficio || '-'}</span>
                  )}
                </div>
              )}

              {(fornitoreForm.rea_numero || isEditing) && (
                <div className="form-group">
                  <label>REA Numero</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={fornitoreForm.rea_numero}
                      onChange={(e) => setFornitoreForm({ ...fornitoreForm, rea_numero: e.target.value })}
                      placeholder="REA Numero"
                    />
                  ) : (
                    <span>{fornitoreForm.rea_numero || '-'}</span>
                  )}
                </div>
              )}

              {(fornitoreForm.rea_capitale_sociale || isEditing) && (
                <div className="form-group">
                  <label>Capitale Sociale</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={fornitoreForm.rea_capitale_sociale}
                      onChange={(e) => setFornitoreForm({ ...fornitoreForm, rea_capitale_sociale: e.target.value })}
                      placeholder="Capitale Sociale"
                    />
                  ) : (
                    <span>{fornitoreForm.rea_capitale_sociale || '-'}</span>
                  )}
                </div>
              )}
            </div>

            {/* Note - fuori dalla griglia */}
            {(fornitoreForm.note || isEditing) && (
              <div className="form-group">
                <label>Note</label>
                {isEditing ? (
                  <textarea
                    value={fornitoreForm.note}
                    onChange={(e) => setFornitoreForm({ ...fornitoreForm, note: e.target.value })}
                    rows={3}
                    placeholder="Note aggiuntive..."
                  />
                ) : (
                  <span>{fornitoreForm.note || '-'}</span>
                )}
              </div>
            )}

            {/* Categoria Note - fuori dalla griglia */}
            {(fornitoreForm.categoria_note || isEditing) && (
              <div className="form-group">
                <label>Note Categoria</label>
                {isEditing ? (
                  <textarea
                    value={fornitoreForm.categoria_note}
                    onChange={(e) => setFornitoreForm({ ...fornitoreForm, categoria_note: e.target.value })}
                    rows={2}
                    placeholder="Note sulla categoria/macrocategoria..."
                  />
                ) : (
                  <span>{fornitoreForm.categoria_note || '-'}</span>
                )}
              </div>
            )}
          </form>
        )}
      </BaseModal>
    );
  };

  const renderIndirizzo = (row) => {
    if (row.indirizzo_comune) {
      const comune = row.indirizzo_comune.toUpperCase();
      const provincia = row.indirizzo_provincia ? `(${row.indirizzo_provincia.toUpperCase()})` : '';
      return comune + (provincia ? ' ' + provincia : '');
    }
    return '—';
  };

  const renderContatti = (row) => {
    const parts = [];
    if (row.email) parts.push(row.email);
    if (row.telefono) parts.push(row.telefono);
    return parts.length > 0 ? (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {parts.map((part, idx) => (
          <span key={idx}>{part}</span>
        ))}
      </div>
    ) : '—';
  };

  const renderRea = (row) => {
    const reaParts = [row.rea_ufficio, row.rea_numero].filter(Boolean).join(' ');
    if (reaParts) {
      return reaParts;
    }
    return '—';
  };

  const filteredRows = useMemo(() => {
    let filtered = rows;
    
    // Filtro per tipo
    if (filterTipo !== 'tutti') {
      filtered = filtered.filter((row) => {
        if (filterTipo === 'fornitore') return row.is_fornitore && !row.is_cliente;
        if (filterTipo === 'cliente') return row.is_cliente && !row.is_fornitore;
        if (filterTipo === 'entrambi') return row.is_fornitore && row.is_cliente;
        return true;
      });
    }
    
    // Filtro per testo
    const term = (deferredFilterText || '').trim().toLowerCase();
    if (term) {
      filtered = filtered.filter((row) => {
        if (!row.searchIndex) return false;
        return row.searchIndex.includes(term);
      });
    }
    
    return filtered;
  }, [rows, deferredFilterText, filterTipo]);
  
  // Paginazione sui risultati filtrati
  const totalPages = Math.ceil(filteredRows.length / FORNITORI_PER_PAGINA);
  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * FORNITORI_PER_PAGINA;
    const endIndex = startIndex + FORNITORI_PER_PAGINA;
    return filteredRows.slice(startIndex, endIndex);
  }, [filteredRows, currentPage]);

  const isAnyModalOpen = showFornitoreModal;

  return (
    <div className={`gestione-fornitori ${isAnyModalOpen ? 'modal-open' : ''}`}>
      {/* Pulsanti azioni */}
      <div className="filters-actions">
        <button className="btn btn-primary" onClick={() => {
          openFornitoreModal(null);
          setIsEditing(true);
        }}>
          Nuovo Fornitore/Cliente
        </button>
      </div>

      {/* Barra filtri */}
      <div className="filters-bar">
        <div className="filters-row">
          <div className="filter-group search">
            <label>Cerca</label>
            <input
              type="text"
              placeholder="Nome, P.IVA, contatti o macrocategoria..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label>Tipo</label>
            <SmartSelect
              options={[
                { value: 'tutti', label: 'Tutti' },
                { value: 'fornitore', label: 'Solo Fornitori' },
                { value: 'cliente', label: 'Solo Clienti' },
                { value: 'entrambi', label: 'Fornitori e Clienti' }
              ]}
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value)}
              displayField="label"
              valueField="value"
              allowEmpty={false}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading">Caricamento...</div>
      ) : (
        <>
          <div className="table-wrapper">
            <div className="table-container">
              <table className="data-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Tipo</th>
                  <th>Partita IVA</th>
                  <th>Indirizzo</th>
                  <th>Contatti</th>
                  <th>REA</th>
                  <th>Macrocategoria</th>
                </tr>
              </thead>
              <tbody>
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-state">
                    Nessun fornitore/cliente trovato
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row) => (
                  <tr 
                    key={row.id}
                    onClick={() => openFornitoreModal(row)}
                    className="table-row-clickable"
                  >
                    <td>{row.nome}</td>
                    <td>
                      <div className="tipo-badges">
                        {row.is_fornitore && (
                          <span className="badge badge-fornitore">Fornitore</span>
                        )}
                        {row.is_cliente && (
                          <span className="badge badge-cliente">Cliente</span>
                        )}
                        {!row.is_fornitore && !row.is_cliente && <span>—</span>}
                      </div>
                    </td>
                    <td>{row.partita_iva || '—'}</td>
                    <td>{renderIndirizzo(row)}</td>
                    <td>{renderContatti(row)}</td>
                    <td>{renderRea(row)}</td>
                    <td>{renderMacrocategoria(row)}</td>
                  </tr>
                ))
              )}
              </tbody>
              </table>
            </div>
          </div>

          {/* Controlli paginazione */}
          {filteredRows.length > FORNITORI_PER_PAGINA && (
            <div className="pagination-fixed-bottom">
              <div className="pagination pagination-minimal">
              <div className="pagination-controls">
                <button
                  className="pagination-btn-prev"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  ←
                </button>
                <div className="pagination-controls-center">
                  {(() => {
                    // Se ci sono meno di 5 pagine, mostra tutte le pagine
                    if (totalPages < 5) {
                      if (totalPages <= 1) {
                        return null; // Nessuna paginazione se c'è solo 1 pagina
                      }
                      // Mostra tutte le pagine (2, 3 o 4)
                      return Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <button
                          key={page}
                          className={`pagination-btn ${page === currentPage ? 'active' : ''}`}
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </button>
                      ));
                    }
                    
                    // Se ci sono almeno 5 pagine, mostra sempre 5 numeri con la pagina corrente al centro
                    const startPage = Math.max(1, currentPage - 2);
                    const endPage = Math.min(totalPages, currentPage + 2);
                    
                    let pagesToShow = [];
                    for (let i = startPage; i <= endPage; i++) {
                      pagesToShow.push(i);
                    }
                    
                    // Se abbiamo meno di 5 numeri, aggiungi placeholder
                    if (pagesToShow.length < 5) {
                      if (currentPage <= 3) {
                        while (pagesToShow.length < 5 && pagesToShow[pagesToShow.length - 1] < totalPages) {
                          const nextPage = pagesToShow[pagesToShow.length - 1] + 1;
                          if (nextPage <= totalPages) {
                            pagesToShow.push(nextPage);
                          }
                        }
                        while (pagesToShow.length < 5) {
                          pagesToShow.push(null);
                        }
                      } else if (currentPage >= totalPages - 2) {
                        while (pagesToShow.length < 5 && pagesToShow[0] > 1) {
                          const prevPage = pagesToShow[0] - 1;
                          if (prevPage >= 1) {
                            pagesToShow.unshift(prevPage);
                          }
                        }
                        while (pagesToShow.length < 5) {
                          pagesToShow.unshift(null);
                        }
                      } else {
                        const needed = 5 - pagesToShow.length;
                        const before = Math.floor(needed / 2);
                        const after = needed - before;
                        
                        for (let i = 0; i < before && pagesToShow[0] > 1; i++) {
                          pagesToShow.unshift(pagesToShow[0] - 1);
                        }
                        for (let i = 0; i < after && pagesToShow[pagesToShow.length - 1] < totalPages; i++) {
                          pagesToShow.push(pagesToShow[pagesToShow.length - 1] + 1);
                        }
                        
                        while (pagesToShow.length < 5) {
                          if (pagesToShow[0] === 1) {
                            pagesToShow.push(null);
                          } else {
                            pagesToShow.unshift(null);
                          }
                        }
                      }
                    }
                    
                    while (pagesToShow.length > 5) {
                      if (pagesToShow[0] < currentPage - 2) {
                        pagesToShow.shift();
                      } else {
                        pagesToShow.pop();
                      }
                    }
                    
                    return pagesToShow.map((item, idx) => {
                      if (item === null) {
                        return <span key={`placeholder-${idx}`} className="pagination-btn" style={{ visibility: 'hidden' }}>1</span>;
                      }
                      return (
                        <button
                          key={item}
                          className={`pagination-btn ${item === currentPage ? 'active' : ''}`}
                          onClick={() => setCurrentPage(item)}
                        >
                          {item}
                        </button>
                      );
                    });
                  })()}
                </div>
                <button
                  className="pagination-btn-next"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  →
                </button>
              </div>
            </div>
            </div>
          )}
        </>
      )}

      {showFornitoreModal && renderModalContent()}
    </div>
  );
};

// Funzione per ottenere la classe CSS del badge macrocategoria
function getMacrocategoriaBadgeClass(macrocategoria) {
  if (!macrocategoria || macrocategoria === 'nessuna') {
    return 'badge-macrocategoria badge-macrocategoria-none';
  }
  return `badge-macrocategoria badge-macrocategoria-${macrocategoria}`;
}

// Funzione per ottenere il label della macrocategoria
function getMacrocategoriaLabel(macrocategoria) {
  if (!macrocategoria || macrocategoria === 'nessuna') {
    return 'Nessuna';
  }
  return MACROCATEGORIE_OPTIONS.find(m => m.value === macrocategoria)?.label || macrocategoria;
}

export default GestioneFornitori;
