/**
 * AllevamentoHierarchy - Vista gerarchica interattiva
 * Navigazione: Sede → Stabilimento → Box (azienda unica dal contesto)
 */
import React, { useEffect, useState } from 'react';
import { useAzienda } from '../../../context/AziendaContext';
import LoadingSpinner from '../../../components/LoadingSpinner';
import './AllevamentoHierarchy.css';
import SedeView from './hierarchy/SedeView';
import StabilimentoView from './hierarchy/StabilimentoView';
import BoxView from './hierarchy/BoxView';

const AllevamentoHierarchy = () => {
  const { azienda, loading: aziendaLoading, error: aziendaError } = useAzienda();
  const [view, setView] = useState('sede'); // sede, stabilimento, box
  const [selectedSede, setSelectedSede] = useState(null);
  const [selectedStabilimento, setSelectedStabilimento] = useState(null);

  useEffect(() => {
    if (!azienda) {
      setView('sede');
      setSelectedSede(null);
      setSelectedStabilimento(null);
    }
  }, [azienda]);

  const resetToSede = () => {
    setView('sede');
    setSelectedSede(null);
    setSelectedStabilimento(null);
  };

  const navigateToSede = (sede) => {
    setSelectedSede(sede);
    setSelectedStabilimento(null);
    setView('stabilimento');
  };

  const navigateToStabilimento = (stabilimento) => {
    setSelectedStabilimento(stabilimento);
    setView('box');
  };

  if (aziendaLoading) {
    return (
      <div className="allevamento-hierarchy">
        <LoadingSpinner message="Caricamento azienda..." size="medium" />
      </div>
    );
  }

  if (aziendaError) {
    return (
      <div className="allevamento-hierarchy">
        <div className="empty-state">
          <p>Errore durante il caricamento dell&apos;azienda. Riprova dal modulo Profilo.</p>
        </div>
      </div>
    );
  }

  if (!azienda) {
    return (
      <div className="allevamento-hierarchy">
        <div className="empty-state">
          <h3>Nessuna azienda configurata</h3>
          <p>Configura l&apos;anagrafica aziendale nel modulo Profilo per iniziare a gestire l&apos;allevamento.</p>
        </div>
      </div>
    );
  };

  const navigateBack = (level) => {
    if (level === 'sede') {
      resetToSede();
    } else if (level === 'stabilimento' && selectedSede) {
      navigateToSede(selectedSede);
    }
  };

  return (
    <div className="allevamento-hierarchy">
      <div className="hierarchy-content">
        {view === 'sede' && (
          <SedeView
            azienda={azienda}
            onSelectSede={navigateToSede}
            onBack={null}
          />
        )}

        {view === 'stabilimento' && selectedSede && (
          <StabilimentoView
            sede={selectedSede}
            onSelectStabilimento={navigateToStabilimento}
            onBack={() => navigateBack('sede')}
          />
        )}

        {view === 'box' && selectedStabilimento && (
          <BoxView
            stabilimento={selectedStabilimento}
            onBack={() => navigateBack('stabilimento')}
          />
        )}
      </div>
    </div>
  );
};

export default AllevamentoHierarchy;

