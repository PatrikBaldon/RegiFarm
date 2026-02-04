/**
 * Hybrid Data Service
 * 
 * Servizio ibrido che decide automaticamente se usare:
 * - Database locale SQLite (per letture istantanee)
 * - Backend online (per operazioni che richiedono il server)
 * 
 * Strategia:
 * 1. LETTURE: Sempre da database locale (< 5ms)
 * 2. SCRITTURE: Locale + sync in background
 * 3. OPERAZIONI SPECIALI: Sempre online (PDF, import, report)
 * 
 * Uso:
 *   import hybridData from './services/hybridDataService';
 *   
 *   // Lettura istantanea (locale)
 *   const animali = await hybridData.getAnimali({ azienda_id: 1 });
 *   
 *   // Generazione PDF (online)
 *   const pdf = await hybridData.generatePDF(data);
 */

import localDataService from './localDataService';
import api from './api';

class HybridDataService {
  constructor() {
    this.useLocalDb = true; // Flag per abilitare/disabilitare database locale
    this._loggedAvailability = null; // Per evitare log ripetitivi
  }

  /**
   * Inizializza il servizio (opzionale, localDataService si auto-inizializza via useLocalDatabase)
   */
  async init() {
    try {
      const success = await localDataService.init();
      return success;
    } catch (error) {
      return false;
    }
  }

  /**
   * Verifica se il database locale è disponibile
   * Controlla dinamicamente lo stato di localDataService
   */
  isLocalAvailable() {
    // Controlla dinamicamente se localDataService è inizializzato e disponibile
    const available = this.useLocalDb && 
                      localDataService.isInitialized && 
                      localDataService.isAvailable;
    
    // Log solo quando cambia (per debug)
    if (this._loggedAvailability !== available) {
      this._loggedAvailability = available;
    }
    
    return available;
  }

  // ============================================
  // LETTURE - SEMPRE LOCALI (quando disponibile)
  // ============================================

  async getAnimali(filters = {}) {
    if (this.isLocalAvailable()) {
      return localDataService.getAnimali(filters);
    }
    // Fallback a API online
    return api.get('/allevamento/animali', filters);
  }

  async getAnimale(id) {
    if (this.isLocalAvailable()) {
      return localDataService.getAnimale(id);
    }
    return api.get(`/allevamento/animali/${id}`);
  }

  async getSedi(filters = {}) {
    if (this.isLocalAvailable()) {
      return localDataService.getSedi(filters);
    }
    return api.get('/allevamento/sedi', filters);
  }

  async getSede(id) {
    if (this.isLocalAvailable()) {
      return localDataService.getSede(id);
    }
    return api.get(`/allevamento/sedi/${id}`);
  }

  async getStabilimenti(filters = {}) {
    if (this.isLocalAvailable()) {
      return localDataService.getStabilimenti(filters);
    }
    return api.get('/allevamento/stabilimenti', filters);
  }

  async getStabilimento(id) {
    if (this.isLocalAvailable()) {
      // Cerca nel database locale
      const stabilimenti = await localDataService.getStabilimenti({ id });
      return stabilimenti && stabilimenti.length > 0 ? stabilimenti[0] : null;
    }
    return api.get(`/allevamento/stabilimenti/${id}`);
  }

  async getBox(filters = {}) {
    if (this.isLocalAvailable()) {
      return localDataService.getBox(filters);
    }
    return api.get('/allevamento/box', filters);
  }

  async getBoxDetail(id) {
    if (this.isLocalAvailable()) {
      // Cerca nel database locale
      const box = await localDataService.getBox({ id });
      return box && box.length > 0 ? box[0] : null;
    }
    return api.get(`/allevamento/box/${id}`);
  }

  async getFornitori(filters = {}) {
    if (this.isLocalAvailable()) {
      return localDataService.getFornitori(filters);
    }
    return api.get('/amministrazione/fornitori/', filters);
  }

  async getFornitore(id) {
    if (this.isLocalAvailable()) {
      // Cerca nel database locale
      const fornitori = await localDataService.getFornitori({ id });
      return fornitori && fornitori.length > 0 ? fornitori[0] : null;
    }
    return api.get(`/amministrazione/fornitori/${id}`);
  }

  async getFatture(filters = {}) {
    if (this.isLocalAvailable()) {
      return localDataService.getFatture(filters);
    }
    return api.get('/amministrazione/fatture', filters);
  }

  async getFattura(id) {
    if (this.isLocalAvailable()) {
      // Cerca nel database locale
      const fatture = await localDataService.getFatture({ id });
      return fatture && fatture.length > 0 ? fatture[0] : null;
    }
    return api.get(`/amministrazione/fatture/${id}`);
  }

  /**
   * Ottiene i documenti aperti (fatture con residuo > 0) per la prima nota
   * Usa database locale per performance ottimali
   */
  async getPrimaNotaDocumenti(aziendaId) {
    if (this.isLocalAvailable()) {
      try {
        // Ottieni tutte le fatture dal database locale
        const fatture = await localDataService.getFatture({ azienda_id: aziendaId });
        
        // Raccogli tutti gli ID di fornitori/clienti per lookup efficiente
        const fornitoreIds = new Set();
        const clienteIds = new Set();
        fatture.forEach(f => {
          if (f.fornitore_id) fornitoreIds.add(f.fornitore_id);
          if (f.cliente_id) clienteIds.add(f.cliente_id);
        });

        // Carica fornitori per lookup veloce (carica tutti e filtra manualmente)
        const fornitoriMap = new Map();
        if (fornitoreIds.size > 0 || clienteIds.size > 0) {
          const allIds = new Set([...fornitoreIds, ...clienteIds]);
          const fornitori = await localDataService.getFornitori({});
          if (Array.isArray(fornitori)) {
            fornitori
              .filter(f => allIds.has(f.id))
              .forEach(f => fornitoriMap.set(f.id, f.nome));
          }
        }

        const documenti = [];

        for (const fattura of fatture) {
          // Calcola residuo in base al tipo
          let residuo = 0;
          if (fattura.tipo === 'entrata') {
            // Fatture emesse: residuo = totale - incassato
            residuo = parseFloat(fattura.importo_totale || 0) - parseFloat(fattura.importo_incassato || 0);
          } else {
            // Fatture ricevute: residuo = totale - pagato
            residuo = parseFloat(fattura.importo_totale || 0) - parseFloat(fattura.importo_pagato || 0);
          }

          // Salta fatture senza residuo
          if (residuo <= 0) continue;

          // Determina contropartita
          let contropartita = null;
          if (fattura.tipo === 'entrata') {
            // Fatture emesse: usa cliente_nome o cerca nel fornitore/cliente
            contropartita = fattura.cliente_nome || null;
            if (!contropartita && fattura.cliente_id) {
              contropartita = fornitoriMap.get(fattura.cliente_id) || null;
            }
            // Se non c'è ancora, prova a recuperarlo dai dati XML
            if (!contropartita && fattura.dati_xml) {
              const cessionario = fattura.dati_xml?.cessionario || {};
              contropartita = cessionario.denominazione || cessionario.ragione_sociale || null;
            }
          } else {
            // Fatture ricevute: cerca il fornitore
            if (fattura.fornitore_id) {
              contropartita = fornitoriMap.get(fattura.fornitore_id) || null;
            }
            // Se non c'è ancora, prova dai dati XML
            if (!contropartita && fattura.dati_xml) {
              const cedente = fattura.dati_xml?.cedente || {};
              contropartita = cedente.denominazione || cedente.ragione_sociale || null;
            }
          }

          // Recupera tipo_documento e condizioni_pagamento
          let tipo_documento = fattura.tipo_documento || null;
          let condizioni_pagamento = fattura.condizioni_pagamento || null;

          // Se non disponibili, prova a recuperarli dai dati XML
          if (!tipo_documento && fattura.dati_xml) {
            const documento = fattura.dati_xml?.documento || {};
            tipo_documento = documento.tipo_documento || null;
          }
          if (!condizioni_pagamento && fattura.dati_xml) {
            const pagamenti = fattura.dati_xml?.pagamenti || [];
            if (pagamenti.length > 0 && pagamenti[0]) {
              condizioni_pagamento = pagamenti[0].condizioni_pagamento || null;
            }
          }

          // Determina il tipo documento per la prima nota
          const documento_tipo = fattura.tipo === 'entrata' 
            ? 'fattura_emessa' 
            : 'fattura_amministrazione';

          documenti.push({
            id: fattura.id,
            tipo: documento_tipo,
            riferimento: fattura.numero || `Documento #${fattura.id}`,
            data: fattura.data_fattura,
            contropartita: contropartita || '-',
            residuo: residuo,
            tipo_documento: tipo_documento,
            condizioni_pagamento: condizioni_pagamento,
            // Campi aggiuntivi per compatibilità
            importo_totale: parseFloat(fattura.importo_totale || 0),
          });
        }

        return documenti;
      } catch (error) {
        // Fallback al backend se c'è un errore
        return api.get('/amministrazione/prima-nota/documenti-aperti', { azienda_id: aziendaId });
      }
    }
    // Se il database locale non è disponibile, usa il backend
    return api.get('/amministrazione/prima-nota/documenti-aperti', { azienda_id: aziendaId });
  }

