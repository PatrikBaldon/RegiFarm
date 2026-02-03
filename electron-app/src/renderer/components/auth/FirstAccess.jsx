import React, { useState } from 'react';

import { useAuth } from '../../context/AuthContext';
import './Auth.css';

const FirstAccess = () => {
  const { profile, loading, completeFirstLogin, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [error, setError] = useState(null);

  if (!profile?.utente) {
    return null;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setFeedback(null);

    if (!password || !confirmPassword) {
      setError('Inserisci e conferma la nuova password.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Le password non coincidono.');
      return;
    }
    if (password.length < 8) {
      setError('La password deve contenere almeno 8 caratteri.');
      return;
    }

    try {
      await completeFirstLogin(password);
      setFeedback('Password aggiornata con successo!');
    } catch (err) {

      setError(err?.message || 'Impossibile completare il primo accesso.');
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <h1>Benvenuto in RegiFarm Pro</h1>
        <p>
          Ciao {profile.utente.email}! È il tuo primo accesso. Imposta una password
          definitiva per continuare.
        </p>

        {error && <div className="auth-error">{error}</div>}
        {feedback && <div className="auth-success">{feedback}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Nuova password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Almeno 8 caratteri"
              autoComplete="new-password"
            />
          </label>

          <label>
            Conferma password
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Ripeti la password"
              autoComplete="new-password"
            />
          </label>

          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? 'Salvataggio…' : 'Salva e accedi'}
          </button>
        </form>

        <button type="button" className="auth-secondary-button" onClick={signOut}>
          Esci
        </button>
      </div>
    </div>
  );
};

export default FirstAccess;
