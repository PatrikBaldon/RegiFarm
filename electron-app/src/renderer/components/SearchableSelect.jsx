/**
 * SearchableSelect - Componente riutilizzabile per dropdown searchable
 * Simile a quello usato nella modale DDT per i fornitori
 */
import React, { useState, useEffect } from 'react';
import '../modules/alimentazione/components/Alimentazione.css';

const SearchableSelect = ({
  options = [],
  value = '',
  onChange,
  placeholder = 'Cerca...',
  displayField = 'nome',
  valueField = 'id',
  required = false,
  disabled = false,
  className = '',
  filterFunction = null, // Funzione personalizzata per il filtro
  showSelectedInInput = true, // Se true mostra il valore selezionato nell'input; altrimenti l'input resta vuoto
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const [useFixedPosition, setUseFixedPosition] = useState(false);
  const inputRef = React.useRef(null);
  const dropdownRef = React.useRef(null);

  // Trova l'opzione selezionata quando cambia il value
  useEffect(() => {
    if (value && options.length > 0) {
      const val = String(value).toLowerCase();
      // Se il valore è "tutti" o "tutte", non considerarlo come selezione valida
      if (val === 'tutti' || val === 'tutte') {
        setSelectedOption(null);
        setSearchTerm('');
        return;
      }
      
      const option = options.find(opt => {
        const optVal = typeof opt === 'object' ? opt[valueField] : opt;
        return String(optVal) === String(value);
      });
      setSelectedOption(option);
      // Lascia sempre il campo vuoto - la selezione apparirà come placeholder
      setSearchTerm('');
    } else {
      setSelectedOption(null);
      setSearchTerm('');
    }
  }, [value, options, valueField, displayField]);

  // Calcola la posizione del dropdown quando si apre
  useEffect(() => {
    if (showDropdown && inputRef.current) {
      const inputRect = inputRef.current.getBoundingClientRect();
      const isInFilters = inputRef.current.closest('.movimenti-filters');
      
      // Controlla se è nella prima fila del form-grid
      const formGroup = inputRef.current.closest('.form-group');
      const formGrid = formGroup?.closest('.form-grid');
      const isFirstRow = formGrid && (
        formGroup === formGrid.querySelector('.form-group:first-child') ||
        formGroup === formGrid.querySelector('.form-group:nth-child(2)') ||
        formGroup === formGrid.querySelector('.form-group:nth-child(3)') ||
        formGroup === formGrid.querySelector('.form-group:nth-child(4)')
      );
      
      if (isInFilters || isFirstRow) {
        // Con position: fixed, le coordinate sono relative al viewport
        setDropdownPosition({
          top: inputRect.bottom + 4,
          left: inputRect.left,
          width: inputRect.width,
        });
        setUseFixedPosition(true);
      } else {
        setDropdownPosition({ top: 0, left: 0, width: 0 });
        setUseFixedPosition(false);
      }
    } else {
      setUseFixedPosition(false);
    }
  }, [showDropdown]);

  // Chiudi il dropdown quando si clicca fuori
  useEffect(() => {
    const handleClickOutside = (e) => {
      const target = e.target;
      // Controlla se il click è dentro l'input o il dropdown
      const isInsideInput = inputRef.current && inputRef.current.contains(target);
      const isInsideDropdown = dropdownRef.current && dropdownRef.current.contains(target);
      
      if (!isInsideInput && !isInsideDropdown) {
        setShowDropdown(false);
        // Lascia sempre il campo vuoto - la selezione apparirà come placeholder
        setSearchTerm('');
      }
    };

    if (showDropdown) {
      // Usa mousedown invece di click per catturare il click prima che il blur venga chiamato
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showDropdown, selectedOption, searchTerm, displayField]);

  // Filtra le opzioni, escludendo "Tutte" o "Tutti" che non devono essere selezionabili
  const filteredOptions = options.filter(option => {
    const val = typeof option === 'object' ? option[valueField] : option;
    // Escludi "Tutte" o "Tutti" dalle opzioni selezionabili
    if (String(val).toLowerCase() === 'tutti' || String(val).toLowerCase() === 'tutte') {
      return false;
    }
    
    if (filterFunction) {
      return filterFunction(option, searchTerm);
    }
    const display = typeof option === 'object' ? option[displayField] : option;
    // Se non c'è ricerca, mostra tutte le opzioni
    if (!searchTerm.trim()) {
      return true;
    }
    return String(display || '').toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Seleziona un'opzione
  const selectOption = (option) => {
    const val = typeof option === 'object' ? option[valueField] : option;
    const display = typeof option === 'object' ? option[displayField] : option;
    setSelectedOption(option);
    // Lascia il campo vuoto - la selezione apparirà come placeholder
    setSearchTerm('');
    setShowDropdown(false);
    if (onChange) {
      onChange({ target: { value: val === '' || val === null || val === undefined ? '' : String(val) } });
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="text"
        className={`searchable-select-input ${className}`}
        placeholder={
          selectedOption 
            ? (typeof selectedOption === 'object' ? selectedOption[displayField] : selectedOption)
            : placeholder
        }
        value={searchTerm}
        onChange={(e) => {
          if (!disabled) {
            const newValue = e.target.value;
            setSearchTerm(newValue);
            setShowDropdown(true);
            // Quando l'utente inizia a digitare, cancella la selezione
            if (selectedOption && newValue.trim()) {
              setSelectedOption(null);
            }
          }
        }}
        onFocus={() => {
          if (!disabled) {
            // Apri sempre la dropdown quando si fa focus
            setShowDropdown(true);
            // Lascia sempre il campo vuoto - la selezione apparirà come placeholder
            setSearchTerm('');
          }
        }}
        onBlur={(e) => {
          if (!disabled) {
            // Non chiudere immediatamente su blur - il click esterno gestirà la chiusura
            // Questo evita che il dropdown si chiuda quando si clicca su un'opzione
            // Il listener mousedown gestirà la chiusura quando si clicca fuori
            const relatedTarget = e.relatedTarget;
            // Se il blur è causato da un click su un elemento del dropdown, non chiudere
            if (relatedTarget && (inputRef.current?.contains(relatedTarget) || dropdownRef.current?.contains(relatedTarget))) {
              return;
              }
          }
        }}
        required={required}
        disabled={disabled}
      />
      {!disabled && showDropdown && filteredOptions.length > 0 && (
        <div 
          ref={dropdownRef}
          className={`searchable-select-dropdown ${useFixedPosition ? 'searchable-select-dropdown-fixed' : ''}`}
          style={useFixedPosition ? {
            position: 'fixed',
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`,
          } : {}}
        >
          {filteredOptions.map((option, index) => {
              const val = typeof option === 'object' ? option[valueField] : option;
              const display = typeof option === 'object' ? option[displayField] : option;
              const key = typeof option === 'object' && option.id ? option.id : index;
              const isSelected = String(val) === String(value);
              return (
                <div
                  key={key}
                  className={`searchable-select-option ${isSelected ? 'selected' : ''}`}
                  onClick={() => selectOption(option)}
                >
                  {display}
                </div>
              );
            })}
        </div>
      )}
      {!disabled && showDropdown && filteredOptions.length === 0 && searchTerm && (
        <div 
          ref={dropdownRef}
          className={`searchable-select-dropdown ${useFixedPosition ? 'searchable-select-dropdown-fixed' : ''}`}
          style={useFixedPosition ? {
            position: 'fixed',
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`,
          } : {}}
        >
          <div className="searchable-select-option disabled">Nessun risultato trovato</div>
        </div>
      )}
    </>
  );
};

export default SearchableSelect;

