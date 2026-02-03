import React, { useEffect, useMemo, useState } from 'react';
import SmartSelect from '../../../components/SmartSelect';
import BaseModal from '../../../components/BaseModal';
import { allevamentoService } from '../services/allevamentoService';

const AssignToBoxModal = ({ open, onClose, animali = [], aziendaId, onCompleted }) => {
  const [sedi, setSedi] = useState([]);
  const [stabilimenti, setStabilimenti] = useState([]);
  const [boxes, setBoxes] = useState([]);
  const [selectedSede, setSelectedSede] = useState('');
  const [selectedStabilimento, setSelectedStabilimento] = useState('');
  const [selectedBox, setSelectedBox] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    if (open && aziendaId) {
      loadSedi(aziendaId);
    }
  }, [open, aziendaId]);

  useEffect(() => {
    if (selectedSede) {
      loadStabilimenti(selectedSede);
      setSelectedStabilimento('');
      setBoxes([]);
      setSelectedBox('');
    } else {
      setStabilimenti([]);
      setBoxes([]);
      setSelectedBox('');
    }
  }, [selectedSede]);

  useEffect(() => {
    if (selectedStabilimento) {
      loadBoxes(selectedStabilimento);
      setSelectedBox('');
    } else {
      setBoxes([]);
      setSelectedBox('');
    }
  }, [selectedStabilimento]);

  const sedeOptions = useMemo(
    () => [
      { value: '', label: 'Seleziona sede...' },
      ...sedi.map((s) => ({
        value: String(s.id),
        label: s.nome && s.codice_stalla ? `${s.nome} (${s.codice_stalla})` : s.nome || `Sede #${s.id}`,
      })),
    ],
    [sedi],
  );

  const stabilimentoOptions = useMemo(
    () => [
      { value: '', label: 'Seleziona stabilimento...' },
      ...stabilimenti.map((s) => ({ value: String(s.id), label: s.nome || `Stabilimento #${s.id}` })),
    ],
    [stabilimenti],
  );

  const boxOptions = useMemo(
    () => [
      { value: '', label: 'Seleziona box...' },
      ...boxes.map((box) => ({
        value: String(box.id),
        label: box.nome
          ? `${box.nome}${box.codice ? ` (${box.codice})` : ''}`
          : box.codice
            ? box.codice
            : `Box #${box.id}`,
      })),
    ],
    [boxes],
  );

  const loadSedi = async (azienda) => {
    try {
      const data = await allevamentoService.getSedi(azienda);
      setSedi(data || []);
    } catch (err) {
      setSedi([]);
    }
  };

  const loadStabilimenti = async (sedeId) => {
    try {
      const data = await allevamentoService.getStabilimenti(sedeId);
      setStabilimenti(data || []);
    } catch (err) {
      setStabilimenti([]);
    }
  };

  const loadBoxes = async (stabilimentoId) => {
    try {
      const data = await allevamentoService.getBox(stabilimentoId);
      setBoxes(data || []);
    } catch (err) {
      setBoxes([]);
    }
  };

  const handleConfirm = async () => {
    if (!selectedBox) {
      setError('Seleziona un box di destinazione');
      return;
    }
    if (!animali.length) {
      setError('Nessun animale selezionato');
      return;
    }
    setError(null);
    setSuccessMessage(null);
    setLoading(true);
    let success = 0;
    let failed = 0;
    for (const animale of animali) {
      try {
        await allevamentoService.createMovimentazione({
          animale_id: animale.id,
          a_box_id: parseInt(selectedBox, 10),
        });
        success += 1;
      } catch (err) {

        failed += 1;
      }
    }
    setLoading(false);
    setSuccessMessage(`Assegnati ${success} animali${failed ? `, errori: ${failed}` : ''}.`);
    if (typeof onCompleted === 'function') {
      onCompleted({ success, failed, destBox: selectedBox });
    }
  };

  const handleClose = () => {
    setError(null);
    setSuccessMessage(null);
    setSelectedSede('');
    setSelectedStabilimento('');
    setBoxes([]);
    setSelectedBox('');
    onClose?.();
  };

  return (
    <BaseModal
      isOpen={open}
      onClose={handleClose}
      title="Assegna animali a un box"
      size="medium"
      footerActions={
        <>
          <button type="button" className="btn btn-secondary" onClick={handleClose} disabled={loading}>
            Annulla
          </button>
          <button type="button" className="btn btn-primary" onClick={handleConfirm} disabled={loading}>
            {loading ? 'Assegnazione in corso...' : 'Conferma assegnazione'}
          </button>
        </>
      }
    >
      <div>
          <p>
            Stai assegnando <strong>{animali.length}</strong> animale
            {animali.length === 1 ? '' : 'i'} al box selezionato.
          </p>

        <div className="form-group">
          <label>Sede</label>
          <SmartSelect
              options={sedeOptions}
              value={selectedSede}
              onChange={(e) => setSelectedSede(e.target.value)}
              displayField="label"
              valueField="value"
              placeholder="Seleziona la sede"
              disabled={!aziendaId}
              className="select-compact"
            />
        </div>

        <div className="form-group">
          <label>Stabilimento</label>
          <SmartSelect
              options={stabilimentoOptions}
              value={selectedStabilimento}
              onChange={(e) => setSelectedStabilimento(e.target.value)}
              displayField="label"
              valueField="value"
              placeholder="Seleziona lo stabilimento"
              disabled={!selectedSede}
              className="select-compact"
            />
        </div>

        <div className="form-group">
          <label>Box</label>
          <SmartSelect
              options={boxOptions}
              value={selectedBox}
              onChange={(e) => setSelectedBox(e.target.value)}
              displayField="label"
              valueField="value"
              placeholder="Seleziona il box"
              disabled={!selectedStabilimento}
              className="select-compact"
            />
        </div>

          {error && <div className="alert alert-error">{error}</div>}
          {successMessage && <div className="alert alert-success">{successMessage}</div>}
        </div>
    </BaseModal>
  );
};

export default AssignToBoxModal;

