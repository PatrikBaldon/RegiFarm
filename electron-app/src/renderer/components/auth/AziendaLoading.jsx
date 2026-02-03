import React from 'react';
import './Auth.css';

const AziendaLoading = () => {
  return (
    <div className="auth-wrapper auth-wrapper--with-video">
      <div className="auth-card auth-card--liquid auth-card--visible">
        <h1>RegiFarm Pro</h1>
        <div style={{ textAlign: 'center', padding: '2rem 0' }}>
          <div className="loading-spinner" style={{
            width: '50px',
            height: '50px',
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #3498db',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1.5rem'
          }}></div>
          <p style={{ fontSize: '1.1rem', color: '#666', margin: 0 }}>
            Azienda in caricamento...
          </p>
          <p style={{ fontSize: '0.9rem', color: '#999', marginTop: '0.5rem' }}>
            Attendere prego
          </p>
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
};

export default AziendaLoading;

