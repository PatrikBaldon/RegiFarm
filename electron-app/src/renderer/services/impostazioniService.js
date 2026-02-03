import api from './api';

export const impostazioniService = {
  getImpostazioni: (aziendaId) => {
    if (!aziendaId) {
      throw new Error('aziendaId è obbligatorio per recuperare le impostazioni');
    }
    return api.get('/impostazioni/', { azienda_id: aziendaId });
  },
  saveImpostazioni: (data, aziendaId) => {
    if (!aziendaId) {
      throw new Error('aziendaId è obbligatorio per salvare le impostazioni');
    }
    return api.put('/impostazioni/', data, { params: { azienda_id: aziendaId } });
  },
};

