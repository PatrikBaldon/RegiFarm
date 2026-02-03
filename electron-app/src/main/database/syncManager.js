/**
 * Sync Manager per RegiFarm Pro
 * 
 * Gestisce la sincronizzazione bidirezionale tra:
 * - Database Locale SQLite (letture istantanee)
 * - Backend Fly.io → Supabase (persistenza cloud)
 * 
 * Strategia:
 * 1. PUSH: Modifiche locali → Backend → Supabase
 * 2. PULL: Supabase → Backend → Database Locale
 * 
 * La sincronizzazione avviene in background senza bloccare l'UI.
 */

const localDb = require('./localDb');

// URL del backend (stesso usato dal frontend)
const API_BASE_URL = 'https://regifarm-backend.fly.dev/api/v1';
// Per sviluppo locale: 'http://localhost:8000/api/v1'

class SyncManager {
  constructor() {
    this.isSyncing = false;
    this.syncInterval = null;
    this.syncIntervalMs = 60000; // 60 secondi (ridotto da 30s per ridurre carico backend)
    this.lastSyncTime = null;
    this.authToken = null;
    this.onSyncUpdate = null; // Callback per notificare il renderer
    this.pendingPushCount = 0;
    this.currentAziendaId = null; // Azienda corrente per sync
    this.isBackgroundSyncing = false; // Flag per indicare sync in background durante chiusura
    this.onBackgroundSyncComplete = null; // Callback quando la sync in background è completata
  }

  /**
   * Imposta il token di autenticazione
   */
  setAuthToken(token) {
    this.authToken = token;
  }

  /**
   * Imposta l'azienda corrente per la sincronizzazione
   */
  setAziendaId(aziendaId) {
    this.currentAziendaId = aziendaId;
  }

  /**
   * Imposta callback per aggiornamenti sync
   */
  setOnSyncUpdate(callback) {
    this.onSyncUpdate = callback;
  }

  /**
   * Avvia sincronizzazione periodica
   */
  start() {
    if (this.syncInterval) {
      console.log('[SyncManager] Già in esecuzione');
      return;
    }

    console.log('[SyncManager] Avvio sincronizzazione periodica ogni', this.syncIntervalMs / 1000, 'secondi');
    
    // Sync iniziale
    this.syncAll();
    
    // Sync periodica
    this.syncInterval = setInterval(() => {
      this.syncAll();
    }, this.syncIntervalMs);
  }