  async getTerreni(filters = {}) {
    if (this.isLocalAvailable()) {
      return localDataService.getTerreni(filters);
    }
    return api.get('/terreni', filters);
  }

  async getTerreno(id) {
    if (this.isLocalAvailable()) {
      // Cerca nel database locale
      const terreni = await localDataService.getTerreni({ id });
      return terreni && terreni.length > 0 ? terreni[0] : null;
    }
    return api.get(`/terreni/${id}`);
  }

  async insertTerreno(data) {
    if (this.isLocalAvailable()) {
      return localDataService.insertTerreno(data);
    }
    return api.post('/terreni/', data);
  }

  async updateTerreno(id, updates) {
    if (this.isLocalAvailable()) {
      return localDataService.updateTerreno(id, updates);
    }
    return api.put(`/terreni/${id}`, updates);
  }

  async deleteTerreno(id) {
    if (this.isLocalAvailable()) {
      return localDataService.deleteTerreno(id);
    }
    return api.delete(`/terreni/${id}`);
  }

  async getAttrezzature(filters = {}) {
    if (this.isLocalAvailable()) {
      return localDataService.getAttrezzature(filters);
    }
    return api.get('/amministrazione/attrezzature', filters);
  }

  async getFarmaci(filters = {}) {
    if (this.isLocalAvailable()) {
      return localDataService.getFarmaci(filters);
    }
    return api.get('/sanitario/farmaci', filters);
  }

  async getFarmaco(id) {
    if (this.isLocalAvailable()) {
      // Cerca nel database locale
      const farmaci = await localDataService.getFarmaci({ id });
      return farmaci && farmaci.length > 0 ? farmaci[0] : null;
    }
    return api.get(`/sanitario/farmaci/${id}`);
  }

  async getAssicurazioni(filters = {}) {
    if (this.isLocalAvailable()) {
      return localDataService.getAssicurazioni(filters);
    }
    return api.get('/amministrazione/assicurazioni-aziendali', filters);
  }

  async getComponentiAlimentari(filters = {}) {
    if (this.isLocalAvailable()) {
      return localDataService.getComponentiAlimentari(filters);
    }
    return api.get('/alimentazione/componenti-alimentari', filters);
  }

  async getMangimi(filters = {}) {
    if (this.isLocalAvailable()) {
      return localDataService.getMangimi(filters);
    }
    return api.get('/alimentazione/mangimi-confezionati', filters);
  }

  // ============================================
  // SCRITTURE - LOCALE + SYNC
  // ============================================

  async updateAnimale(id, updates) {
    if (this.isLocalAvailable()) {
      // Scrivi localmente (istantaneo) + sync in background
      return localDataService.updateAnimale(id, updates);
    }
    // Fallback: scrivi direttamente online
    return api.put(`/allevamento/animali/${id}`, updates);
  }

  async insertAnimale(data) {
    if (this.isLocalAvailable()) {
      return localDataService.insertAnimale(data);
    }
    return api.post('/allevamento/animali', data);
  }

  async deleteAnimale(id) {
    if (this.isLocalAvailable()) {
      return localDataService.deleteAnimale(id);
    }
    return api.delete(`/allevamento/animali/${id}`);
  }

  async updateFornitore(id, updates) {
    if (this.isLocalAvailable()) {
      return localDataService.updateFornitore(id, updates);
    }
    return api.put(`/amministrazione/fornitori/${id}`, updates);
  }

  async insertFornitore(data) {
    if (this.isLocalAvailable()) {
      return localDataService.insertFornitore(data);
    }
    return api.post('/amministrazione/fornitori/', data);
  }

  async updateFattura(id, updates) {
    if (this.isLocalAvailable()) {
      return localDataService.updateFattura(id, updates);
    }
    return api.put(`/amministrazione/fatture/${id}`, updates);
  }

  async insertFattura(data) {
    if (this.isLocalAvailable()) {
      return localDataService.insertFattura(data);
    }
    return api.post('/amministrazione/fatture', data);
  }

  async deleteFattura(id) {
    if (this.isLocalAvailable()) {
      return localDataService.deleteFattura(id);
    }
    return api.delete(`/amministrazione/fatture/${id}`);
  }

  // ============================================
  // SEDI - SCRITTURE
  // ============================================

  async insertSede(data) {
    if (this.isLocalAvailable()) {
      return localDataService.insertSede(data);
    }
    return api.post('/allevamento/sedi', data);
  }

  async updateSede(id, updates) {
    if (this.isLocalAvailable()) {
      return localDataService.updateSede(id, updates);
    }
    return api.put(`/allevamento/sedi/${id}`, updates);
  }

  async deleteSede(id) {
    if (this.isLocalAvailable()) {
      return localDataService.deleteSede(id);
    }
    return api.delete(`/allevamento/sedi/${id}`);
  }

  // ============================================
  // STABILIMENTI - SCRITTURE
  // ============================================

  async insertStabilimento(data) {
    if (this.isLocalAvailable()) {
      return localDataService.insertStabilimento(data);
    }
    return api.post('/allevamento/stabilimenti', data);
  }

  async updateStabilimento(id, updates) {
    if (this.isLocalAvailable()) {
      return localDataService.updateStabilimento(id, updates);
    }
    return api.put(`/allevamento/stabilimenti/${id}`, updates);
  }

