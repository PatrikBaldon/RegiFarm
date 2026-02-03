/**
 * Local Data Service
 * 
 * Servizio per accedere al database locale SQLite tramite IPC.
 * Tutte le letture sono ISTANTANEE (< 5ms).
 * Le scritture vengono salvate localmente e sincronizzate in background.
 * 
 * Uso:
 *   import localData from './services/localDataService';
 *   
 *   // Lettura istantanea
 *   const animali = await localData.getAnimali({ azienda_id: 1 });
 *   
 *   // Scrittura locale + sync background
 *   await localData.updateAnimale(id, { peso_attuale: 450 });
 */

// Verifica se siamo in ambiente Electron
const isElectron = typeof window !== 'undefined' && 
                   window.process && 
                   window.process.type === 'renderer';

// ipcRenderer per comunicazione con main process
let ipcRenderer = null;
if (isElectron) {
  try {
    // Prova require globale (nodeIntegration: true)
    if (typeof require !== 'undefined') {
      ipcRenderer = require('electron').ipcRenderer;
    } else if (window.require) {
      ipcRenderer = window.require('electron').ipcRenderer;
    } else {
    }
  } catch (e) {
  }
} else {
}

class LocalDataService {
  constructor() {
    this.isAvailable = false;
    this.isInitialized = false;
    this.onSyncUpdate = null;
    this._setupSyncListener();
  }

