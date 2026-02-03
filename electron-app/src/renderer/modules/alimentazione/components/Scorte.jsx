import React, { useCallback, useEffect, useState } from 'react';
import './Alimentazione.css';
import {
  prefetchAlimentazioneScorte,
  getCachedAlimentazioneScorte,
} from '../prefetchers';
import { useRequest } from '../../../context/RequestContext';

const Scorte = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const hydrateScorte = useCallback(
    async ({ force = false } = {}) => {
      // Se i dati sono già nello state e non è forzato, non ricaricare
      if (!force && rows.length > 0) {
        return null;
      }

      const cached = getCachedAlimentazioneScorte();
      if (!force && Array.isArray(cached)) {
        setRows(cached);
        setError(null);
        setLoading(false);
        return cached;
      } else if (force) {
        setLoading(true);
      } else if (!cached) {
        setLoading(true);
      }

      try {
        const data = await prefetchAlimentazioneScorte({ force });
        if (Array.isArray(data)) {
          setRows(data);
          setError(null);
        }
        return data;
      } catch (err) {

        setError(err.message || 'Errore caricando le scorte');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [rows.length],
  );

  useEffect(() => {
    hydrateScorte();
  }, [hydrateScorte]);

  return (
    <div className="alimentazione-section">
      <div className="section-header">
        <h3>Scorte</h3>
      </div>
      {loading && <div className="loading">Caricamento...</div>}
      {error && <div className="alert alert-error">{error}</div>}
        {!loading && !error && (
        <div className="table-container">
          <table className="data-table">
              <thead>
                <tr>
                  <th>Componente ID</th>
                  <th>Mangime ID</th>
                  <th>Unità</th>
                  <th>Quantità disponibile</th>
                </tr>
              </thead>
              <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="empty-state">Nessuna scorta disponibile.</td>
                </tr>
              ) : (
                rows.map((r, idx) => (
                  <tr key={idx}>
                    <td>{r.componente_alimentare_id || '-'}</td>
                    <td>{r.mangime_confezionato_id || '-'}</td>
                    <td>{r.unita_misura}</td>
                    <td>{r.quantita_disponibile}</td>
                  </tr>
                ))
                )}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
};

export default Scorte;
