/**
 * Service for Statistiche API calls
 */
import api from './api';

export const statisticheService = {
  // Endpoint batch ottimizzati - riducono latenza
  getHomeStatsBatch: (aziendaId) =>
    api.get('/statistiche/home-batch', { azienda_id: aziendaId }),
  
  getAllevamentoBatch: (aziendaId) =>
    api.get('/statistiche/allevamento-batch', { azienda_id: aziendaId }),
  
  getAlimentazioneBatch: (aziendaId) =>
    api.get('/statistiche/alimentazione-batch', { azienda_id: aziendaId }),
  
  getAmministrazioneBatch: (aziendaId) =>
    api.get('/statistiche/amministrazione-batch', { azienda_id: aziendaId }),

  // Animali
  getAnimaliArrivati: (periodo, aggregazione, aziendaId, sedeId) =>
    api.get('/statistiche/animali-arrivati', { periodo, aggregazione, azienda_id: aziendaId, sede_id: sedeId }),

  getAnimaliPresenti: (aggregazione, aziendaId, sedeId) =>
    api.get('/statistiche/animali-presenti', { aggregazione, azienda_id: aziendaId, sede_id: sedeId }),

  getAnimaliPerStato: (aggregazione = 'azienda', aziendaId, sedeId) =>
    api.get('/statistiche/animali-stato', { aggregazione, azienda_id: aziendaId, sede_id: sedeId }),

  getAnimaliUsciti: (aggregazione, periodo, aziendaId, sedeId) =>
    api.get('/statistiche/animali-uscite', { aggregazione, periodo, azienda_id: aziendaId, sede_id: sedeId }),

  getAnimaliMorti: (aggregazione, aziendaId, sedeId) =>
    api.get('/statistiche/animali-morti', { aggregazione, azienda_id: aziendaId, sede_id: sedeId }),

  getAnimaliPerSesso: (aggregazione, sesso, aziendaId, sedeId) =>
    api.get('/statistiche/animali-per-sesso', { aggregazione, sesso, azienda_id: aziendaId, sede_id: sedeId }),

  getAnimaliPerRazza: (aggregazione, razza, aziendaId, sedeId) =>
    api.get('/statistiche/animali-per-razza', { aggregazione, razza, azienda_id: aziendaId, sede_id: sedeId }),

  // Somministrazioni
  getSomministrazioni: (periodo, soloPresenti, aggregazione, aziendaId, sedeId) =>
    api.get('/statistiche/somministrazioni', { periodo, solo_presenti: soloPresenti, aggregazione, azienda_id: aziendaId, sede_id: sedeId }),

  // Terreni
  getTerreniStats: (aggregazione, aziendaId) =>
    api.get('/statistiche/terreni', { aggregazione, azienda_id: aziendaId }),

  getTerreniColtivati: () =>
    api.get('/statistiche/terreni-coltivati'),

  // Fatture e Costi
  getFattureEmesse: (periodo) =>
    api.get('/statistiche/fatture-emesse', { periodo }),

  getCosti: (periodo, perCategoria) =>
    api.get('/statistiche/costi', { periodo, per_categoria: perCategoria }),

  getFattureScadute: () =>
    api.get('/statistiche/fatture-scadute'),

  // Altri
  getUltimaSyncAnagrafe: () =>
    api.get('/statistiche/ultima-sync-anagrafe'),

  getAssicurazioniScadenze: () =>
    api.get('/statistiche/assicurazioni-scadenze'),

  getRevisioniScadenze: () =>
    api.get('/statistiche/revisioni-scadenze'),

  getNotifiche: (aziendaId) =>
    api.get('/statistiche/notifiche', { azienda_id: aziendaId }),
};

