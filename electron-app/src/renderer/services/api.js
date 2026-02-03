/**
 * API service for backend communication
 */
// TODO: Verifica il routing corretto in API Gateway prima di usare questo URL
// Se il routing funziona con /default/regifarm-api, usa:
// const API_BASE_URL = 'https://9ylulcfmt5.execute-api.eu-north-1.amazonaws.com/default/regifarm-api/api/v1';
// Se il routing funziona senza prefisso, usa:
// const API_BASE_URL = 'https://9ylulcfmt5.execute-api.eu-north-1.amazonaws.com/api/v1';

// Backend su fly.io
const API_BASE_URL = 'https://regifarm-backend.fly.dev/api/v1';
// Per sviluppo locale, usa: 'http://localhost:8000/api/v1'

// Numero massimo di retry per chiamate fallite
const MAX_RETRIES = 2;
// Retry aggiuntivi per cold start backend (ERR_CONNECTION_CLOSED)
const COLD_START_EXTRA_RETRIES = 3;
// Delay tra retry (in ms)
const RETRY_DELAY = 1000;
// Delay più lungo per cold start (backend scale-to-zero, ~15-30s avvio)
const COLD_START_DELAY = 3000;

// Helper per retry con exponential backoff
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class ApiService {
  constructor() {
    this.authToken = null;
    // Cache per deduplicare richieste in corso (previene chiamate duplicate)
    this.pendingRequests = new Map();
    // Cache risultati con TTL differenziato per tipo di dato
    this.resultCache = new Map();
    this.CACHE_TTL_DYNAMIC = 60000; // 1 minuto per dati dinamici (aumentato da 30s)
    this.CACHE_TTL_STATIC = 600000; // 10 minuti per dati relativamente statici (aumentato da 5min)
    // Stato del backend
    this.backendReady = false;
    this.backendReadyPromise = null;
    // Coda per limitare richieste simultanee (ottimizzato per throughput)
    this.requestQueue = [];
    this.activeRequests = 0;
    this.maxConcurrentRequests = 7; // Aumentato da 5 a 7 per migliorare throughput
  }

  setAuthToken(token) {
    this.authToken = token || null;
  }

  /**
   * Attende che il backend sia pronto prima di fare chiamate API
   * Verifica l'endpoint /health fino a quando non risponde con successo.
   * Con scale-to-zero (Fly): cold start ~15-30s, quindi più tentativi e delay maggiori.
   */
  async waitForBackend(maxAttempts = 15, delay = 2000) {
    // Se già verificato, ritorna immediatamente
    if (this.backendReady) {
      return true;
    }

    // Se c'è già una promise in corso, riutilizzala
    if (this.backendReadyPromise) {
      // Aspetta al massimo 35s per il check (cold start Fly)
      return Promise.race([
        this.backendReadyPromise,
        sleep(35000).then(() => true)
      ]);
    }

    // Crea una nuova promise per il check
    this.backendReadyPromise = (async () => {
      const healthUrl = `${API_BASE_URL.replace('/api/v1', '')}/health`;
      
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
          const response = await fetch(healthUrl, {
            method: 'GET',
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);
          
          if (response.ok) {
            this.backendReady = true;
            return true;
          }
        } catch (error) {
          // Ignora: ritenta al prossimo ciclo
        }
        
        if (attempt < maxAttempts - 1) {
          await sleep(delay);
        }
      }
      
      this.backendReady = true;
      return true;
    })();

    // Aspetta al massimo ~35s (cold start Fly) poi procedi; le singole richieste hanno retry
    return Promise.race([
      this.backendReadyPromise,
      sleep(35000).then(() => true)
    ]);
  }

  /**
   * Resetta lo stato del backend (utile quando il backend viene riavviato)
   */
  resetBackendStatus() {
    this.backendReady = false;
    this.backendReadyPromise = null;
  }

  _getCacheKey(endpoint, options) {
    // Solo GET requests sono cachate
    if (options.method && options.method !== 'GET') return null;
    return `${endpoint}`;
  }

  _getCacheTTL(endpoint) {
    // Endpoint con dati relativamente statici: cache più lunga (30s)
    const staticEndpoints = [
      '/aziende',
      '/sedi',
      '/fornitori',
      '/componenti-alimentari',
      '/mangimi-confezionati',
      '/farmaci',
      '/attrezzature',
      '/terreni',
      '/impostazioni',
    ];
    
    // Verifica se l'endpoint contiene uno dei pattern statici
    const isStatic = staticEndpoints.some(pattern => endpoint.includes(pattern));
    return isStatic ? this.CACHE_TTL_STATIC : this.CACHE_TTL_DYNAMIC;
  }

  _cleanExpiredCache() {
    const now = Date.now();
    for (const [key, { timestamp }] of this.resultCache) {
      // Usa TTL appropriato basato sull'endpoint (estrai dalla key)
      const ttl = this._getCacheTTL(key);
      if (now - timestamp > ttl) {
        this.resultCache.delete(key);
      }
    }
  }

  async _processQueue() {
    // Processa tutte le richieste disponibili fino al limite
    const requestsToProcess = [];
    while (this.requestQueue.length > 0 && this.activeRequests + requestsToProcess.length < this.maxConcurrentRequests) {
      requestsToProcess.push(this.requestQueue.shift());
    }
    
    // Processa le richieste con un piccolo delay tra loro per evitare picchi
    for (let i = 0; i < requestsToProcess.length; i++) {
      const { resolve, reject, requestFn } = requestsToProcess[i];
      this.activeRequests++;
      
      // Aggiungi un piccolo delay tra le richieste (50ms) per evitare picchi simultanei
      if (i > 0) {
        await sleep(50);
      }
      
      // Esegui la richiesta in modo asincrono senza bloccare
      requestFn()
        .then(result => {
          resolve(result);
        })
        .catch(error => {
          reject(error);
        })
        .finally(() => {
          this.activeRequests--;
          // Processa la prossima richiesta nella coda immediatamente
          if (this.requestQueue.length > 0) {
            this._processQueue();
          }
        });
    }
  }

  async _enqueueRequest(requestFn) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ resolve, reject, requestFn });
      this._processQueue();
    });
  }

  async request(endpoint, options = {}) {
    // Attendi che il backend sia pronto prima di fare la richiesta
    // Skip check solo se esplicitamente richiesto (per esempio per il health check stesso)
    // Ottimizzato: se il backend è già pronto, procede immediatamente
    // Se non è pronto, aspetta al massimo 1 secondo, poi procede comunque
    // (le chiamate API hanno retry automatici se il backend non è ancora pronto)
    if (!options.skipBackendCheck && !this.backendReady) {
      // Con backend scale-to-zero (Fly): aspetta fino a ~35s che /health risponda (cold start)
      try {
        await Promise.race([
          this.waitForBackend(),
          sleep(35000) // Cold start Fly ~15-30s; poi le singole richieste hanno retry
        ]);
      } catch (error) {
        // Ignora: le richieste hanno retry con backoff
      }
    }
    
    // Assicura che l'URL usi sempre https:// (forza https per sicurezza)
    let url = `${API_BASE_URL}${endpoint}`;
    // Sostituisci http:// con https:// se presente (per sicurezza)
    url = url.replace(/^http:\/\//, 'https://');
    
    const cacheKey = this._getCacheKey(endpoint, options);
    
    // Controlla cache risultati (solo per GET) con TTL differenziato
    if (cacheKey && !options.skipCache) {
      const cached = this.resultCache.get(cacheKey);
      if (cached) {
        const ttl = this._getCacheTTL(endpoint);
        if (Date.now() - cached.timestamp < ttl) {
          return cached.data;
        }
      }
    }
    
    // Deduplicazione: se c'è già una richiesta in corso per questo endpoint, riutilizzala
    if (cacheKey && this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey);
    }
    let {
      timeout: customTimeout, // timeout personalizzato (se non specificato, usa default 30s)
      maxRetries = MAX_RETRIES,
      responseType = 'json',
      ...fetchOptions
    } = options;
    
    // Se options.body è FormData, non impostare Content-Type (lo fa il browser con boundary)
    const isFormData = fetchOptions.body instanceof FormData;
    
    // Crea gli headers - per FormData non impostiamo Content-Type
    const defaultHeaders = isFormData ? {} : { 'Content-Type': 'application/json' };
    const authHeaders = this.authToken
      ? { Authorization: `Bearer ${this.authToken}` }
      : {};
    
    const config = {
      ...fetchOptions,
      headers: {
        ...defaultHeaders,
        ...authHeaders,
        ...fetchOptions.headers,  // Gli headers passati dall'opzione sovrascrivono i default
      },
    };

    // Crea la promise della richiesta e la mette in coda
    const requestFn = async () => {
      let lastError;
      // Usa AbortController esterno se fornito, altrimenti creane uno nuovo
      const externalController = options.signal ? options.signal : null;
      const useExternalController = externalController && !externalController.aborted;
      
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          // Se c'è un controller esterno e è stato abortito, interrompi
          if (useExternalController && externalController.aborted) {
            throw new Error('Request cancelled');
          }
          
          // Crea un controller per il timeout (o usa quello esterno se non ha timeout)
          // Timeout default 30s, ma può essere personalizzato tramite options.timeout
          const timeoutMs = customTimeout !== undefined ? customTimeout : 30000; // Default 30 secondi
          const timeoutController = useExternalController ? externalController : new AbortController();
          const timeoutId = useExternalController ? null : setTimeout(() => timeoutController.abort(), timeoutMs);
          
          // Combina i signal se necessario (timeout + esterno)
          const combinedSignal = useExternalController 
            ? externalController.signal 
            : timeoutController.signal;
          
          const response = await fetch(url, {
            ...config,
            signal: combinedSignal
          });
          
          if (timeoutId) clearTimeout(timeoutId);
      
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: response.statusText }));
          // Prepara un messaggio leggibile per errori Pydantic (detail come lista)
          let friendlyDetail = errorData.detail;
          if (Array.isArray(errorData.detail)) {
            friendlyDetail = errorData.detail
              .map((e) => {
                const loc = Array.isArray(e.loc) ? e.loc.join('.') : e.loc;
                return `${loc}: ${e.msg}`;
              })
              .join(' | ');
          }
          
          // Messaggi personalizzati per errori comuni
          if (response.status === 500) {
            // Controlla se è un errore di connessione database
            const errorText = JSON.stringify(errorData).toLowerCase();
            if (errorText.includes('database') || errorText.includes('connection') || 
                errorText.includes('supabase') || errorText.includes('host name') ||
                errorText.includes('nodename') || errorText.includes('operationalerror')) {
              friendlyDetail = 'Errore di connessione al database. Verifica che il database Supabase sia disponibile e che la configurazione sia corretta.';
            } else {
              friendlyDetail = friendlyDetail || 'Errore interno del server. Contatta il supporto se il problema persiste.';
            }
          }
          
          // Crea un errore personalizzato che preserva tutti i dati
          const error = new Error(friendlyDetail || errorData.message || `HTTP error! status: ${response.status}`);
          // Aggiungi i dati dell'errore come proprietà
          error.response = errorData;
          error.status = response.status;
          // Se ci sono errori o partite_dati, aggiungili all'errore
          if (errorData.errors) error.errors = errorData.errors;
          if (errorData.partite_dati) error.partite_dati = errorData.partite_dati;
          throw error;
        }
        
        if (responseType === 'blob') {
          return await response.blob();
        }

        if (responseType === 'arraybuffer') {
          return await response.arrayBuffer();
        }

        if (responseType === 'text') {
          return await response.text();
        }

        // Gestisci risposte 204 No Content (senza body) per JSON
        if (response.status === 204 || response.status === 201) {
          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            return null;
          }
        }
        
        const text = await response.text();
        if (!text || text.trim() === '') {
          return null;
        }
        
        try {
          return JSON.parse(text);
        } catch (e) {
          if (response.status >= 200 && response.status < 300) {
            return null;
          }
          throw e;
        }
      } catch (error) {
        let processedError = error;
        
        // Estrai lo status code dalla risposta se disponibile
        let statusCode = error.status || error.statusCode;
        if (error.response) {
          statusCode = error.response.status || statusCode;
        }
        
        // In Electron/Chromium l'errore di rete può essere in message o in cause (es. net::ERR_CONNECTION_CLOSED)
        const msg = (error && error.message) ? error.message : '';
        const causeMsg = (error && error.cause && error.cause.message) ? error.cause.message : '';
        const fullMsg = `${msg} ${causeMsg}`.trim();
        
        if (error) {
          // Se la richiesta è stata cancellata esternamente, non fare retry
          if (error.name === 'AbortError' || fullMsg.includes('aborted') || fullMsg.includes('cancelled')) {
            if (useExternalController && externalController.aborted) {
              // Richiesta cancellata dal componente - non è un errore
              throw new Error('Request cancelled by user');
            }
            processedError = new Error('Timeout: La richiesta ha impiegato troppo tempo. Riprova.');
            processedError.status = 408;
          } else if (fullMsg.includes('Failed to fetch') || fullMsg.includes('NetworkError') || fullMsg.includes('ERR_CONNECTION_REFUSED') || fullMsg.includes('ERR_CONNECTION_CLOSED') || fullMsg.includes('ERR_CONNECTION_RESET') || fullMsg.includes('ERR_TIMED_OUT') || fullMsg.includes('ERR_NETWORK_CHANGED')) {
            // ERR_CONNECTION_* / ERR_TIMED_OUT: cold start, limite Fly o timeout
            // ERR_NETWORK_CHANGED: errore temporaneo di rete
            if (fullMsg.includes('ERR_NETWORK_CHANGED')) {
              processedError = new Error('Errore di rete temporaneo. Riprovo...');
              processedError.status = 0;
              processedError.isNetworkError = true;
            } else if (fullMsg.includes('ERR_CONNECTION_CLOSED') || fullMsg.includes('ERR_CONNECTION_RESET') || fullMsg.includes('ERR_TIMED_OUT') || fullMsg.includes('Failed to fetch')) {
              // Failed to fetch / ERR_CONNECTION_* / ERR_TIMED_OUT: cold start o limite Fly
              processedError = new Error('Server non raggiungibile, riprovo...');
              processedError.status = 0;
              processedError.isNetworkError = true;
              processedError.isConnectionClosed = true; // retry con backoff
            } else {
              processedError = new Error('Impossibile connettersi al server. Verifica che il backend sia in esecuzione su https://regifarm-backend.fly.dev');
              processedError.status = statusCode || 0;
            }
          } else if (fullMsg.toLowerCase().includes('timeout')) {
            processedError = new Error('Timeout: Il server non risponde. Verifica che il backend sia in esecuzione.');
            processedError.status = 408;
          }
        }
        
        // Assegna lo status code se non è già presente
        if (!processedError.status && statusCode) {
          processedError.status = statusCode;
        }
        
        lastError = processedError;
        
        // Per ERR_CONNECTION_CLOSED (cold start) usa più retry e delay più lungo
        if (processedError.isConnectionClosed && attempt <= maxRetries + COLD_START_EXTRA_RETRIES) {
          maxRetries = MAX_RETRIES + COLD_START_EXTRA_RETRIES;
        }
        
        // Gestisci errori 503 (Service Unavailable) - backend non disponibile
        if (processedError.status === 503 || statusCode === 503) {
          processedError.message = 'Il server non è temporaneamente disponibile. L\'app funzionerà in modalità limitata.';
          processedError.isServiceUnavailable = true;
          processedError.status = 503;
          // Per errori 503, fai solo 1 retry veloce, poi procedi
          if (attempt >= 1) {
            throw processedError;
          }
        }
        
        // Non fare retry per errori 4xx (client errors) tranne 408 (timeout) e 429 (rate limit)
        if (processedError.status && processedError.status >= 400 && processedError.status < 500) {
          if (processedError.status !== 408 && processedError.status !== 429 && processedError.status !== 503) {
            throw processedError;
          }
        }
        
        // Se la richiesta è stata cancellata, non fare retry
        if (processedError.message?.includes('cancelled') || processedError.message?.includes('Request cancelled')) {
          throw processedError;
        }
        
        // Se non è l'ultimo tentativo, aspetta prima di riprovare (exponential backoff)
        // Per cold start (ERR_CONNECTION_CLOSED) usa delay più lungo
        if (attempt < maxRetries) {
          // Controlla se il controller esterno è stato abortito durante l'attesa
          if (useExternalController && externalController.aborted) {
            throw new Error('Request cancelled by user');
          }
          
          const isTimeout = processedError.status === 408 || processedError.message?.includes('Timeout');
          const isNetworkError = processedError.isNetworkError || processedError.status === 0;
          const isColdStart = processedError.isConnectionClosed === true;
          let baseDelay = RETRY_DELAY;
          if (isColdStart) {
            baseDelay = COLD_START_DELAY; // 3s, 6s, 12s... per dare tempo al backend di avviarsi
          } else if (isTimeout || isNetworkError) {
            baseDelay = RETRY_DELAY * 2;
          }
          const delay = baseDelay * Math.pow(2, attempt);
          await sleep(delay);
          continue;
        }
        
        // Se è l'ultimo tentativo, rilancia l'errore
        throw processedError;
      }
    }
    
    // Se arriviamo qui, tutti i tentativi sono falliti
    throw lastError || new Error('Request failed after all retries');
    };
    
    // Metti la richiesta in coda per limitare le richieste simultanee
    const requestPromise = this._enqueueRequest(requestFn);
    
    // Registra la richiesta pending per deduplicazione
    if (cacheKey) {
      this.pendingRequests.set(cacheKey, requestPromise);
    }
    
    try {
      const result = await requestPromise;
      
      // Salva in cache (solo per GET con successo) con TTL appropriato
      if (cacheKey) {
        this.resultCache.set(cacheKey, { data: result, timestamp: Date.now() });
        // Pulisci cache scaduta periodicamente
        this._cleanExpiredCache();
      }
      
      return result;
    } finally {
      // Rimuovi dalla lista pending
      if (cacheKey) {
        this.pendingRequests.delete(cacheKey);
      }
    }
  }

  // Invalida la cache per un pattern di endpoint
  invalidateCache(pattern = null) {
    if (!pattern) {
      this.resultCache.clear();
      return;
    }
    for (const key of this.resultCache.keys()) {
      if (key.includes(pattern)) {
        this.resultCache.delete(key);
      }
    }
  }

  get(endpoint, params = {}, options = {}) {
    // Filter out undefined, null, and empty string values
    const filteredParams = Object.entries(params).reduce((acc, [key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        acc[key] = value;
      }
      return acc;
    }, {});
    
    const queryString = new URLSearchParams(filteredParams).toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;
    return this.request(url, { method: 'GET', ...options });
  }

  post(endpoint, data, options = {}) {
    // Se data è FormData, non fare JSON.stringify
    const body = data instanceof FormData ? data : JSON.stringify(data);
    return this.request(endpoint, {
      method: 'POST',
      body,
      ...options,
    });
  }

  put(endpoint, data, options = {}) {
    // Gestisci i parametri query se presenti
    let url = endpoint;
    if (options.params) {
      const filteredParams = Object.entries(options.params).reduce((acc, [key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          acc[key] = value;
        }
        return acc;
      }, {});
      
      const queryString = new URLSearchParams(filteredParams).toString();
      if (queryString) {
        url = `${endpoint}?${queryString}`;
      }
    }
    
    return this.request(url, {
      method: 'PUT',
      body: JSON.stringify(data),
      ...options,
    });
  }

  delete(endpoint, options = {}) {
    return this.request(endpoint, { method: 'DELETE', ...options });
  }
}

export default new ApiService();