  async deleteStabilimento(id) {
    if (this.isLocalAvailable()) {
      return localDataService.deleteStabilimento(id);
    }
    return api.delete(`/allevamento/stabilimenti/${id}`);
  }

  // ============================================
  // BOX - SCRITTURE
  // ============================================

  async insertBox(data) {
    if (this.isLocalAvailable()) {
      return localDataService.insertBox(data);
    }
    return api.post('/allevamento/box', data);
  }

  async updateBox(id, updates) {
    if (this.isLocalAvailable()) {
      return localDataService.updateBox(id, updates);
    }
    return api.put(`/allevamento/box/${id}`, updates);
  }

  async deleteBox(id) {
    if (this.isLocalAvailable()) {
      return localDataService.deleteBox(id);
    }
    return api.delete(`/allevamento/box/${id}`);
  }

  // ============================================
  // FORNITORI - SCRITTURE
  // ============================================

  async deleteFornitore(id) {
    if (this.isLocalAvailable()) {
      return localDataService.deleteFornitore(id);
    }
    return api.delete(`/amministrazione/fornitori/${id}`);
  }

  // ============================================
  // TERRENI - SCRITTURE (già aggiunto prima)
  // ============================================

  // ============================================
  // ATTREZZATURE - SCRITTURE
  // ============================================

  async getAttrezzatura(id) {
    if (this.isLocalAvailable()) {
      return localDataService.getAttrezzatura(id);
    }
    return api.get(`/amministrazione/attrezzature/${id}`);
  }

  async insertAttrezzatura(data) {
    if (this.isLocalAvailable()) {
      return localDataService.insertAttrezzatura(data);
    }
    return api.post('/amministrazione/attrezzature', data);
  }

  async updateAttrezzatura(id, updates) {
    if (this.isLocalAvailable()) {
      return localDataService.updateAttrezzatura(id, updates);
    }
    return api.put(`/amministrazione/attrezzature/${id}`, updates);
  }

  async deleteAttrezzatura(id) {
    if (this.isLocalAvailable()) {
      return localDataService.deleteAttrezzatura(id);
    }
    return api.delete(`/amministrazione/attrezzature/${id}`);
  }

  // ============================================
  // FARMACI - SCRITTURE
  // ============================================

  async insertFarmaco(data) {
    if (this.isLocalAvailable()) {
      return localDataService.insertFarmaco(data);
    }
    return api.post('/sanitario/farmaci', data);
  }

  async updateFarmaco(id, updates) {
    if (this.isLocalAvailable()) {
      return localDataService.updateFarmaco(id, updates);
    }
    return api.put(`/sanitario/farmaci/${id}`, updates);
  }

  async deleteFarmaco(id) {
    if (this.isLocalAvailable()) {
      return localDataService.deleteFarmaco(id);
    }
    return api.delete(`/sanitario/farmaci/${id}`);
  }

  // ============================================
  // SOMMINISTRAZIONI - CRUD COMPLETO
  // ============================================

  async getSomministrazioni(filters = {}) {
    if (this.isLocalAvailable()) {
      return localDataService.getSomministrazioni(filters);
    }
    return api.get('/sanitario/somministrazioni', filters);
  }

  async getSomministrazione(id) {
    if (this.isLocalAvailable()) {
      return localDataService.getSomministrazione(id);
    }
    return api.get(`/sanitario/somministrazioni/${id}`);
  }

  async insertSomministrazione(data) {
    if (this.isLocalAvailable()) {
      return localDataService.insertSomministrazione(data);
    }
    return api.post('/sanitario/somministrazioni', data);
  }

  async updateSomministrazione(id, updates) {
    if (this.isLocalAvailable()) {
      return localDataService.updateSomministrazione(id, updates);
    }
    return api.put(`/sanitario/somministrazioni/${id}`, updates);
  }

  async deleteSomministrazione(id) {
    if (this.isLocalAvailable()) {
      return localDataService.deleteSomministrazione(id);
    }
    return api.delete(`/sanitario/somministrazioni/${id}`);
  }

  // ============================================
  // ASSICURAZIONI - SCRITTURE
  // ============================================

  async insertAssicurazione(data) {
    if (this.isLocalAvailable()) {
      return localDataService.insertAssicurazione(data);
    }
    return api.post('/amministrazione/assicurazioni-aziendali', data);
  }

  async updateAssicurazione(id, updates) {
    if (this.isLocalAvailable()) {
      return localDataService.updateAssicurazione(id, updates);
    }
    return api.put(`/amministrazione/assicurazioni-aziendali/${id}`, updates);
  }

  async deleteAssicurazione(id) {
    if (this.isLocalAvailable()) {
      return localDataService.deleteAssicurazione(id);
    }
    return api.delete(`/amministrazione/assicurazioni-aziendali/${id}`);
  }

  // ============================================
  // CONTRATTI SOCCIDA - CRUD COMPLETO
  // ============================================

  async getContrattiSoccida(filters = {}) {
    if (this.isLocalAvailable()) {
      return localDataService.getContrattiSoccida(filters);
    }
    return api.get('/amministrazione/contratti-soccida', filters);
  }

  async getContrattoSoccida(id) {
    if (this.isLocalAvailable()) {
      return localDataService.getContrattoSoccida(id);
    }
    return api.get(`/amministrazione/contratti-soccida/${id}`);
  }

  async insertContrattoSoccida(data) {
    if (this.isLocalAvailable()) {
      return localDataService.insertContrattoSoccida(data);
    }
    return api.post('/amministrazione/contratti-soccida', data);
  }

  async updateContrattoSoccida(id, updates) {
    if (this.isLocalAvailable()) {
      return localDataService.updateContrattoSoccida(id, updates);
    }
    return api.put(`/amministrazione/contratti-soccida/${id}`, updates);
  }

  async deleteContrattoSoccida(id) {
    if (this.isLocalAvailable()) {
      return localDataService.deleteContrattoSoccida(id);
    }
    return api.delete(`/amministrazione/contratti-soccida/${id}`);
  }

  // ============================================
  // PARTITE ANIMALI - CRUD COMPLETO
  // ============================================

  async getPartite(filters = {}, options = {}) {
    // forceApi: true = leggi sempre dal server (per vedere partite appena confermate prima che il sync aggiorni il locale)
    if (options.forceApi) {
      const params = { ...filters, limit: filters.limit ?? 1000 };
      return api.get('/amministrazione/partite', params);
    }
    if (this.isLocalAvailable()) {
      return localDataService.getPartite(filters);
    }
    return api.get('/amministrazione/partite', { ...filters, limit: filters.limit ?? 1000 });
  }

  async getPartita(id) {
    if (this.isLocalAvailable()) {
      const local = await localDataService.getPartita(id);
      // Fallback a API se non in locale (es. partita creata via anagrafe su Supabase, sync non ancora completato)
      if (local != null) return local;
      return api.get(`/amministrazione/partite/${id}`);
    }
    return api.get(`/amministrazione/partite/${id}`);
  }

  async insertPartita(data) {
    if (this.isLocalAvailable()) {
      return localDataService.insertPartita(data);
    }
    return api.post('/amministrazione/partite', data);
  }

