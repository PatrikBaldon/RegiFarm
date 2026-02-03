/**
 * GestionePagamenti - Gestione pagamenti ricevuti/effettuati
 */
import React, { useState, useEffect, useMemo } from 'react';
import SearchableSelect from '../../../components/SearchableSelect';
import { amministrazioneService } from '../services/amministrazioneService';
import { useAzienda } from '../../../context/AziendaContext';
import '../../alimentazione/components/Alimentazione.css';
import './GestionePagamenti.css';

const TIPI_PAGAMENTO = [
  { value: 'entrata', label: 'Entrata' },
  { value: 'uscita', label: 'Uscita' },
];

const METODI_PAGAMENTO = [
  { value: 'contanti', label: 'Contanti' },
  { value: 'bonifico', label: 'Bonifico' },
  { value: 'assegno', label: 'Assegno' },
  { value: 'carta', label: 'Carta' },
  { value: 'rid', label: 'RID' },
  { value: 'altro', label: 'Altro' },
];

const GestionePagamenti = () => {
  const [pagamenti, setPagamenti] = useState([]);
  const [fattureEmesse, setFattureEmesse] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedPagamento, setSelectedPagamento] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    tipo: '',
    metodo: '',
  });
  const [formData, setFormData] = useState({
    azienda_id: null,
    tipo: 'entrata',
    fattura_emessa_id: null,
    fattura_amministrazione_id: null,
    importo: '',
    data_pagamento: new Date().toISOString().split('T')[0],
    data_valuta: '',
    metodo: 'contanti',
    numero_riferimento: '',
    banca: '',
    iban: '',
    descrizione: '',
    note: '',
  });

  const { azienda, loading: aziendaLoading } = useAzienda();
  const aziendaId = azienda?.id;
  const canOperate = Boolean(aziendaId);

  const tipoFilterOptions = useMemo(
    () => [{ value: '', label: 'Tutti i tipi' }, ...TIPI_PAGAMENTO],
    []
  );

  const metodoFilterOptions = useMemo(
    () => [{ value: '', label: 'Tutti i metodi' }, ...METODI_PAGAMENTO],
    []
  );

  const fattureEmesseOptions = useMemo(
    () => [
      { value: '', label: 'Nessuna' },
      ...fattureEmesse.map((f) => ({
        value: String(f.id),
        label: `${f.numero} - €${parseFloat(f.importo_totale || 0).toFixed(2)}`,
      })),
    ],
    [fattureEmesse]
  );

  useEffect(() => {
    if (!aziendaId) return;
    setFormData((prev) => ({
      ...prev,
      azienda_id: prev.azienda_id ?? aziendaId,
    }));
    loadData(aziendaId);
    loadFattureEmesse(aziendaId);
  }, [aziendaId]);

  const loadData = async (id) => {
    if (!id) return;
    setLoading(true);
    try {
      const pagamentiData = await amministrazioneService.getPagamenti(id);
      setPagamenti(pagamentiData);
    } catch (error) {

      alert('Errore nel caricamento dei dati');
    } finally {
      setLoading(false);
    }
  };

  const loadFattureEmesse = async (id) => {
    if (!id) return;
    try {
      const fattureData = await amministrazioneService.getFattureEmesse(id);
      setFattureEmesse(fattureData);
    } catch (error) {

    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!aziendaId) {
      alert('Configura l\'azienda prima di registrare un pagamento.');
      return;
    }
    try {
      const dataToSend = {
        ...formData,
        azienda_id: aziendaId,
        importo: parseFloat(formData.importo),
        fattura_emessa_id: formData.fattura_emessa_id || null,
        fattura_amministrazione_id: formData.fattura_amministrazione_id || null,
        data_valuta: formData.data_valuta || null,
      };

      if (selectedPagamento) {
        await amministrazioneService.updatePagamento(selectedPagamento.id, dataToSend);
      } else {
        await amministrazioneService.createPagamento(dataToSend);
      }
      setShowModal(false);
      resetForm();
      loadData(aziendaId);
    } catch (error) {

      alert('Errore nel salvataggio');
    }
  };

  const handleEdit = (pagamento) => {
    setSelectedPagamento(pagamento);
    setFormData({
      ...pagamento,
      data_pagamento: pagamento.data_pagamento.split('T')[0],
      data_valuta: pagamento.data_valuta ? pagamento.data_valuta.split('T')[0] : '',
      importo: pagamento.importo.toString(),
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Sei sicuro di voler eliminare questo pagamento?')) return;
    
    try {
      await amministrazioneService.deletePagamento(id);
      loadData(aziendaId);
    } catch (error) {

      alert('Errore nell\'eliminazione');
    }
  };

  const resetForm = () => {
    setFormData({
      azienda_id: aziendaId || null,
      tipo: 'entrata',
      fattura_emessa_id: null,
      fattura_amministrazione_id: null,
      importo: '',
      data_pagamento: new Date().toISOString().split('T')[0],
      data_valuta: '',
      metodo: 'contanti',
      numero_riferimento: '',
      banca: '',
      iban: '',
      descrizione: '',
      note: '',
    });
    setSelectedPagamento(null);
  };

  const getTipoBadgeClass = (tipo) => {
    return tipo === 'entrata' ? 'badge-success' : 'badge-danger';
  };

  const getFatturaNumero = (fatturaId) => {
    if (!fatturaId) return '-';
    const fattura = fattureEmesse.find(f => f.id === fatturaId);
    return fattura ? fattura.numero : 'N/A';
  };

  const filteredPagamenti = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    return pagamenti.filter((pagamento) => {
      if (filters.tipo && pagamento.tipo !== filters.tipo) {
        return false;
      }
      if (filters.metodo && pagamento.metodo !== filters.metodo) {
        return false;
      }
      if (!term) {
        return true;
      }
      const fatturaNumero = getFatturaNumero(pagamento.fattura_emessa_id);
      const searchable = [
        pagamento.descrizione,
        pagamento.numero_riferimento,
        pagamento.note,
        pagamento.banca,
        pagamento.iban,
        fatturaNumero,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return searchable.includes(term);
    });
  }, [pagamenti, filters, fattureEmesse]);

  return (
    <div className="gestione-pagamenti">
      <div className="header-actions">
        <button
          className="btn btn-primary"
          onClick={() => { resetForm(); setShowModal(true); }}
          disabled={!canOperate}
          style={!canOperate ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
        >
          Nuovo Pagamento
        </button>
      </div>
      <div className="filters-bar">
        <input
          type="text"
          placeholder="Cerca per descrizione, riferimento o fattura..."
          value={filters.search}
          onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
        />
        <SearchableSelect
          className="select-compact"
          options={tipoFilterOptions}
          value={filters.tipo}
          onChange={(e) => setFilters((prev) => ({ ...prev, tipo: e.target.value }))}
          displayField="label"
          valueField="value"
          placeholder="Tutti i tipi"
        />
        <SearchableSelect
          className="select-compact"
          options={metodoFilterOptions}
          value={filters.metodo}
          onChange={(e) => setFilters((prev) => ({ ...prev, metodo: e.target.value }))}
          displayField="label"
          valueField="value"
          placeholder="Tutti i metodi"
        />
      </div>

      {!canOperate ? (
        <div className="empty-state">
          Configura l&apos;azienda nelle impostazioni per registrare i pagamenti.
        </div>
      ) : (
        <>
          {loading ? (
            <div className="loading">Caricamento...</div>
          ) : (
            <div className="table-container">
              <table className="data-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Tipo</th>
              <th>Importo</th>
              <th>Metodo</th>
              <th>Fattura</th>
              <th>Descrizione</th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
                  {filteredPagamenti.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="empty-state">
                        Nessun pagamento trovato
                      </td>
                    </tr>
                  ) : (
                    filteredPagamenti.map(pagamento => (
              <tr key={pagamento.id}>
                <td>{new Date(pagamento.data_pagamento).toLocaleDateString('it-IT')}</td>
                <td>
                  <span className={`badge ${getTipoBadgeClass(pagamento.tipo)}`}>
                    {pagamento.tipo}
                  </span>
                </td>
                <td>€{parseFloat(pagamento.importo).toFixed(2)}</td>
                <td>{pagamento.metodo}</td>
                <td>{getFatturaNumero(pagamento.fattura_emessa_id)}</td>
                <td>{pagamento.descrizione || '-'}</td>
                <td>
                  <button className="btn-icon" onClick={() => handleEdit(pagamento)} title="Modifica">✏️</button>
                  <button className="btn-icon" onClick={() => handleDelete(pagamento.id)} title="Elimina">🗑️</button>
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

      {showModal && (
        <div className="modal">
          <div className="modal-content large">
            <div className="modal-header">
              <h3>{selectedPagamento ? 'Modifica Pagamento' : 'Nuovo Pagamento'}</h3>
              <button className="close-button" onClick={() => { setShowModal(false); resetForm(); }}>
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Tipo *</label>
                  <SearchableSelect
                    className="select-compact"
                    options={TIPI_PAGAMENTO}
                    value={formData.tipo}
                    onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                    displayField="label"
                    valueField="value"
                    required
                    placeholder="Seleziona tipo"
                  />
                </div>
                <div className="form-group">
                  <label>Fattura Emessa</label>
                  <SearchableSelect
                    className="select-compact"
                    options={fattureEmesseOptions}
                    value={formData.fattura_emessa_id ? String(formData.fattura_emessa_id) : ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        fattura_emessa_id: e.target.value ? parseInt(e.target.value, 10) : null,
                      })}
                    displayField="label"
                    valueField="value"
                    placeholder="Nessuna"
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Importo (€) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.importo}
                    onChange={(e) => setFormData({ ...formData, importo: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Data Pagamento *</label>
                  <input
                    type="date"
                    value={formData.data_pagamento}
                    onChange={(e) => setFormData({ ...formData, data_pagamento: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Data Valuta</label>
                  <input
                    type="date"
                    value={formData.data_valuta}
                    onChange={(e) => setFormData({ ...formData, data_valuta: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Metodo Pagamento *</label>
                  <SearchableSelect
                    className="select-compact"
                    options={METODI_PAGAMENTO}
                    value={formData.metodo}
                    onChange={(e) => setFormData({ ...formData, metodo: e.target.value })}
                    displayField="label"
                    valueField="value"
                    required
                    placeholder="Seleziona metodo"
                  />
                </div>
                <div className="form-group">
                  <label>Numero Riferimento</label>
                  <input
                    type="text"
                    value={formData.numero_riferimento}
                    onChange={(e) => setFormData({ ...formData, numero_riferimento: e.target.value })}
                    placeholder="Numero bonifico, assegno, etc."
                  />
                </div>
              </div>
              {formData.metodo === 'bonifico' && (
                <div className="form-row">
                  <div className="form-group">
                    <label>Banca</label>
                    <input
                      type="text"
                      value={formData.banca}
                      onChange={(e) => setFormData({ ...formData, banca: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>IBAN</label>
                    <input
                      type="text"
                      value={formData.iban}
                      onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                      maxLength={34}
                    />
                  </div>
                </div>
              )}
              <div className="form-group">
                <label>Descrizione</label>
                <input
                  type="text"
                  value={formData.descrizione}
                  onChange={(e) => setFormData({ ...formData, descrizione: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Note</label>
                <textarea
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">Salva</button>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowModal(false); resetForm(); }}>
                  Annulla
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestionePagamenti;