  /**
   * Inizializza il servizio e il database locale
   */
  async init() {
    if (!ipcRenderer) {
      return false;
    }

    try {
      const result = await ipcRenderer.invoke('db:init');
      this.isAvailable = result.success;
      this.isInitialized = true;
      
      if (result.success) {
      } else {
      }
      
      return result.success;
    } catch (error) {
      this.isAvailable = false;
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Verifica disponibilità database locale
   */
  async checkAvailable() {
    if (!ipcRenderer) return false;
    try {
      this.isAvailable = await ipcRenderer.invoke('db:isAvailable');
      return this.isAvailable;
    } catch {
      return false;
    }
  }

  /**
   * Setup listener per aggiornamenti sync
   * @private
   */
  _setupSyncListener() {
    if (!ipcRenderer) return;

    ipcRenderer.on('sync:update', (event, data) => {
      if (this.onSyncUpdate) {
        this.onSyncUpdate(data);
      }
    });
  }

  /**
   * Registra callback per aggiornamenti sync
   */
  setOnSyncUpdate(callback) {
    this.onSyncUpdate = callback;
  }

  // ============================================
  // SYNC OPERATIONS
  // ============================================

  /**
   * Avvia sincronizzazione periodica
   */
  async startSync() {
    if (!ipcRenderer) return { success: false };
    return ipcRenderer.invoke('sync:start');
  }

  /**
   * Ferma sincronizzazione
   */
  async stopSync() {
    if (!ipcRenderer) return { success: false };
    return ipcRenderer.invoke('sync:stop');
  }

  /**
   * Trigger sync immediata
   */
  async triggerSync() {
    if (!ipcRenderer) return { success: false };
    return ipcRenderer.invoke('sync:trigger');
  }

  /**
   * Sync iniziale completa per un'azienda
   */
  async initialSync(aziendaId) {
    if (!ipcRenderer) return { success: false };
    return ipcRenderer.invoke('sync:initial', aziendaId);
  }

  /**
   * Verifica se serve sync iniziale
   */
  async needsInitialSync(aziendaId) {
    if (!ipcRenderer) return true;
    return ipcRenderer.invoke('sync:needsInitial', aziendaId);
  }

  /**
   * Imposta token autenticazione per sync
   */
  async setAuthToken(token) {
    if (!ipcRenderer) return;
    return ipcRenderer.invoke('sync:setAuthToken', token);
  }

  /**
   * Imposta azienda corrente per sync
   */
  async setAziendaId(aziendaId) {
    if (!ipcRenderer) return;
    return ipcRenderer.invoke('sync:setAziendaId', aziendaId);
  }

  /**
   * Ottieni stato sync
   */
  async getSyncStatus() {
    if (!ipcRenderer) return null;
    return ipcRenderer.invoke('sync:getStatus');
  }

  /**
   * Reset sync e forza full sync completa
   * Utile dopo operazioni di pulizia database
   */
  async resetSync(aziendaId) {
    if (!ipcRenderer) return { success: false };
    return ipcRenderer.invoke('sync:reset', aziendaId);
  }

  /**
   * Pulisce dati di un'azienda (per cambio azienda)
   */
  async clearAziendaData(aziendaId) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:clearAzienda', aziendaId);
    return result.success;
  }

  // ============================================
  // DATABASE OPERATIONS - LETTURE (ISTANTANEE)
  // ============================================

  /**
   * Select generico da una tabella
   */
  async select(table, filters = {}, options = {}) {
    if (!ipcRenderer) return [];
    return ipcRenderer.invoke('db:select', { table, filters, options });
  }

  /**
   * Get record by ID
   */
  async getById(table, id) {
    if (!ipcRenderer) return null;
    return ipcRenderer.invoke('db:getById', { table, id });
  }

  /**
   * Count records
   */
  async count(table, filters = {}) {
    if (!ipcRenderer) return 0;
    return ipcRenderer.invoke('db:count', { table, filters });
  }

  // ============================================
  // ANIMALI
  // ============================================

  async getAnimali(filters = {}) {
    if (!ipcRenderer) return [];
    return ipcRenderer.invoke('db:getAnimali', filters);
  }

  async getAnimale(id) {
    if (!ipcRenderer) return null;
    return ipcRenderer.invoke('db:getAnimale', id);
  }

  async insertAnimale(data) {
    if (!ipcRenderer) return null;
    const result = await ipcRenderer.invoke('db:insertAnimale', data);
    // Trigger sync in background
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async updateAnimale(id, updates) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:updateAnimale', { id, updates });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async deleteAnimale(id) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:delete', { table: 'animali', id });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  // ============================================
  // SEDI
  // ============================================

  async getSedi(filters = {}) {
    if (!ipcRenderer) return [];
    return ipcRenderer.invoke('db:getSedi', filters);
  }

  async getSede(id) {
    if (!ipcRenderer) return null;
    return ipcRenderer.invoke('db:getSede', id);
  }

  async insertSede(data) {
    if (!ipcRenderer) return null;
    const result = await ipcRenderer.invoke('db:insert', { table: 'sedi', data });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async updateSede(id, updates) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:update', { table: 'sedi', id, updates });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async deleteSede(id) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:delete', { table: 'sedi', id });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  // ============================================
  // STABILIMENTI
  // ============================================

  async getStabilimenti(filters = {}) {
    if (!ipcRenderer) return [];
    return ipcRenderer.invoke('db:getStabilimenti', filters);
  }

  async insertStabilimento(data) {
    if (!ipcRenderer) return null;
    const result = await ipcRenderer.invoke('db:insert', { table: 'stabilimenti', data });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async updateStabilimento(id, updates) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:update', { table: 'stabilimenti', id, updates });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async deleteStabilimento(id) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:delete', { table: 'stabilimenti', id });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  // ============================================
  // BOX
  // ============================================

  async getBox(filters = {}) {
    if (!ipcRenderer) return [];
    return ipcRenderer.invoke('db:getBox', filters);
  }

  async insertBox(data) {
    if (!ipcRenderer) return null;
    const result = await ipcRenderer.invoke('db:insert', { table: 'box', data });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async updateBox(id, updates) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:update', { table: 'box', id, updates });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async deleteBox(id) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:delete', { table: 'box', id });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  // ============================================
  // FORNITORI
  // ============================================

  async getFornitori(filters = {}) {
    if (!ipcRenderer) return [];
    return ipcRenderer.invoke('db:getFornitori', filters);
  }

  async insertFornitore(data) {
    if (!ipcRenderer) return null;
    const result = await ipcRenderer.invoke('db:insertFornitore', data);
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async updateFornitore(id, updates) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:updateFornitore', { id, updates });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async deleteFornitore(id) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:delete', { table: 'fornitori', id });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  // ============================================
  // FATTURE
  // ============================================

  async getFatture(filters = {}) {
    if (!ipcRenderer) return [];
    return ipcRenderer.invoke('db:getFatture', filters);
  }

  async insertFattura(data) {
    if (!ipcRenderer) return null;
    const result = await ipcRenderer.invoke('db:insertFattura', data);
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async updateFattura(id, updates) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:updateFattura', { id, updates });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async deleteFattura(id) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:delete', { table: 'fatture_amministrazione', id });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  // ============================================
  // TERRENI
  // ============================================

  async getTerreni(filters = {}) {
    if (!ipcRenderer) return [];
    return ipcRenderer.invoke('db:getTerreni', filters);
  }

  async insertTerreno(data) {
    if (!ipcRenderer) return null;
    const result = await ipcRenderer.invoke('db:insert', { table: 'terreni', data });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async updateTerreno(id, updates) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:update', { table: 'terreni', id, updates });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async deleteTerreno(id) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:delete', { table: 'terreni', id });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  // ============================================
  // ATTREZZATURE
  // ============================================

  async getAttrezzature(filters = {}) {
    if (!ipcRenderer) return [];
    return ipcRenderer.invoke('db:getAttrezzature', filters);
  }

  async getAttrezzatura(id) {
    if (!ipcRenderer) return null;
    return ipcRenderer.invoke('db:getById', { table: 'attrezzature', id });
  }

  async insertAttrezzatura(data) {
    if (!ipcRenderer) return null;
    const result = await ipcRenderer.invoke('db:insert', { table: 'attrezzature', data });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async updateAttrezzatura(id, updates) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:update', { table: 'attrezzature', id, updates });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async deleteAttrezzatura(id) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:delete', { table: 'attrezzature', id });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  // ============================================
  // FARMACI
  // ============================================

  async getFarmaci(filters = {}) {
    if (!ipcRenderer) return [];
    return ipcRenderer.invoke('db:getFarmaci', filters);
  }

  async insertFarmaco(data) {
    if (!ipcRenderer) return null;
    const result = await ipcRenderer.invoke('db:insert', { table: 'farmaci', data });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async updateFarmaco(id, updates) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:update', { table: 'farmaci', id, updates });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async deleteFarmaco(id) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:delete', { table: 'farmaci', id });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  // ============================================
  // SOMMINISTRAZIONI
  // ============================================

  async getSomministrazioni(filters = {}) {
    if (!ipcRenderer) return [];
    return ipcRenderer.invoke('db:select', { table: 'somministrazioni', filters });
  }

  async getSomministrazione(id) {
    if (!ipcRenderer) return null;
    return ipcRenderer.invoke('db:getById', { table: 'somministrazioni', id });
  }

  async insertSomministrazione(data) {
    if (!ipcRenderer) return null;
    const result = await ipcRenderer.invoke('db:insert', { table: 'somministrazioni', data });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async updateSomministrazione(id, updates) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:update', { table: 'somministrazioni', id, updates });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async deleteSomministrazione(id) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:delete', { table: 'somministrazioni', id });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  // ============================================
  // ASSICURAZIONI
  // ============================================

  async getAssicurazioni(filters = {}) {
    if (!ipcRenderer) return [];
    return ipcRenderer.invoke('db:getAssicurazioni', filters);
  }

  async insertAssicurazione(data) {
    if (!ipcRenderer) return null;
    const result = await ipcRenderer.invoke('db:insert', { table: 'assicurazioni_aziendali', data });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async updateAssicurazione(id, updates) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:update', { table: 'assicurazioni_aziendali', id, updates });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async deleteAssicurazione(id) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:delete', { table: 'assicurazioni_aziendali', id });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  // ============================================
  // CONTRATTI SOCCIDA
  // ============================================

  async getContrattiSoccida(filters = {}) {
    if (!ipcRenderer) return [];
    return ipcRenderer.invoke('db:select', { table: 'contratti_soccida', filters });
  }

  async getContrattoSoccida(id) {
    if (!ipcRenderer) return null;
    return ipcRenderer.invoke('db:getById', { table: 'contratti_soccida', id });
  }

  async insertContrattoSoccida(data) {
    if (!ipcRenderer) return null;
    const result = await ipcRenderer.invoke('db:insert', { table: 'contratti_soccida', data });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async updateContrattoSoccida(id, updates) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:update', { table: 'contratti_soccida', id, updates });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async deleteContrattoSoccida(id) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:delete', { table: 'contratti_soccida', id });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  // ============================================
  // ASSICURAZIONI
  // ============================================

  async getAssicurazioni(filters = {}) {
    if (!ipcRenderer) return [];
    return ipcRenderer.invoke('db:getAssicurazioni', filters);
  }

  // ============================================
  // ALIMENTAZIONE
  // ============================================

  async getComponentiAlimentari(filters = {}) {
    if (!ipcRenderer) return [];
    return ipcRenderer.invoke('db:getComponentiAlimentari', filters);
  }

  async getMangimi(filters = {}) {
    if (!ipcRenderer) return [];
    return ipcRenderer.invoke('db:getMangimi', filters);
  }

  // ============================================
  // PARTITE ANIMALI
  // ============================================

  async getPartite(filters = {}) {
    if (!ipcRenderer) return [];
    return ipcRenderer.invoke('db:getPartite', filters);
  }

  async getPartita(id) {
    if (!ipcRenderer) return null;
    return ipcRenderer.invoke('db:getPartita', id);
  }

  async insertPartita(data) {
    if (!ipcRenderer) return null;
    const result = await ipcRenderer.invoke('db:insert', { table: 'partite_animali', data });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async updatePartita(id, updates) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:update', { table: 'partite_animali', id, updates });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async deletePartita(id) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:delete', { table: 'partite_animali', id });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  // ============================================
  // PRIMA NOTA
  // ============================================

  async getPNConti(filters = {}) {
    if (!ipcRenderer) return [];
    return ipcRenderer.invoke('db:getPNConti', filters);
  }

  async getPNConto(id) {
    if (!ipcRenderer) return null;
    return ipcRenderer.invoke('db:getById', { table: 'pn_conti', id });
  }

  async insertPNConto(data) {
    if (!ipcRenderer) return null;
    const result = await ipcRenderer.invoke('db:insert', { table: 'pn_conti', data });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async updatePNConto(id, updates) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:update', { table: 'pn_conti', id, updates });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async deletePNConto(id) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:delete', { table: 'pn_conti', id });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async getPNCategorie(filters = {}) {
    if (!ipcRenderer) return [];
    return ipcRenderer.invoke('db:query', {
      sql: 'SELECT * FROM pn_categorie WHERE deleted_at IS NULL',
      params: []
    });
  }

  async insertPNCategoria(data) {
    if (!ipcRenderer) return null;
    const result = await ipcRenderer.invoke('db:insert', { table: 'pn_categorie', data });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async updatePNCategoria(id, updates) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:update', { table: 'pn_categorie', id, updates });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async deletePNCategoria(id) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:delete', { table: 'pn_categorie', id });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async getPNMovimenti(filters = {}) {
    if (!ipcRenderer) return [];
    return ipcRenderer.invoke('db:getPNMovimenti', filters);
  }

  async getPNMovimento(id) {
    if (!ipcRenderer) return null;
    return ipcRenderer.invoke('db:getById', { table: 'pn_movimenti', id });
  }

  async insertPNMovimento(data) {
    if (!ipcRenderer) return null;
    const result = await ipcRenderer.invoke('db:insert', { table: 'pn_movimenti', data });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async updatePNMovimento(id, updates) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:update', { table: 'pn_movimenti', id, updates });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async deletePNMovimento(id) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:delete', { table: 'pn_movimenti', id });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async insertPNContoIban(data) {
    if (!ipcRenderer) return null;
    const result = await ipcRenderer.invoke('db:insert', { table: 'pn_conti_iban', data });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async updatePNContoIban(id, updates) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:update', { table: 'pn_conti_iban', id, updates });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async deletePNContoIban(id) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:delete', { table: 'pn_conti_iban', id });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  // ============================================
  // PIANI ALIMENTAZIONE
  // ============================================

  async getPianiAlimentazione(filters = {}) {
    if (!ipcRenderer) return [];
    return ipcRenderer.invoke('db:getPianiAlimentazione', filters);
  }

  async getPianoAlimentazione(id) {
    if (!ipcRenderer) return null;
    return ipcRenderer.invoke('db:getPianoAlimentazione', id);
  }

  async insertPianoAlimentazione(data) {
    if (!ipcRenderer) return null;
    const result = await ipcRenderer.invoke('db:insert', { table: 'piani_alimentazione', data });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async updatePianoAlimentazione(id, updates) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:update', { table: 'piani_alimentazione', id, updates });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async deletePianoAlimentazione(id) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:delete', { table: 'piani_alimentazione', id });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async getComposizioniPiano(pianoId) {
    if (!ipcRenderer) return [];
    return ipcRenderer.invoke('db:query', {
      sql: 'SELECT * FROM composizione_piano WHERE piano_alimentazione_id = ? AND deleted_at IS NULL ORDER BY ordine ASC',
      params: [pianoId]
    });
  }

  async insertComposizionePiano(data) {
    if (!ipcRenderer) return null;
    const result = await ipcRenderer.invoke('db:insert', { table: 'composizione_piano', data });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async updateComposizionePiano(id, updates) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:update', { table: 'composizione_piano', id, updates });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async deleteComposizionePiano(id) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:delete', { table: 'composizione_piano', id });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  // ============================================
  // REGISTRO ALIMENTAZIONE
  // ============================================

  async getRegistroAlimentazione(filters = {}) {
    if (!ipcRenderer) return [];
    return ipcRenderer.invoke('db:getRegistroAlimentazione', filters);
  }

  async getVoceRegistro(id) {
    if (!ipcRenderer) return null;
    return ipcRenderer.invoke('db:getById', { table: 'registro_alimentazione', id });
  }

  async insertVoceRegistro(data) {
    if (!ipcRenderer) return null;
    const result = await ipcRenderer.invoke('db:insert', { table: 'registro_alimentazione', data });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async updateVoceRegistro(id, updates) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:update', { table: 'registro_alimentazione', id, updates });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async deleteVoceRegistro(id) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:delete', { table: 'registro_alimentazione', id });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  // ============================================
  // DDT
  // ============================================

  async getDdt(filters = {}) {
    if (!ipcRenderer) return [];
    return ipcRenderer.invoke('db:getDdt', filters);
  }

  async getDdtById(id) {
    if (!ipcRenderer) return null;
    return ipcRenderer.invoke('db:getDdtById', id);
  }

  async insertDdt(data) {
    if (!ipcRenderer) return null;
    const result = await ipcRenderer.invoke('db:insert', { table: 'ddt', data });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async updateDdt(id, updates) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:update', { table: 'ddt', id, updates });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async deleteDdt(id) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:delete', { table: 'ddt', id });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async getDdtRighe(ddtId) {
    if (!ipcRenderer) return [];
    return ipcRenderer.invoke('db:query', {
      sql: 'SELECT * FROM ddt_righe WHERE ddt_id = ? AND deleted_at IS NULL',
      params: [ddtId]
    });
  }

  async insertDdtRiga(data) {
    if (!ipcRenderer) return null;
    const result = await ipcRenderer.invoke('db:insert', { table: 'ddt_righe', data });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async updateDdtRiga(id, updates) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:update', { table: 'ddt_righe', id, updates });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async deleteDdtRiga(id) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:delete', { table: 'ddt_righe', id });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  // ============================================
  // MAGAZZINO MOVIMENTI
  // ============================================

  async getMagazzinoMovimenti(filters = {}) {
    if (!ipcRenderer) return [];
    return ipcRenderer.invoke('db:getMagazzinoMovimenti', filters);
  }

  async getMagazzinoMovimento(id) {
    if (!ipcRenderer) return null;
    return ipcRenderer.invoke('db:getById', { table: 'magazzino_movimenti', id });
  }

  async insertMagazzinoMovimento(data) {
    if (!ipcRenderer) return null;
    const result = await ipcRenderer.invoke('db:insert', { table: 'magazzino_movimenti', data });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async updateMagazzinoMovimento(id, updates) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:update', { table: 'magazzino_movimenti', id, updates });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async deleteMagazzinoMovimento(id) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:delete', { table: 'magazzino_movimenti', id });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  // ============================================
  // MOVIMENTAZIONI ANIMALI
  // ============================================

  async getMovimentazioni(filters = {}) {
    if (!ipcRenderer) return [];
    return ipcRenderer.invoke('db:getMovimentazioni', filters);
  }

  async insertMovimentazione(data) {
    if (!ipcRenderer) return null;
    const result = await ipcRenderer.invoke('db:insert', { table: 'movimentazioni', data });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  // ============================================
  // LOTTI FARMACO
  // ============================================

  async getLottiFarmaco(filters = {}) {
    if (!ipcRenderer) return [];
    return ipcRenderer.invoke('db:getLottiFarmaco', filters);
  }

  async getLottoFarmaco(id) {
    if (!ipcRenderer) return null;
    return ipcRenderer.invoke('db:getLottoFarmaco', id);
  }

  async insertLottoFarmaco(data) {
    if (!ipcRenderer) return null;
    const result = await ipcRenderer.invoke('db:insert', { table: 'lotti_farmaco', data });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async updateLottoFarmaco(id, updates) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:update', { table: 'lotti_farmaco', id, updates });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async deleteLottoFarmaco(id) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:delete', { table: 'lotti_farmaco', id });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  // ============================================
  // LAVORAZIONI TERRENO
  // ============================================

  async getLavorazioni(filters = {}) {
    if (!ipcRenderer) return [];
    return ipcRenderer.invoke('db:getLavorazioni', filters);
  }

  async insertLavorazione(data) {
    if (!ipcRenderer) return null;
    const result = await ipcRenderer.invoke('db:insert', { table: 'lavorazioni_terreno', data });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async updateLavorazione(id, updates) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:update', { table: 'lavorazioni_terreno', id, updates });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async deleteLavorazione(id) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:delete', { table: 'lavorazioni_terreno', id });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  // ============================================
  // RACCOLTI TERRENO
  // ============================================

  async getRaccolti(filters = {}) {
    if (!ipcRenderer) return [];
    return ipcRenderer.invoke('db:getRaccolti', filters);
  }

  async insertRaccolto(data) {
    if (!ipcRenderer) return null;
    const result = await ipcRenderer.invoke('db:insert', { table: 'raccolti_terreno', data });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async updateRaccolto(id, updates) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:update', { table: 'raccolti_terreno', id, updates });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async deleteRaccolto(id) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:delete', { table: 'raccolti_terreno', id });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async getTerrenoRiepilogo(terrenoId) {
    if (!ipcRenderer) return null;
    return ipcRenderer.invoke('db:getTerrenoRiepilogo', terrenoId);
  }

  // ============================================
  // CICLI TERRENO
  // ============================================

  async getCicli(filters = {}) {
    if (!ipcRenderer) return [];
    return ipcRenderer.invoke('db:getCicli', filters);
  }

  async getCiclo(id) {
    if (!ipcRenderer) return null;
    return ipcRenderer.invoke('db:getCiclo', id);
  }

  async insertCiclo(data) {
    if (!ipcRenderer) return null;
    const result = await ipcRenderer.invoke('db:insertCiclo', data);
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async updateCiclo(id, updates) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:updateCiclo', { id, updates });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async deleteCiclo(id) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:deleteCiclo', id);
    ipcRenderer.send('sync:trigger');
    return result;
  }

  // --- FASI CICLO ---
  async getCicloFasi(cicloId) {
    if (!ipcRenderer) return [];
    return ipcRenderer.invoke('db:getCicloFasi', cicloId);
  }

  async getCicloFase(id) {
    if (!ipcRenderer) return null;
    return ipcRenderer.invoke('db:getCicloFase', id);
  }

  async insertCicloFase(data) {
    if (!ipcRenderer) return null;
    const result = await ipcRenderer.invoke('db:insertCicloFase', data);
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async updateCicloFase(id, updates) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:updateCicloFase', { id, updates });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async deleteCicloFase(id) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:deleteCicloFase', id);
    ipcRenderer.send('sync:trigger');
    return result;
  }