  async updatePartita(id, updates) {
    if (this.isLocalAvailable()) {
      return localDataService.updatePartita(id, updates);
    }
    return api.put(`/amministrazione/partite/${id}`, updates);
  }

  async deletePartita(id) {
    if (this.isLocalAvailable()) {
      return localDataService.deletePartita(id);
    }
    return api.delete(`/amministrazione/partite/${id}`);
  }

  // ============================================
  // PRIMA NOTA - CRUD COMPLETO
  // ============================================

  async getPNConti(filters = {}) {
    if (this.isLocalAvailable()) {
      return localDataService.getPNConti(filters);
    }
    return api.get('/amministrazione/prima-nota/conti', filters);
  }

  async getPNConto(id) {
    if (this.isLocalAvailable()) {
      return localDataService.getPNConto(id);
    }
    return api.get(`/amministrazione/prima-nota/conti/${id}`);
  }

  async insertPNConto(data) {
    if (this.isLocalAvailable()) {
      return localDataService.insertPNConto(data);
    }
    return api.post('/amministrazione/prima-nota/conti', data);
  }

  async updatePNConto(id, updates) {
    if (this.isLocalAvailable()) {
      return localDataService.updatePNConto(id, updates);
    }
    return api.put(`/amministrazione/prima-nota/conti/${id}`, updates);
  }

  async deletePNConto(id) {
    if (this.isLocalAvailable()) {
      return localDataService.deletePNConto(id);
    }
    return api.delete(`/amministrazione/prima-nota/conti/${id}`);
  }

  async getPNCategorie(filters = {}) {
    if (this.isLocalAvailable()) {
      return localDataService.getPNCategorie(filters);
    }
    return api.get('/amministrazione/prima-nota/categorie', filters);
  }

  async insertPNCategoria(data) {
    if (this.isLocalAvailable()) {
      return localDataService.insertPNCategoria(data);
    }
    return api.post('/amministrazione/prima-nota/categorie', data);
  }

  async updatePNCategoria(id, updates) {
    if (this.isLocalAvailable()) {
      return localDataService.updatePNCategoria(id, updates);
    }
    return api.put(`/amministrazione/prima-nota/categorie/${id}`, updates);
  }

  async deletePNCategoria(id) {
    if (this.isLocalAvailable()) {
      return localDataService.deletePNCategoria(id);
    }
    return api.delete(`/amministrazione/prima-nota/categorie/${id}`);
  }

  async getPNMovimenti(filters = {}) {
    if (this.isLocalAvailable()) {
      return localDataService.getPNMovimenti(filters);
    }
    return api.get('/amministrazione/prima-nota/movimenti', filters);
  }

  async getPNMovimento(id) {
    if (this.isLocalAvailable()) {
      return localDataService.getPNMovimento(id);
    }
    return api.get(`/amministrazione/prima-nota/movimenti/${id}`);
  }

  async insertPNMovimento(data) {
    if (this.isLocalAvailable()) {
      return localDataService.insertPNMovimento(data);
    }
    return api.post('/amministrazione/prima-nota/movimenti', data);
  }

  async updatePNMovimento(id, updates) {
    if (this.isLocalAvailable()) {
      return localDataService.updatePNMovimento(id, updates);
    }
    return api.put(`/amministrazione/prima-nota/movimenti/${id}`, updates);
  }

  async deletePNMovimento(id) {
    if (this.isLocalAvailable()) {
      return localDataService.deletePNMovimento(id);
    }
    return api.delete(`/amministrazione/prima-nota/movimenti/${id}`);
  }

  async insertPNContoIban(contoId, data) {
    if (this.isLocalAvailable()) {
      return localDataService.insertPNContoIban({ ...data, conto_id: contoId });
    }
    return api.post(`/amministrazione/prima-nota/conti/${contoId}/iban`, data);
  }

  async updatePNContoIban(ibanId, updates) {
    if (this.isLocalAvailable()) {
      return localDataService.updatePNContoIban(ibanId, updates);
    }
    return api.put(`/amministrazione/prima-nota/conti/iban/${ibanId}`, updates);
  }

  async deletePNContoIban(ibanId) {
    if (this.isLocalAvailable()) {
      return localDataService.deletePNContoIban(ibanId);
    }
    return api.delete(`/amministrazione/prima-nota/conti/iban/${ibanId}`);
  }

  // ============================================
  // PIANI ALIMENTAZIONE - CRUD COMPLETO
  // ============================================

  async getPianiAlimentazione(filters = {}) {
    if (this.isLocalAvailable()) {
      return localDataService.getPianiAlimentazione(filters);
    }
    return api.get('/piani-alimentazione', filters);
  }

  async getPianoAlimentazione(id) {
    if (this.isLocalAvailable()) {
      return localDataService.getPianoAlimentazione(id);
    }
    return api.get(`/piani-alimentazione/${id}`);
  }

  async insertPianoAlimentazione(data) {
    if (this.isLocalAvailable()) {
      return localDataService.insertPianoAlimentazione(data);
    }
    return api.post('/piani-alimentazione', data);
  }

  async updatePianoAlimentazione(id, updates) {
    if (this.isLocalAvailable()) {
      return localDataService.updatePianoAlimentazione(id, updates);
    }
    return api.put(`/piani-alimentazione/${id}`, updates);
  }

  async deletePianoAlimentazione(id) {
    if (this.isLocalAvailable()) {
      return localDataService.deletePianoAlimentazione(id);
    }
    return api.delete(`/piani-alimentazione/${id}`);
  }

  async getComposizioniPiano(pianoId) {
    if (this.isLocalAvailable()) {
      return localDataService.getComposizioniPiano(pianoId);
    }
    return api.get('/composizioni-piano', { piano_alimentazione_id: pianoId });
  }

  async insertComposizionePiano(data) {
    if (this.isLocalAvailable()) {
      return localDataService.insertComposizionePiano(data);
    }
    return api.post('/composizioni-piano', data);
  }

  async updateComposizionePiano(id, updates) {
    if (this.isLocalAvailable()) {
      return localDataService.updateComposizionePiano(id, updates);
    }
    return api.put(`/composizioni-piano/${id}`, updates);
  }

  async deleteComposizionePiano(id) {
    if (this.isLocalAvailable()) {
      return localDataService.deleteComposizionePiano(id);
    }
    return api.delete(`/composizioni-piano/${id}`);
  }

  // ============================================
  // REGISTRO ALIMENTAZIONE - CRUD COMPLETO
  // ============================================

  async getRegistroAlimentazione(filters = {}) {
    if (this.isLocalAvailable()) {
      return localDataService.getRegistroAlimentazione(filters);
    }
    return api.get('/registro-alimentazione', filters);
  }

  async getVoceRegistro(id) {
    if (this.isLocalAvailable()) {
      return localDataService.getVoceRegistro(id);
    }
    return api.get(`/registro-alimentazione/${id}`);
  }

  async insertVoceRegistro(data) {
    if (this.isLocalAvailable()) {
      return localDataService.insertVoceRegistro(data);
    }
    return api.post('/registro-alimentazione', data);
  }

