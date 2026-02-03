/**
 * Configurazione delle statistiche disponibili per la dashboard
 */
export const STATISTICHE_CONFIG = {
  // Animali
  animali_arrivati: {
    id: 'animali_arrivati',
    label: 'Animali Arrivati',
    category: 'allevamento',
    icon: '🐄',
    endpoint: 'animali-arrivati',
    options: {
      periodo: { type: 'select', label: 'Periodo', values: ['settimana', 'mese', 'anno', 'sempre'], default: 'sempre' },
      aggregazione: { type: 'select', label: 'Aggregazione', values: ['sede', 'azienda'], default: 'azienda' },
    },
    formatValue: (data) => {
      if (!data) return '0';
      if (data.dati && typeof data.dati === 'object') {
        // Somma tutti i valori, inclusi quelli con chiavi speciali (azienda_X, non_assegnati)
        const total = Object.entries(data.dati).reduce((sum, [key, val]) => {
          // Ignora le chiavi, conta solo i valori
          const num = typeof val === 'number' ? val : parseFloat(val) || 0;
          return sum + num;
        }, 0);
        return total.toString();
      }
      return '0';
    },
  },
  
  animali_presenti: {
    id: 'animali_presenti',
    label: 'Animali Presenti',
    category: 'allevamento',
    icon: '🐄',
    endpoint: 'animali-presenti',
    options: {
      aggregazione: { type: 'select', label: 'Aggregazione', values: ['sede', 'azienda'], default: 'azienda' },
    },
    formatValue: (data) => {
      if (!data) return '0';
      if (data.dati && typeof data.dati === 'object') {
        const total = Object.values(data.dati).reduce((sum, val) => {
          const num = typeof val === 'number' ? val : parseFloat(val) || 0;
          return sum + num;
        }, 0);
        return total.toString();
      }
      return '0';
    },
  },
  
  animali_totali_presenti_azienda: {
    id: 'animali_totali_presenti_azienda',
    label: 'Animali Totali Presenti (per Azienda)',
    category: 'allevamento',
    icon: '🐄',
    endpoint: 'animali-presenti',
    options: {
      aggregazione: { type: 'select', label: 'Aggregazione', values: ['azienda'], default: 'azienda' },
    },
    formatValue: (data) => {
      if (!data) return '0';
      if (data.dati && typeof data.dati === 'object') {
        const total = Object.values(data.dati).reduce((sum, val) => {
          const num = typeof val === 'number' ? val : parseFloat(val) || 0;
          return sum + num;
        }, 0);
        return total.toString();
      }
      return '0';
    },
  },
  
  animali_uscite: {
    id: 'animali_uscite',
    label: 'Animali Usciti',
    category: 'allevamento',
    icon: '🚪',
    endpoint: 'animali-uscite',
    options: {
      periodo: { type: 'select', label: 'Periodo', values: ['settimana', 'mese', 'anno', 'sempre'], default: null },
      aggregazione: { type: 'select', label: 'Aggregazione', values: ['sede', 'azienda'], default: 'azienda' },
    },
    formatValue: (data) => {
      if (!data) return '0';
      if (data.dati && typeof data.dati === 'object') {
        const total = Object.values(data.dati).reduce((sum, val) => {
          const num = typeof val === 'number' ? val : parseFloat(val) || 0;
          return sum + num;
        }, 0);
        return total.toString();
      }
      return '0';
    },
  },
  
  animali_morti: {
    id: 'animali_morti',
    label: 'Animali Morti',
    category: 'allevamento',
    icon: '💀',
    endpoint: 'animali-morti',
    options: {
      aggregazione: { type: 'select', label: 'Aggregazione', values: ['sede', 'azienda'], default: 'azienda' },
    },
    formatValue: (data) => {
      if (!data) return '0';
      if (data.dati && typeof data.dati === 'object') {
        const total = Object.values(data.dati).reduce((sum, val) => {
          const num = typeof val === 'number' ? val : parseFloat(val) || 0;
          return sum + num;
        }, 0);
        return total.toString();
      }
      return '0';
    },
  },
  
  animali_maschi: {
    id: 'animali_maschi',
    label: 'Animali Maschi',
    category: 'allevamento',
    icon: '🐂',
    endpoint: 'animali-per-sesso',
    options: {
      aggregazione: { type: 'select', label: 'Aggregazione', values: ['sede', 'azienda'], default: 'azienda' },
      sesso: { type: 'hidden', value: 'M' },
    },
    formatValue: (data) => {
      if (!data) return '0';
      if (data.dati && typeof data.dati === 'object') {
        const total = Object.values(data.dati).reduce((sum, val) => {
          const num = typeof val === 'number' ? val : parseFloat(val) || 0;
          return sum + num;
        }, 0);
        return total.toString();
      }
      return '0';
    },
  },
  
  animali_femmine: {
    id: 'animali_femmine',
    label: 'Animali Femmine',
    category: 'allevamento',
    icon: '🐄',
    endpoint: 'animali-per-sesso',
    options: {
      aggregazione: { type: 'select', label: 'Aggregazione', values: ['sede', 'azienda'], default: 'azienda' },
      sesso: { type: 'hidden', value: 'F' },
    },
    formatValue: (data) => {
      if (!data) return '0';
      if (data.dati && typeof data.dati === 'object') {
        const total = Object.values(data.dati).reduce((sum, val) => {
          const num = typeof val === 'number' ? val : parseFloat(val) || 0;
          return sum + num;
        }, 0);
        return total.toString();
      }
      return '0';
    },
  },
  
  animali_per_razza: {
    id: 'animali_per_razza',
    label: 'Animali per Razza',
    category: 'allevamento',
    icon: '🐄',
    endpoint: 'animali-per-razza',
    options: {
      aggregazione: { type: 'select', label: 'Aggregazione', values: ['sede', 'azienda'], default: 'azienda' },
      razza: { type: 'text', label: 'Razza (opzionale)', default: '' },
    },
    formatValue: (data) => {
      if (!data || !data.dati) return '0';
      const totalRazze = Object.values(data.dati).reduce((sum, razze) => {
        if (typeof razze === 'object' && razze !== null) {
          return sum + Object.values(razze).reduce((s, v) => {
            const num = typeof v === 'number' ? v : parseFloat(v) || 0;
            return s + num;
          }, 0);
        }
        return sum;
      }, 0);
      return totalRazze.toString();
    },
  },
  
  // Somministrazioni
  somministrazioni_totali: {
    id: 'somministrazioni_totali',
    label: 'Somministrazioni Totali',
    category: 'sanitario',
    icon: '💊',
    endpoint: 'somministrazioni',
    options: {
      periodo: { type: 'select', label: 'Periodo', values: ['totali', 'settimana', 'mese', 'anno', 'sempre'], default: 'totali' },
      aggregazione: { type: 'select', label: 'Aggregazione', values: ['sede', 'azienda'], default: 'azienda' },
      solo_presenti: { type: 'checkbox', label: 'Solo animali presenti', default: false },
    },
    formatValue: (data) => {
      if (!data) return '0';
      if (data.dati && typeof data.dati === 'object') {
        const total = Object.values(data.dati).reduce((sum, val) => {
          const num = typeof val === 'number' ? val : parseFloat(val) || 0;
          return sum + num;
        }, 0);
        return total.toString();
      }
      return '0';
    },
  },
  
  somministrazioni_settimana: {
    id: 'somministrazioni_settimana',
    label: 'Somministrazioni (Settimana)',
    category: 'sanitario',
    icon: '💊',
    endpoint: 'somministrazioni',
    options: {
      periodo: { type: 'select', label: 'Periodo', values: ['settimana', 'mese', 'anno', 'sempre'], default: 'settimana' },
      aggregazione: { type: 'select', label: 'Aggregazione', values: ['sede', 'azienda'], default: 'azienda' },
      solo_presenti: { type: 'checkbox', label: 'Solo animali presenti', default: false },
    },
    formatValue: (data) => {
      if (!data) return '0';
      if (data.dati && typeof data.dati === 'object') {
        const total = Object.values(data.dati).reduce((sum, val) => {
          const num = typeof val === 'number' ? val : parseFloat(val) || 0;
          return sum + num;
        }, 0);
        return total.toString();
      }
      return '0';
    },
  },
  
  somministrazioni_mese: {
    id: 'somministrazioni_mese',
    label: 'Somministrazioni (Mese)',
    category: 'sanitario',
    icon: '💊',
    endpoint: 'somministrazioni',
    options: {
      periodo: { type: 'select', label: 'Periodo', values: ['settimana', 'mese', 'anno', 'sempre'], default: 'mese' },
      aggregazione: { type: 'select', label: 'Aggregazione', values: ['sede', 'azienda'], default: 'azienda' },
      solo_presenti: { type: 'checkbox', label: 'Solo animali presenti', default: false },
    },
    formatValue: (data) => {
      if (!data) return '0';
      if (data.dati && typeof data.dati === 'object') {
        const total = Object.values(data.dati).reduce((sum, val) => {
          const num = typeof val === 'number' ? val : parseFloat(val) || 0;
          return sum + num;
        }, 0);
        return total.toString();
      }
      return '0';
    },
  },
  
  somministrazioni_anno: {
    id: 'somministrazioni_anno',
    label: 'Somministrazioni (Anno)',
    category: 'sanitario',
    icon: '💊',
    endpoint: 'somministrazioni',
    options: {
      periodo: { type: 'select', label: 'Periodo', values: ['settimana', 'mese', 'anno', 'sempre'], default: 'anno' },
      aggregazione: { type: 'select', label: 'Aggregazione', values: ['sede', 'azienda'], default: 'azienda' },
      solo_presenti: { type: 'checkbox', label: 'Solo animali presenti', default: false },
    },
    formatValue: (data) => {
      if (!data) return '0';
      if (data.dati && typeof data.dati === 'object') {
        const total = Object.values(data.dati).reduce((sum, val) => {
          const num = typeof val === 'number' ? val : parseFloat(val) || 0;
          return sum + num;
        }, 0);
        return total.toString();
      }
      return '0';
    },
  },
  
  // Terreni
  terreni_totali: {
    id: 'terreni_totali',
    label: 'Terreni Totali',
    category: 'terreni',
    icon: '🌾',
    endpoint: 'terreni',
    options: {
      aggregazione: { type: 'select', label: 'Aggregazione', values: ['totali'], default: 'totali' },
    },
    formatValue: (data) => {
      if (!data) return '0';
      return (data.numero_terreni || 0).toString();
    },
  },
  
  terreni_per_azienda: {
    id: 'terreni_per_azienda',
    label: 'Terreni per Azienda',
    category: 'terreni',
    icon: '🌾',
    endpoint: 'terreni',
    options: {
      aggregazione: { type: 'select', label: 'Aggregazione', values: ['azienda'], default: 'azienda' },
    },
    formatValue: (data) => {
      if (data.dati) {
        const total = Object.values(data.dati).reduce((sum, val) => sum + val.numero, 0);
        return total.toString();
      }
      return '0';
    },
  },
  
  terreni_coltivati: {
    id: 'terreni_coltivati',
    label: 'Terreni Coltivati',
    category: 'terreni',
    icon: '🌱',
    endpoint: 'terreni-coltivati',
    options: {},
    formatValue: (data) => {
      if (!data) return '0';
      return (data.numero_terreni_coltivati || 0).toString();
    },
  },
  
  terreni_coltivati_campi: {
    id: 'terreni_coltivati_campi',
    label: 'Terreni Coltivati (Campi)',
    category: 'terreni',
    icon: '🌱',
    endpoint: 'terreni-coltivati',
    options: {},
    formatValue: (data) => {
      if (!data) return '0';
      return (data.superficie_campi || 0).toString();
    },
  },
  
  // Fatture e Costi
  fatture_emesse_mese: {
    id: 'fatture_emesse_mese',
    label: 'Fatture Emesse (Mese)',
    category: 'amministrazione',
    icon: '📄',
    endpoint: 'fatture-emesse',
    options: {
      periodo: { type: 'select', label: 'Periodo', values: ['settimana', 'mese', 'anno', 'sempre'], default: 'mese' },
    },
    formatValue: (data) => {
      if (!data) return '0';
      return (data.numero_fatture || 0).toString();
    },
  },
  
  fatture_emesse_anno: {
    id: 'fatture_emesse_anno',
    label: 'Fatture Emesse (Anno)',
    category: 'amministrazione',
    icon: '📄',
    endpoint: 'fatture-emesse',
    options: {
      periodo: { type: 'select', label: 'Periodo', values: ['settimana', 'mese', 'anno', 'sempre'], default: 'anno' },
    },
    formatValue: (data) => {
      if (!data) return '0';
      return (data.numero_fatture || 0).toString();
    },
  },
  
  totale_incassato_mese: {
    id: 'totale_incassato_mese',
    label: 'Totale Incassato (Mese)',
    category: 'amministrazione',
    icon: '💰',
    endpoint: 'fatture-emesse',
    options: {
      periodo: { type: 'select', label: 'Periodo', values: ['settimana', 'mese', 'anno', 'sempre'], default: 'mese' },
    },
    formatValue: (data) => {
      if (!data || !data.totale_incassato) return '€ 0,00';
      const tot = typeof data.totale_incassato === 'number' ? data.totale_incassato : parseFloat(data.totale_incassato) || 0;
      return `€ ${tot.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    },
  },
  
  totale_incassato_anno: {
    id: 'totale_incassato_anno',
    label: 'Totale Incassato (Anno)',
    category: 'amministrazione',
    icon: '💰',
    endpoint: 'fatture-emesse',
    options: {
      periodo: { type: 'select', label: 'Periodo', values: ['settimana', 'mese', 'anno', 'sempre'], default: 'anno' },
    },
    formatValue: (data) => {
      if (!data || !data.totale_incassato) return '€ 0,00';
      const tot = typeof data.totale_incassato === 'number' ? data.totale_incassato : parseFloat(data.totale_incassato) || 0;
      return `€ ${tot.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    },
  },
  
  costi_totali_mese: {
    id: 'costi_totali_mese',
    label: 'Costi Totali (Mese)',
    category: 'amministrazione',
    icon: '💸',
    endpoint: 'costi',
    options: {
      periodo: { type: 'select', label: 'Periodo', values: ['settimana', 'mese', 'anno', 'sempre'], default: 'mese' },
      per_categoria: { type: 'checkbox', label: 'Per categoria', default: false },
    },
    formatValue: (data) => {
      if (!data || !data.totale) return '€ 0,00';
      const tot = typeof data.totale === 'number' ? data.totale : parseFloat(data.totale) || 0;
      return `€ ${tot.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    },
  },
  
  costi_totali_anno: {
    id: 'costi_totali_anno',
    label: 'Costi Totali (Anno)',
    category: 'amministrazione',
    icon: '💸',
    endpoint: 'costi',
    options: {
      periodo: { type: 'select', label: 'Periodo', values: ['settimana', 'mese', 'anno', 'sempre'], default: 'anno' },
      per_categoria: { type: 'checkbox', label: 'Per categoria', default: false },
    },
    formatValue: (data) => {
      if (!data || !data.totale) return '€ 0,00';
      const tot = typeof data.totale === 'number' ? data.totale : parseFloat(data.totale) || 0;
      return `€ ${tot.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    },
  },
  
  fatture_scadute: {
    id: 'fatture_scadute',
    label: 'Fatture Scadute',
    category: 'amministrazione',
    icon: '⏰',
    endpoint: 'fatture-scadute',
    options: {},
    formatValue: (data) => {
      if (!data) return '0';
      return (data.numero_fatture || 0).toString();
    },
  },
  
  // Altri
  ultima_sync_anagrafe: {
    id: 'ultima_sync_anagrafe',
    label: 'Ultima Sync Anagrafe',
    category: 'amministrazione',
    icon: '🔄',
    endpoint: 'ultima-sync-anagrafe',
    options: {},
    formatValue: (data) => {
      if (!data || !data.ultima_sync) return 'Mai';
      try {
        const date = new Date(data.ultima_sync);
        if (isNaN(date.getTime())) return 'Mai';
        return date.toLocaleDateString('it-IT');
      } catch (e) {
        return 'Mai';
      }
    },
  },
  
  assicurazioni_scadute: {
    id: 'assicurazioni_scadute',
    label: 'Assicurazioni Scadute',
    category: 'amministrazione',
    icon: '📋',
    endpoint: 'assicurazioni-scadenze',
    options: {},
    formatValue: (data) => {
      if (!data) return '0';
      return (data.scadute || 0).toString();
    },
  },
  
  assicurazioni_in_scadenza: {
    id: 'assicurazioni_in_scadenza',
    label: 'Assicurazioni in Scadenza',
    category: 'amministrazione',
    icon: '📋',
    endpoint: 'assicurazioni-scadenze',
    options: {},
    formatValue: (data) => {
      if (!data) return '0';
      return (data.in_scadenza || 0).toString();
    },
  },
  
  revisioni_scadute: {
    id: 'revisioni_scadute',
    label: 'Revisioni Scadute',
    category: 'attrezzatura',
    icon: '🔧',
    endpoint: 'revisioni-scadenze',
    options: {},
    formatValue: (data) => {
      if (!data) return '0';
      return (data.scadute || 0).toString();
    },
  },
  
  revisioni_in_scadenza: {
    id: 'revisioni_in_scadenza',
    label: 'Revisioni in Scadenza',
    category: 'attrezzatura',
    icon: '🔧',
    endpoint: 'revisioni-scadenze',
    options: {},
    formatValue: (data) => {
      if (!data) return '0';
      return (data.in_scadenza || 0).toString();
    },
  },
};

// Statistiche semplici (senza opzioni)
export const STATISTICHE_SEMPLICI = {
  animali_totali: {
    id: 'animali_totali',
    label: 'Animali Totali',
    category: 'allevamento',
    icon: '🐄',
  },
  aziende: {
    id: 'aziende',
    label: 'Aziende',
    category: 'allevamento',
    icon: '🏢',
  },
  sedi: {
    id: 'sedi',
    label: 'Sedi',
    category: 'allevamento',
    icon: '📍',
  },
  fatture_ricevute: {
    id: 'fatture_ricevute',
    label: 'Fatture Ricevute',
    category: 'amministrazione',
    icon: '📥',
  },
  terreni: {
    id: 'terreni',
    label: 'Terreni',
    category: 'terreni',
    icon: '🌾',
  },
  fornitori: {
    id: 'fornitori',
    label: 'Fornitori',
    category: 'amministrazione',
    icon: '👥',
  },
  attrezzature: {
    id: 'attrezzature',
    label: 'Attrezzature',
    category: 'attrezzatura',
    icon: '🔧',
  },
  farmaci: {
    id: 'farmaci',
    label: 'Farmaci',
    category: 'sanitario',
    icon: '💊',
  },
};

