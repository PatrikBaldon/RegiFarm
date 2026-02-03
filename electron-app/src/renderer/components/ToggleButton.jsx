/**
 * ToggleButton - Componente toggle button classico
 * Sostituisce le checkbox con un toggle button standard
 */
import React from 'react';
import './ToggleButton.css';

const ToggleButton = ({
  checked,
  onChange,
  disabled = false,
  label,
  id,
  name,
  className = '',
  ...props
}) => {
  return (
    <div className={`toggle-button-wrapper ${className}`}>
      <button
        type="button"
        id={id}
        name={name}
        className={`toggle-button ${checked ? 'toggle-button-active' : ''} ${disabled ? 'toggle-button-disabled' : ''}`}
        onClick={onChange}
        disabled={disabled}
        role="switch"
        aria-checked={checked}
        {...props}
      >
        <span className="toggle-button-track">
          <span className="toggle-button-thumb"></span>
        </span>
      </button>
      {label && <span className="toggle-button-text">{label}</span>}
    </div>
  );
};

export default ToggleButton;

