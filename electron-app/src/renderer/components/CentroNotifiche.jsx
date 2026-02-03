/**
 * Centro Notifiche - Componente per mostrare notifiche importanti nella home
 * Rimodulato con cards individuali cliccabili
 */
import React, { useState, useEffect } from 'react';
import hybridDataService from '../services/hybridDataService';
import './CentroNotifiche.css';

const CentroNotifiche = ({ aziendaId, setActiveModule }) => {
  const [notifiche, setNotifiche] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadNotifiche = async () => {
      if (!aziendaId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Usa hybridDataService per performance ottimali (database locale < 5ms)
        const data = await hybridDataService.getNotifiche(aziendaId);
        // Il backend/hybrid restituisce { notifiche: [...], total: N }
        setNotifiche(data.notifiche || []);
      } catch (error) {
        console.error('Errore nel caricamento notifiche:', error);
        setNotifiche([]);
      } finally {
        setLoading(false);
      }
    };

    loadNotifiche();
  }, [aziendaId]);

  const handleNotificationClick = (notifica) => {
    if (!notifica.link || !setActiveModule) return;
    
    const { modulo, tipo, id, attrezzatura_id } = notifica.link;
    
    // Naviga al modulo appropriato
    setActiveModule(modulo);
    
    // Se c'è un ID specifico, potremmo voler aprire direttamente il record
    // Questo dipende da come è strutturata la navigazione nell'app
    // Per ora, apriamo solo il modulo e lasciamo che l'utente trovi il record
    // In futuro si potrebbe implementare una navigazione diretta al record
    setTimeout(() => {
      // Emetti un evento custom per aprire il record specifico se necessario
      window.dispatchEvent(new CustomEvent('openNotificationRecord', {
        detail: { tipo, id, attrezzatura_id, modulo }
      }));
    }, 100);
  };

  const getUrgenzaIcon = (urgenza) => {
    switch (urgenza) {
      case 'scaduta':
        return '🔴';
      case 'in_scadenza':
        return '🟡';
      case 'info':
        return '🔵';
      default:
        return '⚪';
    }
  };

  const getUrgenzaClass = (urgenza) => {
    switch (urgenza) {
      case 'scaduta':
        return 'notifica-urgente';
      case 'in_scadenza':
        return 'notifica-warning';
      case 'info':
        return 'notifica-info';
      default:
        return '';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  };

  if (loading) {
    return (
      <section className="centro-notifiche-section">
        <div className="loading-state">
          <p>Caricamento notifiche...</p>
        </div>
      </section>
    );
  }

  if (notifiche.length === 0) {
    return (
      <section className="centro-notifiche-section">
        <div className="notifiche-empty">
          <p>🎉 Nessuna notifica urgente. Tutto a posto!</p>
        </div>
      </section>
    );
  }

  return (
    <section className="centro-notifiche-section">
      <div className="notifiche-grid-cards">
        {notifiche.map((notifica, index) => (
          <div
            key={`${notifica.tipo}-${notifica.id}-${index}`}
            className={`notifica-card-clickable ${getUrgenzaClass(notifica.urgenza)}`}
            onClick={() => handleNotificationClick(notifica)}
          >
            <div className="notifica-card-header">
              <div className="notifica-icon-urgenza">
                {getUrgenzaIcon(notifica.urgenza)}
              </div>
              <div className="notifica-card-title-section">
                <h3 className="notifica-card-title">{notifica.titolo}</h3>
                <span className="notifica-card-type">
                  {notifica.tipo === 'polizza_attrezzatura' && '🔧 Polizza Attrezzatura'}
                  {notifica.tipo === 'polizza_aziendale' && '🏢 Polizza Aziendale'}
                  {notifica.tipo === 'fattura' && '💰 Fattura'}
                </span>
              </div>
            </div>
            <div className="notifica-card-content">
              <p className="notifica-card-description">{notifica.descrizione}</p>
              {notifica.data_scadenza && (
                <div className="notifica-card-date">
                  <strong>Scadenza:</strong> {formatDate(notifica.data_scadenza)}
                </div>
              )}
            </div>
            <div className="notifica-card-footer">
              <span className="notifica-card-action">Clicca per aprire →</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default CentroNotifiche;
