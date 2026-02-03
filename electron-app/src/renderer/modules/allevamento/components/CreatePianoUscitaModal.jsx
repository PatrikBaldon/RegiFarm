import React, { useState } from 'react';
import BaseModal from '../../../components/BaseModal';
import { allevamentoService } from '../services/allevamentoService';

const CreatePianoUscitaModal = ({ open, onClose, animali = [], aziendaId, onCreated }) => {
  const [nome, setNome] = useState('');
  const [dataUscita, setDataUscita] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleConfirm = async () => {
    if (!nome.trim()) {
      setError('Inserisci un nome per il piano di uscita');
      return;
    }
    if (!animali.length) {
      setError('Seleziona almeno un animale per creare il piano');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload = {
        nome: nome.trim(),
        note: note || null,
        animale_ids: animali.map((a) => a.id),
      };
      if (dataUscita) {
        payload.data_uscita = dataUscita;
      }
      if (aziendaId) {
        payload.azienda_id = aziendaId;
      }
      const piano = await allevamentoService.createPianoUscita(payload);
      if (typeof onCreated === 'function') {
        onCreated(piano);
      }
      setNome('');
      setDataUscita('');
      setNote('');
      onClose?.();
    } catch (err) {

      setError(err.message || 'Impossibile creare il piano di uscita');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setError(null);
    setNome('');
    setDataUscita('');
    setNote('');
    onClose?.();
  };

  return (
    <BaseModal
      isOpen={open}
      onClose={handleClose}
      title="Nuovo piano di uscita"
      size="medium"
      footerActions={
        <>
          <button type="button" className="btn btn-secondary" onClick={handleClose} disabled={loading}>
            Annulla
          </button>
          <button type="button" className="btn btn-primary" onClick={handleConfirm} disabled={loading}>
            {loading ? 'Creazione in corso...' : 'Crea piano'}
          </button>
        </>
      }
    >
      <div>
          <p>
            Il piano comprenderà <strong>{animali.length}</strong> animale
            {animali.length === 1 ? '' : 'i'} selezionati.
          </p>

        <div className="form-group">
          <label>Nome piano</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Es. Partenza 12/09 stabilimento A"
              maxLength={120}
            className="form-input"
            />
        </div>

        <div className="form-group">
          <label>Data di uscita (opzionale)</label>
            <input
              type="date"
              value={dataUscita}
              onChange={(e) => setDataUscita(e.target.value)}
            className="form-input"
            />
        </div>

        <div className="form-group">
          <label>Note (opzionali)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              placeholder="Aggiungi eventuali note operative..."
            className="form-input"
            />
        </div>

        {error && <div className="alert alert-error">{error}</div>}
      </div>
    </BaseModal>
  );
};

export default CreatePianoUscitaModal;

