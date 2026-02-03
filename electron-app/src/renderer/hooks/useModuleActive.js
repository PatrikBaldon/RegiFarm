/**
 * Hook per verificare se il modulo corrente è attivo
 * Utile per evitare di fare richieste quando il modulo è nascosto
 */
import { useRequest } from '../context/RequestContext';

export const useModuleActive = () => {
  const { isActive } = useRequest();
  return isActive;
};

