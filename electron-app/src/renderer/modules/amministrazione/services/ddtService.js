/**
 * Service for DDT Emessi (Documenti di Trasporto) API calls
 */
import api from '../../../services/api';

export const ddtService = {
  // Get all DDT emessi
  getDDT: async (params = {}) => {
    const queryParams = {
      skip: params.skip || 0,
      limit: params.limit || 1000,
      azienda_id: params.azienda_id || null,
      cliente_id: params.cliente_id || null,
      data_da: params.data_da || null,
      data_a: params.data_a || null,
    };
    return api.get('/amministrazione/ddt-emessi', queryParams);
  },

  // Get single DDT
  getDDTById: async (id) => {
    return api.get(`/amministrazione/ddt-emessi/${id}`);
  },

  // Create DDT
  createDDT: async (data, numero_progressivo = null) => {
    const params = numero_progressivo ? { numero_progressivo } : {};
    return api.post('/amministrazione/ddt-emessi', data, { params });
  },

  // Update DDT
  updateDDT: async (id, data) => {
    return api.put(`/amministrazione/ddt-emessi/${id}`, data);
  },

  // Delete DDT
  deleteDDT: async (id) => {
    return api.delete(`/amministrazione/ddt-emessi/${id}`);
  },

  // Get next DDT number
  getNextDDTNumber: async (azienda_id, anno = null, numero_progressivo = null) => {
    const params = {
      azienda_id,
      ...(anno !== null && { anno }),
      ...(numero_progressivo !== null && { numero_progressivo }),
    };
    return api.get('/amministrazione/ddt-emessi/next-number', params);
  },

  // Download PDF
  downloadPDF: async (id) => {
    const response = await api.get(`/amministrazione/ddt-emessi/${id}/pdf`, {}, {
      responseType: 'blob',
    });
    return response;
  },
};

export default ddtService;

