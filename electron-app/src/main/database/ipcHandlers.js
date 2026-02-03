/**
 * IPC Handlers per Database Locale e Sync
 * 
 * Gestisce la comunicazione tra il processo renderer (React) e
 * il processo main (database SQLite + sync).
 * 
 * Channels:
 * - db:* → Operazioni database locale (CRUD)
 * - sync:* → Operazioni sincronizzazione
 */

const { ipcMain, BrowserWindow } = require('electron');
const localDb = require('./localDb');
const syncManager = require('./syncManager');

/**
 * Registra tutti gli IPC handlers per database e sync
 */
function registerDatabaseHandlers() {
  console.log('[IPC] Registrazione handlers database...');

  // ============================================
  // DATABASE - INIZIALIZZAZIONE
  // ============================================

  /**
   * Inizializza database locale
   */
  ipcMain.handle('db:init', async () => {
    try {
      const success = localDb.init();
      return { success, path: localDb.dbPath };
    } catch (error) {
      console.error('[IPC] Errore db:init:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Verifica disponibilità database
   */
  ipcMain.handle('db:isAvailable', () => {
    return localDb.isAvailable();
  });

  // ============================================
  // DATABASE - OPERAZIONI GENERICHE
  // ============================================

  /**
   * Select generico
   */
  ipcMain.handle('db:select', async (event, { table, filters, options }) => {
    try {
      return localDb.select(table, filters || {}, options || {});
    } catch (error) {
      console.error(`[IPC] Errore db:select ${table}:`, error);
      return [];
    }
  });

  /**
   * Get by ID
   */
  ipcMain.handle('db:getById', async (event, { table, id }) => {
    try {
      return localDb.getById(table, id);
    } catch (error) {
      console.error(`[IPC] Errore db:getById ${table}:`, error);
      return null;
    }
  });

  /**
   * Insert
   */
  ipcMain.handle('db:insert', async (event, { table, data }) => {
    try {
      return localDb.insert(table, data);
    } catch (error) {
      console.error(`[IPC] Errore db:insert ${table}:`, error);
      return null;
    }
  });

  /**
   * Update
   */
  ipcMain.handle('db:update', async (event, { table, id, updates }) => {
    try {
      return localDb.update(table, id, updates);
    } catch (error) {
      console.error(`[IPC] Errore db:update ${table}:`, error);
      return false;
    }
  });

  /**
   * Soft Delete
   */
  ipcMain.handle('db:delete', async (event, { table, id }) => {
    try {
      return localDb.softDelete(table, id);
    } catch (error) {
      console.error(`[IPC] Errore db:delete ${table}:`, error);
      return false;
    }
  });

  /**
   * Count
   */
  ipcMain.handle('db:count', async (event, { table, filters }) => {
    try {
      return localDb.count(table, filters || {});
    } catch (error) {
      console.error(`[IPC] Errore db:count ${table}:`, error);
      return 0;
    }
  });

  // ============================================
  // DATABASE - OPERAZIONI SPECIFICHE
  // ============================================

  // --- ANIMALI ---
  ipcMain.handle('db:getAnimali', async (event, filters) => {
    return localDb.getAnimali(filters || {});
  });

  ipcMain.handle('db:getAnimale', async (event, id) => {
    return localDb.getAnimale(id);
  });

  ipcMain.handle('db:insertAnimale', async (event, data) => {
    return localDb.insertAnimale(data);
  });

  ipcMain.handle('db:updateAnimale', async (event, { id, updates }) => {
    return localDb.updateAnimale(id, updates);
  });

  // --- SEDI ---
  ipcMain.handle('db:getSedi', async (event, filters) => {
    return localDb.getSedi(filters || {});
  });

  ipcMain.handle('db:getSede', async (event, id) => {
    return localDb.getSede(id);
  });

  // --- STABILIMENTI ---
  ipcMain.handle('db:getStabilimenti', async (event, filters) => {
    return localDb.getStabilimenti(filters || {});
  });

  // --- BOX ---
  ipcMain.handle('db:getBox', async (event, filters) => {
    return localDb.getBox(filters || {});
  });

  // --- FORNITORI ---
  ipcMain.handle('db:getFornitori', async (event, filters) => {
    return localDb.getFornitori(filters || {});
  });

  ipcMain.handle('db:insertFornitore', async (event, data) => {
    return localDb.insertFornitore(data);
  });

  ipcMain.handle('db:updateFornitore', async (event, { id, updates }) => {
    return localDb.updateFornitore(id, updates);
  });

  // --- FATTURE ---
  ipcMain.handle('db:getFatture', async (event, filters) => {
    return localDb.getFatture(filters || {});
  });

  ipcMain.handle('db:insertFattura', async (event, data) => {
    return localDb.insertFattura(data);
  });

  ipcMain.handle('db:updateFattura', async (event, { id, updates }) => {
    return localDb.updateFattura(id, updates);
  });

  // --- TERRENI ---
  ipcMain.handle('db:getTerreni', async (event, filters) => {
    return localDb.getTerreni(filters || {});
  });

  // --- ATTREZZATURE ---
  ipcMain.handle('db:getAttrezzature', async (event, filters) => {
    return localDb.getAttrezzature(filters || {});
  });

  // --- FARMACI ---
  ipcMain.handle('db:getFarmaci', async (event, filters) => {
    return localDb.getFarmaci(filters || {});
  });

  // --- ASSICURAZIONI ---
  ipcMain.handle('db:getAssicurazioni', async (event, filters) => {
    return localDb.getAssicurazioni(filters || {});
  });

  // --- COMPONENTI ALIMENTARI ---
  ipcMain.handle('db:getComponentiAlimentari', async (event, filters) => {
    return localDb.getComponentiAlimentari(filters || {});
  });

  // --- MANGIMI ---
  ipcMain.handle('db:getMangimi', async (event, filters) => {
    return localDb.getMangimi(filters || {});
  });

  // --- CONTRATTI SOCCIDA ---
  ipcMain.handle('db:getContrattiSoccida', async (event, filters) => {
    return localDb.getContrattiSoccida(filters || {});
  });

  ipcMain.handle('db:getContrattoSoccida', async (event, id) => {
    return localDb.getContrattoSoccida(id);
  });

  // --- PARTITE ANIMALI ---
  ipcMain.handle('db:getPartite', async (event, filters) => {
    return localDb.getPartite(filters || {});
  });

  ipcMain.handle('db:getPartita', async (event, id) => {
    return localDb.getPartita(id);
  });

  // --- PRIMA NOTA ---
  ipcMain.handle('db:getPNConti', async (event, filters) => {
    return localDb.getPNConti(filters || {});
  });

  ipcMain.handle('db:getPNMovimenti', async (event, filters) => {
    return localDb.getPNMovimenti(filters || {});
  });

  // --- PIANI ALIMENTAZIONE ---
  ipcMain.handle('db:getPianiAlimentazione', async (event, filters) => {
    return localDb.getPianiAlimentazione(filters || {});
  });

  ipcMain.handle('db:getPianoAlimentazione', async (event, id) => {
    return localDb.getPianoAlimentazione(id);
  });

  // --- REGISTRO ALIMENTAZIONE ---
  ipcMain.handle('db:getRegistroAlimentazione', async (event, filters) => {
    return localDb.getRegistroAlimentazione(filters || {});
  });

  // --- DDT ---
  ipcMain.handle('db:getDdt', async (event, filters) => {
    return localDb.getDdt(filters || {});
  });

  ipcMain.handle('db:getDdtById', async (event, id) => {
    return localDb.getDdtById(id);
  });

  // --- MAGAZZINO MOVIMENTI ---
  ipcMain.handle('db:getMagazzinoMovimenti', async (event, filters) => {
    return localDb.getMagazzinoMovimenti(filters || {});
  });

  // --- MOVIMENTAZIONI ANIMALI ---
  ipcMain.handle('db:getMovimentazioni', async (event, filters) => {
    return localDb.getMovimentazioni(filters || {});
  });

  // --- LOTTI FARMACO ---
  ipcMain.handle('db:getLottiFarmaco', async (event, filters) => {
    return localDb.getLottiFarmaco(filters || {});
  });

  ipcMain.handle('db:getLottoFarmaco', async (event, id) => {
    return localDb.getLottoFarmaco(id);
  });

  // --- LAVORAZIONI TERRENO ---
  ipcMain.handle('db:getLavorazioni', async (event, filters) => {
    return localDb.getLavorazioni(filters || {});
  });

  // --- RACCOLTI TERRENO ---
  ipcMain.handle('db:getRaccolti', async (event, filters) => {
    return localDb.getRaccolti(filters || {});
  });

  // --- RIEPILOGO TERRENO ---
  ipcMain.handle('db:getTerrenoRiepilogo', async (event, terrenoId) => {
    return localDb.getTerrenoRiepilogo(terrenoId);
  });

  // --- CICLI TERRENO ---
  ipcMain.handle('db:getCicli', async (event, filters) => {
    return localDb.getCicli(filters || {});
  });

  ipcMain.handle('db:getCiclo', async (event, id) => {
    return localDb.getCiclo(id);
  });

  ipcMain.handle('db:insertCiclo', async (event, data) => {
    return localDb.insertCiclo(data);
  });

  ipcMain.handle('db:updateCiclo', async (event, { id, updates }) => {
    return localDb.updateCiclo(id, updates);
  });

  ipcMain.handle('db:deleteCiclo', async (event, id) => {
    return localDb.deleteCiclo(id);
  });

  // --- FASI CICLO TERRENO ---
  ipcMain.handle('db:getCicloFasi', async (event, cicloId) => {
    return localDb.getCicloFasi(cicloId);
  });

  ipcMain.handle('db:getCicloFase', async (event, id) => {
    return localDb.getCicloFase(id);
  });

  ipcMain.handle('db:insertCicloFase', async (event, data) => {
    return localDb.insertCicloFase(data);
  });

  ipcMain.handle('db:updateCicloFase', async (event, { id, updates }) => {
    return localDb.updateCicloFase(id, updates);
  });

  ipcMain.handle('db:deleteCicloFase', async (event, id) => {
    return localDb.deleteCicloFase(id);
  });

  // --- COSTI CICLO TERRENO ---
  ipcMain.handle('db:getCicloCosti', async (event, filters) => {
    return localDb.getCicloCosti(filters || {});
  });

  ipcMain.handle('db:getCicloCosto', async (event, id) => {
    return localDb.getCicloCosto(id);
  });

  ipcMain.handle('db:insertCicloCosto', async (event, data) => {
    return localDb.insertCicloCosto(data);
  });

  ipcMain.handle('db:updateCicloCosto', async (event, { id, updates }) => {
    return localDb.updateCicloCosto(id, updates);
  });

  ipcMain.handle('db:deleteCicloCosto', async (event, id) => {
    return localDb.deleteCicloCosto(id);
  });

  // --- SCADENZE ATTREZZATURE ---
  ipcMain.handle('db:getScadenzeAttrezzatura', async (event, attrezzaturaId) => {
    return localDb.getScadenzeAttrezzatura(attrezzaturaId);
  });

  // --- AMMORTAMENTI ---
  ipcMain.handle('db:getAmmortamenti', async (event, filters) => {
    return localDb.getAmmortamenti(filters || {});
  });

  // --- QUERY RAW ---
  ipcMain.handle('db:query', async (event, { sql, params }) => {
    return localDb.query(sql, params || []);
  });

  // ============================================
  // SYNC - OPERAZIONI
  // ============================================

  /**
   * Avvia sync manager
   */
  ipcMain.handle('sync:start', async () => {
    try {
      syncManager.start();
      return { success: true };
    } catch (error) {
      console.error('[IPC] Errore sync:start:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Ferma sync manager
   */
  ipcMain.handle('sync:stop', async () => {
    try {
      syncManager.stop();
      return { success: true };
    } catch (error) {
      console.error('[IPC] Errore sync:stop:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Trigger sync immediata
   */
  ipcMain.handle('sync:trigger', async () => {
    try {
      const result = await syncManager.triggerSync();
      return result;
    } catch (error) {
      console.error('[IPC] Errore sync:trigger:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Anche come evento (non bloccante)
   */
  ipcMain.on('sync:trigger', () => {
    syncManager.triggerSync().catch(err => {
      console.error('[IPC] Errore sync:trigger (event):', err);
    });
  });

  /**
   * Sync iniziale completa
   */
  ipcMain.handle('sync:initial', async (event, aziendaId) => {
    try {
      const result = await syncManager.initialSync(aziendaId);
      return result;
    } catch (error) {
      console.error('[IPC] Errore sync:initial:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Reset sync e forza full sync
   */
  ipcMain.handle('sync:reset', async (event, aziendaId) => {
    try {
      const result = await syncManager.resetSync(aziendaId);
      return result;
    } catch (error) {
      console.error('[IPC] Errore sync:reset:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Verifica se serve sync iniziale
   */
  ipcMain.handle('sync:needsInitial', async (event, aziendaId) => {
    return syncManager.needsInitialSync(aziendaId);
  });

  /**
   * Pulisce dati di un'azienda (per cambio azienda)
   */
  ipcMain.handle('db:clearAzienda', async (event, aziendaId) => {
    try {
      return { success: localDb.clearAziendaData(aziendaId) };
    } catch (error) {
      console.error('[IPC] Errore db:clearAzienda:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Imposta token autenticazione per sync
   */
  ipcMain.handle('sync:setAuthToken', async (event, token) => {
    syncManager.setAuthToken(token);
    return { success: true };
  });

  /**
   * Imposta azienda corrente per sync
   */
  ipcMain.handle('sync:setAziendaId', async (event, aziendaId) => {
    syncManager.setAziendaId(aziendaId);
    return { success: true };
  });

  /**
   * Ottieni stato sync
   */
  ipcMain.handle('sync:getStatus', async () => {
    return syncManager.getStatus();
  });

  /**
   * Ottieni record pending sync
   */
  ipcMain.handle('sync:getPending', async (event, table) => {
    return localDb.getPendingSync(table);
  });

  // ============================================
  // SYNC - NOTIFICHE AL RENDERER
  // ============================================

  // Configura callback per notificare il renderer degli aggiornamenti sync
  syncManager.setOnSyncUpdate((data) => {
    // Invia a tutte le finestre
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send('sync:update', data);
      }
    });
  });

  console.log('[IPC] Handlers database registrati con successo');
}

/**
 * Inizializza database e sync all'avvio
 */
function initializeDatabase() {
  console.log('[IPC] Inizializzazione database locale...');
  
  const success = localDb.init();
  
  if (success) {
    console.log('[IPC] Database locale pronto');
    // Non avviamo automaticamente il sync, lo farà il renderer dopo il login
  } else {
    console.warn('[IPC] Database locale non disponibile - funzionalità offline disabilitata');
  }

  return success;
}

/**
 * Cleanup alla chiusura
 */
function cleanup() {
  console.log('[IPC] Cleanup database e sync...');
  syncManager.stop();
  localDb.close();
}

module.exports = {
  registerDatabaseHandlers,
  initializeDatabase,
  cleanup,
  getSyncManager: () => syncManager, // Export funzione per ottenere syncManager
};