  async updateVoceRegistro(id, updates) {
    if (this.isLocalAvailable()) {
      return localDataService.updateVoceRegistro(id, updates);
    }
    return api.put(`/registro-alimentazione/${id}`, updates);
  }

  async deleteVoceRegistro(id) {
    if (this.isLocalAvailable()) {
      return localDataService.deleteVoceRegistro(id);
    }
    return api.delete(`/registro-alimentazione/${id}`);
  }

  // ============================================
  // DDT - CRUD COMPLETO
  // ============================================

  async getDdt(filters = {}) {
    if (this.isLocalAvailable()) {
      return localDataService.getDdt(filters);
    }
    return api.get('/ddt', filters);
  }

  async getDdtById(id) {
    if (this.isLocalAvailable()) {
      return localDataService.getDdtById(id);
    }
    return api.get(`/ddt/${id}`);
  }

  async insertDdt(data) {
    if (this.isLocalAvailable()) {
      return localDataService.insertDdt(data);
    }
    return api.post('/ddt', data);
  }

  async updateDdt(id, updates) {
    if (this.isLocalAvailable()) {
      return localDataService.updateDdt(id, updates);
    }
    return api.put(`/ddt/${id}`, updates);
  }

  async deleteDdt(id) {
    if (this.isLocalAvailable()) {
      return localDataService.deleteDdt(id);
    }
    return api.delete(`/ddt/${id}`);
  }

  async getDdtRighe(ddtId) {
    if (this.isLocalAvailable()) {
      return localDataService.getDdtRighe(ddtId);
    }
    return api.get(`/ddt/${ddtId}/righe`);
  }

  async insertDdtRiga(data) {
    if (this.isLocalAvailable()) {
      return localDataService.insertDdtRiga(data);
    }
    return api.post('/ddt-righe', data);
  }

  async updateDdtRiga(id, updates) {
    if (this.isLocalAvailable()) {
      return localDataService.updateDdtRiga(id, updates);
    }
    return api.put(`/ddt-righe/${id}`, updates);
  }

  async deleteDdtRiga(id) {
    if (this.isLocalAvailable()) {
      return localDataService.deleteDdtRiga(id);
    }
    return api.delete(`/ddt-righe/${id}`);
  }

  // ============================================
  // MAGAZZINO MOVIMENTI - CRUD COMPLETO
  // ============================================

  async getMagazzinoMovimenti(filters = {}) {
    if (this.isLocalAvailable()) {
      return localDataService.getMagazzinoMovimenti(filters);
    }
    return api.get('/magazzino/movimenti', filters);
  }

  async insertMagazzinoMovimento(data) {
    if (this.isLocalAvailable()) {
      return localDataService.insertMagazzinoMovimento(data);
    }
    return api.post('/magazzino/movimenti', data);
  }

  async updateMagazzinoMovimento(id, updates) {
    if (this.isLocalAvailable()) {
      return localDataService.updateMagazzinoMovimento(id, updates);
    }
    return api.put(`/magazzino/movimenti/${id}`, updates);
  }

  async deleteMagazzinoMovimento(id) {
    if (this.isLocalAvailable()) {
      return localDataService.deleteMagazzinoMovimento(id);
    }
    return api.delete(`/magazzino/movimenti/${id}`);
  }

  // ============================================
  // MOVIMENTAZIONI ANIMALI
  // ============================================

  async getMovimentazioni(filters = {}) {
    if (this.isLocalAvailable()) {
      return localDataService.getMovimentazioni(filters);
    }
    return api.get('/allevamento/movimentazioni', filters);
  }

  async insertMovimentazione(data) {
    if (this.isLocalAvailable()) {
      return localDataService.insertMovimentazione(data);
    }
    return api.post('/allevamento/movimentazioni', data);
  }

  // ============================================
  // LOTTI FARMACO - CRUD COMPLETO
  // ============================================

  async getLottiFarmaco(filters = {}) {
    if (this.isLocalAvailable()) {
      return localDataService.getLottiFarmaco(filters);
    }
    return api.get('/sanitario/lotti-farmaco', filters);
  }

  async getLottoFarmaco(id) {
    if (this.isLocalAvailable()) {
      return localDataService.getLottoFarmaco(id);
    }
    return api.get(`/sanitario/lotti-farmaco/${id}`);
  }

  async insertLottoFarmaco(data) {
    if (this.isLocalAvailable()) {
      return localDataService.insertLottoFarmaco(data);
    }
    return api.post('/sanitario/lotti-farmaco', data);
  }

  async updateLottoFarmaco(id, updates) {
    if (this.isLocalAvailable()) {
      return localDataService.updateLottoFarmaco(id, updates);
    }
    return api.put(`/sanitario/lotti-farmaco/${id}`, updates);
  }

  async deleteLottoFarmaco(id) {
    if (this.isLocalAvailable()) {
      return localDataService.deleteLottoFarmaco(id);
    }
    return api.delete(`/sanitario/lotti-farmaco/${id}`);
  }

  // ============================================
  // LAVORAZIONI TERRENO - CRUD COMPLETO
  // ============================================

  async getLavorazioni(filters = {}) {
    if (this.isLocalAvailable()) {
      return localDataService.getLavorazioni(filters);
    }
    return api.get('/terreni/lavorazioni', filters);
  }

  async insertLavorazione(data) {
    if (this.isLocalAvailable()) {
      return localDataService.insertLavorazione(data);
    }
    return api.post('/terreni/lavorazioni', data);
  }

  async updateLavorazione(id, updates) {
    if (this.isLocalAvailable()) {
      return localDataService.updateLavorazione(id, updates);
    }
    return api.put(`/terreni/lavorazioni/${id}`, updates);
  }

  async deleteLavorazione(id) {
    if (this.isLocalAvailable()) {
      return localDataService.deleteLavorazione(id);
    }
    return api.delete(`/terreni/lavorazioni/${id}`);
  }

  // ============================================
  // RACCOLTI TERRENO - CRUD COMPLETO
  // ============================================

  async getRaccolti(filters = {}) {
    if (this.isLocalAvailable()) {
      return localDataService.getRaccolti(filters);
    }
    return api.get('/terreni/raccolti', filters);
  }

  async insertRaccolto(data) {
    if (this.isLocalAvailable()) {
      return localDataService.insertRaccolto(data);
    }
    return api.post('/terreni/raccolti', data);
  }

  async updateRaccolto(id, updates) {
    if (this.isLocalAvailable()) {
      return localDataService.updateRaccolto(id, updates);
    }
    return api.put(`/terreni/raccolti/${id}`, updates);
  }

  async deleteRaccolto(id) {
    if (this.isLocalAvailable()) {
      return localDataService.deleteRaccolto(id);
    }
    return api.delete(`/terreni/raccolti/${id}`);
  }

  async getTerrenoRiepilogo(terrenoId) {
    if (this.isLocalAvailable()) {
      return localDataService.getTerrenoRiepilogo(terrenoId);
    }
    return api.get(`/terreni/${terrenoId}/riepilogo`);
  }

  // ============================================
  // CICLI TERRENO - CRUD COMPLETO
  // ============================================

