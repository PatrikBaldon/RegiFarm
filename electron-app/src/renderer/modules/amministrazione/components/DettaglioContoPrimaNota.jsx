/**
 * DettaglioContoPrimaNota - Componente per visualizzare il dettaglio di un conto con filtri avanzati
 */
import React, { useState, useEffect, useMemo } from 'react';
import SmartSelect from '../../../components/SmartSelect';
import { amministrazioneService } from '../services/amministrazioneService';
import './DettaglioContoPrimaNota.css';

const FILTRO_TIPO_OPTIONS = [
  { value: 'tutti', label: 'Tutti' },
  { value: 'entrata', label: 'Entrata' },
  { value: 'uscita', label: 'Uscita' },
  { value: 'giroconto', label: 'Giroconto' },
];

const FILTRO_STATO_OPTIONS = [
  { value: 'tutti', label: 'Tutti' },
  { value: 'definitivo', label: 'Definitivo' },
  { value: 'provvisorio', label: 'Da confermare' },
];

const EMPTY_FILTERS = {
  categoria: 'tutte',
  attrezzatura: 'tutte',
  partita: 'tutte',
  contratto_soccida: 'tutti',
  tipo: 'tutti',
  stato: 'tutti',
  from: '',
  to: '',
  search: '',
};

const DettaglioContoPrimaNota = ({
  conto,
  aziendaId,
  categorie = [],
  attrezzature = [],
  partite = [],
  contrattiSoccida = [],
  onBack,
}) => {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [movimenti, setMovimenti] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  // Carica movimenti quando cambiano i filtri o il conto
  useEffect(() => {
    if (conto && aziendaId) {
      fetchMovimenti();
    }
  }, [conto, aziendaId, filters]);

  const fetchMovimenti = async () => {
    if (!conto || !aziendaId) return;

    setLoading(true);
    try {
      const params = {
        conto_id: String(conto.id),
        tipo_operazione: filters.tipo !== 'tutti' ? filters.tipo : undefined,
        stato: filters.stato !== 'tutti' ? filters.stato : undefined,
        categoria_id: filters.categoria !== 'tutte' ? filters.categoria : undefined,
        attrezzatura_id: filters.attrezzatura !== 'tutte' ? filters.attrezzatura : undefined,
        partita_id: filters.partita !== 'tutte' ? filters.partita : undefined,
        contratto_soccida_id: filters.contratto_soccida !== 'tutti' ? filters.contratto_soccida : undefined,
        search: filters.search || undefined,
        data_da: filters.from || undefined,
        data_a: filters.to || undefined,
      };

      const response = await amministrazioneService.getPrimaNotaMovimenti(aziendaId, params);
      const movimentiData = Array.isArray(response) ? response : response?.movimenti || [];
      setMovimenti(movimentiData);
      setCurrentPage(1);
    } catch (error) {
      setMovimenti([]);
    } finally {
      setLoading(false);
    }
  };

  const categoriaFilterOptions = useMemo(
    () => [
      { value: 'tutte', label: 'Tutte' },
      ...categorie.map((c) => ({
        value: String(c.id ?? c.value),
        label: c.label || c.nome || `Categoria #${c.id ?? c.value}`,
      })),
    ],
    [categorie]
  );

  const attrezzaturaFilterOptions = useMemo(
    () => {
      if (!Array.isArray(attrezzature) || attrezzature.length === 0) {
        return [{ value: 'tutte', label: 'Tutte' }];
      }
      return [
        { value: 'tutte', label: 'Tutte' },
        ...attrezzature.map((att) => {
          const chunks = [att.nome];
          const tipoValue = typeof att.tipo === 'string' ? att.tipo : att.tipo?.value;
          if (tipoValue) chunks.push(tipoValue);
          if (att.targa) chunks.push(att.targa);
          return {
            value: String(att.id),
            label: chunks.filter(Boolean).join(' · '),
          };
        }),
      ];
    },
    [attrezzature]
  );

  const partitaFilterOptions = useMemo(
    () => {
      if (!partite || partite.length === 0) {
        return [{ value: 'tutte', label: 'Tutte' }];
      }
      return [
        { value: 'tutte', label: 'Tutte' },
        ...partite.map((p) => ({
          value: String(p.id),
          label: p.numero_partita
            ? `Partita ${p.numero_partita} - ${p.numero_capi} capi`
            : `Partita #${p.id} - ${p.numero_capi || 0} capi`,
        })),
      ];
    },
    [partite]
  );

  const contrattoSoccidaFilterOptions = useMemo(
    () => {
      if (!contrattiSoccida || contrattiSoccida.length === 0) {
        return [{ value: 'tutti', label: 'Tutti' }];
      }
      return [
        { value: 'tutti', label: 'Tutti' },
        ...contrattiSoccida.map((c) => ({
          value: String(c.id),
          label: c.numero_contratto
            ? `${c.numero_contratto} - ${c.soccidante?.nome || 'N/A'}`
            : `Contratto #${c.id} - ${c.soccidante?.nome || 'N/A'}`,
        })),
      ];
    },
    [contrattiSoccida]
  );

  const movimentiTotals = useMemo(() => {
    const totale = movimenti.reduce(
      (acc, movimento) => {
        const valore = Number(movimento.importo || 0);
        if (movimento.tipo_operazione === 'entrata') acc.entrate += valore;
        if (movimento.tipo_operazione === 'uscita') acc.uscite += valore;
        return acc;
      },
      { entrate: 0, uscite: 0 }
    );
    return {
      entrate: totale.entrate,
      uscite: totale.uscite,
      saldo: totale.entrate - totale.uscite,
    };
  }, [movimenti]);

  const paginatedMovimenti = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return movimenti.slice(start, end);
  }, [movimenti, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(movimenti.length / itemsPerPage);

  const handleResetFilters = () => {
    setFilters(EMPTY_FILTERS);
  };

  const formatCurrency = (value) => {
    if (value === null || value === undefined || value === '') return '€0,00';
    const numero = Number(value);
    if (Number.isNaN(numero)) return String(value);
    return numero.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
  };

  const formatDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('it-IT');
  };

  if (!conto) {
    return (
      <div className="dettaglio-conto-empty">
        <p>Nessun conto selezionato</p>
        {onBack && (
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            Torna indietro
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="dettaglio-conto-prima-nota">
      {/* Header fisso */}
      <div className="dettaglio-conto-header">
        <div className="dettaglio-conto-header-left">
          {onBack && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={onBack}>
              ← Indietro
            </button>
          )}
          <h2 className="dettaglio-conto-title">{conto.nome}</h2>
        </div>
        <div className="dettaglio-conto-stats-bar">
          <div className="dettaglio-conto-stat">
            <span className="dettaglio-conto-stat-label">Entrate</span>
            <span className="dettaglio-conto-stat-value positive">{formatCurrency(movimentiTotals.entrate)}</span>
          </div>
          <div className="dettaglio-conto-stat">
            <span className="dettaglio-conto-stat-label">Uscite</span>
            <span className="dettaglio-conto-stat-value negative">{formatCurrency(movimentiTotals.uscite)}</span>
          </div>
          <div className="dettaglio-conto-stat">
            <span className="dettaglio-conto-stat-label">Saldo</span>
            <span className={`dettaglio-conto-stat-value ${movimentiTotals.saldo >= 0 ? 'positive' : 'negative'}`}>
              {formatCurrency(movimentiTotals.saldo)}
            </span>
          </div>
        </div>
      </div>

      <div className="dettaglio-conto-layout">
        {/* Sidebar filtri */}
        <div className="dettaglio-conto-filters-sidebar">
          <div className="dettaglio-conto-filters-header">
            <h3>Filtri</h3>
            <button type="button" className="btn btn-tertiary btn-sm" onClick={handleResetFilters}>
              Pulisci
            </button>
          </div>

          <div className="dettaglio-conto-filters-content">
            <div className="filter-group-vertical">
              <label>Tipo movimento</label>
              <SmartSelect
                options={FILTRO_TIPO_OPTIONS}
                value={filters.tipo}
                onChange={(e) => setFilters((prev) => ({ ...prev, tipo: e.target.value }))}
                displayField="label"
                valueField="value"
                placeholder="Tutti"
              />
            </div>

            <div className="filter-group-vertical">
              <label>Stato</label>
              <SmartSelect
                options={FILTRO_STATO_OPTIONS}
                value={filters.stato}
                onChange={(e) => setFilters((prev) => ({ ...prev, stato: e.target.value }))}
                displayField="label"
                valueField="value"
                placeholder="Tutti"
              />
            </div>

            <div className="filter-group-vertical">
              <label>Categoria</label>
              <SmartSelect
                options={categoriaFilterOptions}
                value={filters.categoria}
                onChange={(e) => setFilters((prev) => ({ ...prev, categoria: e.target.value }))}
                displayField="label"
                valueField="value"
                placeholder="Tutte"
              />
            </div>

            <div className="filter-group-vertical">
              <label>Attrezzatura</label>
              <SmartSelect
                options={attrezzaturaFilterOptions}
                value={filters.attrezzatura}
                onChange={(e) => setFilters((prev) => ({ ...prev, attrezzatura: e.target.value }))}
                displayField="label"
                valueField="value"
                placeholder="Tutte"
              />
            </div>

            <div className="filter-group-vertical">
              <label>Partita</label>
              <SmartSelect
                options={partitaFilterOptions}
                value={filters.partita}
                onChange={(e) => setFilters((prev) => ({ ...prev, partita: e.target.value }))}
                displayField="label"
                valueField="value"
                placeholder="Tutte"
              />
            </div>

            <div className="filter-group-vertical">
              <label>Contratto Soccida</label>
              <SmartSelect
                options={contrattoSoccidaFilterOptions}
                value={filters.contratto_soccida}
                onChange={(e) => setFilters((prev) => ({ ...prev, contratto_soccida: e.target.value }))}
                displayField="label"
                valueField="value"
                placeholder="Tutti"
              />
            </div>

            <div className="filter-group-vertical">
              <label>Ricerca</label>
              <input
                type="text"
                placeholder="Descrizione o controparte"
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
              />
            </div>

            <div className="filter-group-vertical">
              <label>Periodo</label>
              <div className="date-range-vertical">
                <input
                  type="date"
                  value={filters.from}
                  onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))}
                  placeholder="Da"
                  title="Data da"
                />
                <span className="date-separator">→</span>
                <input
                  type="date"
                  value={filters.to}
                  onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))}
                  placeholder="A"
                  title="Data a"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Tabella movimenti */}
        <div className="dettaglio-conto-table-wrapper">
          {loading ? (
            <div className="loading">Caricamento movimenti...</div>
          ) : (
            <>
              <div className="table-container">
                <table className="data-table">
                  <thead className="table-header-sticky">
                    <tr>
                      <th>Data</th>
                      <th>Descrizione</th>
                      <th>Categoria</th>
                      <th>Controparte</th>
                      <th className="align-right">Dare</th>
                      <th className="align-right">Avere</th>
                      <th>Stato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedMovimenti.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="empty-state">
                          Nessun movimento per i criteri scelti
                        </td>
                      </tr>
                    ) : (
                      paginatedMovimenti.map((movimento) => (
                        <tr key={movimento.id}>
                          <td>{formatDate(movimento.data)}</td>
                          <td>{movimento.descrizione}</td>
                          <td>{movimento.categoria_label || movimento.categoria_nome || '-'}</td>
                          <td>{movimento.contropartita_nome || '-'}</td>
                          <td className="align-right">
                            {movimento.tipo_operazione === 'uscita'
                              ? formatCurrency(movimento.importo)
                              : '—'}
                          </td>
                          <td className="align-right">
                            {movimento.tipo_operazione === 'entrata'
                              ? formatCurrency(movimento.importo)
                              : '—'}
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                movimento.stato === 'definitivo' ? 'badge-success' : 'badge-warning'
                              }`}
                            >
                              {movimento.stato === 'definitivo' ? 'Definitivo' : 'Da confermare'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="pagination">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    ← Precedente
                  </button>
                  <span className="pagination-info">
                    Pagina {currentPage} di {totalPages}
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Successiva →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DettaglioContoPrimaNota;