  /**
   * Ferma sincronizzazione periodica
   */
  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('[SyncManager] Sincronizzazione fermata');
    }
  }

  /**
   * Esegue sincronizzazione completa
   */
  async syncAll() {
    if (this.isSyncing) {
      console.log('[SyncManager] Sync già in corso, skip');
      return { success: false, reason: 'already_syncing' };
    }

    if (!localDb.isAvailable()) {
      console.log('[SyncManager] Database locale non disponibile');
      return { success: false, reason: 'db_unavailable' };
    }

    // Ottieni aziendaId se non è stato impostato
    let aziendaId = this.currentAziendaId;
    if (!aziendaId) {
      // Prova a ottenerlo dai metadati o dal database
      const syncedAzienda = localDb.getSyncMeta('initial_sync_azienda');
      if (syncedAzienda) {
        aziendaId = parseInt(syncedAzienda, 10);
        console.log(`[SyncManager] AziendaId ottenuto dai metadati: ${aziendaId}`);
      } else {
        // Prova a ottenere dalla tabella aziende (prima azienda disponibile)
        const aziende = localDb.select('aziende', {}, { limit: 1 });
        if (aziende && aziende.length > 0) {
          aziendaId = aziende[0].id;
          console.log(`[SyncManager] AziendaId ottenuto dal database: ${aziendaId}`);
        }
      }
    }

    if (!aziendaId) {
      console.warn('[SyncManager] syncAll chiamato senza aziendaId - skip sync');
      return { success: false, reason: 'no_azienda_id' };
    }

    // Verifica se serve sync iniziale
    const needsInitial = localDb.getSyncMeta('initial_sync_completed') !== 'true';
    if (needsInitial) {
      console.log('[SyncManager] Sync iniziale non completata, avvio sync iniziale...');
      return await this.initialSync(aziendaId);
    }

    // Verifica se i dati locali sono inconsistenti (es: movimenti senza contropartita quando dovrebbero averla)
    const needsFullSync = this._checkDataConsistency(aziendaId);
    if (needsFullSync) {
      console.log('[SyncManager] Rilevata inconsistenza nei dati locali, forzo full sync...');
      return await this.initialSync(aziendaId);
    }

    this.isSyncing = true;
    this._notifyUpdate({ status: 'syncing', phase: 'start' });

    try {
      console.log('[SyncManager] Inizio sincronizzazione completa per azienda:', aziendaId);
      const startTime = Date.now();

      // 1. PUSH: Invia modifiche locali al server
      const pushResult = await this.pushChanges();
      this._notifyUpdate({ status: 'syncing', phase: 'push', result: pushResult });

      // 2. PULL: Scarica aggiornamenti dal server
      const pullResult = await this.pullChanges({ aziendaId, fullSync: false });
      this._notifyUpdate({ status: 'syncing', phase: 'pull', result: pullResult });

      // 3. Pulizia
      localDb.cleanOldSyncLogs();

      const duration = Date.now() - startTime;
      this.lastSyncTime = new Date().toISOString();
      localDb.updateSyncMeta('last_sync', this.lastSyncTime);

      console.log(`[SyncManager] Sync completata in ${duration}ms`);
      this._notifyUpdate({ 
        status: 'completed', 
        duration, 
        pushResult, 
        pullResult,
        lastSync: this.lastSyncTime 
      });

      return { success: true, duration, pushResult, pullResult };

    } catch (error) {
      console.error('[SyncManager] Errore sincronizzazione:', error);
      this._notifyUpdate({ status: 'error', error: error.message });
      return { success: false, error: error.message };

    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * PUSH: Invia modifiche locali al backend
   */
  async pushChanges() {
    const tables = [
      { name: 'animali', endpoint: '/allevamento/animali' },
      { name: 'sedi', endpoint: '/allevamento/sedi' },
      { name: 'stabilimenti', endpoint: '/allevamento/stabilimenti' },
      { name: 'box', endpoint: '/allevamento/box' },
      { name: 'fornitori', endpoint: '/amministrazione/fornitori' },
      { name: 'fatture_amministrazione', endpoint: '/amministrazione/fatture' },
      { name: 'terreni', endpoint: '/terreni' },
      { name: 'attrezzature', endpoint: '/amministrazione/attrezzature' },
      { name: 'farmaci', endpoint: '/sanitario/farmaci' },
      { name: 'somministrazioni', endpoint: '/sanitario/somministrazioni' },
      { name: 'assicurazioni_aziendali', endpoint: '/amministrazione/assicurazioni-aziendali' },
      { name: 'contratti_soccida', endpoint: '/amministrazione/contratti-soccida' },
      { name: 'partite_animali', endpoint: '/amministrazione/partite' },
      { name: 'pn_conti', endpoint: '/amministrazione/prima-nota/conti' },
      { name: 'pn_preferenze', endpoint: '/amministrazione/prima-nota/preferenze' },
      { name: 'pn_categorie', endpoint: '/amministrazione/prima-nota/categorie' },
      { name: 'pn_movimenti', endpoint: '/amministrazione/prima-nota/movimenti' },
      { name: 'piani_alimentazione', endpoint: '/piani-alimentazione' },
      { name: 'composizione_piano', endpoint: '/composizioni-piano' },
      { name: 'registro_alimentazione', endpoint: '/registro-alimentazione' },
      { name: 'ddt', endpoint: '/ddt' },
      { name: 'ddt_righe', endpoint: '/ddt-righe' },
      { name: 'magazzino_movimenti', endpoint: '/magazzino/movimenti' },
      { name: 'movimentazioni', endpoint: '/allevamento/movimentazioni' },
      { name: 'lotti_farmaco', endpoint: '/sanitario/lotti-farmaco' },
      { name: 'lavorazioni_terreno', endpoint: '/terreni/lavorazioni' },
      { name: 'raccolti_terreno', endpoint: '/terreni/raccolti' },
      { name: 'cicli_terreno', endpoint: '/terreni/cicli' },
      { name: 'cicli_terreno_fasi', endpoint: '/terreni/cicli/fasi' },
      { name: 'cicli_terreno_costi', endpoint: '/terreni/cicli/costi' },
      { name: 'scadenze_attrezzature', endpoint: '/amministrazione/scadenze-attrezzature' },
      { name: 'ammortamenti', endpoint: '/amministrazione/ammortamenti' },
    ];

    const results = {
      pushed: 0,
      errors: 0,
      details: [],
    };

    for (const { name, endpoint } of tables) {
      const pending = localDb.getPendingSync(name);
      
      for (const record of pending) {
        // Determina operazione: se il record è soft-deleted localmente, è una DELETE
        const isDeleted = record.deleted_at && record.deleted_at !== null;
        
          // Determina operazione dal sync_log
          const syncLog = localDb.query(
            `SELECT operation FROM _sync_log 
             WHERE table_name = ? AND record_id = ? AND status = 'pending'
             ORDER BY created_at DESC LIMIT 1`,
            [name, record.id]
          )[0];

        // Se il record è soft-deleted, forza operazione DELETE
        const operation = isDeleted ? 'delete' : (syncLog?.operation || 'update');
        
        try {

          // Prepara dati (rimuovi campi locali)
          const data = { ...record };
          delete data.sync_status;
          delete data.synced_at;
          delete data.local_updated_at;
          delete data.deleted_at; // Rimuovi deleted_at dai dati inviati

          // Gestione speciale per cicli_terreno_fasi e cicli_terreno_costi: l'endpoint POST richiede ciclo_id nell'URL
          let actualEndpoint = endpoint;
          if (name === 'cicli_terreno_fasi' && operation === 'insert' && record.ciclo_id) {
            actualEndpoint = `/terreni/cicli/${record.ciclo_id}/fasi`;
            // Rimuovi ciclo_id dai dati (è già nell'URL)
            delete data.ciclo_id;
          } else if (name === 'cicli_terreno_costi' && operation === 'insert' && record.ciclo_id) {
            actualEndpoint = `/terreni/cicli/${record.ciclo_id}/costi`;
            // Rimuovi ciclo_id e azienda_id dai dati (ciclo_id è nell'URL, azienda_id viene preso dal ciclo nel backend)
            delete data.ciclo_id;
            delete data.azienda_id;
          }

          let response;
          
          if (operation === 'insert' && !record.id.toString().startsWith('temp_')) {
            // Record già creato sul server (ha ID numerico), usa update
            response = await this._apiRequest('PUT', `${endpoint}/${record.id}`, data);
          } else if (operation === 'insert') {
            // Nuovo record (ID temporaneo), crea sul server
            response = await this._apiRequest('POST', actualEndpoint, data);
            // Se il server ritorna un nuovo ID, aggiorna localmente
            if (response?.id && response.id !== record.id) {
              localDb.run(
                `UPDATE ${name} SET id = ? WHERE id = ?`,
                [response.id, record.id]
              );
            }
          } else if (operation === 'delete') {
            response = await this._apiRequest('DELETE', `${endpoint}/${record.id}`);
          } else {
            // Update
            response = await this._apiRequest('PUT', `${endpoint}/${record.id}`, data);
          }

          localDb.markSynced(name, record.id);
          results.pushed++;
          results.details.push({ table: name, id: record.id, operation, success: true });

        } catch (error) {
          // Gestione specifica per errori 404
          const is404 = error.message.includes('404') || error.message.includes('non trovato');
          
          if (is404) {
            // Se è un 404 su DELETE, il record è già stato eliminato in Supabase - ok
            if (operation === 'delete' || isDeleted) {
              console.log(`[SyncManager] Record ${name}/${record.id} già eliminato in Supabase, marco come sincronizzato`);
              localDb.markSynced(name, record.id);
              results.pushed++;
              results.details.push({ table: name, id: record.id, operation: 'delete', success: true });
              continue;
            }
            
            // Se è un 404 su UPDATE e il record è soft-deleted localmente, skip
            if (isDeleted) {
              console.log(`[SyncManager] Record ${name}/${record.id} eliminato localmente e non presente in Supabase, marco come sincronizzato`);
              localDb.markSynced(name, record.id);
              results.pushed++;
              results.details.push({ table: name, id: record.id, operation: 'delete', success: true });
              continue;
            }
            
            // Se è un 404 su UPDATE e il record non è eliminato, potrebbe essere un nuovo record
            // Prova a crearlo come nuovo record (POST)
            try {
              const data = { ...record };
              delete data.sync_status;
              delete data.synced_at;
              delete data.local_updated_at;
              delete data.deleted_at;
              
              // Gestione speciale per cicli_terreno_fasi e cicli_terreno_costi: l'endpoint POST richiede ciclo_id nell'URL
              let actualEndpoint = endpoint;
              if (name === 'cicli_terreno_fasi' && record.ciclo_id) {
                actualEndpoint = `/terreni/cicli/${record.ciclo_id}/fasi`;
                delete data.ciclo_id;
              } else if (name === 'cicli_terreno_costi' && record.ciclo_id) {
                actualEndpoint = `/terreni/cicli/${record.ciclo_id}/costi`;
                delete data.ciclo_id;
              }
              
              console.log(`[SyncManager] Record ${name}/${record.id} non trovato in Supabase, provo a crearlo come nuovo record`);
              const response = await this._apiRequest('POST', actualEndpoint, data);
              
              if (response?.id && response.id !== record.id) {
                localDb.run(
                  `UPDATE ${name} SET id = ? WHERE id = ?`,
                  [response.id, record.id]
                );
              }
              
              localDb.markSynced(name, record.id);
              results.pushed++;
              results.details.push({ table: name, id: record.id, operation: 'insert', success: true });
              continue;
            } catch (createError) {
              // Se anche la creazione fallisce, marca come errore
              console.error(`[SyncManager] Errore push ${name}/${record.id}:`, error.message);
              localDb.markSyncError(name, record.id, error.message);
              results.errors++;
              results.details.push({ 
                table: name, 
                id: record.id, 
                success: false, 
                error: error.message 
              });
            }
          } else {
            // Altri errori (non 404)
          console.error(`[SyncManager] Errore push ${name}/${record.id}:`, error.message);
          localDb.markSyncError(name, record.id, error.message);
          results.errors++;
          results.details.push({ 
            table: name, 
            id: record.id, 
            success: false, 
            error: error.message 
          });
          }
        }
      }
    }

    this.pendingPushCount = results.errors;
    console.log(`[SyncManager] Push completato: ${results.pushed} ok, ${results.errors} errori`);
    return results;
  }

  /**
   * PULL: Scarica aggiornamenti dal backend usando endpoint BATCH
   * @param {Object} options - Opzioni
   * @param {number} options.aziendaId - ID azienda per filtrare
   * @param {boolean} options.fullSync - Se true, scarica tutti i dati
   */
  async pullChanges(options = {}) {
    const { aziendaId, fullSync = false } = options;

    const results = {
      pulled: 0,
      tables: {},
    };

    if (!aziendaId) {
      console.warn('[SyncManager] pullChanges chiamato senza aziendaId');
      return results;
    }

    try {
      // Costruisci URL con parametri
      const params = new URLSearchParams();
      params.append('azienda_id', aziendaId);
      
      // Per sync incrementale, usa last_sync
      if (!fullSync) {
        const lastSync = localDb.getSyncMeta('last_sync');
        if (lastSync) {
          params.append('updated_after', lastSync);
        }
      }

      const url = `/sync/pull/stream?${params.toString()}`;
      console.log(`[SyncManager] Pull stream: ${url}`);

      // Una singola chiamata invece di 15+
      const response = await this._apiRequest('POST', url);

      if (!response) {
        console.warn('[SyncManager] Risposta vuota da endpoint batch');
        return results;
      }

      if (response.error) {
        console.error('[SyncManager] Errore nella risposta batch:', response.error);
        return { ...results, error: response.error };
      }

      if (response && response.tables) {
        console.log(`[SyncManager] Ricevute ${Object.keys(response.tables).length} tabelle dal batch`);
        console.log(`[SyncManager] Record count totale dalla risposta: ${response.record_count || 0}`);
        
        // Inserisci i dati nell'ordine corretto (rispetta FK)
        // Nota: componenti_alimentari e mangimi_confezionati non sono supportate dal backend sync
        // Vengono gestite separatamente tramite endpoint alimentazione
        const tableOrder = [
          'aziende', 'sedi', 'stabilimenti', 'box', 'animali', 'decessi',
          'fornitori', 'fatture_amministrazione', 'partite_animali',
          'terreni', 'attrezzature', 'farmaci',
          'assicurazioni_aziendali', 'contratti_soccida',
          'pn_conti', 'pn_preferenze', 'pn_categorie', 'pn_movimenti',  // Prima Nota: conti e preferenze prima di categorie e movimenti
          'cicli_terreno', 'cicli_terreno_fasi', 'cicli_terreno_costi'  // Cicli terreno dopo terreni
        ];

        for (const tableName of tableOrder) {
          const tableData = response.tables[tableName];
          if (tableData === undefined || tableData === null) {
            // Tabella non presente nella risposta - potrebbe essere un errore del backend
            console.warn(`[SyncManager] Tabella ${tableName}: non presente nella risposta`);
            results.tables[tableName] = 0;
          } else if (Array.isArray(tableData)) {
            if (tableData.length > 0) {
              const count = localDb.bulkUpsert(tableName, tableData, true);
              results.pulled += count;
              results.tables[tableName] = count;
              localDb.updateSyncMeta(`last_sync_${tableName}`, new Date().toISOString());
              console.log(`[SyncManager] Tabella ${tableName}: ${count} record inseriti`);
            } else {
              results.tables[tableName] = 0;
            }
          } else {
            console.warn(`[SyncManager] Tabella ${tableName}: dati non validi (tipo: ${typeof tableData})`);
            results.tables[tableName] = 0;
          }
        }

        // Aggiorna timestamp sync globale
        localDb.updateSyncMeta('last_sync', new Date().toISOString());
      } else {
        console.warn('[SyncManager] Risposta batch senza campo "tables" o risposta vuota');
        console.log('[SyncManager] Risposta completa:', JSON.stringify(response, null, 2));
      }

      console.log(`[SyncManager] Pull batch completato: ${results.pulled} record totali`);
      return results;

    } catch (error) {
      console.error('[SyncManager] Errore pull batch:', error.message);
      
      // Fallback a vecchio metodo se endpoint batch non disponibile
      if (error.message.includes('404') || error.message.includes('Not Found')) {
        console.log('[SyncManager] Fallback a sync tradizionale...');
        return this._pullChangesLegacy(options);
      }
      
      return { ...results, error: error.message };
    }
  }

  /**
   * PULL Legacy: Metodo vecchio per compatibilità
   * Usato come fallback se l'endpoint batch non è disponibile
   * @private
   */
  async _pullChangesLegacy(options = {}) {
    const { aziendaId, fullSync = false } = options;

    const results = {
      pulled: 0,
      tables: {},
    };

    // Tabelle da sincronizzare - IMPORTANTE: solo dati dell'azienda corrente
    // Ordine importante: prima tabelle senza FK, poi quelle con FK
    const tables = [
      // Azienda: solo quella corrente (filtro per ID)
      { name: 'aziende', endpoint: `/aziende/${aziendaId}`, filter: null, isSingle: true },
      // Sedi: solo quelle dell'azienda
      { name: 'sedi', endpoint: '/allevamento/sedi', filter: { azienda_id: aziendaId } },
      // Stabilimenti: verranno filtrati dopo aver scaricato le sedi
      { name: 'stabilimenti', endpoint: '/allevamento/stabilimenti', filter: null, dependsOn: 'sedi' },
      // Box: verranno filtrati dopo aver scaricato gli stabilimenti
      { name: 'box', endpoint: '/allevamento/box', filter: null, dependsOn: 'stabilimenti' },
      // Animali: solo quelli dell'azienda
      { name: 'animali', endpoint: '/allevamento/animali', filter: { azienda_id: aziendaId } },
      { name: 'fornitori', endpoint: '/amministrazione/fornitori/', filter: { azienda_id: aziendaId } },
      { name: 'fatture_amministrazione', endpoint: '/amministrazione/fatture', filter: { azienda_id: aziendaId } },
      { name: 'partite_animali', endpoint: '/amministrazione/partite', filter: { azienda_id: aziendaId, limit: 1000 } },
      { name: 'terreni', endpoint: '/terreni', filter: { azienda_id: aziendaId } },
      { name: 'attrezzature', endpoint: '/amministrazione/attrezzature', filter: { azienda_id: aziendaId } },
      { name: 'farmaci', endpoint: '/sanitario/farmaci', filter: { azienda_id: aziendaId } },
      { name: 'somministrazioni', endpoint: '/sanitario/somministrazioni', filter: { azienda_id: aziendaId } },
      { name: 'assicurazioni_aziendali', endpoint: '/amministrazione/assicurazioni-aziendali', filter: { azienda_id: aziendaId } },
      { name: 'contratti_soccida', endpoint: '/amministrazione/contratti-soccida', filter: { azienda_id: aziendaId } },
      { name: 'pn_conti', endpoint: '/amministrazione/prima-nota/conti', filter: { azienda_id: aziendaId } },
      { name: 'pn_preferenze', endpoint: '/amministrazione/prima-nota/setup', filter: { azienda_id: aziendaId }, isSingle: true, extractFromSetup: 'preferenze' },
      { name: 'pn_categorie', endpoint: '/amministrazione/prima-nota/categorie', filter: { azienda_id: aziendaId } },
      { name: 'pn_movimenti', endpoint: '/amministrazione/prima-nota/movimenti', filter: { azienda_id: aziendaId } },
      { name: 'piani_alimentazione', endpoint: '/piani-alimentazione', filter: { azienda_id: aziendaId } },
      { name: 'composizione_piano', endpoint: '/composizioni-piano', filter: null, dependsOn: 'piani_alimentazione' },
      { name: 'registro_alimentazione', endpoint: '/registro-alimentazione', filter: { azienda_id: aziendaId } },
      { name: 'ddt', endpoint: '/ddt', filter: { azienda_id: aziendaId } },
      { name: 'ddt_righe', endpoint: '/ddt-righe', filter: null, dependsOn: 'ddt' },
      { name: 'magazzino_movimenti', endpoint: '/magazzino/movimenti', filter: { azienda_id: aziendaId } },
      { name: 'movimentazioni', endpoint: '/allevamento/movimentazioni', filter: null, dependsOn: 'animali' },
      { name: 'lotti_farmaco', endpoint: '/sanitario/lotti-farmaco', filter: { azienda_id: aziendaId } },
      { name: 'lavorazioni_terreno', endpoint: '/terreni/lavorazioni', filter: { azienda_id: aziendaId } },
      { name: 'raccolti_terreno', endpoint: '/terreni/raccolti', filter: { azienda_id: aziendaId } },
      { name: 'cicli_terreno', endpoint: '/terreni/cicli', filter: { azienda_id: aziendaId } },
      { name: 'cicli_terreno_fasi', endpoint: '/terreni/cicli/fasi', filter: null, dependsOn: 'cicli_terreno' },
      { name: 'cicli_terreno_costi', endpoint: '/terreni/cicli/costi', filter: null, dependsOn: 'cicli_terreno' },
      { name: 'scadenze_attrezzature', endpoint: '/amministrazione/scadenze-attrezzature', filter: null, dependsOn: 'attrezzature' },
      { name: 'ammortamenti', endpoint: '/amministrazione/ammortamenti', filter: { azienda_id: aziendaId } },
    ];

    for (const tableConfig of tables) {
      const { name, endpoint, filter, isSingle, dependsOn, extractFromSetup } = tableConfig;
      
      try {
        let data;
        
        // Gestione speciale per pn_preferenze (viene da setup)
        if (extractFromSetup) {
          const setupData = await this._apiRequest('GET', `${endpoint}?azienda_id=${aziendaId}`);
          if (setupData && setupData[extractFromSetup]) {
            // Estrai le preferenze dall'oggetto setup e aggiungi azienda_id
            const preferenze = { ...setupData[extractFromSetup], azienda_id: aziendaId };
            data = [preferenze];
          } else {
            data = [];
          }
        }
        // Gestione speciale per record singolo (azienda)
        else if (isSingle) {
          data = await this._apiRequest('GET', endpoint);
          // Converti in array per bulkUpsert
          data = data ? [data] : [];
        }
        // Gestione per tabelle dipendenti (stabilimenti, box)
        else if (dependsOn) {
          // Per stabilimenti: scarica solo quelli delle sedi dell'azienda
          if (name === 'stabilimenti') {
            const sedi = localDb.getSedi({ azienda_id: aziendaId });
            const sedeIds = sedi.map(s => s.id);
            if (sedeIds.length === 0) {
              data = [];
            } else {
              // Scarica stabilimenti per ogni sede
              const allStabilimenti = [];
              for (const sedeId of sedeIds) {
                const stabilimenti = await this._apiRequest('GET', `${endpoint}?sede_id=${sedeId}`);
                if (Array.isArray(stabilimenti)) {
                  allStabilimenti.push(...stabilimenti);
                }
              }
              data = allStabilimenti;
            }
          }
          // Per box: scarica solo quelli degli stabilimenti dell'azienda
          else if (name === 'box') {
            const sedi = localDb.getSedi({ azienda_id: aziendaId });
            const sedeIds = sedi.map(s => s.id);
            const stabilimenti = localDb.getStabilimenti({});
            // Filtra stabilimenti delle sedi dell'azienda
            const stabilimentiAzienda = stabilimenti.filter(s => sedeIds.includes(s.sede_id));
            const stabilimentoIds = stabilimentiAzienda.map(s => s.id);
            
            if (stabilimentoIds.length === 0) {
              data = [];
            } else {
              // Scarica box per ogni stabilimento
              const allBox = [];
              for (const stabilimentoId of stabilimentoIds) {
                const box = await this._apiRequest('GET', `${endpoint}?stabilimento_id=${stabilimentoId}`);
                if (Array.isArray(box)) {
                  allBox.push(...box);
                }
              }
              data = allBox;
            }
          } else {
            data = [];
          }
        }
        // Gestione normale con filtri
        else {
          // Costruisci query params
          const params = new URLSearchParams();
          if (filter) {
            for (const [key, value] of Object.entries(filter)) {
              if (value !== undefined && value !== null) {
                params.append(key, value);
              }
            }
          }

          // Per sync incrementale, usa last_sync se non è fullSync
          if (!fullSync) {
            const lastSync = localDb.getSyncMeta(`last_sync_${name}`);
            if (lastSync) {
              params.append('updated_after', lastSync);
            }
          }

          const queryString = params.toString();
          const url = queryString ? `${endpoint}?${queryString}` : endpoint;

          data = await this._apiRequest('GET', url);
          
          // Assicura che sia un array
          if (!Array.isArray(data)) {
            data = data ? [data] : [];
          }
        }

        if (Array.isArray(data) && data.length > 0) {
          const count = localDb.bulkUpsert(name, data, true);
          results.pulled += count;
          results.tables[name] = count;
          
          // Aggiorna timestamp sync per questa tabella
          localDb.updateSyncMeta(`last_sync_${name}`, new Date().toISOString());
        } else {
          results.tables[name] = 0;
        }

      } catch (error) {
        console.error(`[SyncManager] Errore pull ${name}:`, error.message);
        results.tables[name] = { error: error.message };
      }
    }

    console.log(`[SyncManager] Pull legacy completato: ${results.pulled} record totali`);
    return results;
  }

  /**
   * Sincronizzazione iniziale completa
   * Scarica tutti i dati dal server per popolare il database locale
   */
  async initialSync(aziendaId) {
    console.log('[SyncManager] Avvio sincronizzazione iniziale per azienda:', aziendaId);
    
    this._notifyUpdate({ status: 'initial_sync', phase: 'start' });

    try {
      // Pull completo di tutti i dati
      const result = await this.pullChanges({ aziendaId, fullSync: true });
      
      localDb.updateSyncMeta('initial_sync_completed', 'true');
      localDb.updateSyncMeta('initial_sync_azienda', aziendaId.toString());
      localDb.updateSyncMeta('initial_sync_time', new Date().toISOString());

      this._notifyUpdate({ status: 'initial_sync', phase: 'completed', result });
      
      console.log('[SyncManager] Sincronizzazione iniziale completata');
      return { success: true, ...result };

    } catch (error) {
      console.error('[SyncManager] Errore sync iniziale:', error);
      this._notifyUpdate({ status: 'initial_sync', phase: 'error', error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Verifica se è necessaria la sync iniziale
   */
  needsInitialSync(aziendaId) {
    const completed = localDb.getSyncMeta('initial_sync_completed');
    const syncedAzienda = localDb.getSyncMeta('initial_sync_azienda');
    
    // Se non è mai stata fatta o è per un'azienda diversa
    return completed !== 'true' || syncedAzienda !== aziendaId?.toString();
  }

  /**
   * Resetta la sincronizzazione e forza una full sync
   * Utile dopo operazioni di pulizia database
   */
  async resetSync(aziendaId) {
    console.log('[SyncManager] Reset sincronizzazione per azienda:', aziendaId);
    
    // Rimuovi tutti i metadati di sync
    localDb.updateSyncMeta('initial_sync_completed', null);
    localDb.updateSyncMeta('initial_sync_azienda', null);
    localDb.updateSyncMeta('last_sync', null);
    
    // Pulisci i log di sync
    localDb.cleanOldSyncLogs();
    
    // Forza una sync iniziale completa
    return await this.initialSync(aziendaId);
  }

  /**
   * Trigger sync immediata (per chiamate dal renderer)
   */
  async triggerSync() {
    return this.syncAll();
  }

  /**
   * Avvia sync in background (per chiusura app)
   * Mantiene il processo attivo fino al completamento
   */
  async startBackgroundSync() {
    if (this.isBackgroundSyncing) {
      console.log('[SyncManager] Background sync già in corso');
      return { success: false, reason: 'already_syncing' };
    }

    this.isBackgroundSyncing = true;
    console.log('[SyncManager] Avvio sync in background...');

    try {
      const result = await this.syncAll();
      
      // Notifica completamento
      if (this.onBackgroundSyncComplete) {
        this.onBackgroundSyncComplete(result);
      }

      return result;
    } finally {
      this.isBackgroundSyncing = false;
    }
  }

  /**
   * Verifica se ci sono modifiche pendenti
   */
  hasPendingChanges() {
    if (!localDb.isAvailable()) return false;
    
    try {
      const pendingLogs = localDb.getPendingSync();
      return pendingLogs && pendingLogs.length > 0;
    } catch (err) {
      console.error('[SyncManager] Errore verifica modifiche pendenti:', err);
      return false;
    }
  }

  /**
   * Ottieni numero modifiche pendenti
   */
  getPendingChangesCount() {
    if (!localDb.isAvailable()) return 0;
    
    try {
      const pendingLogs = localDb.getPendingSync();
      return pendingLogs ? pendingLogs.length : 0;
    } catch (err) {
      console.error('[SyncManager] Errore conteggio modifiche pendenti:', err);
      return 0;
    }
  }

  /**
   * Ottieni stato sync
   */
  getStatus() {
    // Conta tutte le modifiche pendenti dal database locale
    let totalPendingCount = 0;
    try {
      const pendingLogs = localDb.getPendingSync();
      totalPendingCount = pendingLogs ? pendingLogs.length : 0;
    } catch (err) {
      console.error('[SyncManager] Errore nel conteggio modifiche pendenti:', err);
    }
    
    return {
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      pendingPushCount: this.pendingPushCount,
      pendingCount: totalPendingCount, // Numero totale di modifiche pendenti
      isRunning: this.syncInterval !== null,
    };
  }

  /**
   * Verifica consistenza dei dati locali
   * Rileva se ci sono inconsistenze che richiedono una full sync
   * @private
   */
  _checkDataConsistency(aziendaId) {
    if (!localDb.isAvailable()) return false;
    
    try {
      // Verifica: se ci sono molti movimenti Prima Nota senza contropartita,
      // probabilmente i dati sono vecchi e servono una full sync
      // Usa query SQL diretta per verificare (SQLite non supporta FILTER, usa SUM con CASE)
      const query = `
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN (contropartita_nome IS NULL OR contropartita_nome = '') THEN 1 ELSE 0 END) as senza_contropartita,
          SUM(CASE WHEN fattura_amministrazione_id IS NOT NULL THEN 1 ELSE 0 END) as con_fattura,
          SUM(CASE WHEN fattura_amministrazione_id IS NOT NULL 
                   AND (contropartita_nome IS NULL OR contropartita_nome = '') THEN 1 ELSE 0 END) as con_fattura_senza_contropartita
        FROM pn_movimenti
        WHERE azienda_id = ? AND deleted_at IS NULL
      `;
      
      const result = localDb.db.prepare(query).get(aziendaId);
      
      if (result && result.total > 0) {
        const percentualeSenza = (result.senza_contropartita / result.total) * 100;
        
        // Se il 50% o più dei movimenti non ha contropartita, probabilmente i dati sono vecchi
        // (in Supabase tutti i movimenti dovrebbero avere contropartita)
        if (percentualeSenza >= 50) {
          console.log(`[SyncManager] Rilevata inconsistenza: ${result.senza_contropartita}/${result.total} movimenti senza contropartita (${percentualeSenza.toFixed(1)}%)`);
          return true;
        }
        
        // Se ci sono movimenti con fattura ma senza contropartita, è un problema
        // (i movimenti con fattura dovrebbero sempre avere contropartita)
        if (result.con_fattura > 0 && result.con_fattura_senza_contropartita > 0) {
          const percentualeFatturaSenza = (result.con_fattura_senza_contropartita / result.con_fattura) * 100;
          // Anche un solo movimento con fattura senza contropartita è un problema
          if (percentualeFatturaSenza > 0) {
            console.log(`[SyncManager] Rilevata inconsistenza: ${result.con_fattura_senza_contropartita}/${result.con_fattura} movimenti con fattura senza contropartita (${percentualeFatturaSenza.toFixed(1)}%)`);
            return true;
          }
        }
      }
      
      return false;
    } catch (err) {
      console.error('[SyncManager] Errore verifica consistenza dati:', err);
      return false;
    }
  }

  /**
   * Notifica aggiornamento al renderer
   * @private
   */
  _notifyUpdate(data) {
    if (this.onSyncUpdate) {
      this.onSyncUpdate(data);
    }
  }

  /**
   * Esegue richiesta API al backend
   * Usa https/http nativo di Node.js (disponibile in Electron main process)
   * @private
   */
  async _apiRequest(method, endpoint, data = null) {
    const url = `${API_BASE_URL}${endpoint}`;
    const urlObj = new URL(url);
    const https = require('https');
    const http = require('http');
    const client = urlObj.protocol === 'https:' ? https : http;

    const headers = {
      'Content-Type': 'application/json',
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    return new Promise((resolve, reject) => {
      const body = data && (method === 'POST' || method === 'PUT') 
        ? JSON.stringify(data) 
        : null;

      if (body) {
        headers['Content-Length'] = Buffer.byteLength(body);
      }

      const req = client.request(url, {
        method,
        headers,
      }, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk.toString();
        });
        
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = responseData ? JSON.parse(responseData) : null;
              resolve(parsed);
            } catch (e) {
              // Se non è JSON, ritorna il testo
              resolve(responseData || null);
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${responseData || res.statusMessage}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Network error: ${error.message}`));
      });

      if (body) {
        req.write(body);
      }
      
      req.end();
    });
  }
}

// Singleton
const syncManager = new SyncManager();

module.exports = syncManager;

