/**
 * SimpleSelect - Dropdown senza ricerca per insiemi di opzioni piccoli
 */
import React, { useEffect, useRef, useState } from 'react';
import './SimpleSelect.css';

const SimpleSelect = ({
  options = [],
  value = '',
  onChange,
  placeholder = 'Seleziona...',
  displayField = 'label',
  valueField = 'value',
  required = false,
  disabled = false,
  className = '',
  allowEmpty = true, // se true mostra anche un'opzione vuota
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const menuRef = useRef(null);
  const [lastSelectedLabel, setLastSelectedLabel] = useState('');
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0 });
  const [useFixedPosition, setUseFixedPosition] = useState(false);

  const selected = options.find(opt => {
    const val = typeof opt === 'object' ? opt[valueField] : opt;
    return String(val) === String(value);
  });
  const selectedLabel = selected
    ? (typeof selected === 'object' ? selected[displayField] : selected)
    : '';
  const displayValue = selectedLabel || (value ? lastSelectedLabel : '');

  useEffect(() => {
    if (selectedLabel) {
      setLastSelectedLabel(selectedLabel);
    } else if (!value) {
      setLastSelectedLabel('');
    }
  }, [selectedLabel, value]);

  // Calcola la posizione del menu quando si apre
  useEffect(() => {
    if (open && containerRef.current) {
      const trigger = containerRef.current.querySelector('.simple-select-trigger');
      if (trigger) {
        const triggerRect = trigger.getBoundingClientRect();
        const formGroup = containerRef.current.closest('.form-group');
        const formGrid = formGroup?.closest('.form-grid');
        const isFirstRow = formGrid && (
          formGroup === formGrid.querySelector('.form-group:first-child') ||
          formGroup === formGrid.querySelector('.form-group:nth-child(2)') ||
          formGroup === formGrid.querySelector('.form-group:nth-child(3)') ||
          formGroup === formGrid.querySelector('.form-group:nth-child(4)')
        );
        const inReportAllevamento = containerRef.current.closest('.report-allevamento-sections');
        
        // Se è in un form-group con classe speciale (es. ddt-trasporto-mezzo-select) o in Report Allevamento, usa sempre fixed (menu sopra le sezioni, solo la tendina scrolla)
        const needsFixedPosition = isFirstRow || formGroup?.classList.contains('ddt-trasporto-mezzo-select') || !!inReportAllevamento;
        
        if (needsFixedPosition) {
          // Usa position: fixed per evitare scroll
          setMenuPosition({
            top: triggerRect.bottom + 4,
            left: triggerRect.left,
            width: triggerRect.width,
          });
          setUseFixedPosition(true);
        } else {
          setUseFixedPosition(false);
        }
      }
    } else {
      setUseFixedPosition(false);
    }
  }, [open]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleSelect = (opt) => {
    if (disabled) return;
    const val = (opt === null)
      ? ''
      : (typeof opt === 'object' ? opt[valueField] : opt);
    onChange && onChange({ target: { value: val === undefined || val === null ? '' : String(val) } });
    setOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className={`simple-select ${className} ${disabled ? 'disabled' : ''}`}
    >
      <div
        className={`simple-select-trigger ${open ? 'open' : ''} ${!displayValue ? 'placeholder' : ''}`}
        onClick={() => !disabled && setOpen(!open)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            !disabled && setOpen(!open);
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="simple-select-text">{displayValue || placeholder}</span>
        <span className="chevron" />
      </div>
      {open && (
        <div 
          ref={menuRef}
          className={`simple-select-menu ${useFixedPosition ? 'simple-select-menu-fixed' : ''}`}
          role="listbox"
          style={useFixedPosition ? {
            position: 'fixed',
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left}px`,
            width: `${menuPosition.width}px`,
            zIndex: 10000,
          } : {}}
        >
          {allowEmpty && (
            <div
              className={`simple-select-option ${value === '' ? 'selected' : ''}`}
              onClick={() => handleSelect(null)}
              role="option"
              aria-selected={value === ''}
            >
              {placeholder}
            </div>
          )}
          {options.map((opt, idx) => {
            const val = typeof opt === 'object' ? opt[valueField] : opt;
            const label = typeof opt === 'object' ? opt[displayField] : opt;
            const isSel = String(val) === String(value);
            return (
              <div
                key={idx}
                className={`simple-select-option ${isSel ? 'selected' : ''}`}
                onClick={() => handleSelect(opt)}
                role="option"
                aria-selected={isSel}
              >
                {label}
              </div>
            );
          })}
        </div>
      )}
      {/* Campo invisibile per rispettare required/forme HTML se necessario */}
      {required && (
        <input
          tabIndex={-1}
          className="sr-only"
          style={{ position: 'absolute', opacity: 0, height: 0, width: 0, pointerEvents: 'none' }}
          value={value}
          onChange={() => {}}
          required
        />
      )}
    </div>
  );
};

export default SimpleSelect;