  async getCicli(filters = {}) {
    if (this.isLocalAvailable()) {
      return localDataService.getCicli(filters);
    }
    // Backend usa path parameter: /{terreno_id}/cicli
    const { terreno_id, ...otherFilters } = filters;
    if (!terreno_id) {
      console.warn('[HybridDataService] getCicli chiamato senza terreno_id');
      return [];
    }
    return api.get(`/terreni/${terreno_id}/cicli`, otherFilters);
  }

  async getCiclo(id) {
    if (this.isLocalAvailable()) {
      return localDataService.getCiclo(id);
    }
    return api.get(`/terreni/cicli/${id}`);
  }

  async insertCiclo(data) {
    if (this.isLocalAvailable()) {
      return localDataService.insertCiclo(data);
    }
    return api.post('/terreni/cicli', data);
  }

  async updateCiclo(id, updates) {
    if (this.isLocalAvailable()) {
      return localDataService.updateCiclo(id, updates);
    }
    return api.put(`/terreni/cicli/${id}`, updates);
  }

  async deleteCiclo(id) {
    if (this.isLocalAvailable()) {
      return localDataService.deleteCiclo(id);
    }
    return api.delete(`/terreni/cicli/${id}`);
  }

  async insertCicloFase(cicloId, data) {
    if (this.isLocalAvailable()) {
      return localDataService.insertCicloFase({ ...data, ciclo_id: cicloId });
    }
    return api.post(`/terreni/cicli/${cicloId}/fasi`, data);
  }

  async updateCicloFase(faseId, updates) {
    if (this.isLocalAvailable()) {
      return localDataService.updateCicloFase(faseId, updates);
    }
    return api.put(`/terreni/cicli/fasi/${faseId}`, updates);
  }

  async deleteCicloFase(faseId) {
    if (this.isLocalAvailable()) {
      return localDataService.deleteCicloFase(faseId);
    }
    return api.delete(`/terreni/cicli/fasi/${faseId}`);
  }

  async insertCicloCosto(cicloId, data) {
    if (this.isLocalAvailable()) {
      return localDataService.insertCicloCosto({ ...data, ciclo_id: cicloId });
    }
    return api.post(`/terreni/cicli/${cicloId}/costi`, data);
  }

  async updateCicloCosto(costoId, updates) {
    if (this.isLocalAvailable()) {
      return localDataService.updateCicloCosto(costoId, updates);
    }
    return api.put(`/terreni/cicli/costi/${costoId}`, updates);
  }

  async deleteCicloCosto(costoId) {
    if (this.isLocalAvailable()) {
      return localDataService.deleteCicloCosto(costoId);
    }
    return api.delete(`/terreni/cicli/costi/${costoId}`);
  }

  // ============================================
  // SCADENZE ATTREZZATURE - CRUD COMPLETO
  // ============================================

  async getScadenzeAttrezzatura(attrezzaturaId) {
    if (this.isLocalAvailable()) {
      return localDataService.getScadenzeAttrezzatura(attrezzaturaId);
    }
    return api.get(`/amministrazione/attrezzature/${attrezzaturaId}/scadenze`);
  }

  async insertScadenzaAttrezzatura(attrezzaturaId, data) {
    if (this.isLocalAvailable()) {
      return localDataService.insertScadenzaAttrezzatura({ ...data, attrezzatura_id: attrezzaturaId });
    }
    return api.post(`/amministrazione/attrezzature/${attrezzaturaId}/scadenze`, data);
  }

  async updateScadenzaAttrezzatura(id, updates) {
    if (this.isLocalAvailable()) {
      return localDataService.updateScadenzaAttrezzatura(id, updates);
    }
    return api.put(`/amministrazione/scadenze-attrezzature/${id}`, updates);
  }

  async deleteScadenzaAttrezzatura(id) {
    if (this.isLocalAvailable()) {
      return localDataService.deleteScadenzaAttrezzatura(id);
    }
    return api.delete(`/amministrazione/scadenze-attrezzature/${id}`);
  }

  // ============================================
  // AMMORTAMENTI - CRUD COMPLETO
  // ============================================

  async getAmmortamenti(filters = {}) {
    if (this.isLocalAvailable()) {
      return localDataService.getAmmortamenti(filters);
    }
    return api.get('/amministrazione/ammortamenti', filters);
  }

  async insertAmmortamento(attrezzaturaId, data) {
    if (this.isLocalAvailable()) {
      return localDataService.insertAmmortamento({ ...data, attrezzatura_id: attrezzaturaId });
    }
    return api.post(`/amministrazione/attrezzature/${attrezzaturaId}/ammortamenti`, data);
  }

  async updateAmmortamento(id, updates) {
    if (this.isLocalAvailable()) {
      return localDataService.updateAmmortamento(id, updates);
    }
    return api.put(`/amministrazione/ammortamenti/${id}`, updates);
  }

  async deleteAmmortamento(id) {
    if (this.isLocalAvailable()) {
      return localDataService.deleteAmmortamento(id);
    }
    return api.delete(`/amministrazione/ammortamenti/${id}`);
  }

  // ============================================
  // OPERAZIONI SEMPRE ONLINE
  // Queste richiedono il backend per funzionalità specifiche
  // ============================================

  /**
   * Generazione PDF - SEMPRE ONLINE
   * Richiede librerie server-side
   */
  async generatePianoUscitaPDF(animaleIds) {
    return api.post('/allevamento/piano-uscita/pdf', 
      { animale_ids: animaleIds }, 
      { responseType: 'blob' }
    );
  }

  /**
   * Import XML fatture - SEMPRE ONLINE
   * Parsing complesso lato server
   */
  async importFattureXML(file, options = {}) {
    const formData = new FormData();
    formData.append('file', file);
    const params = new URLSearchParams();
    if (options.skipDuplicates !== undefined) {
      params.append('skip_duplicates', options.skipDuplicates);
    }
    return api.post(`/amministrazione/import/fatture-xml?${params}`, formData);
  }

  /**
   * Report allevamento - SEMPRE ONLINE
   * Aggregazioni complesse
   */
  async getReportAllevamento(params = {}) {
    return api.get('/amministrazione/report/allevamento', params, { responseType: 'blob' });
  }

  /**
   * Report prima nota - SEMPRE ONLINE
   */
  async getReportPrimaNota(params = {}) {
    return api.get('/amministrazione/report/prima-nota/dare-avere', params, { responseType: 'blob' });
  }

