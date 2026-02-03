/**
 * Hook React per gestire i codici stalla gestiti dinamicamente
 * Carica i codici stalla dalla tabella sedi e fornisce funzioni di utilità
 */
import { useState, useEffect, useCallback } from 'react';
import { allevamentoService } from '../modules/allevamento/services/allevamentoService';

export const useCodiciStallaGestiti = (aziendaId = null) => {
  const [codiciStalla, setCodiciStalla] = useState([]);
  const [sedi, setSedi] = useState([]);
  const [codiceDefaultIngresso, setCodiceDefaultIngresso] = useState(null);
  const [codiceDefaultUscita, setCodiceDefaultUscita] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadCodiciStalla = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await allevamentoService.getCodiciStallaGestiti(aziendaId);
      setCodiciStalla(data.codici_stalla || []);
      setSedi(data.sedi || []);
      setCodiceDefaultIngresso(data.codice_default_ingresso);
      setCodiceDefaultUscita(data.codice_default_uscita);
    } catch (err) {

      setError(err.message);
      setCodiciStalla([]);
      setSedi([]);
    } finally {
      setLoading(false);
    }
  }, [aziendaId]);

  useEffect(() => {
    loadCodiciStalla();
  }, [loadCodiciStalla]);

  const isCodiceStallaGestito = useCallback((codiceStalla) => {
    if (!codiceStalla) return false;
    return codiciStalla.includes(codiceStalla);
  }, [codiciStalla]);

  const getSedeByCodiceStalla = useCallback((codiceStalla) => {
    if (!codiceStalla) return null;
    return sedi.find(s => s.codice_stalla === codiceStalla) || null;
  }, [sedi]);

  return {
    codiciStalla,
    sedi,
    codiceDefaultIngresso,
    codiceDefaultUscita,
    loading,
    error,
    reload: loadCodiciStalla,
    isCodiceStallaGestito,
    getSedeByCodiceStalla,
  };
};

