/**
 * Hook per Optimistic Updates
 * 
 * Permette di aggiornare l'UI IMMEDIATAMENTE senza aspettare la risposta del server.
 * Se l'operazione fallisce, esegue automaticamente il rollback.
 * 
 * Questo migliora drasticamente la percezione di velocità dell'app.
 * 
 * @example
 * const { optimisticUpdate, optimisticCreate, optimisticDelete } = useOptimisticUpdate(
 *   animali,
 *   setAnimali,
 *   { idField: 'id' }
 * );
 * 
 * // Update istantaneo
 * await optimisticUpdate(
 *   animalId,
 *   { peso_attuale: 450 },
 *   () => api.put(`/animali/${animalId}`, { peso_attuale: 450 })
 * );
 */

import { useState, useCallback, useRef } from 'react';

/**
 * @param {Array} data - Array di dati correnti
 * @param {Function} setData - Setter dello state
 * @param {Object} options - Opzioni
 * @param {string} options.idField - Nome del campo ID (default: 'id')
 * @param {Function} options.onError - Callback per errori
 * @param {Function} options.onSuccess - Callback per successo
 */
export const useOptimisticUpdate = (data, setData, options = {}) => {
  const {
    idField = 'id',
    onError,
    onSuccess,
  } = options;

  const [pendingOperations, setPendingOperations] = useState(new Set());
  const rollbackRef = useRef(null);

  /**
   * Aggiorna un elemento ottimisticamente
   * @param {number|string} id - ID dell'elemento
   * @param {Object} updates - Campi da aggiornare
   * @param {Function} serverOperation - Funzione async che esegue l'operazione sul server
   * @returns {Promise<boolean>} - true se successo, false se fallito
   */
  const optimisticUpdate = useCallback(async (id, updates, serverOperation) => {
    // Salva lo stato originale per eventuale rollback
    const originalItem = data.find(item => item[idField] === id);
    if (!originalItem) {

      return false;
    }

    const originalData = [...data];
    rollbackRef.current = originalData;

    // 1. Aggiorna UI IMMEDIATAMENTE (< 1ms)
    setData(prev => prev.map(item =>
      item[idField] === id
        ? { ...item, ...updates, _optimistic: true }
        : item
    ));

    // Traccia operazione in corso
    setPendingOperations(prev => new Set(prev).add(id));

    try {
      // 2. Esegui operazione server in background
      const result = await serverOperation();

      // 3. Aggiorna con dati reali dal server (se forniti)
      if (result && typeof result === 'object') {
        setData(prev => prev.map(item =>
          item[idField] === id
            ? { ...item, ...result, _optimistic: false }
            : item
        ));
      } else {
        // Rimuovi flag _optimistic
        setData(prev => prev.map(item =>
          item[idField] === id
            ? { ...item, _optimistic: false }
            : item
        ));
      }

      onSuccess?.({ id, updates, result });
      return true;

    } catch (error) {
      // 4. ROLLBACK: ripristina stato originale

      setData(rollbackRef.current);
      
      onError?.({ id, updates, error });
      return false;

    } finally {
      setPendingOperations(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      rollbackRef.current = null;
    }
  }, [data, setData, idField, onError, onSuccess]);

  /**
   * Crea un elemento ottimisticamente
   * @param {Object} newItem - Nuovo elemento da creare
   * @param {Function} serverOperation - Funzione async che crea sul server
   * @returns {Promise<Object|null>} - Elemento creato o null se fallito
   */
  const optimisticCreate = useCallback(async (newItem, serverOperation) => {
    // Genera ID temporaneo
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const optimisticItem = {
      ...newItem,
      [idField]: tempId,
      _optimistic: true,
      _tempId: tempId,
    };

    const originalData = [...data];
    rollbackRef.current = originalData;

    // 1. Aggiungi all'UI immediatamente
    setData(prev => [...prev, optimisticItem]);

    try {
      // 2. Crea sul server
      const result = await serverOperation();

      if (result && result[idField]) {
        // 3. Sostituisci con dati reali (con ID definitivo)
        setData(prev => prev.map(item =>
          item._tempId === tempId
            ? { ...result, _optimistic: false }
            : item
        ));
        
        onSuccess?.({ tempId, result });
        return result;
      }

      // Se il server non ritorna dati, rimuovi flag optimistic
      setData(prev => prev.map(item =>
        item._tempId === tempId
          ? { ...item, _optimistic: false }
          : item
      ));
      
      return optimisticItem;

    } catch (error) {
      // 4. ROLLBACK: rimuovi elemento

      setData(rollbackRef.current);
      
      onError?.({ tempId, newItem, error });
      return null;

    } finally {
      rollbackRef.current = null;
    }
  }, [data, setData, idField, onError, onSuccess]);

  /**
   * Elimina un elemento ottimisticamente
   * @param {number|string} id - ID dell'elemento
   * @param {Function} serverOperation - Funzione async che elimina sul server
   * @returns {Promise<boolean>} - true se successo, false se fallito
   */
  const optimisticDelete = useCallback(async (id, serverOperation) => {
    const originalData = [...data];
    rollbackRef.current = originalData;

    // 1. Rimuovi dall'UI immediatamente
    setData(prev => prev.filter(item => item[idField] !== id));

    try {
      // 2. Elimina sul server
      await serverOperation();
      
      onSuccess?.({ id, operation: 'delete' });
      return true;

    } catch (error) {
      // 3. ROLLBACK: ripristina elemento

      setData(rollbackRef.current);
      
      onError?.({ id, operation: 'delete', error });
      return false;

    } finally {
      rollbackRef.current = null;
    }
  }, [data, setData, idField, onError, onSuccess]);

  /**
   * Verifica se un elemento ha un'operazione in corso
   */
  const isPending = useCallback((id) => pendingOperations.has(id), [pendingOperations]);

  /**
   * Verifica se ci sono operazioni in corso
   */
  const hasPendingOperations = pendingOperations.size > 0;

  return {
    optimisticUpdate,
    optimisticCreate,
    optimisticDelete,
    isPending,
    hasPendingOperations,
    pendingOperations,
  };
};

export default useOptimisticUpdate;