  /**
   * Sincronizzazione anagrafe - SEMPRE ONLINE
   * Upload file + processing
   */
  async sincronizzaAnagrafe(file, aziendaId) {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/amministrazione/sincronizza-anagrafe?azienda_id=${aziendaId}`, formData);
  }

  /**
   * Statistiche batch - PREFERISCE ONLINE per dati freschi
   * Ma può fallback a locale se offline
   */
  async getHomeStatsBatch(aziendaId) {
    try {
      // Prova online per dati freschi
      return await api.get('/statistiche/home-batch', { azienda_id: aziendaId });
    } catch (error) {
      // Se offline, calcola localmente
      if (this.isLocalAvailable()) {
        return this._calculateLocalStats(aziendaId);
      }
      throw error;
    }
  }

  /**
   * Calcola statistiche localmente
   * @private
   */
  async _calculateLocalStats(aziendaId) {
    const animali = await localDataService.getAnimali({ azienda_id: aziendaId });
    
    // Conta per stato
    const animaliStato = {};
    let presenti = 0;
    for (const a of animali) {
      const stato = a.stato || 'sconosciuto';
      animaliStato[stato] = (animaliStato[stato] || 0) + 1;
      if (stato === 'presente') presenti++;
    }

    const terreni = await localDataService.getTerreni({ azienda_id: aziendaId });
    const attrezzature = await localDataService.getAttrezzature({ azienda_id: aziendaId });
    const assicurazioni = await localDataService.getAssicurazioni({ azienda_id: aziendaId });

    const oggi = new Date().toISOString().split('T')[0];
    const fra30g = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const assicScadute = assicurazioni.filter(a => a.data_scadenza < oggi).length;
    const assicInScadenza = assicurazioni.filter(a => 
      a.data_scadenza >= oggi && a.data_scadenza <= fra30g
    ).length;

    return {
      animali_stato: animaliStato,
      animali_presenti: presenti,
      terreni: {
        numero: terreni.length,
        superficie_ha: terreni.reduce((sum, t) => sum + (t.superficie || 0), 0),
      },
      attrezzature: attrezzature.length,
      assicurazioni: {
        scadute: assicScadute,
        in_scadenza: assicInScadenza,
      },
      _source: 'local', // Indica che i dati vengono dal database locale
    };
  }

  // ============================================
  // NOTIFICHE - CALCOLO LOCALE VELOCE
  // ============================================

  /**
   * Ottiene tutte le notifiche importanti (polizze, fatture, etc.)
   * Usa database locale per performance ottimali (< 5ms)
   */
  async getNotifiche(aziendaId) {
    if (this.isLocalAvailable()) {
      try {
        const oggi = new Date().toISOString().split('T')[0];
        const scadenza30g = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const notifiche = [];

        // Carica tutti i dati necessari in parallelo
        // Gestisce il caso in cui alcune tabelle potrebbero non esistere nel database locale
        let attrezzature, scadenze, polizzeAttrezzature, assicurazioniAziendali, fatture;
        
        try {
          [
            attrezzature,
            scadenze,
            polizzeAttrezzature,
            assicurazioniAziendali,
            fatture
          ] = await Promise.all([
            localDataService.getAttrezzature({ azienda_id: aziendaId }).catch(() => []),
            localDataService.select('scadenze_attrezzature', { deleted_at: null }).catch(() => []),
            localDataService.select('polizze_attrezzature', { 
              azienda_id: aziendaId, 
              attiva: true, 
              deleted_at: null 
            }).catch(() => []), // Se la tabella non esiste, usa array vuoto
            localDataService.getAssicurazioni({ azienda_id: aziendaId }).catch(() => []),
            localDataService.getFatture({ azienda_id: aziendaId }).catch(() => [])
          ]);
        } catch (error) {
          // Se c'è un errore generale, fallback all'API online
          console.warn('[HybridDataService] Errore nel caricamento dati locali per notifiche, fallback a API:', error);
          return api.get('/statistiche/notifiche', { azienda_id: aziendaId });
        }
        
        // Assicura che tutti siano array
        attrezzature = attrezzature || [];
        scadenze = scadenze || [];
        polizzeAttrezzature = polizzeAttrezzature || [];
        assicurazioniAziendali = assicurazioniAziendali || [];
        fatture = fatture || [];

        // Crea mappa attrezzature per lookup veloce
        const attrezzatureMap = new Map();
        attrezzature.forEach(att => attrezzatureMap.set(att.id, att));

        // Filtra scadenze per azienda e tipo assicurazione
        const scadenzeAssicurazioni = scadenze.filter(s => {
          const attrezzatura = attrezzatureMap.get(s.attrezzatura_id);
          return attrezzatura && s.tipo === 'assicurazione' && !s.deleted_at;
        });

        // Polizze attrezzature scadute (legacy: ScadenzaAttrezzatura)
        scadenzeAssicurazioni.forEach(scadenza => {
          const attrezzatura = attrezzatureMap.get(scadenza.attrezzatura_id);
          if (!attrezzatura) return;

          const giorniScaduti = Math.floor((new Date(oggi) - new Date(scadenza.data_scadenza)) / (1000 * 60 * 60 * 24));
          const giorniAllaScadenza = Math.floor((new Date(scadenza.data_scadenza) - new Date(oggi)) / (1000 * 60 * 60 * 24));

          if (scadenza.data_scadenza < oggi) {
            notifiche.push({
              tipo: 'polizza_attrezzatura',
              id: scadenza.id,
              tipo_record: 'scadenza_legacy',
              titolo: `Assicurazione ${attrezzatura.nome || 'Attrezzatura'} scaduta`,
              descrizione: `Polizza ${scadenza.numero_polizza || 'N/A'} scaduta da ${giorniScaduti} giorni`,
              data_scadenza: scadenza.data_scadenza,
              urgenza: 'scaduta',
              link: {
                modulo: 'attrezzatura',
                tipo: 'scadenza',
                id: scadenza.id,
                attrezzatura_id: scadenza.attrezzatura_id
              }
            });
          } else if (scadenza.data_scadenza >= oggi && scadenza.data_scadenza <= scadenza30g) {
            notifiche.push({
              tipo: 'polizza_attrezzatura',
              id: scadenza.id,
              tipo_record: 'scadenza_legacy',
              titolo: `Assicurazione ${attrezzatura.nome || 'Attrezzatura'} in scadenza`,
              descrizione: `Polizza ${scadenza.numero_polizza || 'N/A'} scade tra ${giorniAllaScadenza} giorni`,
              data_scadenza: scadenza.data_scadenza,
              urgenza: 'in_scadenza',
              link: {
                modulo: 'attrezzatura',
                tipo: 'scadenza',
                id: scadenza.id,
                attrezzatura_id: scadenza.attrezzatura_id
              }
            });
          }
        });

        // Polizze attrezzature (nuovo sistema)
        polizzeAttrezzature.forEach(polizza => {
          const attrezzatura = attrezzatureMap.get(polizza.attrezzatura_id);
          const attrezzaturaNome = attrezzatura?.nome || 'Attrezzatura';
          const giorniScaduti = Math.floor((new Date(oggi) - new Date(polizza.data_scadenza)) / (1000 * 60 * 60 * 24));
          const giorniAllaScadenza = Math.floor((new Date(polizza.data_scadenza) - new Date(oggi)) / (1000 * 60 * 60 * 24));

          if (polizza.data_scadenza < oggi) {
            notifiche.push({
              tipo: 'polizza_attrezzatura',
              id: polizza.id,
              tipo_record: 'polizza',
              titolo: `Polizza ${attrezzaturaNome} scaduta`,
              descrizione: `${polizza.tipo_polizza || 'Polizza'} - ${polizza.numero_polizza || 'N/A'} scaduta da ${giorniScaduti} giorni`,
              data_scadenza: polizza.data_scadenza,
              urgenza: 'scaduta',
              link: {
                modulo: 'attrezzatura',
                tipo: 'polizza',
                id: polizza.id,
                attrezzatura_id: polizza.attrezzatura_id
              }
            });
          } else if (polizza.data_scadenza >= oggi && polizza.data_scadenza <= scadenza30g) {
            notifiche.push({
              tipo: 'polizza_attrezzatura',
              id: polizza.id,
              tipo_record: 'polizza',
              titolo: `Polizza ${attrezzaturaNome} in scadenza`,
              descrizione: `${polizza.tipo_polizza || 'Polizza'} - ${polizza.numero_polizza || 'N/A'} scade tra ${giorniAllaScadenza} giorni`,
              data_scadenza: polizza.data_scadenza,
              urgenza: 'in_scadenza',
              link: {
                modulo: 'attrezzatura',
                tipo: 'polizza',
                id: polizza.id,
                attrezzatura_id: polizza.attrezzatura_id
              }
            });
          }
        });

        // Polizze aziendali
        assicurazioniAziendali.forEach(polizza => {
          if (polizza.deleted_at) return;
          const giorniScaduti = Math.floor((new Date(oggi) - new Date(polizza.data_scadenza)) / (1000 * 60 * 60 * 24));
          const giorniAllaScadenza = Math.floor((new Date(polizza.data_scadenza) - new Date(oggi)) / (1000 * 60 * 60 * 24));

          if (polizza.data_scadenza < oggi) {
            notifiche.push({
              tipo: 'polizza_aziendale',
              id: polizza.id,
              tipo_record: 'assicurazione_aziendale',
              titolo: `Polizza aziendale ${polizza.tipo || 'N/A'} scaduta`,
              descrizione: `${polizza.numero_polizza || 'N/A'} - ${polizza.compagnia || 'N/A'} scaduta da ${giorniScaduti} giorni`,
              data_scadenza: polizza.data_scadenza,
              urgenza: 'scaduta',
              link: {
                modulo: 'allevamento',
                tipo: 'assicurazione_aziendale',
                id: polizza.id
              }
            });
          } else if (polizza.data_scadenza >= oggi && polizza.data_scadenza <= scadenza30g) {
            notifiche.push({
              tipo: 'polizza_aziendale',
              id: polizza.id,
              tipo_record: 'assicurazione_aziendale',
              titolo: `Polizza aziendale ${polizza.tipo || 'N/A'} in scadenza`,
              descrizione: `${polizza.numero_polizza || 'N/A'} - ${polizza.compagnia || 'N/A'} scade tra ${giorniAllaScadenza} giorni`,
              data_scadenza: polizza.data_scadenza,
              urgenza: 'in_scadenza',
              link: {
                modulo: 'allevamento',
                tipo: 'assicurazione_aziendale',
                id: polizza.id
              }
            });
          }
        });

        // Fatture
        fatture.forEach(fattura => {
          if (fattura.deleted_at) return;

          // Fatture scadute
          if (fattura.data_scadenza && fattura.data_scadenza < oggi) {
            const giorniScaduti = Math.floor((new Date(oggi) - new Date(fattura.data_scadenza)) / (1000 * 60 * 60 * 24));
            notifiche.push({
              tipo: 'fattura',
              id: fattura.id,
              tipo_record: 'fattura_scaduta',
              titolo: `Fattura ${fattura.numero || 'N/A'} scaduta`,
              descrizione: `Fattura da ${fattura.fornitore_nome || 'N/A'} scaduta da ${giorniScaduti} giorni - €${parseFloat(fattura.importo_totale || 0).toFixed(2)}`,
              data_scadenza: fattura.data_scadenza,
              urgenza: 'scaduta',
              link: {
                modulo: 'amministrazione',
                tipo: 'fattura',
                id: fattura.id
              }
            });
          }
          // Fatture in scadenza (30 giorni) - solo da pagare o parziali
          else if (fattura.data_scadenza && fattura.data_scadenza >= oggi && fattura.data_scadenza <= scadenza30g) {
            if (fattura.stato_pagamento === 'da_pagare' || fattura.stato_pagamento === 'parziale') {
              const giorniAllaScadenza = Math.floor((new Date(fattura.data_scadenza) - new Date(oggi)) / (1000 * 60 * 60 * 24));
              notifiche.push({
                tipo: 'fattura',
                id: fattura.id,
                tipo_record: 'fattura_in_scadenza',
                titolo: `Fattura ${fattura.numero || 'N/A'} in scadenza`,
                descrizione: `Fattura da ${fattura.fornitore_nome || 'N/A'} scade tra ${giorniAllaScadenza} giorni - €${parseFloat(fattura.importo_totale || 0).toFixed(2)}`,
                data_scadenza: fattura.data_scadenza,
                urgenza: 'in_scadenza',
                link: {
                  modulo: 'amministrazione',
                  tipo: 'fattura',
                  id: fattura.id
                }
              });
            }
          }
          // Fatture senza categoria
          if ((!fattura.categoria || fattura.categoria === '') && !fattura.categoria_id) {
            notifiche.push({
              tipo: 'fattura',
              id: fattura.id,
              tipo_record: 'fattura_senza_categoria',
              titolo: `Fattura ${fattura.numero || 'N/A'} senza categoria`,
              descrizione: `Fattura da ${fattura.fornitore_nome || 'N/A'} richiede classificazione - €${parseFloat(fattura.importo_totale || 0).toFixed(2)}`,
              data_scadenza: null,
              urgenza: 'info',
              link: {
                modulo: 'amministrazione',
                tipo: 'fattura',
                id: fattura.id
              }
            });
          }
        });

        // Ordina notifiche per urgenza (scaduta > in_scadenza > info) e data (più recenti prima)
        const urgenzaOrder = { scaduta: 0, in_scadenza: 1, info: 2 };
        notifiche.sort((a, b) => {
          const orderA = urgenzaOrder[a.urgenza] || 99;
          const orderB = urgenzaOrder[b.urgenza] || 99;
          if (orderA !== orderB) return orderA - orderB;
          // Per data_scadenza: ordine decrescente (più recenti prima)
          // Converte le date in formato comparabile e inverte l'ordine
          const dateA = a.data_scadenza || '0000-01-01';
          const dateB = b.data_scadenza || '0000-01-01';
          return dateB.localeCompare(dateA);
        });

        return {
          notifiche,
          total: notifiche.length,
          _source: 'local' // Indica che i dati vengono dal database locale
        };
      } catch (error) {
        console.error('Errore nel calcolo notifiche locali:', error);
        // Fallback a API online in caso di errore
        return api.get('/statistiche/notifiche', { azienda_id: aziendaId });
      }
    }
    // Fallback: usa API online
    return api.get('/statistiche/notifiche', { azienda_id: aziendaId });
  }

  // ============================================
  // SYNC
  // ============================================

  /**
   * Trigger sync manuale
   */
  async triggerSync() {
    return localDataService.triggerSync();
  }

  /**
   * Sync iniziale
   */
  async initialSync(aziendaId) {
    return localDataService.initialSync(aziendaId);
  }

  /**
   * Imposta token auth per sync
   */
  async setAuthToken(token) {
    return localDataService.setAuthToken(token);
  }

  /**
   * Ottieni stato sync
   */
  async getSyncStatus() {
    return localDataService.getSyncStatus();
  }

  /**
   * Reset sync e forza full sync completa
   * Utile dopo operazioni di pulizia database
   */
  async resetSync(aziendaId) {
    return localDataService.resetSync(aziendaId);
  }
}

// Singleton
const hybridDataService = new HybridDataService();

export default hybridDataService;

