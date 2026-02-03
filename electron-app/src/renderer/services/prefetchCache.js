const cache = new Map();

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minuti (aumentato da 2min per ridurre chiamate API)

export const getCachedData = (key) => {
  const entry = cache.get(key);
  if (!entry) return null;

  const { ttl = DEFAULT_TTL, timestamp, data } = entry;
  if (timestamp && ttl && Date.now() - timestamp > ttl) {
    cache.delete(key);
    return null;
  }
  return data ?? null;
};

export const setCache = (key, data, options = {}) => {
  const ttl = options.ttl ?? DEFAULT_TTL;
  cache.set(key, {
    data,
    ttl,
    timestamp: Date.now(),
  });
  return data;
};

export const clearCache = (key) => {
  cache.delete(key);
};

export const prefetchOnce = (key, fetcher, options = {}) => {
  const { ttl = DEFAULT_TTL, force = false } = options;
  const existing = cache.get(key);

  const isFresh =
    existing &&
    existing.data !== undefined &&
    (!existing.timestamp || Date.now() - existing.timestamp <= (existing.ttl ?? DEFAULT_TTL));

  if (!force && isFresh) {
    return Promise.resolve(existing.data);
  }

  if (!force && existing?.promise) {
    return existing.promise;
  }

  const promise = Promise.resolve()
    .then(fetcher)
    .then((data) => {
      cache.set(key, {
        data,
        ttl,
        timestamp: Date.now(),
      });
      return data;
    })
    .catch((error) => {
      // Per errori 503 (Service Unavailable), gestisci silenziosamente
      // L'app può funzionare in modalità limitata
      if (error?.status === 503 || error?.isServiceUnavailable) {
        // Se ci sono dati cached, usali
        if (existing && existing.data !== undefined) {
          cache.set(key, {
            data: existing.data,
            ttl: existing.ttl,
            timestamp: existing.timestamp,
          });
          return existing.data;
        }
        // Altrimenti ritorna null/array vuoto invece di lanciare l'errore
        return null;
      }
      
      // Per altri errori, mantieni il comportamento originale
      if (existing && existing.data !== undefined) {
        cache.set(key, {
          data: existing.data,
          ttl: existing.ttl,
          timestamp: existing.timestamp,
        });
        return existing.data; // Ritorna i dati cached invece di lanciare l'errore
      } else {
        cache.delete(key);
        // Non lanciare l'errore per evitare "Uncaught (in promise)"
        // Ritorna null/array vuoto invece
        return null;
      }
    });

  cache.set(key, {
    data: existing?.data,
    ttl,
    timestamp: existing?.timestamp ?? 0,
    promise,
  });

  return promise;
};

export default {
  prefetchOnce,
  getCachedData,
  setCache,
  clearCache,
};

