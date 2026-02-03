import React from 'react';

import { useAuth } from '../../context/AuthContext';
import './Auth.css';

const PendingApproval = () => {
  const { profile, signOut, loading } = useAuth();

  return (
    <div className="auth-wrapper auth-wrapper--with-video">
      <div className="auth-card auth-card--liquid auth-card--visible">
        <div className="auth-pending-icon">⏳</div>
        <h1>In Attesa di Approvazione</h1>
        
        <div className="auth-pending-denied">
          <p>
            Ciao <strong>{profile?.utente?.email || 'utente'}</strong>!
          </p>
          <p>
            La tua richiesta di accesso è stata ricevuta ed è in fase di revisione.
          </p>
          <p>
            Riceverai una notifica via email quando un amministratore 
            approverà il tuo account.
          </p>
        </div>

        <button 
          type="button" 
          className="auth-secondary-button" 
          onClick={signOut}
          disabled={loading}
        >
          {loading ? 'Disconnessione...' : 'Esci'}
        </button>
      </div>
    </div>
  );
};

export default PendingApproval;

