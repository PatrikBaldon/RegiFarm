/**
 * Somministrazioni - Componente unificato che contiene storico e modale per nuova somministrazione
 */
import React, { useState, useRef } from 'react';
import StoricoSomministrazioni from './StoricoSomministrazioni';
import RegistraSomministrazione from './RegistraSomministrazione';
import RegistraSomministrazioneGruppo from './RegistraSomministrazioneGruppo';
import BaseModal from '../../../components/BaseModal';
import '../../alimentazione/components/Alimentazione.css';

const Somministrazioni = () => {
  const [showModal, setShowModal] = useState(false);
  const [showModalGruppo, setShowModalGruppo] = useState(false);
  const [modalType, setModalType] = useState('singola'); // 'singola' o 'gruppo'
  const [refreshKey, setRefreshKey] = useState(0);
  const [loadingSingola, setLoadingSingola] = useState(false);
  const [loadingGruppo, setLoadingGruppo] = useState(false);
  const formRefSingola = useRef(null);
  const formRefGruppo = useRef(null);

  const handleNewSomministrazione = () => {
    setModalType('singola');
    setShowModal(true);
  };

  const handleNewSomministrazioneGruppo = () => {
    setModalType('gruppo');
    setShowModalGruppo(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    // Forza il refresh dello storico dopo aver chiuso la modale
    setRefreshKey(prev => prev + 1);
  };

  const handleCloseModalGruppo = () => {
    setShowModalGruppo(false);
    // Forza il refresh dello storico dopo aver chiuso la modale
    setRefreshKey(prev => prev + 1);
  };

  const handleSuccess = () => {
    setShowModal(false);
    // Forza il refresh dello storico dopo aver salvato
    setRefreshKey(prev => prev + 1);
  };

  const handleSuccessGruppo = () => {
    setShowModalGruppo(false);
    // Forza il refresh dello storico dopo aver salvato
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="somministrazioni-container">
      <div key={refreshKey}>
        <StoricoSomministrazioni 
          onNewClick={handleNewSomministrazione}
          onNewGruppoClick={handleNewSomministrazioneGruppo}
        />
      </div>

      <BaseModal
        isOpen={showModal}
        onClose={handleCloseModal}
        title="Nuova Somministrazione"
        size="large"
        footerActions={
          <>
            <button className="btn btn-secondary" onClick={handleCloseModal}>
              Annulla
            </button>
            <button 
              className="btn btn-primary" 
              onClick={() => {
                if (formRefSingola.current) {
                  formRefSingola.current.submit();
                }
              }}
            >
              Salva
            </button>
          </>
        }
      >
        <RegistraSomministrazione 
          ref={formRefSingola}
          onSuccess={handleSuccess}
          onCancel={handleCloseModal}
          isModal={true}
        />
      </BaseModal>

      <BaseModal
        isOpen={showModalGruppo}
        onClose={handleCloseModalGruppo}
        title="Somministrazione di Gruppo"
        size="xlarge"
        footerActions={
          <>
            <button className="btn btn-secondary" onClick={handleCloseModalGruppo}>
              Annulla
            </button>
            <button 
              className="btn btn-primary" 
              onClick={() => {
                if (formRefGruppo.current) {
                  formRefGruppo.current.submit();
                }
              }}
            >
              Salva
            </button>
          </>
        }
      >
        <RegistraSomministrazioneGruppo 
          ref={formRefGruppo}
          onSuccess={handleSuccessGruppo}
          onCancel={handleCloseModalGruppo}
          isModal={true}
        />
      </BaseModal>
    </div>
  );
};

export default Somministrazioni;

