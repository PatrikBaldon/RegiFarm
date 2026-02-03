/**
 * LoadingSpinner - Componente riutilizzabile per mostrare una rotella di caricamento
 */
import React from 'react';
import './LoadingSpinner.css';

const LoadingSpinner = ({ 
  message = 'Caricamento in corso...', 
  fullScreen = false,
  size = 'large' // 'small', 'medium', 'large'
}) => {
  const sizeClass = `spinner--${size}`;
  const containerClass = fullScreen ? 'loading-spinner-container loading-spinner-container--fullscreen' : 'loading-spinner-container';

  return (
    <div className={containerClass}>
      <div className="loading-spinner-content">
        <div className={`spinner ${sizeClass}`}>
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
        </div>
        {message && (
          <p className="loading-message" style={{ marginTop: '1rem' }}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
};

export default LoadingSpinner;

