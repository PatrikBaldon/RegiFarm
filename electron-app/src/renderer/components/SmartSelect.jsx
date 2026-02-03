import React from 'react';
import SimpleSelect from './SimpleSelect';
import SearchableSelect from './SearchableSelect';

/**
 * SmartSelect - Componente che sceglie automaticamente tra SimpleSelect e SearchableSelect
 * 
 * Regole:
 * - Se options.length <= 25: usa SimpleSelect
 * - Se options.length > 25: usa SearchableSelect
 * 
 * Props: tutte le props sono passate direttamente al componente selezionato
 */
const SmartSelect = ({
  options = [],
  ...props
}) => {
  const shouldUseSearchable = options.length > 25;

  if (shouldUseSearchable) {
    return <SearchableSelect options={options} {...props} />;
  }

  return <SimpleSelect options={options} {...props} />;
};

export default SmartSelect;

