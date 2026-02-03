/**
 * Database Locale SQLite per RegiFarm Pro
 * 
 * Gestisce tutte le operazioni CRUD sul database locale.
 * Le letture sono istantanee (< 5ms), le scritture vengono
 * marcate come 'pending' per la sincronizzazione con Supabase.
 */

const path = require('path');
const { app } = require('electron');
const { SCHEMA_VERSION, CREATE_TABLES_SQL, INIT_META_SQL } = require('./schema');

// better-sqlite3 sarà caricato dinamicamente per gestire errori di build
let Database;
try {
  Database = require('better-sqlite3');
} catch (error) {
  console.error('[LocalDb] better-sqlite3 non disponibile:', error.message);
  Database = null;
}

class LocalDatabase {
  constructor() {
    this.db = null;
    this.isInitialized = false;
    this.dbPath = null;
  }

  /**
   * Verifica e applica migrazioni se necessario
   * @private
   */
  _applyMigrations() {
    try {
      let currentVersion = null;
      
      // Verifica se esiste la tabella _meta
      try {
        const metaExists = this.db.prepare(`
          SELECT name FROM sqlite_master 
          WHERE type='table' AND name='_meta'
        `).get();

        if (metaExists) {
          try {
            const result = this.db.prepare('SELECT value FROM _meta WHERE key = ?').get('schema_version');
            currentVersion = result ? result.value : null;
          } catch (e) {
            // Tabella _meta esiste ma non ha ancora schema_version o query fallita
            currentVersion = null;
          }
        }
      } catch (e) {
        // Database vuoto o errore, currentVersion rimane null
        currentVersion = null;
      }

      const targetVersion = SCHEMA_VERSION.toString();
      console.log(`[LocalDb] Versione schema corrente: ${currentVersion || 'nessuna'}, target: ${targetVersion}`);

      // Se non c'è versione o è diversa, ricrea schema
      if (!currentVersion || currentVersion !== targetVersion) {
        console.log('[LocalDb] Schema obsoleto o mancante, ricreazione tabelle...');
        
        // Elimina tutte le tabelle (in ordine inverso per rispettare FK)
        const dropTables = `
          DROP TABLE IF EXISTS _sync_log;
          DROP TABLE IF EXISTS ammortamenti;
          DROP TABLE IF EXISTS cicli_terreno_costi;
          DROP TABLE IF EXISTS cicli_terreno_fasi;
          DROP TABLE IF EXISTS cicli_terreno;
          DROP TABLE IF EXISTS raccolti_terreno;
          DROP TABLE IF EXISTS lavorazioni_terreno;
          DROP TABLE IF EXISTS lotti_farmaco;
          DROP TABLE IF EXISTS movimentazioni;
          DROP TABLE IF EXISTS magazzino_movimenti;
          DROP TABLE IF EXISTS ddt_righe;
          DROP TABLE IF EXISTS ddt;
          DROP TABLE IF EXISTS registro_alimentazione_dettagli;
          DROP TABLE IF EXISTS registro_alimentazione;
          DROP TABLE IF EXISTS composizione_piano;
          DROP TABLE IF EXISTS piani_alimentazione;
          DROP TABLE IF EXISTS pn_movimenti_documenti;
          DROP TABLE IF EXISTS pn_movimenti;
          DROP TABLE IF EXISTS pn_conti_iban;
          DROP TABLE IF EXISTS pn_preferenze;
          DROP TABLE IF EXISTS pn_categorie;
          DROP TABLE IF EXISTS pn_conti;
          DROP TABLE IF EXISTS decessi;
          DROP TABLE IF EXISTS partite_animali_animali;
          DROP TABLE IF EXISTS partite_animali;
          DROP TABLE IF EXISTS somministrazioni;
          DROP TABLE IF EXISTS scadenze_attrezzature;
          DROP TABLE IF EXISTS box;
          DROP TABLE IF EXISTS stabilimenti;
          DROP TABLE IF EXISTS animali;
          DROP TABLE IF EXISTS sedi;
          DROP TABLE IF EXISTS componenti_alimentari;
          DROP TABLE IF EXISTS mangimi_confezionati;
          DROP TABLE IF EXISTS farmaci;
          DROP TABLE IF EXISTS fatture_amministrazione;
          DROP TABLE IF EXISTS fornitori;
          DROP TABLE IF EXISTS terreni;
          DROP TABLE IF EXISTS attrezzature;
          DROP TABLE IF EXISTS assicurazioni_aziendali;
          DROP TABLE IF EXISTS contratti_soccida;
          DROP TABLE IF EXISTS impostazioni;
          DROP TABLE IF EXISTS aziende;
          DROP TABLE IF EXISTS _meta;
        `;
        
        this.db.exec(dropTables);
        console.log('[LocalDb] Tabelle eliminate');

        // Ricrea schema
        this.db.exec(CREATE_TABLES_SQL);
        this.db.exec(INIT_META_SQL);
        
        // Aggiorna versione
        this.db.prepare('INSERT OR REPLACE INTO _meta (key, value, updated_at) VALUES (?, ?, ?)')
          .run('schema_version', targetVersion, new Date().toISOString());
        
        console.log(`[LocalDb] ✅ Schema aggiornato alla versione ${targetVersion}`);
      } else {
        console.log('[LocalDb] Schema già aggiornato');
        
        // Assicurati che la tabella _meta esista sempre (potrebbe essere stata eliminata manualmente)
        try {
          const metaExists = this.db.prepare(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='_meta'
          `).get();
          
          if (!metaExists) {
            console.log('[LocalDb] Tabella _meta mancante, creazione...');
            this.db.exec(`
              CREATE TABLE IF NOT EXISTS _meta (
                key TEXT PRIMARY KEY,
                value TEXT,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
              )
            `);
            this.db.exec(INIT_META_SQL);
            console.log('[LocalDb] ✅ Tabella _meta creata e inizializzata');
          }
        } catch (metaError) {
          console.error('[LocalDb] Errore verifica/creazione _meta:', metaError);
        }
      }
    } catch (error) {
      console.error('[LocalDb] Errore applicazione migrazioni:', error);
      throw error;
    }
  }

  /**
   * Inizializza il database
   * @returns {boolean} true se inizializzato con successo
   */
  init() {
    if (this.isInitialized) return true;
    
    if (!Database) {
      console.error('[LocalDb] better-sqlite3 non disponibile - database locale disabilitato');
      return false;
    }

    try {
      // Percorso database nella cartella userData dell'app
      this.dbPath = path.join(app.getPath('userData'), 'regifarm_local.db');
      console.log('[LocalDb] Inizializzazione database:', this.dbPath);

      // Crea connessione
      this.db = new Database(this.dbPath);
      
      // Ottimizzazioni performance
      this.db.pragma('journal_mode = WAL'); // Write-Ahead Logging per performance
      this.db.pragma('synchronous = NORMAL'); // Bilanciamento performance/sicurezza
      this.db.pragma('cache_size = -64000'); // 64MB cache
      this.db.pragma('temp_store = MEMORY'); // Temp tables in memoria
      // Disabilita foreign keys durante sync per evitare errori con dati parziali
      this.db.pragma('foreign_keys = OFF');

      // Applica migrazioni PRIMA di creare le tabelle (le migrazioni gestiscono la creazione)
      this._applyMigrations();

      this.isInitialized = true;
      console.log('[LocalDb] Database inizializzato con successo');
      return true;
    } catch (error) {
      console.error('[LocalDb] Errore inizializzazione:', error);
      return false;
    }
  }

  /**
   * Verifica se il database è disponibile
   */
  isAvailable() {
    return this.isInitialized && this.db !== null;
  }

  /**
   * Pulisce tutti i dati di un'azienda (utile quando si cambia azienda)
   */
  clearAziendaData(aziendaId) {
    if (!this.isAvailable()) return false;

    try {
      const tables = [
        'animali', 'sedi', 'stabilimenti', 'box', 'fornitori', 
        'fatture_amministrazione', 'partite_animali', 'terreni',
        'attrezzature', 'farmaci', 'componenti_alimentari', 
        'mangimi_confezionati', 'assicurazioni_aziendali', 'contratti_soccida'
      ];

      let deleted = 0;
      for (const table of tables) {
        const result = this.db.prepare(
          `DELETE FROM ${table} WHERE azienda_id = ?`
        ).run(aziendaId);
        deleted += result.changes;
      }

      // Pulisci anche aziende (tranne quella corrente se è diversa)
      this.db.prepare(`DELETE FROM aziende WHERE id != ?`).run(aziendaId);

      console.log(`[LocalDb] Puliti ${deleted} record per cambio azienda`);
      return true;
    } catch (error) {
      console.error('[LocalDb] Errore clearAziendaData:', error);
      return false;
    }
  }

  /**
   * Chiude la connessione al database
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.isInitialized = false;
      console.log('[LocalDb] Database chiuso');
    }
  }

  // ============================================
  // METODI GENERICI
  // ============================================

  /**
   * Esegue una query SELECT
   * @param {string} table - Nome tabella
   * @param {Object} filters - Filtri {campo: valore}
   * @param {Object} options - Opzioni {orderBy, limit, offset}
   */
  select(table, filters = {}, options = {}) {
    if (!this.isAvailable()) return [];

    try {
      // Ottieni colonne effettive della tabella per validare i filtri
      const tableInfo = this.db.prepare(`PRAGMA table_info(${table})`).all();
      const tableColumns = new Set(tableInfo.map(col => col.name));

      const hasDeletedAt = tableColumns.has('deleted_at');
      let query = `SELECT * FROM ${table}`;
      const params = [];
      if (hasDeletedAt) {
        query += ` WHERE deleted_at IS NULL`;
      } else {
        query += ` WHERE 1=1`;
      }

      // Aggiungi filtri (solo se la colonna esiste nella tabella e il valore è un tipo supportato da SQLite)
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null && value !== '' && tableColumns.has(key)) {
          // SQLite supporta solo: numbers, strings, bigints, buffers, e null
          const valueType = typeof value;
          
          // Salta oggetti e array per evitare errori
          if (valueType === 'object' && !(value instanceof Buffer)) {
            console.warn(`[LocalDb] Filtro ${key} ignorato: valore di tipo oggetto non supportato da SQLite`);
            continue;
          }
          
          query += ` AND ${key} = ?`;
          
          // Converti booleani in 0/1 (SQLite non supporta booleani nativi)
          if (valueType === 'boolean') {
            params.push(value ? 1 : 0);
          } else {
            params.push(value);
          }
        }
      }

      // Order by
      if (options.orderBy) {
        query += ` ORDER BY ${options.orderBy}`;
      }

      // Limit e offset
      if (options.limit) {
        query += ` LIMIT ?`;
        params.push(options.limit);
      }
      if (options.offset) {
        query += ` OFFSET ?`;
        params.push(options.offset);
      }

      const results = this.db.prepare(query).all(...params);
      
      // Parse JSON fields for fatture_amministrazione
      if (table === 'fatture_amministrazione') {
        try {
          return results.map(record => this._parseFatturaJsonFields(record));
        } catch (parseError) {
          console.error(`[LocalDb] Errore parsing JSON fatture:`, parseError);
          // Se c'è un errore nel parsing, restituisci i risultati senza parsing
          return results;
        }
      }
      
      return results;
    } catch (error) {
      console.error(`[LocalDb] Errore select ${table}:`, error);
      // Se c'è un errore SQL (es. colonna non esiste), potrebbe essere che lo schema non è aggiornato
      // Restituisci array vuoto invece di crashare
      return [];
    }
  }
  
  /**
   * Parsa i campi JSON di una fattura
   * @private
   */
  _parseFatturaJsonFields(record) {
    if (!record) return record;
    
    const jsonFields = ['righe', 'pagamenti_programmati', 'linee', 'dati_xml'];
    const parsed = { ...record };
    
    for (const field of jsonFields) {
      // Se il campo esiste ed è una stringa, prova a parsarlo
      if (parsed[field] !== undefined && parsed[field] !== null) {
        if (typeof parsed[field] === 'string') {
          try {
            // Se la stringa è vuota, lascia null
            if (parsed[field].trim() === '') {
              parsed[field] = null;
            } else {
              parsed[field] = JSON.parse(parsed[field]);
            }
          } catch (e) {
            console.warn(`[LocalDb] Errore parsing JSON per campo ${field}:`, e.message);
            parsed[field] = null;
          }
        }
        // Se è già un oggetto/array, lascialo così com'è
      } else {
        // Se il campo non esiste, imposta un valore di default per array
        if (field === 'righe' || field === 'pagamenti_programmati' || field === 'linee') {
          parsed[field] = [];
        } else {
          parsed[field] = null;
        }
      }
    }
    
    return parsed;
  }

  /**
   * Ottiene un record per ID
   */
  getById(table, id) {
    if (!this.isAvailable()) return null;

    try {
      const record = this.db.prepare(
        `SELECT * FROM ${table} WHERE id = ? AND deleted_at IS NULL`
      ).get(id);
      
      // Parse JSON fields for fatture_amministrazione
      if (table === 'fatture_amministrazione' && record) {
        return this._parseFatturaJsonFields(record);
      }
      
      return record;
    } catch (error) {
      console.error(`[LocalDb] Errore getById ${table}:`, error);
      return null;
    }
  }

  /**
   * Inserisce un record
   * @param {string} table - Nome tabella
   * @param {Object} data - Dati da inserire
   * @param {boolean} markPending - Se true, marca come pending per sync
   */
  insert(table, data, markPending = true) {
    if (!this.isAvailable()) return null;

    try {
      const now = new Date().toISOString();
      const insertData = {
        ...data,
        created_at: data.created_at || now,
        updated_at: now,
        local_updated_at: now,
        sync_status: markPending ? 'pending' : 'synced',
        synced_at: markPending ? null : now,
      };

      const columns = Object.keys(insertData);
      const placeholders = columns.map(() => '?').join(', ');
      const values = columns.map(col => insertData[col]);

      const stmt = this.db.prepare(
        `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`
      );
      const result = stmt.run(...values);

      // Log per sync
      if (markPending) {
        this._logSync(table, 'insert', result.lastInsertRowid, insertData);
      }

      return { ...insertData, id: result.lastInsertRowid };
    } catch (error) {
      console.error(`[LocalDb] Errore insert ${table}:`, error);
      return null;
    }
  }

  /**
   * Aggiorna un record
   * @param {string} table - Nome tabella
   * @param {number} id - ID record
   * @param {Object} updates - Campi da aggiornare
   * @param {boolean} markPending - Se true, marca come pending per sync
   */
  update(table, id, updates, markPending = true) {
    if (!this.isAvailable()) return false;

    try {
      const now = new Date().toISOString();
      const updateData = {
        ...updates,
        updated_at: now,
        local_updated_at: now,
      };

      if (markPending) {
        updateData.sync_status = 'pending';
      }

      // Rimuovi campi che non devono essere aggiornati
      delete updateData.id;
      delete updateData.created_at;

      const setClauses = Object.keys(updateData).map(col => `${col} = ?`).join(', ');
      const values = [...Object.values(updateData), id];

      const stmt = this.db.prepare(
        `UPDATE ${table} SET ${setClauses} WHERE id = ?`
      );
      const result = stmt.run(...values);

      // Log per sync
      if (markPending && result.changes > 0) {
        this._logSync(table, 'update', id, updateData);
      }

      return result.changes > 0;
    } catch (error) {
      console.error(`[LocalDb] Errore update ${table}:`, error);
      return false;
    }
  }

  /**
   * Soft delete di un record
   */
  softDelete(table, id, markPending = true) {
    if (!this.isAvailable()) return false;

    try {
      const now = new Date().toISOString();
      const stmt = this.db.prepare(
        `UPDATE ${table} SET deleted_at = ?, sync_status = ?, local_updated_at = ? WHERE id = ?`
      );
      const result = stmt.run(now, markPending ? 'pending' : 'synced', now, id);

      if (markPending && result.changes > 0) {
        this._logSync(table, 'delete', id, { deleted_at: now });
      }

      return result.changes > 0;
    } catch (error) {
      console.error(`[LocalDb] Errore softDelete ${table}:`, error);
      return false;
    }
  }

  /**
   * Alias per softDelete (per compatibilità con metodi che usano this.delete)
   */
  delete(table, id, markPending = true) {
    return this.softDelete(table, id, markPending);
  }

  /**
   * Converte un valore per SQLite
   * - Oggetti e array vengono serializzati in JSON
   * - null, undefined, numeri, stringhe, bigint, buffer rimangono invariati
   * @private
   */
  _toSqliteValue(value) {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'object' && !(value instanceof Buffer)) {
      // Array o oggetti devono essere serializzati
      return JSON.stringify(value);
    }
    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }
    return value;
  }

  /**
   * Inserisce o aggiorna multipli record (per sync da server)
   * Gestisce automaticamente colonne extra/mancanti rispetto allo schema locale
   */
  bulkUpsert(table, records, markSynced = true) {
    if (!this.isAvailable() || !records.length) return 0;

    try {
      // Ottieni colonne effettive della tabella
      const tableInfo = this.db.prepare(`PRAGMA table_info(${table})`).all();
      const tableColumns = new Set(tableInfo.map(col => col.name));
      
      const now = new Date().toISOString();
      let count = 0;
      let errors = 0;
      let duplicatesRemoved = 0;

      // Per pn_movimenti, rimuovi duplicati per contenuto prima di inserire
      // Questo risolve il problema dei record vecchi con ID diversi ma stesso contenuto
      if (table === 'pn_movimenti') {
        try {
          // Strategia: elimina i duplicati mantenendo quello con più dati completi
          // Priorità: record con fattura_amministrazione_id > record senza
          // Se entrambi hanno/non hanno fattura, mantieni quello con ID più alto
          const deleteDuplicates = this.db.prepare(`
            DELETE FROM ${table}
            WHERE id IN (
              SELECT m1.id
              FROM ${table} m1
              INNER JOIN ${table} m2 ON 
                m1.descrizione = m2.descrizione
                AND m1.data = m2.data
                AND m1.importo = m2.importo
                AND m1.azienda_id = m2.azienda_id
                AND m1.deleted_at IS NULL
                AND m2.deleted_at IS NULL
                AND m1.id != m2.id
                AND (
                  -- Elimina m1 se m2 ha fattura e m1 no
                  (m1.fattura_amministrazione_id IS NULL AND m2.fattura_amministrazione_id IS NOT NULL)
                  OR
                  -- Elimina m1 se hanno stesso stato fattura ma m1 ha ID più basso
                  (m1.id < m2.id AND (
                    (m1.fattura_amministrazione_id IS NULL AND m2.fattura_amministrazione_id IS NULL)
                    OR (m1.fattura_amministrazione_id IS NOT NULL AND m2.fattura_amministrazione_id IS NOT NULL)
                  ))
                )
            )
          `);
          const result = deleteDuplicates.run();
          duplicatesRemoved = result.changes;
          if (duplicatesRemoved > 0) {
            console.log(`[LocalDb] Rimossi ${duplicatesRemoved} duplicati per contenuto da ${table}`);
          }
        } catch (dupError) {
          console.warn(`[LocalDb] Errore rimozione duplicati ${table}:`, dupError.message);
        }
      }

      // Usa transaction per performance
      const upsertMany = this.db.transaction((items) => {
        for (const record of items) {
          try {
            // Filtra solo colonne che esistono nella tabella
            const filteredData = {};
            for (const [key, value] of Object.entries(record)) {
              if (tableColumns.has(key)) {
                // Converti il valore per SQLite (serializza oggetti/array)
                filteredData[key] = this._toSqliteValue(value);
              }
            }

            // Aggiungi campi sync
            filteredData.synced_at = markSynced ? now : null;
            filteredData.sync_status = markSynced ? 'synced' : 'pending';
            filteredData.local_updated_at = now;

            const columns = Object.keys(filteredData);
            if (columns.length === 0) {
              console.warn(`[LocalDb] Record ${record.id} senza colonne valide per ${table}`);
              continue;
            }

            const placeholders = columns.map(() => '?').join(', ');
            const updateClauses = columns
              .filter(c => c !== 'id')
              .map(c => `${c} = excluded.${c}`)
              .join(', ');

            const stmt = this.db.prepare(`
              INSERT INTO ${table} (${columns.join(', ')}) 
              VALUES (${placeholders})
              ON CONFLICT(id) DO UPDATE SET ${updateClauses}
            `);

            stmt.run(...columns.map(c => filteredData[c]));
            count++;
          } catch (error) {
            errors++;
            console.error(`[LocalDb] Errore upsert record ${record.id} in ${table}:`, error.message);
            // Continua con il prossimo record invece di fallire tutto
          }
        }
      });

      upsertMany(records);
      
      if (errors > 0) {
        console.warn(`[LocalDb] Bulk upsert ${table}: ${count} ok, ${errors} errori${duplicatesRemoved > 0 ? `, ${duplicatesRemoved} duplicati rimossi` : ''}`);
      } else {
        console.log(`[LocalDb] Bulk upsert ${table}: ${count} record${duplicatesRemoved > 0 ? `, ${duplicatesRemoved} duplicati rimossi` : ''}`);
      }
      
      return count;
    } catch (error) {
      console.error(`[LocalDb] Errore bulkUpsert ${table}:`, error);
      return 0;
    }
  }

  /**
   * Conta record
   */
  count(table, filters = {}) {
    if (!this.isAvailable()) return 0;

    try {
      let query = `SELECT COUNT(*) as count FROM ${table} WHERE deleted_at IS NULL`;
      const params = [];

      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null) {
          query += ` AND ${key} = ?`;
          params.push(value);
        }
      }

      const result = this.db.prepare(query).get(...params);
      return result?.count || 0;
    } catch (error) {
      console.error(`[LocalDb] Errore count ${table}:`, error);
      return 0;
    }
  }

  // ============================================
  // METODI SPECIFICI PER ENTITÀ
  // ============================================

  // --- ANIMALI ---
  getAnimali(filters = {}) {
    return this.select('animali', filters, { orderBy: 'auricolare ASC' });
  }

  getAnimale(id) {
    return this.getById('animali', id);
  }

  insertAnimale(data) {
    return this.insert('animali', data);
  }

  updateAnimale(id, updates) {
    return this.update('animali', id, updates);
  }

  // --- DECESSI ---
  getDecessoByAnimaleId(animaleId) {
    const rows = this.select('decessi', { animale_id: animaleId }, { limit: 1 });
    return rows && rows.length > 0 ? rows[0] : null;
  }

  updateDecessoByAnimaleId(animaleId, updates) {
    if (!this.isAvailable()) return false;
    const decesso = this.getDecessoByAnimaleId(animaleId);
    if (!decesso) return false;
    return this.update('decessi', decesso.id, updates, false); // non marcare pending - sync gestisce decessi via backend
  }

  upsertDecesso(data) {
    if (!this.isAvailable()) return null;
    try {
      const existing = this.getDecessoByAnimaleId(data.animale_id);
      const now = new Date().toISOString();
      if (existing) {
        const updates = { ...data };
        delete updates.id;
        delete updates.animale_id;
        delete updates.created_at;
        this.update('decessi', existing.id, updates, false);
        return existing.id;
      } else {
        const res = this.insert('decessi', { ...data, created_at: now, updated_at: now }, false);
        return res ? res.id : null;
      }
    } catch (e) {
      console.error('[LocalDb] Errore upsertDecesso:', e);
      return null;
    }
  }

  // --- SEDI ---
  getSedi(filters = {}) {
    return this.select('sedi', filters, { orderBy: 'nome ASC' });
  }

  getSede(id) {
    return this.getById('sedi', id);
  }

  // --- STABILIMENTI ---
  getStabilimenti(filters = {}) {
    // Se c'è azienda_id, filtra tramite sedi
    if (filters.azienda_id) {
      const sedi = this.getSedi({ azienda_id: filters.azienda_id });
      const sedeIds = sedi.map(s => s.id);
      if (sedeIds.length === 0) {
        return [];
      }
      // Filtra stabilimenti per sede_id
      const allStabilimenti = this.select('stabilimenti', {}, { orderBy: 'nome ASC' });
      return allStabilimenti.filter(s => sedeIds.includes(s.sede_id));
    }
    return this.select('stabilimenti', filters, { orderBy: 'nome ASC' });
  }

  // --- BOX ---
  getBox(filters = {}) {
    // Se c'è azienda_id, filtra tramite stabilimenti -> sedi
    if (filters.azienda_id) {
      const sedi = this.getSedi({ azienda_id: filters.azienda_id });
      const sedeIds = sedi.map(s => s.id);
      const stabilimenti = this.getStabilimenti({});
      const stabilimentiAzienda = stabilimenti.filter(s => sedeIds.includes(s.sede_id));
      const stabilimentoIds = stabilimentiAzienda.map(s => s.id);
      
      if (stabilimentoIds.length === 0) {
        return [];
      }
      
      const allBox = this.select('box', {}, { orderBy: 'nome ASC' });
      return allBox.filter(b => stabilimentoIds.includes(b.stabilimento_id));
    }
    return this.select('box', filters, { orderBy: 'nome ASC' });
  }

  // --- FORNITORI ---
  getFornitori(filters = {}) {
    return this.select('fornitori', filters, { orderBy: 'nome ASC' });
  }

  insertFornitore(data) {
    return this.insert('fornitori', data);
  }

  updateFornitore(id, updates) {
    return this.update('fornitori', id, updates);
  }

  // --- FATTURE ---
  getFatture(filters = {}) {
    return this.select('fatture_amministrazione', filters, { orderBy: 'data_fattura DESC' });
  }

  insertFattura(data) {
    return this.insert('fatture_amministrazione', data);
  }

  updateFattura(id, updates) {
    return this.update('fatture_amministrazione', id, updates);
  }

  // --- TERRENI ---
  getTerreni(filters = {}) {
    return this.select('terreni', filters, { orderBy: 'denominazione ASC' });
  }

  // --- ATTREZZATURE ---
  getAttrezzature(filters = {}) {
    return this.select('attrezzature', filters, { orderBy: 'nome ASC' });
  }

  // --- FARMACI ---
  getFarmaci(filters = {}) {
    return this.select('farmaci', filters, { orderBy: 'nome ASC' });
  }

  // --- ASSICURAZIONI ---
  getAssicurazioni(filters = {}) {
    return this.select('assicurazioni_aziendali', filters, { orderBy: 'data_scadenza ASC' });
  }

  // --- COMPONENTI ALIMENTARI ---
  getComponentiAlimentari(filters = {}) {
    return this.select('componenti_alimentari', filters, { orderBy: 'nome ASC' });
  }

  // --- MANGIMI ---
  getMangimi(filters = {}) {
    return this.select('mangimi_confezionati', filters, { orderBy: 'nome ASC' });
  }

  // --- CONTRATTI SOCCIDA ---
  getContrattiSoccida(filters = {}) {
    return this.select('contratti_soccida', filters, { orderBy: 'data_inizio DESC' });
  }

  getContrattoSoccida(id) {
    return this.getById('contratti_soccida', id);
  }

  insertContrattoSoccida(data) {
    return this.insert('contratti_soccida', data);
  }

  updateContrattoSoccida(id, updates) {
    return this.update('contratti_soccida', id, updates);
  }

  deleteContrattoSoccida(id) {
    return this.delete('contratti_soccida', id);
  }

  // --- PARTITE ANIMALI ---
  getPartite(filters = {}) {
    return this.select('partite_animali', filters, { orderBy: 'data DESC' });
  }

  getPartita(id) {
    return this.getById('partite_animali', id);
  }

  insertPartita(data) {
    return this.insert('partite_animali', data);
  }

  updatePartita(id, updates) {
    return this.update('partite_animali', id, updates);
  }

  deletePartita(id) {
    return this.delete('partite_animali', id);
  }

  getPartitaAnimali(partitaId) {
    return this.select('partite_animali_animali', { partita_animale_id: partitaId });
  }

  // --- PRIMA NOTA ---
  getPNConti(filters = {}) {
    return this.select('pn_conti', filters, { orderBy: 'nome ASC' });
  }

  getPNConto(id) {
    return this.getById('pn_conti', id);
  }

  insertPNConto(data) {
    return this.insert('pn_conti', data);
  }

  updatePNConto(id, updates) {
    return this.update('pn_conti', id, updates);
  }

  deletePNConto(id) {
    return this.delete('pn_conti', id);
  }

  getPNCategorie(filters = {}) {
    return this.select('pn_categorie', filters, { orderBy: 'ordine ASC, nome ASC' });
  }

  getPNCategoria(id) {
    return this.getById('pn_categorie', id);
  }

  insertPNCategoria(data) {
    return this.insert('pn_categorie', data);
  }

  updatePNCategoria(id, updates) {
    return this.update('pn_categorie', id, updates);
  }

  deletePNCategoria(id) {
    return this.delete('pn_categorie', id);
  }

  getPNMovimenti(filters = {}) {
    if (!this.isAvailable()) return [];
    
    try {
      // Ottieni colonne effettive della tabella per validare i filtri
      const tableInfo = this.db.prepare(`PRAGMA table_info(pn_movimenti)`).all();
      const tableColumns = new Set(tableInfo.map(col => col.name));

      let query = `
        SELECT m.*, c.nome as categoria_nome, c.nome as categoria_label
        FROM pn_movimenti m
        LEFT JOIN pn_categorie c ON m.categoria_id = c.id AND c.deleted_at IS NULL
        WHERE m.deleted_at IS NULL
      `;
      const params = [];

      // Aggiungi filtri (solo se la colonna esiste nella tabella)
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null && value !== '' && tableColumns.has(key)) {
          query += ` AND m.${key} = ?`;
          params.push(value);
        }
      }

      query += ' ORDER BY m.data DESC, m.created_at DESC';

      return this.db.prepare(query).all(...params);
    } catch (error) {
      console.error('[LocalDb] Errore getPNMovimenti:', error);
      return [];
    }
  }

  getPNMovimento(id) {
    return this.getById('pn_movimenti', id);
  }

  insertPNMovimento(data) {
    return this.insert('pn_movimenti', data);
  }

  updatePNMovimento(id, updates) {
    return this.update('pn_movimenti', id, updates);
  }

  deletePNMovimento(id) {
    return this.delete('pn_movimenti', id);
  }

  getPNContiIban(contoId) {
    return this.select('pn_conti_iban', { conto_id: contoId });
  }

  insertPNContoIban(data) {
    return this.insert('pn_conti_iban', data);
  }

  updatePNContoIban(id, updates) {
    return this.update('pn_conti_iban', id, updates);
  }

  deletePNContoIban(id) {
    return this.delete('pn_conti_iban', id);
  }

  // --- PIANI ALIMENTAZIONE ---
  getPianiAlimentazione(filters = {}) {
    return this.select('piani_alimentazione', filters, { orderBy: 'nome ASC' });
  }

  getPianoAlimentazione(id) {
    return this.getById('piani_alimentazione', id);
  }

  insertPianoAlimentazione(data) {
    return this.insert('piani_alimentazione', data);
  }

  updatePianoAlimentazione(id, updates) {
    return this.update('piani_alimentazione', id, updates);
  }

  deletePianoAlimentazione(id) {
    return this.delete('piani_alimentazione', id);
  }

  getComposizioniPiano(pianoId) {
    return this.select('composizione_piano', { piano_alimentazione_id: pianoId }, { orderBy: 'ordine ASC' });
  }

  getComposizionePiano(id) {
    return this.getById('composizione_piano', id);
  }

  insertComposizionePiano(data) {
    return this.insert('composizione_piano', data);
  }

  updateComposizionePiano(id, updates) {
    return this.update('composizione_piano', id, updates);
  }

  deleteComposizionePiano(id) {
    return this.delete('composizione_piano', id);
  }

  // --- REGISTRO ALIMENTAZIONE ---
  getRegistroAlimentazione(filters = {}) {
    return this.select('registro_alimentazione', filters, { orderBy: 'data DESC' });
  }

  getVoceRegistro(id) {
    return this.getById('registro_alimentazione', id);
  }

  insertVoceRegistro(data) {
    return this.insert('registro_alimentazione', data);
  }

  updateVoceRegistro(id, updates) {
    return this.update('registro_alimentazione', id, updates);
  }

  deleteVoceRegistro(id) {
    return this.delete('registro_alimentazione', id);
  }

  getRegistroDettagli(registroId) {
    return this.select('registro_alimentazione_dettagli', { registro_id: registroId }, { orderBy: 'ordine ASC' });
  }

  // --- DDT ---
  getDdt(filters = {}) {
    return this.select('ddt', filters, { orderBy: 'data DESC, numero DESC' });
  }

  getDdtById(id) {
    return this.getById('ddt', id);
  }

  insertDdt(data) {
    return this.insert('ddt', data);
  }

  updateDdt(id, updates) {
    return this.update('ddt', id, updates);
  }

  deleteDdt(id) {
    return this.delete('ddt', id);
  }

  getDdtRighe(ddtId) {
    return this.select('ddt_righe', { ddt_id: ddtId });
  }

  getDdtRiga(id) {
    return this.getById('ddt_righe', id);
  }

  insertDdtRiga(data) {
    return this.insert('ddt_righe', data);
  }

  updateDdtRiga(id, updates) {
    return this.update('ddt_righe', id, updates);
  }

  deleteDdtRiga(id) {
    return this.delete('ddt_righe', id);
  }

  // --- MAGAZZINO MOVIMENTI ---
  getMagazzinoMovimenti(filters = {}) {
    return this.select('magazzino_movimenti', filters, { orderBy: 'data DESC, created_at DESC' });
  }

  getMagazzinoMovimento(id) {
    return this.getById('magazzino_movimenti', id);
  }

  insertMagazzinoMovimento(data) {
    return this.insert('magazzino_movimenti', data);
  }

  updateMagazzinoMovimento(id, updates) {
    return this.update('magazzino_movimenti', id, updates);
  }

  deleteMagazzinoMovimento(id) {
    return this.delete('magazzino_movimenti', id);
  }

  // --- MOVIMENTAZIONI ANIMALI ---
  getMovimentazioni(filters = {}) {
    return this.select('movimentazioni', filters, { orderBy: 'data_ora DESC' });
  }

  getMovimentazione(id) {
    return this.getById('movimentazioni', id);
  }

  insertMovimentazione(data) {
    return this.insert('movimentazioni', data);
  }

  // --- LOTTI FARMACO ---
  getLottiFarmaco(filters = {}) {
    return this.select('lotti_farmaco', filters, { orderBy: 'scadenza ASC' });
  }

  getLottoFarmaco(id) {
    return this.getById('lotti_farmaco', id);
  }

  insertLottoFarmaco(data) {
    return this.insert('lotti_farmaco', data);
  }

  updateLottoFarmaco(id, updates) {
    return this.update('lotti_farmaco', id, updates);
  }

  deleteLottoFarmaco(id) {
    return this.delete('lotti_farmaco', id);
  }

  // --- LAVORAZIONI TERRENO ---
  getLavorazioni(filters = {}) {
    return this.select('lavorazioni_terreno', filters, { orderBy: 'data DESC' });
  }

  getLavorazione(id) {
    return this.getById('lavorazioni_terreno', id);
  }

  insertLavorazione(data) {
    return this.insert('lavorazioni_terreno', data);
  }

  updateLavorazione(id, updates) {
    return this.update('lavorazioni_terreno', id, updates);
  }

  deleteLavorazione(id) {
    return this.delete('lavorazioni_terreno', id);
  }

  // --- RACCOLTI TERRENO ---
  getRaccolti(filters = {}) {
    return this.select('raccolti_terreno', filters, { orderBy: 'data_inizio DESC' });
  }

  getRaccolto(id) {
    return this.getById('raccolti_terreno', id);
  }

  insertRaccolto(data) {
    return this.insert('raccolti_terreno', data);
  }

  updateRaccolto(id, updates) {
    return this.update('raccolti_terreno', id, updates);
  }

  deleteRaccolto(id) {
    return this.delete('raccolti_terreno', id);
  }

  // --- CICLI TERRENO ---
  /**
   * Ottiene lista cicli con summary calcolati (totale_costi, fasi_concluse, fasi_totali)
   * Replica la logica del backend GET /{terreno_id}/cicli
   */
  getCicli(filters = {}) {
    if (!this.isAvailable()) return [];

    try {
      // Ottieni cicli base
      const cicli = this.select('cicli_terreno', filters, { orderBy: 'anno DESC, data_inizio DESC, created_at DESC' });
      
      if (cicli.length === 0) return [];

      const cicloIds = cicli.map(c => c.id);
      
      // Ottieni tutte le fasi per questi cicli in una query (escludi eliminate)
      const allFasi = this.db.prepare(`
        SELECT ciclo_id, data_fine FROM cicli_terreno_fasi 
        WHERE ciclo_id IN (${cicloIds.join(',')}) AND deleted_at IS NULL
      `).all();
      
      // Ottieni tutti i costi per questi cicli con risoluzione importo (escludi eliminati)
      const allCosti = this.db.prepare(`
        SELECT 
          c.ciclo_id, 
          c.fase_id,
          c.importo, 
          c.source_type,
          c.fattura_amministrazione_id,
          c.lavorazione_id,
          f.importo_netto as fattura_importo_netto,
          f.importo_totale as fattura_importo_totale,
          l.costo_totale as lavorazione_costo
        FROM cicli_terreno_costi c
        LEFT JOIN fatture_amministrazione f ON c.fattura_amministrazione_id = f.id AND f.deleted_at IS NULL
        LEFT JOIN lavorazioni_terreno l ON c.lavorazione_id = l.id AND l.deleted_at IS NULL
        WHERE c.ciclo_id IN (${cicloIds.join(',')}) AND c.deleted_at IS NULL
      `).all();
      
      // Calcola statistiche per ogni ciclo
      const faseStats = {};
      const costiTotali = {};
      
      for (const cicloId of cicloIds) {
        faseStats[cicloId] = { tot: 0, done: 0 };
        costiTotali[cicloId] = 0;
      }
      
      // Conta fasi
      for (const fase of allFasi) {
        const stats = faseStats[fase.ciclo_id];
        if (stats) {
          stats.tot++;
          if (fase.data_fine !== null) {
            stats.done++;
          }
        }
      }
      
      // Calcola costi totali con risoluzione importo
      // Somma solo i costi associati alle fasi (fase_id non null)
      for (const costo of allCosti) {
        // Calcola il totale sommando solo i costi associati alle fasi
        if (costo.fase_id !== null && costo.fase_id !== undefined) {
          let importo = 0;
          
          // Priorità 1: Se c'è un importo esplicito, usalo sempre
          if (costo.importo !== null && costo.importo !== undefined && costo.importo !== '') {
            const importoParsed = parseFloat(costo.importo);
            if (!isNaN(importoParsed) && isFinite(importoParsed)) {
              importo = importoParsed;
            }
          } else if (costo.source_type === 'fattura' && costo.fattura_amministrazione_id) {
            // Priorità 2: Se è una fattura senza importo esplicito, usa il totale della fattura
            importo = parseFloat(costo.fattura_importo_netto || costo.fattura_importo_totale || 0);
          } else if (costo.source_type === 'lavorazione' && costo.lavorazione_id) {
            // Priorità 3: Se è una lavorazione, usa il costo della lavorazione
            importo = parseFloat(costo.lavorazione_costo || 0);
          }
          
          costiTotali[costo.ciclo_id] = (costiTotali[costo.ciclo_id] || 0) + importo;
        }
      }
      
      // Arricchisci i cicli con i campi calcolati
      return cicli.map(ciclo => ({
        ...ciclo,
        totale_costi: costiTotali[ciclo.id] || 0,
        fasi_concluse: faseStats[ciclo.id]?.done || 0,
        fasi_totali: faseStats[ciclo.id]?.tot || 0,
        superficie_coinvolta: ciclo.superficie_coinvolta !== null 
          ? parseFloat(ciclo.superficie_coinvolta) 
          : null,
      }));
    } catch (error) {
      console.error('[LocalDb] Errore getCicli con summary:', error);
      // Fallback a versione semplice
      return this.select('cicli_terreno', filters, { orderBy: 'anno DESC, data_inizio DESC' });
    }
  }

  /**
   * Ottiene dettaglio completo di un ciclo con fasi, costi e totali
   * Replica la logica del backend GET /terreni/cicli/{ciclo_id}
   */
  getCiclo(id) {
    if (!this.isAvailable()) return null;

    try {
      const ciclo = this.getById('cicli_terreno', id);
      if (!ciclo) return null;
      
      // Ottieni fasi ordinate (escludi eliminate)
      const fasi = this.db.prepare(`
        SELECT * FROM cicli_terreno_fasi 
        WHERE ciclo_id = ? AND deleted_at IS NULL
        ORDER BY ordine ASC, data_inizio ASC, id ASC
      `).all(id);
      
      // Ottieni costi con dati fattura/lavorazione (escludi eliminati)
      const costi = this.db.prepare(`
        SELECT 
          c.*,
          f.numero as fattura_numero,
          f.data_fattura as fattura_data_fattura,
          f.importo_totale as fattura_importo_totale,
          f.importo_netto as fattura_importo_netto,
          l.tipo as lavorazione_tipo,
          l.data as lavorazione_data,
          l.costo_totale as lavorazione_costo
        FROM cicli_terreno_costi c
        LEFT JOIN fatture_amministrazione f ON c.fattura_amministrazione_id = f.id AND f.deleted_at IS NULL
        LEFT JOIN lavorazioni_terreno l ON c.lavorazione_id = l.id AND l.deleted_at IS NULL
        WHERE c.ciclo_id = ? AND c.deleted_at IS NULL
        ORDER BY c.data ASC, c.created_at ASC
      `).all(id);
      
      // Calcola totali per fase e totale generale
      const faseTotals = {};
      for (const fase of fasi) {
        faseTotals[fase.id] = 0;
      }
      
      let totaleCosti = 0;
      
      // Elabora costi con risoluzione importo
      const costiElaborati = costi.map(costo => {
        let importoRisolto = 0;
        
        // Priorità 1: Se c'è un importo esplicito (es. riga fattura selezionata), usalo SEMPRE
        // Questo è fondamentale: se l'importo è stato salvato esplicitamente, deve essere usato
        // Gestisce anche stringhe "0", stringhe vuote, e valori null/undefined
        if (costo.importo !== null && costo.importo !== undefined && costo.importo !== '') {
          const importoParsed = parseFloat(costo.importo);
          // Se il parsing ha successo e il risultato è un numero valido (anche 0), usalo
          // IMPORTANTE: se importo è presente, lo usiamo sempre, anche se è 0
          if (!isNaN(importoParsed) && isFinite(importoParsed)) {
            importoRisolto = importoParsed;
          } else {
            // Se il parsing fallisce ma importo è presente, meglio usare 0 che il totale sbagliato
            // Questo evita di usare il totale della fattura quando l'importo è stato salvato
            importoRisolto = 0;
          }
        } else if (costo.source_type === 'fattura' && costo.fattura_amministrazione_id) {
          // Priorità 2: Se è una fattura SENZA importo esplicito, usa il totale della fattura
          // SOLO se non c'è un importo salvato
          importoRisolto = parseFloat(costo.fattura_importo_netto || costo.fattura_importo_totale || 0);
        } else if (costo.source_type === 'lavorazione' && costo.lavorazione_id) {
          // Priorità 3: Se è una lavorazione, usa il costo della lavorazione
          importoRisolto = parseFloat(costo.lavorazione_costo || 0);
        }
        
        totaleCosti += importoRisolto;
        
        // Aggiungi al totale della fase se presente
        if (costo.fase_id && faseTotals[costo.fase_id] !== undefined) {
          faseTotals[costo.fase_id] += importoRisolto;
        }
        
        // Costruisci oggetti fattura/lavorazione inline
        const fattura = costo.fattura_amministrazione_id ? {
          id: costo.fattura_amministrazione_id,
          numero: costo.fattura_numero,
          data_fattura: costo.fattura_data_fattura,
          importo_totale: costo.fattura_importo_totale ? parseFloat(costo.fattura_importo_totale) : null,
          importo_netto: costo.fattura_importo_netto ? parseFloat(costo.fattura_importo_netto) : null,
        } : null;
        
        const lavorazione = costo.lavorazione_id ? {
          id: costo.lavorazione_id,
          tipo: costo.lavorazione_tipo,
          data: costo.lavorazione_data,
          costo: costo.lavorazione_costo ? parseFloat(costo.lavorazione_costo) : null,
        } : null;
        
        return {
          id: costo.id,
          ciclo_id: costo.ciclo_id,
          fase_id: costo.fase_id,
          terreno_id: costo.terreno_id,
          azienda_id: costo.azienda_id,
          descrizione: costo.descrizione,
          data: costo.data,
          importo: (costo.importo !== null && costo.importo !== undefined && costo.importo !== '') 
            ? parseFloat(costo.importo) 
            : null,
          importo_risolto: importoRisolto,
          source_type: costo.source_type,
          fattura_amministrazione_id: costo.fattura_amministrazione_id,
          lavorazione_id: costo.lavorazione_id,
          note: costo.note,
          created_at: costo.created_at,
          updated_at: costo.updated_at,
          fattura,
          lavorazione,
        };
      });
      
      // Elabora fasi con totale costi
      const fasiElaborate = fasi.map(fase => ({
        id: fase.id,
        ciclo_id: fase.ciclo_id,
        nome: fase.nome,
        tipo: fase.tipo,
        ordine: fase.ordine,
        data_inizio: fase.data_inizio,
        data_fine: fase.data_fine,
        note: fase.note,
        created_at: fase.created_at,
        updated_at: fase.updated_at,
        totale_costi: faseTotals[fase.id] || 0,
      }));
      
      // Costi per fase (per compatibilità con backend)
      const costiPerFase = fasi.map(fase => ({
        fase_id: fase.id,
        totale: faseTotals[fase.id] || 0,
        nome: fase.nome,
      }));
      
      return {
        id: ciclo.id,
        azienda_id: ciclo.azienda_id,
        terreno_id: ciclo.terreno_id,
        coltura: ciclo.coltura,
        anno: ciclo.anno,
        data_inizio: ciclo.data_inizio,
        data_fine: ciclo.data_fine,
        superficie_coinvolta: ciclo.superficie_coinvolta !== null 
          ? parseFloat(ciclo.superficie_coinvolta) 
          : null,
        note: ciclo.note,
        created_at: ciclo.created_at,
        updated_at: ciclo.updated_at,
        deleted_at: ciclo.deleted_at,
        totale_costi: totaleCosti,
        fasi: fasiElaborate,
        costi: costiElaborati,
        costi_per_fase: costiPerFase,
      };
    } catch (error) {
      console.error('[LocalDb] Errore getCiclo dettagliato:', error);
      return this.getById('cicli_terreno', id);
    }
  }

  insertCiclo(data) {
    return this.insert('cicli_terreno', data);
  }

  updateCiclo(id, updates) {
    return this.update('cicli_terreno', id, updates);
  }

  deleteCiclo(id) {
    return this.delete('cicli_terreno', id);
  }

  getCicloFasi(cicloId) {
    return this.select('cicli_terreno_fasi', { ciclo_id: cicloId }, { orderBy: 'ordine ASC' });
  }

  getCicloFase(id) {
    return this.getById('cicli_terreno_fasi', id);
  }

  insertCicloFase(data) {
    return this.insert('cicli_terreno_fasi', data);
  }

  updateCicloFase(id, updates) {
    return this.update('cicli_terreno_fasi', id, updates);
  }

  deleteCicloFase(id) {
    return this.delete('cicli_terreno_fasi', id);
  }

  getCicloCosti(filters = {}) {
    return this.select('cicli_terreno_costi', filters, { orderBy: 'data DESC' });
  }

  getCicloCosto(id) {
    return this.getById('cicli_terreno_costi', id);
  }

  insertCicloCosto(data) {
    const result = this.insert('cicli_terreno_costi', data);
    return result;
  }

  updateCicloCosto(id, updates) {
    return this.update('cicli_terreno_costi', id, updates);
  }

  deleteCicloCosto(id) {
    return this.delete('cicli_terreno_costi', id);
  }

  /**
   * Calcola riepilogo costi, ricavi e margine per un terreno
   * Replica la logica del backend GET /{terreno_id}/riepilogo
   */
  getTerrenoRiepilogo(terrenoId) {
    if (!this.isAvailable()) return null;

    try {
      const terreno = this.getById('terreni', terrenoId);
      if (!terreno) {
        return null;
      }

      // Calcola costi dalle fatture ricevute (fatture amministrazione)
      const fatture_ricevute = this.db.prepare(`
        SELECT * FROM fatture_amministrazione
        WHERE terreno_id = ? AND deleted_at IS NULL AND tipo = 'uscita'
      `).all(terrenoId);

      let costi_fatture_ricevute = 0;
      for (const f of fatture_ricevute) {
        costi_fatture_ricevute += parseFloat(f.importo_totale || 0);
      }

      // Calcola costi dai cicli colturali (solo costi associati alle fasi)
      const costi_cicli = this.db.prepare(`
        SELECT 
          c.*,
          f.importo_netto as fattura_importo_netto,
          f.importo_totale as fattura_importo_totale,
          l.costo_totale as lavorazione_costo
        FROM cicli_terreno_costi c
        LEFT JOIN fatture_amministrazione f ON c.fattura_amministrazione_id = f.id AND f.deleted_at IS NULL
        LEFT JOIN lavorazioni_terreno l ON c.lavorazione_id = l.id AND l.deleted_at IS NULL
        WHERE c.terreno_id = ? AND c.fase_id IS NOT NULL
      `).all(terrenoId);

      let costi_cicli_totali = 0;
      for (const costo of costi_cicli) {
        let importo = 0;

        // Priorità 1: Se c'è un importo esplicito, usalo sempre
        if (costo.importo !== null && costo.importo !== undefined && costo.importo !== '') {
          const importoParsed = parseFloat(costo.importo);
          if (!isNaN(importoParsed) && isFinite(importoParsed)) {
            importo = importoParsed;
          }
        } else if (costo.source_type === 'fattura' && costo.fattura_amministrazione_id) {
          // Priorità 2: Se è una fattura senza importo esplicito, usa il totale della fattura
          importo = parseFloat(costo.fattura_importo_netto || costo.fattura_importo_totale || 0);
        } else if (costo.source_type === 'lavorazione' && costo.lavorazione_id) {
          // Priorità 3: Se è una lavorazione, usa il costo della lavorazione
          importo = parseFloat(costo.lavorazione_costo || 0);
        }

        costi_cicli_totali += importo;
      }

      // Somma costi da fatture e costi da cicli
      const costi_totali = costi_fatture_ricevute + costi_cicli_totali;

      // Calcola ricavi dalle vendite prodotti agricoli
      // Verifica se la tabella esiste prima di fare la query
      let vendite = [];
      try {
        vendite = this.db.prepare(`
          SELECT * FROM vendite_prodotti_agricoli
          WHERE terreno_id = ? AND deleted_at IS NULL
        `).all(terrenoId);
      } catch (error) {
        // Tabella non esiste ancora, usa array vuoto
        console.warn('[LocalDb] Tabella vendite_prodotti_agricoli non trovata, usando array vuoto');
        vendite = [];
      }

      let ricavi_totali = 0;
      for (const v of vendite) {
        ricavi_totali += parseFloat(v.importo_totale || 0);
      }
      const numero_vendite = vendite.length;

      // Calcola margine
      const margine = ricavi_totali - costi_totali;

      // Raggruppa prodotti raccolti
      const prodotti_map = {};
      for (const vendita of vendite) {
        const prodotto_key = `${vendita.prodotto}_${vendita.unita_misura}`;
        if (!prodotti_map[prodotto_key]) {
          prodotti_map[prodotto_key] = {
            prodotto: vendita.prodotto,
            unita_misura: vendita.unita_misura,
            quantita_venduta: 0,
            ricavi_totali: 0,
            prezzi_vendita: []
          };
        }
        prodotti_map[prodotto_key].quantita_venduta += parseFloat(vendita.quantita || 0);
        prodotti_map[prodotto_key].ricavi_totali += parseFloat(vendita.importo_totale || 0);
        prodotti_map[prodotto_key].prezzi_vendita.push(parseFloat(vendita.prezzo_unitario || 0));
      }

      // Aggiungi raccolti non venduti
      const raccolti = this.db.prepare(`
        SELECT * FROM raccolti_terreno
        WHERE terreno_id = ?
      `).all(terrenoId);

      for (const raccolto of raccolti) {
        const prodotto_key = `${raccolto.prodotto}_${raccolto.unita_misura}`;
        if (!prodotti_map[prodotto_key]) {
          prodotti_map[prodotto_key] = {
            prodotto: raccolto.prodotto,
            unita_misura: raccolto.unita_misura,
            quantita_venduta: 0,
            ricavi_totali: 0,
            prezzi_vendita: []
          };
        }
        if (raccolto.resa_quantita) {
          const quantita_totale = parseFloat(raccolto.resa_quantita);
          // Verifica se è già stata venduta
          const quantita_venduta_prod = vendite
            .filter(v => v.prodotto === raccolto.prodotto && v.unita_misura === raccolto.unita_misura)
            .reduce((sum, v) => sum + parseFloat(v.quantita || 0), 0);
          
          if (quantita_totale > quantita_venduta_prod) {
            // Aggiungi quantità disponibile
            if (!prodotti_map[prodotto_key].quantita_totale) {
              prodotti_map[prodotto_key].quantita_totale = quantita_totale;
            } else {
              prodotti_map[prodotto_key].quantita_totale += quantita_totale;
            }
          }
        }
      }

      // Calcola scorte per tutti i prodotti
      const prodotti_nomi = [...new Set(Object.values(prodotti_map).map(d => d.prodotto))];
      const scorte_map = {};
      
      if (prodotti_nomi.length > 0) {
        // Query per calcolare scorte aggregate per prodotto
        const scorte_results = this.db.prepare(`
          SELECT 
            causale,
            SUM(CASE WHEN tipo = 'carico' THEN quantita ELSE 0 END) -
            SUM(CASE WHEN tipo = 'scarico' THEN quantita ELSE 0 END) +
            SUM(CASE WHEN tipo = 'rettifica' THEN quantita ELSE 0 END) as quantita
          FROM magazzino_movimenti
          WHERE deleted_at IS NULL
          GROUP BY causale
        `).all();

        // Mappa le scorte ai prodotti (match parziale per nome)
        for (const row of scorte_results) {
          if (row.quantita && row.causale) {
            for (const nome_prod of prodotti_nomi) {
              if (row.causale.toLowerCase().includes(nome_prod.toLowerCase())) {
                if (!scorte_map[nome_prod]) {
                  scorte_map[nome_prod] = 0;
                }
                scorte_map[nome_prod] += parseFloat(row.quantita || 0);
              }
            }
          }
        }
      }

      // Costruisci lista prodotti con informazioni scorte
      const prodotti_info = [];
      const prodotti_autoprodotti = [];

      for (const key in prodotti_map) {
        const dati = prodotti_map[key];
        const quantita_totale = dati.quantita_totale || dati.quantita_venduta;
        const quantita_venduta = dati.quantita_venduta;
        const quantita_disponibile = quantita_totale - quantita_venduta;

        let prezzo_medio = null;
        if (dati.prezzi_vendita.length > 0) {
          prezzo_medio = dati.prezzi_vendita.reduce((a, b) => a + b, 0) / dati.prezzi_vendita.length;
        }

        // Usa le scorte calcolate
        const quantita_scorte = scorte_map[dati.prodotto] || 0;

        prodotti_info.push({
          prodotto: dati.prodotto,
          quantita_totale: quantita_totale,
          unita_misura: dati.unita_misura,
          quantita_venduta: quantita_venduta,
          quantita_disponibile: quantita_disponibile > 0 ? quantita_disponibile : quantita_scorte,
          prezzo_medio_vendita: prezzo_medio,
          ricavi_totali: dati.ricavi_totali
        });

        // Se c'è quantità disponibile, calcola costo unitario per risparmio
        if (quantita_disponibile > 0 || quantita_scorte > 0) {
          let costo_unitario = 0;
          if (quantita_totale > 0 && costi_totali > 0) {
            // Distribuisci i costi proporzionalmente alla quantità
            costo_unitario = costi_totali / quantita_totale;
          }

          prodotti_autoprodotti.push({
            prodotto: dati.prodotto,
            quantita_disponibile: quantita_disponibile > 0 ? quantita_disponibile : quantita_scorte,
            unita_misura: dati.unita_misura,
            costo_unitario: costo_unitario,
            costo_totale: costo_unitario * (quantita_disponibile > 0 ? quantita_disponibile : quantita_scorte)
          });
        }
      }

      // Conta fatture uniche dai cicli (escludendo quelle già conteggiate)
      const fatture_ids_cicli = new Set(
        costi_cicli
          .filter(c => c.fattura_amministrazione_id)
          .map(c => c.fattura_amministrazione_id)
      );
      const fatture_ids_ricevute = new Set(fatture_ricevute.map(f => f.id));
      const fatture_ids_cicli_uniche = [...fatture_ids_cicli].filter(id => !fatture_ids_ricevute.has(id));
      const numero_fatture_costi = fatture_ricevute.length + fatture_ids_cicli_uniche.length;

      return {
        terreno_id: terreno.id,
        terreno_denominazione: terreno.denominazione,
        costi_totali: costi_totali,
        ricavi_totali: ricavi_totali,
        margine: margine,
        prodotti_raccolti: prodotti_info,
        costi_fatture_emesse: 0, // Non implementato per ora
        costi_fatture_ricevute: costi_fatture_ricevute,
        numero_fatture_costi: numero_fatture_costi,
        numero_vendite: numero_vendite,
        prodotti_autoprodotti_disponibili: prodotti_autoprodotti
      };
    } catch (error) {
      console.error('[LocalDb] Errore getTerrenoRiepilogo:', error);
      return null;
    }
  }

  // --- SCADENZE ATTREZZATURE ---
  getScadenzeAttrezzatura(attrezzaturaId) {
    return this.select('scadenze_attrezzature', { attrezzatura_id: attrezzaturaId }, { orderBy: 'data_scadenza ASC' });
  }

  getScadenzaAttrezzatura(id) {
    return this.getById('scadenze_attrezzature', id);
  }

  insertScadenzaAttrezzatura(data) {
    return this.insert('scadenze_attrezzature', data);
  }

  updateScadenzaAttrezzatura(id, updates) {
    return this.update('scadenze_attrezzature', id, updates);
  }

  deleteScadenzaAttrezzatura(id) {
    return this.delete('scadenze_attrezzature', id);
  }

  // --- AMMORTAMENTI ---
  getAmmortamenti(filters = {}) {
    return this.select('ammortamenti', filters, { orderBy: 'anno DESC, mese DESC' });
  }

  getAmmortamento(id) {
    return this.getById('ammortamenti', id);
  }

  insertAmmortamento(data) {
    return this.insert('ammortamenti', data);
  }

  updateAmmortamento(id, updates) {
    return this.update('ammortamenti', id, updates);
  }

  deleteAmmortamento(id) {
    return this.delete('ammortamenti', id);
  }

  // ============================================
  // SYNC HELPERS
  // ============================================

  /**
   * Ottiene record da sincronizzare
   */
  getPendingSync(table = null) {
    if (!this.isAvailable()) return [];

    try {
      if (table) {
        return this.db.prepare(
          `SELECT * FROM ${table} WHERE sync_status = 'pending'`
        ).all();
      }

      // Ottieni da tutte le tabelle
      return this.db.prepare(
        `SELECT * FROM _sync_log WHERE status = 'pending' ORDER BY created_at ASC`
      ).all();
    } catch (error) {
      console.error('[LocalDb] Errore getPendingSync:', error);
      return [];
    }
  }

  /**
   * Marca record come sincronizzato
   */
  markSynced(table, id) {
    if (!this.isAvailable()) return false;

    try {
      const now = new Date().toISOString();
      this.db.prepare(
        `UPDATE ${table} SET sync_status = 'synced', synced_at = ? WHERE id = ?`
      ).run(now, id);

      // Aggiorna anche il log
      this.db.prepare(
        `UPDATE _sync_log SET status = 'synced', synced_at = ? 
         WHERE table_name = ? AND record_id = ? AND status = 'pending'`
      ).run(now, table, id);

      return true;
    } catch (error) {
      console.error('[LocalDb] Errore markSynced:', error);
      return false;
    }
  }

  /**
   * Marca sync come fallito
   */
  markSyncError(table, id, errorMessage) {
    if (!this.isAvailable()) return false;

    try {
      this.db.prepare(
        `UPDATE ${table} SET sync_status = 'error' WHERE id = ?`
      ).run(id);

      this.db.prepare(
        `UPDATE _sync_log SET status = 'error', error_message = ? 
         WHERE table_name = ? AND record_id = ? AND status = 'pending'`
      ).run(errorMessage, table, id);

      return true;
    } catch (error) {
      console.error('[LocalDb] Errore markSyncError:', error);
      return false;
    }
  }

  /**
   * Aggiorna metadati sync
   */
  updateSyncMeta(key, value) {
    if (!this.isAvailable()) return;

    try {
      this.db.prepare(
        `INSERT OR REPLACE INTO _meta (key, value, updated_at) VALUES (?, ?, datetime('now'))`
      ).run(key, value);
    } catch (error) {
      console.error('[LocalDb] Errore updateSyncMeta:', error);
    }
  }

  /**
   * Ottiene metadato sync
   */
  getSyncMeta(key) {
    if (!this.isAvailable()) return null;

    try {
      const result = this.db.prepare(
        `SELECT value FROM _meta WHERE key = ?`
      ).get(key);
      return result?.value;
    } catch (error) {
      console.error('[LocalDb] Errore getSyncMeta:', error);
      return null;
    }
  }

  /**
   * Log operazione per sync
   * @private
   */
  _logSync(table, operation, recordId, data) {
    try {
      this.db.prepare(`
        INSERT INTO _sync_log (table_name, operation, record_id, data, status, created_at)
        VALUES (?, ?, ?, ?, 'pending', datetime('now'))
      `).run(table, operation, recordId, JSON.stringify(data));
    } catch (error) {
      console.error('[LocalDb] Errore _logSync:', error);
    }
  }

  /**
   * Pulisce log sync vecchi (sincronizzati da più di 7 giorni)
   */
  cleanOldSyncLogs() {
    if (!this.isAvailable()) return;

    try {
      this.db.prepare(`
        DELETE FROM _sync_log 
        WHERE status = 'synced' 
        AND synced_at < datetime('now', '-7 days')
      `).run();
    } catch (error) {
      console.error('[LocalDb] Errore cleanOldSyncLogs:', error);
    }
  }

  /**
   * Query raw per casi speciali
   */
  query(sql, params = []) {
    if (!this.isAvailable()) return [];

    try {
      return this.db.prepare(sql).all(...params);
    } catch (error) {
      console.error('[LocalDb] Errore query:', error);
      return [];
    }
  }

  /**
   * Esegui statement raw
   */
  run(sql, params = []) {
    if (!this.isAvailable()) return null;

    try {
      return this.db.prepare(sql).run(...params);
    } catch (error) {
      console.error('[LocalDb] Errore run:', error);
      return null;
    }
  }
}

// Singleton
const localDb = new LocalDatabase();

module.exports = localDb;