  // --- COSTI CICLO ---
  async getCicloCosti(filters = {}) {
    if (!ipcRenderer) return [];
    return ipcRenderer.invoke('db:getCicloCosti', filters);
  }

  async getCicloCosto(id) {
    if (!ipcRenderer) return null;
    return ipcRenderer.invoke('db:getCicloCosto', id);
  }

  async insertCicloCosto(data) {
    if (!ipcRenderer) return null;
    const result = await ipcRenderer.invoke('db:insertCicloCosto', data);
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async updateCicloCosto(id, updates) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:updateCicloCosto', { id, updates });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async deleteCicloCosto(id) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:deleteCicloCosto', id);
    ipcRenderer.send('sync:trigger');
    return result;
  }

  // ============================================
  // SCADENZE ATTREZZATURE
  // ============================================

  async getScadenzeAttrezzatura(attrezzaturaId) {
    if (!ipcRenderer) return [];
    return ipcRenderer.invoke('db:getScadenzeAttrezzatura', attrezzaturaId);
  }

  async insertScadenzaAttrezzatura(data) {
    if (!ipcRenderer) return null;
    const result = await ipcRenderer.invoke('db:insert', { table: 'scadenze_attrezzature', data });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async updateScadenzaAttrezzatura(id, updates) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:update', { table: 'scadenze_attrezzature', id, updates });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async deleteScadenzaAttrezzatura(id) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:delete', { table: 'scadenze_attrezzature', id });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  // ============================================
  // AMMORTAMENTI
  // ============================================

  async getAmmortamenti(filters = {}) {
    if (!ipcRenderer) return [];
    return ipcRenderer.invoke('db:getAmmortamenti', filters);
  }

  async insertAmmortamento(data) {
    if (!ipcRenderer) return null;
    const result = await ipcRenderer.invoke('db:insert', { table: 'ammortamenti', data });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async updateAmmortamento(id, updates) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:update', { table: 'ammortamenti', id, updates });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  async deleteAmmortamento(id) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:delete', { table: 'ammortamenti', id });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  // ============================================
  // QUERY GENERICHE
  // ============================================

  /**
   * Query SQL raw (per casi speciali)
   */
  async query(sql, params = []) {
    if (!ipcRenderer) return [];
    return ipcRenderer.invoke('db:query', { sql, params });
  }

  /**
   * Insert generico
   */
  async insert(table, data) {
    if (!ipcRenderer) return null;
    const result = await ipcRenderer.invoke('db:insert', { table, data });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  /**
   * Update generico
   */
  async update(table, id, updates) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:update', { table, id, updates });
    ipcRenderer.send('sync:trigger');
    return result;
  }

  /**
   * Delete generico
   */
  async delete(table, id) {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke('db:delete', { table, id });
    ipcRenderer.send('sync:trigger');
    return result;
  }
}

// Singleton
const localDataService = new LocalDataService();

export default localDataService;

