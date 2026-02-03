import React, { useState } from 'react';

import api from '../../services/api';
import './Auth.css';

const Register = ({ onSwitchToLogin, showVideoBackground = false }) => {
  const [email, setEmail] = useState('');
  const [nome, setNome] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError(null);

    if (!email) {
      setFormError('Inserisci la tua email.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/onboarding/register', {
        email,
        nome: nome || null,
        note: note || null,
      });
      setSuccess(true);
    } catch (err) {

      let errorMessage = 'Registrazione non riuscita.';
      if (err?.message) {
        if (err.message.includes('già registrata') || err.message.includes('already')) {
          errorMessage = 'Questa email è già registrata. Prova ad accedere.';
        } else if (err.message.includes('invalid') || err.message.includes('Invalid')) {
          errorMessage = 'Email non valida.';
        } else {
          errorMessage = err.message;
        }
      }
      setFormError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className={`auth-wrapper ${showVideoBackground ? 'auth-wrapper--with-video' : ''}`}>
        <div className={`auth-card auth-card--liquid auth-card--visible`}>
          <div className="auth-pending-icon">⏳</div>
          <h1>Richiesta Inviata!</h1>
          <div className="auth-success">
            La tua richiesta di accesso è stata inviata con successo.
          </div>
          <p className="auth-pending-message">
            Un amministratore esaminerà la tua richiesta e ti invierà le credenziali 
            di accesso via email una volta approvata.
          </p>
          <button 
            type="button" 
            className="auth-button"
            onClick={onSwitchToLogin}
          >
            Torna al Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`auth-wrapper ${showVideoBackground ? 'auth-wrapper--with-video' : ''}`}>
      <div className={`auth-card auth-card--liquid auth-card--visible`}>
        <h1>RegiFarm Pro</h1>
        <p>Richiedi l'accesso all'applicazione.</p>

        {formError && (
          <div className="auth-error">{formError}</div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Email *
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="es. utente@azienda.it"
              autoComplete="email"
              required
            />
          </label>

          <label>
            Nome (opzionale)
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Il tuo nome"
              autoComplete="name"
            />
          </label>

          <label>
            Motivo della richiesta (opzionale)
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Perché vuoi accedere a RegiFarm Pro?"
              rows={3}
              className="auth-textarea"
            />
          </label>

          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? 'Invio in corso…' : 'Richiedi Accesso'}
          </button>
        </form>

        <div className="auth-switch">
          <span>Hai già le credenziali?</span>
          <button 
            type="button" 
            className="auth-link-button"
            onClick={onSwitchToLogin}
          >
            Accedi
          </button>
        </div>
      </div>
    </div>
  );
};

export default Register;

