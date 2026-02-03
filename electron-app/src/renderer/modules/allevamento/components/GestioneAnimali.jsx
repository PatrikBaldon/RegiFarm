/**
 * GestioneAnimali - Vista unificata per ricerca, assegnazione e gestione piani di uscita.
 */
import React, { useCallback, useEffect, useState } from 'react';
import AnimalSearch from './AnimalSearch';
import AssignToBoxModal from './AssignToBoxModal';
import CreatePianoUscitaModal from './CreatePianoUscitaModal';
import PianiUscitaManager from './PianiUscitaManager';
import './GestioneAnimali.css';
import { useAzienda } from '../../../context/AziendaContext';
import { allevamentoService } from '../services/allevamentoService';

const GestioneAnimali = () => {
  const { azienda } = useAzienda();
  const aziendaId = azienda?.id;

  const [activeTab, setActiveTab] = useState('ricerca'); // 'ricerca' o 'piani'
  const [selection, setSelection] = useState({ ids: [], items: [] });
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [createPianoModalOpen, setCreatePianoModalOpen] = useState(false);

  const [piani, setPiani] = useState([]);
  const [pianiLoading, setPianiLoading] = useState(false);
  const [pianiError, setPianiError] = useState(null);
  const [selectedPiano, setSelectedPiano] = useState(null);

  const selectedPianoId = selectedPiano?.id ?? null;

  // Usa un ref per selectedPianoId per evitare loop di dipendenze
  const selectedPianoIdRef = React.useRef(selectedPianoId);
  React.useEffect(() => {
    selectedPianoIdRef.current = selectedPianoId;
  }, [selectedPianoId]);

  const loadPiani = useCallback(
    async (keepSelection = true) => {
      if (!aziendaId) {
        setPiani([]);
        setSelectedPiano(null);
        return;
      }

      // Se i dati sono già nello state e non è forzato, non ricaricare
      if (piani.length > 0 && keepSelection) {
        return;
      }

      setPianiLoading(true);
      setPianiError(null);
      try {
        const response = await allevamentoService.getPianiUscita({ azienda_id: aziendaId });
        const list = Array.isArray(response) ? response : response?.data || [];
        setPiani(list);
        // Usa il ref per evitare dipendenze circolari
        const currentSelectedId = selectedPianoIdRef.current;
        if (keepSelection && currentSelectedId) {
          const stillPresent = list.find((p) => p.id === currentSelectedId);
          setSelectedPiano(stillPresent || null);
        } else if (!keepSelection) {
          setSelectedPiano(list[0] || null);
        }
      } catch (err) {
        // Per errori 503, gestisci silenziosamente
        if (err.status === 503 || err.isServiceUnavailable) {
          setPianiError(null); // Non mostrare errore per 503
          setPiani([]);
          setSelectedPiano(null);
        } else {

        setPianiError(err.message || 'Impossibile caricare i piani di uscita');
        setPiani([]);
        setSelectedPiano(null);
        }
      } finally {
        setPianiLoading(false);
      }
    },
    [aziendaId, piani.length], // Rimosso selectedPianoId - usa ref invece
  );

  // Carica i piani solo quando cambia l'azienda
  useEffect(() => {
    loadPiani(false);
  }, [aziendaId]); // Dipende direttamente da aziendaId, non da loadPiani

  useEffect(() => {
    const ensureDetail = async () => {
      if (selectedPiano && selectedPiano.id && !selectedPiano.animali) {
        try {
          const dettagli = await allevamentoService.getPianoUscita(selectedPiano.id);
          if (dettagli) {
            setSelectedPiano(dettagli);
          }
        } catch (err) {

        }
      }
    };
    ensureDetail();
  }, [selectedPiano]);

  const handleSelectionChange = useCallback((nextSelection) => {
    setSelection(nextSelection);
  }, []);

  const handleAssignCompleted = useCallback(() => {
    setAssignModalOpen(false);
    setSelection({ ids: [], items: [] });
  }, []);

  const handleCreatePianoModal = useCallback(() => {
    if (!selection.items.length) return;
    setCreatePianoModalOpen(true);
  }, [selection.items.length]);

  const handlePianoCreated = useCallback(
    async (created) => {
      await loadPiani();
      setSelection({ ids: [], items: [] });
      if (created?.id) {
        try {
          const pianoCompleto = await allevamentoService.getPianoUscita(created.id);
          setSelectedPiano(pianoCompleto || created);
          // Passa alla tab piani dopo la creazione
          setActiveTab('piani');
        } catch (err) {

          setSelectedPiano(created);
          setActiveTab('piani');
        }
      }
    },
    [loadPiani],
  );

  const handleAddToExistingPiano = useCallback(
    async (piano, animali) => {
      if (!piano?.id || !animali?.length) return;
      try {
        await allevamentoService.addAnimaliToPiano(
          piano.id,
          animali.map((a) => a.id),
        );
        await loadPiani();
        setSelection({ ids: [], items: [] });
        const aggiornato = await allevamentoService.getPianoUscita(piano.id);
        setSelectedPiano(aggiornato || piano);
      } catch (err) {

        alert(err.message || 'Impossibile aggiungere gli animali al piano selezionato');
      }
    },
    [loadPiani],
  );

  const handleUpdateNote = useCallback(async (piano, note) => {
    if (!piano?.id) return;
    try {
      await allevamentoService.updatePianoUscita(piano.id, { note });
      setSelectedPiano((prev) => (prev && prev.id === piano.id ? { ...prev, note } : prev));
      setPiani((prev) =>
        prev.map((p) => (p.id === piano.id ? { ...p, note } : p)),
      );
    } catch (err) {

      alert(err.message || 'Impossibile aggiornare le note del piano');
    }
  }, []);

  const handleRemoveAnimale = useCallback(
    async (piano, animale) => {
      if (!piano?.id || !animale?.id) return;
      if (!window.confirm(`Rimuovere l'animale ${animale.auricolare || animale.id} dal piano?`)) {
        return;
      }
      try {
        await allevamentoService.removeAnimaleFromPiano(piano.id, animale.id);
        await loadPiani();
        const aggiornato = await allevamentoService.getPianoUscita(piano.id);
        setSelectedPiano(aggiornato || piano);
      } catch (err) {

        alert(err.message || 'Impossibile rimuovere l\'animale dal piano');
      }
    },
    [loadPiani],
  );

  const handleDeletePiano = useCallback(
    async (piano) => {
      if (!piano?.id) return;
      if (!window.confirm(`Eliminare definitivamente il piano "${piano.nome || piano.id}"?`)) {
        return;
      }
      try {
        await allevamentoService.deletePianoUscita(piano.id);
        await loadPiani(false);
      } catch (err) {

        alert(err.message || 'Impossibile eliminare il piano selezionato');
      }
    },
    [loadPiani],
  );

  return (
    <div className="gestione-animali">
      <div className="gestione-tabs">
        <button
          className={`tab-button ${activeTab === 'ricerca' ? 'active' : ''}`}
          onClick={() => setActiveTab('ricerca')}
        >
          Ricerca Animali
        </button>
        <button
          className={`tab-button ${activeTab === 'piani' ? 'active' : ''}`}
          onClick={() => setActiveTab('piani')}
        >
          Piani di Uscita
        </button>
      </div>

      <div className="gestione-content">
        {activeTab === 'ricerca' && (
        <AnimalSearch
          mode="gestione"
          selection={selection}
          onSelectionChange={handleSelectionChange}
          onRequestAssignBox={() => setAssignModalOpen(true)}
          onRequestCreatePiano={handleCreatePianoModal}
          onRequestAddToPiano={handleAddToExistingPiano}
          selectedPiano={selectedPiano}
        />
        )}

        {activeTab === 'piani' && (
          <>
            <div className="piani-info-section">
              <h3>Come creare un piano di uscita</h3>
              <ol className="piani-instructions">
                <li>Vai alla tab <strong>"Ricerca Animali"</strong></li>
                <li>Seleziona gli animali che vuoi includere nel piano usando i checkbox</li>
                <li>Clicca su <strong>"Nuovo piano di uscita"</strong> nella barra delle azioni</li>
                <li>Inserisci nome, data di uscita (opzionale) e note per il piano</li>
                <li>Conferma la creazione: il piano verrà salvato e apparirà in questa tab</li>
                <li>Puoi anche aggiungere animali a un piano esistente selezionandoli e cliccando <strong>"Aggiungi a [nome piano]"</strong></li>
              </ol>
              <p className="piani-note">
                <strong>Nota:</strong> I piani di uscita permettono di organizzare gruppi di animali per operazioni di vendita, macellazione o trasferimento.
              </p>
            </div>
        <PianiUscitaManager
          piani={piani}
          loading={pianiLoading}
          error={pianiError}
          selectedId={selectedPiano?.id}
          onSelect={(piano) => setSelectedPiano(piano)}
          onRefresh={() => loadPiani()}
          onUpdateNote={handleUpdateNote}
          onRemoveAnimale={handleRemoveAnimale}
          onDeletePiano={handleDeletePiano}
        />
          </>
        )}
      </div>

      <AssignToBoxModal
        open={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        animali={selection.items}
        aziendaId={aziendaId}
        onCompleted={handleAssignCompleted}
      />

      <CreatePianoUscitaModal
        open={createPianoModalOpen}
        onClose={() => setCreatePianoModalOpen(false)}
        animali={selection.items}
        aziendaId={aziendaId}
        onCreated={handlePianoCreated}
      />
    </div>
  );
};

export default GestioneAnimali;

