/**
 * Persistent cache service using localStorage
 * For static data that changes rarely (aziende, sedi, fornitori, etc.)
 * Uses longer TTL (days instead of seconds) to reduce API calls
 */

const STORAGE_PREFIX = 'regifarm:cache:';
const DEFAULT_TTL = 7 * 24 * 60 * 60 * 1000; // 7 giorni per dati statici

/**
 * Get cached data from localStorage
 * @param {string} key - Cache key
 * @returns {any|null} Cached data or null if expired/not found
 */
export const getPersistentCache = (key) => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  try {
    const stored = window.localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    if (!stored) return null;

    const { data, timestamp, ttl = DEFAULT_TTL } = JSON.parse(stored);
    
    // Check if expired
    if (timestamp && ttl && Date.now() - timestamp > ttl) {
      // Remove expired entry
      window.localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
      return null;
    }

    return data ?? null;
  } catch (error) {
    // Remove corrupted entry
    try {
      window.localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
    } catch (e) {
      // Ignore
    }
    return null;
  }
};

/**
 * Set cached data in localStorage
 * @param {string} key - Cache key
 * @param {any} data - Data to cache
 * @param {object} options - Options with ttl
 */
export const setPersistentCache = (key, data, options = {}) => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    const ttl = options.ttl ?? DEFAULT_TTL;
    const entry = {
      data,
      timestamp: Date.now(),
      ttl,
    };
    window.localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(entry));
  } catch (error) {
    // Handle quota exceeded or other errors
    if (error.name === 'QuotaExceededError') {
      clearOldPersistentCache();
      // Retry once
      try {
        const ttl = options.ttl ?? DEFAULT_TTL;
        const entry = {
          data,
          timestamp: Date.now(),
          ttl,
        };
        window.localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(entry));
      } catch (e) {
      }
    } else {
    }
  }
};

/**
 * Clear cached data from localStorage
 * @param {string} key - Cache key (optional, clears all if not provided)
 */
export const clearPersistentCache = (key = null) => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    if (key) {
      window.localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
    } else {
      // Clear all cache entries
      const keys = Object.keys(window.localStorage);
      keys.forEach((k) => {
        if (k.startsWith(STORAGE_PREFIX)) {
          window.localStorage.removeItem(k);
        }
      });
    }
  } catch (error) {
  }
};

/**
 * Clear old expired entries from localStorage
 */
const clearOldPersistentCache = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    const keys = Object.keys(window.localStorage);
    const now = Date.now();
    let cleared = 0;

    keys.forEach((k) => {
      if (k.startsWith(STORAGE_PREFIX)) {
        try {
          const stored = window.localStorage.getItem(k);
          if (stored) {
            const { timestamp, ttl = DEFAULT_TTL } = JSON.parse(stored);
            if (timestamp && now - timestamp > ttl) {
              window.localStorage.removeItem(k);
              cleared++;
            }
          }
        } catch (e) {
          // Remove corrupted entries
          window.localStorage.removeItem(k);
          cleared++;
        }
      }
    });

    if (cleared > 0) {
    }
  } catch (error) {
  }
};

/**
 * Get or set cached data with automatic fetching
 * @param {string} key - Cache key
 * @param {Function} fetcher - Function that returns a Promise with data
 * @param {object} options - Options with ttl, force
 * @returns {Promise<any>} Cached or fresh data
 */
export const getOrSetPersistentCache = async (key, fetcher, options = {}) => {
  const { force = false, ttl = DEFAULT_TTL } = options;

  // Check cache first (unless forced)
  if (!force) {
    const cached = getPersistentCache(key);
    if (cached !== null) {
      return cached;
    }
  }

  // Fetch fresh data
  try {
    const data = await fetcher();
    setPersistentCache(key, data, { ttl });
    return data;
  } catch (error) {
    // On error, try to return cached data even if expired
    const cached = getPersistentCache(key);
    if (cached !== null) {
      return cached;
    }
    throw error;
  }
};

// Cache keys for static data
export const CACHE_KEYS = {
  AZIENDE: 'aziende',
  SEDI: 'sedi',
  FORNITORI: 'fornitori',
  FORNITORI_TIPI: 'fornitori_tipi',
  COMPONENTI_ALIMENTARI: 'componenti_alimentari',
  MANGIMI_CONFEZIONATI: 'mangimi_confezionati',
  FARMACI: 'farmaci',
  ATTREZZATURE: 'attrezzature',
  TERRENI: 'terreni',
};

// Cleanup old entries on module load
if (typeof window !== 'undefined') {
  // Run cleanup after a short delay to not block initialization
  setTimeout(() => {
    clearOldPersistentCache();
  }, 1000);
}

// Named exports for easier dynamic imports
export { getOrSetPersistentCache as getOrSet };
export { clearPersistentCache as clear };

export default {
  get: getPersistentCache,
  set: setPersistentCache,
  clear: clearPersistentCache,
  getOrSet: getOrSetPersistentCache,
  CACHE_KEYS,
};

