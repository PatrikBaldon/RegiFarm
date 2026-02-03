/**
 * attrezzaturaService - API service for attrezzatura module
 * Usa hybridDataService per letture (database locale) e API per scritture/operazioni speciali
 */
import api from '../../../services/api';
import hybridDataService from '../../../services/hybridDataService';

export const attrezzaturaService = {
  // Attrezzature - usa database locale per letture
  getAttrezzature: async (aziendaId, filters = {}) => 
    hybridDataService.getAttrezzature({ azienda_id: aziendaId, ...filters }),
  getAttrezzatura: async (id) => hybridDataService.getAttrezzatura(id),
  createAttrezzatura: async (data) => hybridDataService.insertAttrezzatura(data),
  updateAttrezzatura: async (id, data) => hybridDataService.updateAttrezzatura(id, data),
  deleteAttrezzatura: async (id) => hybridDataService.deleteAttrezzatura(id),

  // Scadenze Attrezzature
  getScadenzeAttrezzatura: async (attrezzaturaId, filters = {}) => 
    hybridDataService.getScadenzeAttrezzatura(attrezzaturaId),
  createScadenzaAttrezzatura: async (attrezzaturaId, data) => 
    hybridDataService.insertScadenzaAttrezzatura(attrezzaturaId, data),
  updateScadenzaAttrezzatura: async (id, data) => 
    hybridDataService.updateScadenzaAttrezzatura(id, data),
  deleteScadenzaAttrezzatura: async (id) => 
    hybridDataService.deleteScadenzaAttrezzatura(id),

  // Ammortamenti
  getAmmortamentiAttrezzatura: async (attrezzaturaId, filters = {}) => 
    hybridDataService.getAmmortamenti({ attrezzatura_id: attrezzaturaId, ...filters }),
  createAmmortamento: async (attrezzaturaId, data) => 
    hybridDataService.insertAmmortamento(attrezzaturaId, data),
  updateAmmortamento: async (id, data) => 
    hybridDataService.updateAmmortamento(id, data),
  deleteAmmortamento: async (id) => 
    hybridDataService.deleteAmmortamento(id),
};

