/**
 * AnimalListView - List view of all animals
 */
import React, { useState, useEffect, useMemo } from 'react';
import SearchableSelect from '../../../components/SearchableSelect';
import { allevamentoService } from '../services/allevamentoService';
import './SediManager.css'; // Reuse styles

const AnimalListView = () => {
  const [animali, setAnimali] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    stato: '',
    box_id: '',
  });

  const statoOptions = useMemo(
    () => [
      { value: '', label: 'Tutti gli stati' },
      { value: 'presente', label: 'Presente' },
      { value: 'venduto', label: 'Venduto' },
      { value: 'deceduto', label: 'Deceduto' },
      { value: 'trasferito', label: 'Trasferito' },
      { value: 'macellato', label: 'Macellato' },
    ],
    [],
  );

  useEffect(() => {
    loadAnimali();
  }, [filters]);

  const loadAnimali = async () => {
    try {
      setLoading(true);
      const queryFilters = {};
      if (filters.stato) queryFilters.stato = filters.stato;
      if (filters.box_id) queryFilters.box_id = parseInt(filters.box_id);
      
      const data = await allevamentoService.getAnimali(queryFilters);
      setAnimali(data || []);
    } catch (err) {
      alert(`Errore nel caricamento: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sedi-manager">
      <div className="manager-header">
        <h2>Lista Animali</h2>
        <div style={{ minWidth: '220px' }}>
          <SearchableSelect
            className="select-compact"
            options={statoOptions}
            value={filters.stato}
            onChange={(e) => setFilters({ ...filters, stato: e.target.value })}
            displayField="label"
            valueField="value"
            placeholder="Tutti gli stati"
          />
        </div>
      </div>

      <div className="table-container">
        {loading ? (
          <div className="loading">Caricamento...</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Auricolare</th>
                <th>Razza</th>
                <th>Sesso</th>
                <th>Data Nascita</th>
                <th>Data Arrivo</th>
                <th>Peso Arrivo</th>
                <th>Tipo Allevamento</th>
                <th>Stato</th>
              </tr>
            </thead>
            <tbody>
              {animali.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '40px' }}>
                    Nessun animale trovato
                  </td>
                </tr>
              ) : (
                animali.map(animale => (
                  <tr key={animale.id}>
                    <td><strong>{animale.auricolare}</strong></td>
                    <td>{animale.razza || '-'}</td>
                    <td>{animale.sesso || '-'}</td>
                    <td>{animale.data_nascita || '-'}</td>
                    <td>{animale.data_arrivo || '-'}</td>
                    <td>{animale.peso_arrivo ? `${animale.peso_arrivo} kg` : '-'}</td>
                    <td>{animale.tipo_allevamento || '-'}</td>
                    <td>
                      <span className={`badge ${animale.stato === 'presente' ? 'badge-success' : animale.stato === 'deceduto' ? 'badge-danger' : 'badge-warning'}`}>
                        {animale.stato}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default AnimalListView;

