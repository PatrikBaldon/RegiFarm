import React, { useState } from 'react';

import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../LoadingSpinner';
import './Auth.css';

const Login = ({ introFinished = true, showVideoBackground = false, onSwitchToRegister, showLoading = false, loadingMessage: propLoadingMessage }) => {
  const { signIn, loading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState(null);
  
  // Usa il messaggio passato come prop o un messaggio di default
  const loadingMessage = propLoadingMessage || 'Caricamento in corso...';

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError(null);

    if (!email || !password) {
      setFormError('Inserisci email e password.');
      return;
    }

    try {
      await signIn(email, password);
    } catch (err) {

      // Messaggi di errore più chiari
      let errorMessage = 'Accesso non riuscito.';
      if (err?.message) {
        if (err.message.includes('database') || err.message.includes('connessione') || 
            err.message.includes('server') || err.message.includes('timeout')) {
          errorMessage = 'Errore di connessione al server. Verifica che il backend sia in esecuzione e che il database sia disponibile.';
        } else if (err.message.includes('Invalid login credentials') || err.message.includes('Email not confirmed')) {
          errorMessage = 'Credenziali non valide. Verifica email e password.';
        } else {
          errorMessage = err.message;
        }
      }
      setFormError(errorMessage);
    }
  };

  // Se showLoading è true, mostra il LoadingSpinner con rotelle verdi invece del form
  if (showLoading) {
    return (
      <div className={`auth-wrapper ${showVideoBackground ? 'auth-wrapper--with-video' : ''}`}>
        <div className={`auth-card auth-card--liquid auth-card--visible`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
          <h1 style={{ marginBottom: '2rem' }}>RegiFarm Pro</h1>
          <LoadingSpinner 
            message={loadingMessage} 
            fullScreen={false}
            size="large"
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`auth-wrapper ${showVideoBackground ? 'auth-wrapper--with-video' : ''}`}>
      <div className={`auth-card auth-card--liquid auth-card--visible`}>
        <h1>RegiFarm Pro</h1>
        <p>Accedi con le credenziali ricevute da Regentia.</p>

        {(formError || error) && (
          <div className="auth-error">{formError || error?.message}</div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="es. utente@azienda.it"
              autoComplete="email"
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete="current-password"
            />
          </label>

          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? 'Accesso in corso…' : 'Accedi'}
          </button>
        </form>

        {onSwitchToRegister && (
          <div className="auth-switch">
            <span>Non hai un account?</span>
            <button 
              type="button" 
              className="auth-link-button"
              onClick={onSwitchToRegister}
            >
              Registrati
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
