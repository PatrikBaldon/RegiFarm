/**
 * Indicatore discreto di preload dati
 * 
 * Mostra una piccola barra di progresso quando i dati vengono caricati in background.
 * Si nasconde automaticamente quando il preload è completato.
 */

import React from 'react';
import './PreloadIndicator.css';

const PreloadIndicator = ({ isPreloading, progress, errors = [] }) => {
  // Non mostrare nulla se non sta caricando e non ci sono errori
  if (!isPreloading && errors.length === 0) {
    return null;
  }

  // Mostra solo errori se ci sono (dopo il completamento)
  if (!isPreloading && errors.length > 0) {
    // Filtra errori non critici (404 per endpoint opzionali)
    const criticalErrors = errors.filter(err => {
      const errStr = typeof err === 'string' ? err : err.message || String(err);
      // Ignora 404 per endpoint opzionali
      if (errStr.includes('404') || errStr.includes('Not Found')) {
        return false;
      }
      // Ignora errori CSP già risolti
      if (errStr.includes('Content Security Policy')) {
        return false;
      }
      return true;
    });

    // Se non ci sono errori critici, non mostrare nulla
    if (criticalErrors.length === 0) {
      return null;
    }

    return (
      <div className="preload-indicator preload-indicator--error">
        <span className="preload-indicator__icon">⚠️</span>
        <span className="preload-indicator__text">
          {criticalErrors.length} errori durante il caricamento
        </span>
        <details className="preload-indicator__details" style={{ marginTop: '4px', fontSize: '11px', opacity: 0.8 }}>
          <summary style={{ cursor: 'pointer' }}>Dettagli</summary>
          <ul style={{ margin: '4px 0', paddingLeft: '16px' }}>
            {criticalErrors.slice(0, 3).map((err, idx) => (
              <li key={idx} style={{ margin: '2px 0' }}>
                {typeof err === 'string' ? err : err.message || String(err)}
              </li>
            ))}
          </ul>
        </details>
      </div>
    );
  }

  return (
    <div className="preload-indicator">
      <div className="preload-indicator__content">
        <span className="preload-indicator__icon">⚡</span>
        <span className="preload-indicator__text">
          Ottimizzazione dati... {progress}%
        </span>
      </div>
      <div className="preload-indicator__bar">
        <div 
          className="preload-indicator__progress"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

export default PreloadIndicator;

