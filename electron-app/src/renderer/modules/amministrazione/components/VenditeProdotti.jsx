/**
 * VenditeProdotti - Gestione vendite prodotti agricoli con bilanciamento costi terreni
 */
import React, { useState, useEffect } from 'react';
import SearchableSelect from '../../../components/SearchableSelect';
import { amministrazioneService } from '../services/amministrazioneService';
import { useAzienda } from '../../../context/AziendaContext';
import '../../alimentazione/components/Alimentazione.css';
import './VenditeProdotti.css';

const UNITA_MISURA_OPTIONS = [
  { value: 'kg', label: 'kg' },
  { value: 'q', label: 'q (quintali)' },
  { value: 't', label: 't (tonnellate)' },
];

const VenditeProdotti = () => {
  const { azienda } = useAzienda();
  const aziendaId = azienda?.id;

  const [vendite, setVendite] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedVendita, setSelectedVendita] = useState(null);
  const [formData, setFormData] = useState({
    azienda_id: null,
    prodotto: '',
    data_vendita: new Date().toISOString().split('T')[0],
    quantita: '',
    unita_misura: 'kg',
    prezzo_unitario: '',
    terreno_id: null,
    raccolto_id: null,
    acquirente: '',
    numero_fattura: '',
    numero_ddt: '',
    note: '',
  });

  useEffect(() => {
    if (aziendaId) {
      setFormData(prev => ({ ...prev, azienda_id: aziendaId }));
      loadVendite();
    }
  }, [aziendaId]);

  const loadVendite = async () => {
    if (!aziendaId) return;
    setLoading(true);
    try {
      const data = await amministrazioneService.getVenditeProdotti({ azienda_id: aziendaId });
      setVendite(data);
    } catch (error) {

      alert('Errore nel caricamento delle vendite');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!aziendaId) {
      alert('Nessuna azienda selezionata');
      return;
    }
    try {
      const importo_totale = parseFloat(formData.quantita) * parseFloat(formData.prezzo_unitario);
      const dataToSend = {
        ...formData,
        azienda_id: aziendaId,
        quantita: parseFloat(formData.quantita),
        prezzo_unitario: parseFloat(formData.prezzo_unitario),
        importo_totale,
      };

      if (selectedVendita) {
        await amministrazioneService.updateVenditaProdotto(selectedVendita.id, dataToSend);
      } else {
        await amministrazioneService.createVenditaProdotto(dataToSend);
      }
      setShowModal(false);
      resetForm();
      loadVendite();
    } catch (error) {

      alert('Errore nel salvataggio');
    }
  };

  const handleEdit = (vendita) => {
    setSelectedVendita(vendita);
    setFormData({
      ...vendita,
      data_vendita: vendita.data_vendita.split('T')[0],
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Sei sicuro di voler eliminare questa vendita?')) return;
    
    try {
      await amministrazioneService.deleteVenditaProdotto(id);
      loadVendite();
    } catch (error) {

      alert('Errore nell\'eliminazione');
    }
  };

  const resetForm = () => {
    setFormData({
      azienda_id: aziendaId,
      prodotto: '',
      data_vendita: new Date().toISOString().split('T')[0],
      quantita: '',
      unita_misura: 'kg',
      prezzo_unitario: '',
      terreno_id: null,
      raccolto_id: null,
      acquirente: '',
      numero_fattura: '',
      numero_ddt: '',
      note: '',
    });
    setSelectedVendita(null);
  };

  return (
    <div className="vendite-prodotti">
      <div className="header-actions">
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
          Nuova Vendita
        </button>
      </div>

      {loading ? (
        <div className="loading">Caricamento...</div>
      ) : (
        <div className="table-container">
          <table className="data-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Prodotto</th>
              <th>Quantità</th>
              <th>Prezzo Unit.</th>
              <th>Importo Totale</th>
              <th>Costi Terreno</th>
              <th>Margine</th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
              {vendite.length === 0 ? (
                <tr>
                  <td colSpan={8} className="empty-state">
                    Nessuna vendita trovata
                  </td>
                </tr>
              ) : (
                vendite.map(vendita => (
              <tr key={vendita.id}>
                <td>{new Date(vendita.data_vendita).toLocaleDateString('it-IT')}</td>
                <td>{vendita.prodotto}</td>
                <td>{vendita.quantita} {vendita.unita_misura}</td>
                <td>€{parseFloat(vendita.prezzo_unitario).toFixed(2)}</td>
                <td>€{parseFloat(vendita.importo_totale).toFixed(2)}</td>
                <td>€{parseFloat(vendita.costi_terreno_totale || 0).toFixed(2)}</td>
                <td className={vendita.margine >= 0 ? 'positive' : 'negative'}>
                  €{parseFloat(vendita.margine || 0).toFixed(2)}
                </td>
                <td>
                  <button className="btn-icon" onClick={() => handleEdit(vendita)} title="Modifica">✏️</button>
                  <button className="btn-icon" onClick={() => handleDelete(vendita.id)} title="Elimina">🗑️</button>
                </td>
              </tr>
                ))
              )}
          </tbody>
        </table>
        </div>
      )}

      {showModal && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{selectedVendita ? 'Modifica Vendita' : 'Nuova Vendita'}</h3>
              <button className="close-button" onClick={() => { setShowModal(false); resetForm(); }}>
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Prodotto *</label>
                <input
                  type="text"
                  value={formData.prodotto}
                  onChange={(e) => setFormData({ ...formData, prodotto: e.target.value })}
                  required
                  placeholder="es. Mais, Grano, Fieno..."
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Data Vendita *</label>
                  <input
                    type="date"
                    value={formData.data_vendita}
                    onChange={(e) => setFormData({ ...formData, data_vendita: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Quantità *</label>
                  <input
                    type="number"
                    step="0.001"
                    value={formData.quantita}
                    onChange={(e) => setFormData({ ...formData, quantita: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Unità Misura</label>
                <SearchableSelect
                  className="select-compact"
                  options={UNITA_MISURA_OPTIONS}
                  value={formData.unita_misura}
                  onChange={(e) => setFormData({ ...formData, unita_misura: e.target.value })}
                  displayField="label"
                  valueField="value"
                  placeholder="Unità di misura"
                />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Prezzo Unitario (€) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.prezzo_unitario}
                    onChange={(e) => setFormData({ ...formData, prezzo_unitario: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Acquirente</label>
                  <input
                    type="text"
                    value={formData.acquirente}
                    onChange={(e) => setFormData({ ...formData, acquirente: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Numero Fattura</label>
                  <input
                    type="text"
                    value={formData.numero_fattura}
                    onChange={(e) => setFormData({ ...formData, numero_fattura: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Numero DDT</label>
                  <input
                    type="text"
                    value={formData.numero_ddt}
                    onChange={(e) => setFormData({ ...formData, numero_ddt: e.target.value })}
                  />
                </div>
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

export default VenditeProdotti;

