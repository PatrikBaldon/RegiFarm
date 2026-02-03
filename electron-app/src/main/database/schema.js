/**
 * Schema del Database Locale SQLite
 * 
 * Questo schema replica le tabelle principali di Supabase per permettere
 * operazioni offline e ridurre drasticamente la latenza delle letture.
 * 
 * Ogni tabella ha campi aggiuntivi per la sincronizzazione:
 * - synced_at: timestamp dell'ultima sincronizzazione
 * - sync_status: 'synced' | 'pending' | 'conflict' | 'error'
 * - local_updated_at: timestamp dell'ultima modifica locale
 */

const SCHEMA_VERSION = 9; // Incrementato per aggiungere deleted_at a cicli_terreno_fasi e cicli_terreno_costi

/**
 * Schema SQL per creare tutte le tabelle
 */
const CREATE_TABLES_SQL = `
-- ============================================
-- TABELLE DI SISTEMA
-- ============================================

-- Metadati del database locale
CREATE TABLE IF NOT EXISTS _meta (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Log delle sincronizzazioni
CREATE TABLE IF NOT EXISTS _sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL, -- 'insert', 'update', 'delete'
  record_id INTEGER,
  data TEXT, -- JSON dei dati
  status TEXT DEFAULT 'pending', -- 'pending', 'synced', 'error'
  error_message TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  synced_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_log_status ON _sync_log(status);
CREATE INDEX IF NOT EXISTS idx_sync_log_table ON _sync_log(table_name);

-- ============================================
-- AZIENDE E STRUTTURE
-- ============================================

CREATE TABLE IF NOT EXISTS aziende (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  codice_fiscale TEXT,
  partita_iva TEXT,
  indirizzo TEXT,
  indirizzo_cap TEXT,
  indirizzo_comune TEXT,
  indirizzo_provincia TEXT,
  indirizzo_nazione TEXT,
  telefono TEXT,
  email TEXT,
  pec TEXT,
  codice_sdi TEXT,
  rea_ufficio TEXT,
  rea_numero TEXT,
  rea_capitale_sociale TEXT,
  referente_nome TEXT,
  referente_email TEXT,
  referente_telefono TEXT,
  sito_web TEXT,
  iban TEXT,
  logo_storage_path TEXT,
  logo_public_url TEXT,
  supabase_user_id TEXT,
  veterinario_id INTEGER,
  ultima_sync_anagrafe TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  -- Campi sync
  synced_at TEXT,
  sync_status TEXT DEFAULT 'synced',
  local_updated_at TEXT
);

CREATE TABLE IF NOT EXISTS sedi (
  id INTEGER PRIMARY KEY,
  azienda_id INTEGER NOT NULL,
  nome TEXT NOT NULL,
  codice_stalla TEXT,
  indirizzo TEXT,
  cap TEXT,
  citta TEXT,
  provincia TEXT,
  latitudine REAL,
  longitudine REAL,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  -- Campi sync
  synced_at TEXT,
  sync_status TEXT DEFAULT 'synced',
  local_updated_at TEXT,
  FOREIGN KEY (azienda_id) REFERENCES aziende(id)
);

CREATE INDEX IF NOT EXISTS idx_sedi_azienda ON sedi(azienda_id);
CREATE INDEX IF NOT EXISTS idx_sedi_codice_stalla ON sedi(codice_stalla);

CREATE TABLE IF NOT EXISTS stabilimenti (
  id INTEGER PRIMARY KEY,
  sede_id INTEGER NOT NULL,
  nome TEXT NOT NULL,
  tipo TEXT,
  capacita_totale INTEGER,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  -- Campi sync
  synced_at TEXT,
  sync_status TEXT DEFAULT 'synced',
  local_updated_at TEXT,
  FOREIGN KEY (sede_id) REFERENCES sedi(id)
);

CREATE INDEX IF NOT EXISTS idx_stabilimenti_sede ON stabilimenti(sede_id);

CREATE TABLE IF NOT EXISTS box (
  id INTEGER PRIMARY KEY,
  stabilimento_id INTEGER NOT NULL,
  nome TEXT NOT NULL,
  capacita INTEGER DEFAULT 50,
  stato TEXT DEFAULT 'libero',
  note TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  -- Campi sync
  synced_at TEXT,
  sync_status TEXT DEFAULT 'synced',
  local_updated_at TEXT,
  FOREIGN KEY (stabilimento_id) REFERENCES stabilimenti(id)
);

CREATE INDEX IF NOT EXISTS idx_box_stabilimento ON box(stabilimento_id);
CREATE INDEX IF NOT EXISTS idx_box_stato ON box(stato);

-- ============================================
-- ANIMALI
-- ============================================

CREATE TABLE IF NOT EXISTS animali (
  id INTEGER PRIMARY KEY,
  azienda_id INTEGER NOT NULL,
  box_id INTEGER,
  auricolare TEXT,
  specie TEXT,
  razza TEXT,
  sesso TEXT,
  data_nascita TEXT,
  codice_elettronico TEXT,
  codice_madre TEXT,
  codice_assegnato_precedenza TEXT,
  codice_azienda_anagrafe TEXT,
  codice_provenienza TEXT,
  identificativo_fiscale_provenienza TEXT,
  specie_allevata_provenienza TEXT,
  motivo_ingresso TEXT,
  data_arrivo TEXT,
  peso_arrivo REAL,
  numero_modello_ingresso TEXT,
  data_modello_ingresso TEXT,
  tipo_allevamento TEXT,
  peso_attuale REAL,
  data_ultima_pesata TEXT,
  stato TEXT DEFAULT 'presente',
  motivo_uscita TEXT,
  data_uscita TEXT,
  numero_modello_uscita TEXT,
  data_modello_uscita TEXT,
  codice_azienda_destinazione TEXT,
  codice_fiera_destinazione TEXT,
  codice_stato_destinazione TEXT,
  regione_macello_destinazione TEXT,
  codice_macello_destinazione TEXT,
  codice_pascolo_destinazione TEXT,
  codice_circo_destinazione TEXT,
  data_macellazione TEXT,
  abbattimento TEXT,
  data_provvvedimento TEXT,
  data_inserimento_box TEXT,
  contratto_soccida_id INTEGER,
  origine_dati TEXT,
  ultima_sync_anagrafe TEXT,
  data_estrazione_dati_anagrafe TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  -- Campi sync
  synced_at TEXT,
  sync_status TEXT DEFAULT 'synced',
  local_updated_at TEXT,
  FOREIGN KEY (azienda_id) REFERENCES aziende(id),
  FOREIGN KEY (box_id) REFERENCES box(id)
);

CREATE INDEX IF NOT EXISTS idx_animali_azienda ON animali(azienda_id);
CREATE INDEX IF NOT EXISTS idx_animali_stato ON animali(stato);
CREATE INDEX IF NOT EXISTS idx_animali_box ON animali(box_id);
CREATE INDEX IF NOT EXISTS idx_animali_auricolare ON animali(auricolare);
CREATE INDEX IF NOT EXISTS idx_animali_codice_elettronico ON animali(codice_elettronico);
CREATE INDEX IF NOT EXISTS idx_animali_codice_azienda ON animali(codice_azienda_anagrafe);
CREATE INDEX IF NOT EXISTS idx_animali_sync ON animali(sync_status);

-- ============================================
-- AMMINISTRAZIONE
-- ============================================

CREATE TABLE IF NOT EXISTS fornitori (
  id INTEGER PRIMARY KEY,
  azienda_id INTEGER,
  nome TEXT NOT NULL,
  partita_iva TEXT,
  indirizzo TEXT,
  indirizzo_cap TEXT,
  indirizzo_comune TEXT,
  indirizzo_provincia TEXT,
  indirizzo_nazione TEXT,
  telefono TEXT,
  email TEXT,
  pec TEXT,
  fax TEXT,
  regime_fiscale TEXT,
  rea_ufficio TEXT,
  rea_numero TEXT,
  rea_capitale_sociale TEXT,
  note TEXT,
  is_fornitore INTEGER DEFAULT 1,
  is_cliente INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  -- Campi sync
  synced_at TEXT,
  sync_status TEXT DEFAULT 'synced',
  local_updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_fornitori_azienda ON fornitori(azienda_id);
CREATE INDEX IF NOT EXISTS idx_fornitori_nome ON fornitori(nome);

CREATE TABLE IF NOT EXISTS fatture_amministrazione (
  id INTEGER PRIMARY KEY,
  azienda_id INTEGER,
  fornitore_id INTEGER,
  cliente_id INTEGER,
  cliente_nome TEXT,
  cliente_piva TEXT,
  cliente_cf TEXT,
  numero TEXT,
  data_fattura TEXT,
  data_registrazione TEXT,
  data_scadenza TEXT,
  tipo TEXT, -- 'entrata', 'uscita'
  tipo_documento TEXT,
  divisa TEXT DEFAULT 'EUR',
  importo_totale REAL,
  importo_iva REAL,
  importo_netto REAL,
  importo_pagato REAL DEFAULT 0,
  importo_incassato REAL DEFAULT 0,
  stato_pagamento TEXT DEFAULT 'da_pagare',
  data_pagamento TEXT,
  data_incasso TEXT,
  condizioni_pagamento TEXT,
  categoria TEXT,
  macrocategoria TEXT,
  sottocategoria TEXT,
  terreno_id INTEGER,
  attrezzatura_id INTEGER,
  contratto_soccida_id INTEGER,
  periodo_da TEXT,
  periodo_a TEXT,
  periodo_attribuzione TEXT,
  descrizione TEXT,
  note TEXT,
  file_url TEXT,
  allegato_path TEXT,
  dati_xml TEXT, -- JSON
  xml_raw TEXT,
  righe TEXT, -- JSON array delle righe di dettaglio
  pagamenti_programmati TEXT, -- JSON array dei pagamenti programmati
  linee TEXT, -- JSON array delle linee (relazione normalizzata)
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  -- Campi sync
  synced_at TEXT,
  sync_status TEXT DEFAULT 'synced',
  local_updated_at TEXT,
  FOREIGN KEY (azienda_id) REFERENCES aziende(id),
  FOREIGN KEY (fornitore_id) REFERENCES fornitori(id),
  FOREIGN KEY (cliente_id) REFERENCES fornitori(id),
  FOREIGN KEY (terreno_id) REFERENCES terreni(id),
  FOREIGN KEY (attrezzatura_id) REFERENCES attrezzature(id),
  FOREIGN KEY (contratto_soccida_id) REFERENCES contratti_soccida(id)
);

CREATE INDEX IF NOT EXISTS idx_fatture_azienda ON fatture_amministrazione(azienda_id);
CREATE INDEX IF NOT EXISTS idx_fatture_fornitore ON fatture_amministrazione(fornitore_id);
CREATE INDEX IF NOT EXISTS idx_fatture_tipo ON fatture_amministrazione(tipo);
CREATE INDEX IF NOT EXISTS idx_fatture_data ON fatture_amministrazione(data_fattura);

CREATE TABLE IF NOT EXISTS partite_animali (
  id INTEGER PRIMARY KEY,
  azienda_id INTEGER,
  tipo TEXT NOT NULL, -- 'ingresso', 'uscita'
  data TEXT,
  numero_partita TEXT,
  codice_stalla TEXT,
  nome_stalla TEXT,
  codice_stalla_azienda TEXT,
  numero_capi INTEGER,
  peso_totale REAL,
  peso_medio REAL,
  modalita_gestione TEXT,
  costo_unitario REAL,
  valore_totale REAL,
  pesi_individuali TEXT, -- JSON
  file_anagrafe_origine TEXT,
  data_importazione TEXT,
  motivo TEXT,
  numero_modello TEXT,
  is_trasferimento_interno INTEGER DEFAULT 0,
  fattura_amministrazione_id INTEGER,
  fattura_emessa_id INTEGER,
  contratto_soccida_id INTEGER,
  note TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  -- Campi sync
  synced_at TEXT,
  sync_status TEXT DEFAULT 'synced',
  local_updated_at TEXT,
  FOREIGN KEY (azienda_id) REFERENCES aziende(id)
);

CREATE INDEX IF NOT EXISTS idx_partite_azienda ON partite_animali(azienda_id);
CREATE INDEX IF NOT EXISTS idx_partite_tipo ON partite_animali(tipo);

CREATE TABLE IF NOT EXISTS partite_animali_animali (
  id INTEGER PRIMARY KEY,
  partita_animale_id INTEGER NOT NULL,
  animale_id INTEGER NOT NULL,
  peso REAL,
  valore REAL,
  created_at TEXT,
  -- Campi sync
  synced_at TEXT,
  sync_status TEXT DEFAULT 'synced',
  FOREIGN KEY (partita_animale_id) REFERENCES partite_animali(id),
  FOREIGN KEY (animale_id) REFERENCES animali(id)
);

CREATE INDEX IF NOT EXISTS idx_partite_animali_rel ON partite_animali_animali(partita_animale_id, animale_id);

-- ============================================
-- ALIMENTAZIONE
-- ============================================

CREATE TABLE IF NOT EXISTS componenti_alimentari (
  id INTEGER PRIMARY KEY,
  azienda_id INTEGER,
  nome TEXT NOT NULL,
  tipo TEXT,
  unita_misura TEXT,
  prezzo_unitario REAL,
  fornitore_id INTEGER,
  note TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  -- Campi sync
  synced_at TEXT,
  sync_status TEXT DEFAULT 'synced',
  local_updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_componenti_azienda ON componenti_alimentari(azienda_id);

CREATE TABLE IF NOT EXISTS mangimi_confezionati (
  id INTEGER PRIMARY KEY,
  azienda_id INTEGER,
  nome TEXT NOT NULL,
  produttore TEXT,
  codice TEXT,
  prezzo_unitario REAL,
  unita_misura TEXT,
  fornitore_id INTEGER,
  note TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  -- Campi sync
  synced_at TEXT,
  sync_status TEXT DEFAULT 'synced',
  local_updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_mangimi_azienda ON mangimi_confezionati(azienda_id);

-- ============================================
-- SANITARIO
-- ============================================

CREATE TABLE IF NOT EXISTS farmaci (
  id INTEGER PRIMARY KEY,
  azienda_id INTEGER,
  nome TEXT NOT NULL,
  principio_attivo TEXT,
  tipo TEXT,
  unita_misura TEXT,
  tempo_sospensione_carne INTEGER,
  tempo_sospensione_latte INTEGER,
  fornitore_id INTEGER,
  note TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  -- Campi sync
  synced_at TEXT,
  sync_status TEXT DEFAULT 'synced',
  local_updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_farmaci_azienda ON farmaci(azienda_id);

CREATE TABLE IF NOT EXISTS somministrazioni (
  id INTEGER PRIMARY KEY,
  animale_id INTEGER NOT NULL,
  farmaco_id INTEGER,
  data_somministrazione TEXT,
  dose REAL,
  unita_misura TEXT,
  via_somministrazione TEXT,
  motivo TEXT,
  veterinario TEXT,
  note TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  -- Campi sync
  synced_at TEXT,
  sync_status TEXT DEFAULT 'synced',
  local_updated_at TEXT,
  FOREIGN KEY (animale_id) REFERENCES animali(id),
  FOREIGN KEY (farmaco_id) REFERENCES farmaci(id)
);

CREATE INDEX IF NOT EXISTS idx_somministrazioni_animale ON somministrazioni(animale_id);
CREATE INDEX IF NOT EXISTS idx_somministrazioni_data ON somministrazioni(data_somministrazione);

-- ============================================
-- TERRENI
-- ============================================

CREATE TABLE IF NOT EXISTS terreni (
  id INTEGER PRIMARY KEY,
  azienda_id INTEGER,
  denominazione TEXT NOT NULL,
  localita TEXT,
  superficie REAL,
  unita_misura TEXT DEFAULT 'ha',
  di_proprieta INTEGER DEFAULT 1,
  in_affitto INTEGER DEFAULT 0,
  canone_mensile REAL,
  canone_annuale REAL,
  fattura_id INTEGER,
  note TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  -- Campi sync
  synced_at TEXT,
  sync_status TEXT DEFAULT 'synced',
  local_updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_terreni_azienda ON terreni(azienda_id);

-- ============================================
-- ATTREZZATURE
-- ============================================

CREATE TABLE IF NOT EXISTS attrezzature (
  id INTEGER PRIMARY KEY,
  azienda_id INTEGER,
  nome TEXT NOT NULL,
  tipo TEXT,
  marca TEXT,
  modello TEXT,
  matricola TEXT,
  anno_acquisto INTEGER,
  valore_acquisto REAL,
  fornitore_id INTEGER,
  note TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  -- Campi sync
  synced_at TEXT,
  sync_status TEXT DEFAULT 'synced',
  local_updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_attrezzature_azienda ON attrezzature(azienda_id);

CREATE TABLE IF NOT EXISTS scadenze_attrezzature (
  id INTEGER PRIMARY KEY,
  attrezzatura_id INTEGER NOT NULL,
  tipo TEXT NOT NULL,
  descrizione TEXT NOT NULL,
  data_scadenza TEXT NOT NULL,
  data_ultimo_rinnovo TEXT,
  costo REAL,
  numero_polizza TEXT,
  note TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  -- Campi sync
  synced_at TEXT,
  sync_status TEXT DEFAULT 'synced',
  local_updated_at TEXT,
  FOREIGN KEY (attrezzatura_id) REFERENCES attrezzature(id)
);

CREATE INDEX IF NOT EXISTS idx_scadenze_attrezzatura ON scadenze_attrezzature(attrezzatura_id);
CREATE INDEX IF NOT EXISTS idx_scadenze_data ON scadenze_attrezzature(data_scadenza);

-- ============================================
-- ASSICURAZIONI
-- ============================================

CREATE TABLE IF NOT EXISTS assicurazioni_aziendali (
  id INTEGER PRIMARY KEY,
  azienda_id INTEGER,
  tipo TEXT,
  compagnia TEXT,
  numero_polizza TEXT,
  data_inizio TEXT,
  data_scadenza TEXT,
  premio_annuale REAL,
  massimale REAL,
  note TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  -- Campi sync
  synced_at TEXT,
  sync_status TEXT DEFAULT 'synced',
  local_updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_assicurazioni_azienda ON assicurazioni_aziendali(azienda_id);
CREATE INDEX IF NOT EXISTS idx_assicurazioni_scadenza ON assicurazioni_aziendali(data_scadenza);

-- ============================================
-- CONTRATTI SOCCIDA
-- ============================================

CREATE TABLE IF NOT EXISTS contratti_soccida (
  id INTEGER PRIMARY KEY,
  azienda_id INTEGER,
  soccidante_id INTEGER,
  numero_contratto TEXT,
  soccidante_nome TEXT,
  soccidante_piva TEXT,
  data_inizio TEXT,
  data_fine TEXT,
  tipologia TEXT,
  modalita_remunerazione TEXT,
  monetizzata INTEGER DEFAULT 1,
  specie_bestiame TEXT,
  numero_capi_previsti INTEGER,
  direzione_tecnica_soccidante INTEGER DEFAULT 1,
  quota_giornaliera REAL,
  prezzo_per_kg REAL,
  percentuale_remunerazione REAL,
  percentuale_soccidante REAL,
  percentuale_riparto_base REAL,
  percentuale_aggiunta_arrivo REAL DEFAULT 0,
  percentuale_sottrazione_uscita REAL DEFAULT 0,
  tipo_allevamento TEXT,
  prezzo_allevamento REAL,
  bonus_mortalita_attivo INTEGER DEFAULT 0,
  bonus_mortalita_percentuale REAL,
  bonus_incremento_attivo INTEGER DEFAULT 0,
  bonus_incremento_kg_soglia REAL,
  bonus_incremento_percentuale REAL,
  mangimi_a_carico_soccidante INTEGER DEFAULT 0,
  medicinali_a_carico_soccidante INTEGER DEFAULT 0,
  quota_decesso_tipo TEXT,
  quota_decesso_valore REAL,
  termine_responsabilita_soccidario_giorni INTEGER,
  copertura_totale_soccidante INTEGER DEFAULT 0,
  franchigia_mortalita_giorni INTEGER,
  traccia_iva_indetraibile INTEGER DEFAULT 1,
  data_prima_consegna TEXT,
  rinnovo_per_consegna INTEGER DEFAULT 1,
  preavviso_disdetta_giorni INTEGER DEFAULT 90,
  giorni_gestione_previsti INTEGER,
  scenario_ripartizione TEXT,
  note TEXT,
  condizioni_particolari TEXT,
  attivo INTEGER DEFAULT 1,
  stato TEXT DEFAULT 'attivo',
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  -- Campi sync
  synced_at TEXT,
  sync_status TEXT DEFAULT 'synced',
  local_updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_contratti_azienda ON contratti_soccida(azienda_id);
CREATE INDEX IF NOT EXISTS idx_contratti_stato ON contratti_soccida(stato);

-- ============================================
-- IMPOSTAZIONI
-- ============================================

CREATE TABLE IF NOT EXISTS impostazioni (
  id INTEGER PRIMARY KEY,
  azienda_id INTEGER,
  chiave TEXT NOT NULL,
  valore TEXT,
  created_at TEXT,
  updated_at TEXT,
  -- Campi sync
  synced_at TEXT,
  sync_status TEXT DEFAULT 'synced',
  local_updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_impostazioni_azienda ON impostazioni(azienda_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_impostazioni_unique ON impostazioni(azienda_id, chiave);

-- ============================================
-- PRIMA NOTA (Nuova struttura)
-- ============================================

CREATE TABLE IF NOT EXISTS pn_conti (
  id INTEGER PRIMARY KEY,
  azienda_id INTEGER NOT NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'cassa',
  saldo_iniziale REAL NOT NULL DEFAULT 0,
  saldo_attuale REAL NOT NULL DEFAULT 0,
  attivo INTEGER NOT NULL DEFAULT 1,
  note TEXT,
  giroconto_strategia TEXT NOT NULL DEFAULT 'automatico',
  created_at TEXT,
  updated_at TEXT,
  -- Campi sync
  synced_at TEXT,
  sync_status TEXT DEFAULT 'synced',
  local_updated_at TEXT,
  FOREIGN KEY (azienda_id) REFERENCES aziende(id)
);

CREATE INDEX IF NOT EXISTS idx_pn_conti_azienda ON pn_conti(azienda_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pn_conti_unique ON pn_conti(azienda_id, nome);

CREATE TABLE IF NOT EXISTS pn_preferenze (
  id INTEGER PRIMARY KEY,
  azienda_id INTEGER NOT NULL UNIQUE,
  conto_predefinito_id INTEGER,
  conto_incassi_id INTEGER,
  conto_pagamenti_id INTEGER,
  conto_debiti_fornitori_id INTEGER,
  conto_crediti_clienti_id INTEGER,
  created_at TEXT,
  updated_at TEXT,
  -- Campi sync
  synced_at TEXT,
  sync_status TEXT DEFAULT 'synced',
  local_updated_at TEXT,
  FOREIGN KEY (azienda_id) REFERENCES aziende(id),
  FOREIGN KEY (conto_predefinito_id) REFERENCES pn_conti(id),
  FOREIGN KEY (conto_incassi_id) REFERENCES pn_conti(id),
  FOREIGN KEY (conto_pagamenti_id) REFERENCES pn_conti(id),
  FOREIGN KEY (conto_debiti_fornitori_id) REFERENCES pn_conti(id),
  FOREIGN KEY (conto_crediti_clienti_id) REFERENCES pn_conti(id)
);

CREATE INDEX IF NOT EXISTS idx_pn_preferenze_azienda ON pn_preferenze(azienda_id);

CREATE TABLE IF NOT EXISTS pn_categorie (
  id INTEGER PRIMARY KEY,
  azienda_id INTEGER,
  nome TEXT NOT NULL,
  codice TEXT,
  tipo_operazione TEXT NOT NULL,
  descrizione TEXT,
  ordine INTEGER DEFAULT 0,
  attiva INTEGER DEFAULT 1,
  creata_dal_sistema INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  -- Campi sync
  synced_at TEXT,
  sync_status TEXT DEFAULT 'synced',
  local_updated_at TEXT,
  FOREIGN KEY (azienda_id) REFERENCES aziende(id)
);

CREATE INDEX IF NOT EXISTS idx_pn_categorie_azienda ON pn_categorie(azienda_id);

CREATE TABLE IF NOT EXISTS pn_conti_iban (
  id INTEGER PRIMARY KEY,
  conto_id INTEGER NOT NULL,
  iban TEXT NOT NULL,
  descrizione TEXT,
  predefinito INTEGER DEFAULT 0,
  attivo INTEGER DEFAULT 1,
  created_at TEXT,
  updated_at TEXT,
  -- Campi sync
  synced_at TEXT,
  sync_status TEXT DEFAULT 'synced',
  local_updated_at TEXT,
  FOREIGN KEY (conto_id) REFERENCES pn_conti(id)
);

CREATE INDEX IF NOT EXISTS idx_pn_conti_iban_conto ON pn_conti_iban(conto_id);

CREATE TABLE IF NOT EXISTS pn_movimenti (
  id INTEGER PRIMARY KEY,
  azienda_id INTEGER NOT NULL,
  conto_id INTEGER NOT NULL,
  conto_destinazione_id INTEGER,
  categoria_id INTEGER,
  tipo_operazione TEXT NOT NULL,
  stato TEXT NOT NULL DEFAULT 'definitivo',
  origine TEXT NOT NULL DEFAULT 'manuale',
  data TEXT NOT NULL,
  descrizione TEXT NOT NULL,
  note TEXT,
  importo REAL NOT NULL,
  quota_extra REAL,
  contropartita_nome TEXT,
  metodo_pagamento TEXT,
  documento_riferimento TEXT,
  riferimento_esterno TEXT,
  fattura_emessa_id INTEGER,
  fattura_amministrazione_id INTEGER,
  pagamento_id INTEGER,
  partita_id INTEGER,
  attrezzatura_id INTEGER,
  contratto_soccida_id INTEGER,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  -- Campi sync
  synced_at TEXT,
  sync_status TEXT DEFAULT 'synced',
  local_updated_at TEXT,
  FOREIGN KEY (azienda_id) REFERENCES aziende(id),
  FOREIGN KEY (conto_id) REFERENCES pn_conti(id),
  FOREIGN KEY (conto_destinazione_id) REFERENCES pn_conti(id),
  FOREIGN KEY (categoria_id) REFERENCES pn_categorie(id)
);

CREATE INDEX IF NOT EXISTS idx_pn_movimenti_azienda ON pn_movimenti(azienda_id);
CREATE INDEX IF NOT EXISTS idx_pn_movimenti_conto ON pn_movimenti(conto_id);
CREATE INDEX IF NOT EXISTS idx_pn_movimenti_data ON pn_movimenti(data);
CREATE INDEX IF NOT EXISTS idx_pn_movimenti_deleted ON pn_movimenti(deleted_at);

-- ============================================
-- ALIMENTAZIONE - Piani e Registro
-- ============================================

CREATE TABLE IF NOT EXISTS piani_alimentazione (
  id INTEGER PRIMARY KEY,
  azienda_id INTEGER NOT NULL,
  nome TEXT NOT NULL,
  descrizione TEXT,
  tipo_allevamento TEXT,
  versione TEXT,
  validita_da TEXT,
  validita_a TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  -- Campi sync
  synced_at TEXT,
  sync_status TEXT DEFAULT 'synced',
  local_updated_at TEXT,
  FOREIGN KEY (azienda_id) REFERENCES aziende(id)
);

CREATE INDEX IF NOT EXISTS idx_piani_azienda ON piani_alimentazione(azienda_id);

CREATE TABLE IF NOT EXISTS composizione_piano (
  id INTEGER PRIMARY KEY,
  piano_alimentazione_id INTEGER NOT NULL,
  componente_alimentare_id INTEGER,
  mangime_confezionato_id INTEGER,
  quantita REAL NOT NULL,
  ordine INTEGER,
  tipo_fornitura TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  -- Campi sync
  synced_at TEXT,
  sync_status TEXT DEFAULT 'synced',
  local_updated_at TEXT,
  FOREIGN KEY (piano_alimentazione_id) REFERENCES piani_alimentazione(id),
  FOREIGN KEY (componente_alimentare_id) REFERENCES componenti_alimentari(id),
  FOREIGN KEY (mangime_confezionato_id) REFERENCES mangimi_confezionati(id)
);

CREATE INDEX IF NOT EXISTS idx_composizione_piano ON composizione_piano(piano_alimentazione_id);

CREATE TABLE IF NOT EXISTS registro_alimentazione (
  id INTEGER PRIMARY KEY,
  azienda_id INTEGER NOT NULL,
  box_id INTEGER,
  data TEXT,
  razione_id INTEGER,
  note TEXT,
  quantita_totale REAL,
  target_tipo TEXT,
  target_id INTEGER,
  tipo_alimento TEXT,
  componente_alimentare_id INTEGER,
  mangime_confezionato_id INTEGER,
  numero_capi INTEGER,
  quota_per_capo REAL,
  giorni_permanenza_min INTEGER,
  giorni_permanenza_max INTEGER,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  -- Campi sync
  synced_at TEXT,
  sync_status TEXT DEFAULT 'synced',
  local_updated_at TEXT,
  FOREIGN KEY (azienda_id) REFERENCES aziende(id),
  FOREIGN KEY (box_id) REFERENCES box(id),
  FOREIGN KEY (razione_id) REFERENCES piani_alimentazione(id),
  FOREIGN KEY (componente_alimentare_id) REFERENCES componenti_alimentari(id),
  FOREIGN KEY (mangime_confezionato_id) REFERENCES mangimi_confezionati(id)
);

CREATE INDEX IF NOT EXISTS idx_registro_azienda ON registro_alimentazione(azienda_id);
CREATE INDEX IF NOT EXISTS idx_registro_data ON registro_alimentazione(data);
CREATE INDEX IF NOT EXISTS idx_registro_box ON registro_alimentazione(box_id);

CREATE TABLE IF NOT EXISTS registro_alimentazione_dettagli (
  id INTEGER PRIMARY KEY,
  registro_id INTEGER NOT NULL,
  componente_alimentare_id INTEGER,
  mangime_confezionato_id INTEGER,
  quantita REAL NOT NULL,
  ordine INTEGER,
  created_at TEXT,
  updated_at TEXT,
  -- Campi sync
  synced_at TEXT,
  sync_status TEXT DEFAULT 'synced',
  FOREIGN KEY (registro_id) REFERENCES registro_alimentazione(id),
  FOREIGN KEY (componente_alimentare_id) REFERENCES componenti_alimentari(id),
  FOREIGN KEY (mangime_confezionato_id) REFERENCES mangimi_confezionati(id)
);

CREATE INDEX IF NOT EXISTS idx_registro_dettagli_registro ON registro_alimentazione_dettagli(registro_id);

-- ============================================
-- ALIMENTAZIONE - DDT e Magazzino
-- ============================================

CREATE TABLE IF NOT EXISTS ddt (
  id INTEGER PRIMARY KEY,
  azienda_id INTEGER NOT NULL,
  data TEXT NOT NULL,
  numero TEXT NOT NULL,
  fornitore_id INTEGER,
  note TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  -- Campi sync
  synced_at TEXT,
  sync_status TEXT DEFAULT 'synced',
  local_updated_at TEXT,
  FOREIGN KEY (azienda_id) REFERENCES aziende(id),
  FOREIGN KEY (fornitore_id) REFERENCES fornitori(id)
);

CREATE INDEX IF NOT EXISTS idx_ddt_azienda ON ddt(azienda_id);
CREATE INDEX IF NOT EXISTS idx_ddt_numero ON ddt(numero);

CREATE TABLE IF NOT EXISTS ddt_righe (
  id INTEGER PRIMARY KEY,
  ddt_id INTEGER NOT NULL,
  componente_alimentare_id INTEGER,
  mangime_confezionato_id INTEGER,
  quantita REAL NOT NULL,
  unita_misura TEXT NOT NULL DEFAULT 'kg',
  prezzo_unitario REAL,
  lotto TEXT,
  scadenza TEXT,
  note TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  -- Campi sync
  synced_at TEXT,
  sync_status TEXT DEFAULT 'synced',
  local_updated_at TEXT,
  FOREIGN KEY (ddt_id) REFERENCES ddt(id),
  FOREIGN KEY (componente_alimentare_id) REFERENCES componenti_alimentari(id),
  FOREIGN KEY (mangime_confezionato_id) REFERENCES mangimi_confezionati(id)
);

CREATE INDEX IF NOT EXISTS idx_ddt_righe_ddt ON ddt_righe(ddt_id);

CREATE TABLE IF NOT EXISTS magazzino_movimenti (
  id INTEGER PRIMARY KEY,
  azienda_id INTEGER NOT NULL,
  data TEXT NOT NULL,
  tipo TEXT NOT NULL, -- 'carico', 'scarico', 'rettifica'
  componente_alimentare_id INTEGER,
  mangime_confezionato_id INTEGER,
  quantita REAL NOT NULL,
  unita_misura TEXT NOT NULL DEFAULT 'kg',
  causale TEXT,
  ddt_riga_id INTEGER,
  note TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  -- Campi sync
  synced_at TEXT,
  sync_status TEXT DEFAULT 'synced',
  local_updated_at TEXT,
  FOREIGN KEY (azienda_id) REFERENCES aziende(id),
  FOREIGN KEY (componente_alimentare_id) REFERENCES componenti_alimentari(id),
  FOREIGN KEY (mangime_confezionato_id) REFERENCES mangimi_confezionati(id),
  FOREIGN KEY (ddt_riga_id) REFERENCES ddt_righe(id)
);

CREATE INDEX IF NOT EXISTS idx_magazzino_azienda ON magazzino_movimenti(azienda_id);
CREATE INDEX IF NOT EXISTS idx_magazzino_data ON magazzino_movimenti(data);
CREATE INDEX IF NOT EXISTS idx_magazzino_tipo ON magazzino_movimenti(tipo);

-- ============================================
-- ALLEVAMENTO - Movimentazioni
-- ============================================

CREATE TABLE IF NOT EXISTS movimentazioni (
  id INTEGER PRIMARY KEY,
  animale_id INTEGER NOT NULL,
  da_box_id INTEGER,
  a_box_id INTEGER NOT NULL,
  data_ora TEXT NOT NULL,
  operatore_id INTEGER,
  motivo TEXT,
  note TEXT,
  created_at TEXT,
  -- Campi sync
  synced_at TEXT,
  sync_status TEXT DEFAULT 'synced',
  local_updated_at TEXT,
  FOREIGN KEY (animale_id) REFERENCES animali(id),
  FOREIGN KEY (da_box_id) REFERENCES box(id),
  FOREIGN KEY (a_box_id) REFERENCES box(id)
);

CREATE INDEX IF NOT EXISTS idx_movimentazioni_animale ON movimentazioni(animale_id);
CREATE INDEX IF NOT EXISTS idx_movimentazioni_data ON movimentazioni(data_ora);

-- ============================================
-- SANITARIO - Lotti Farmaco
-- ============================================

CREATE TABLE IF NOT EXISTS lotti_farmaco (
  id INTEGER PRIMARY KEY,
  azienda_id INTEGER NOT NULL,
  farmaco_id INTEGER NOT NULL,
  lotto TEXT NOT NULL,
  scadenza TEXT,
  quantita_iniziale REAL NOT NULL DEFAULT 0,
  quantita_rimanente REAL NOT NULL DEFAULT 0,
  fornitore TEXT,
  numero_fattura TEXT,
  data_acquisto TEXT,
  note TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  -- Campi sync
  synced_at TEXT,
  sync_status TEXT DEFAULT 'synced',
  local_updated_at TEXT,
  FOREIGN KEY (azienda_id) REFERENCES aziende(id),
  FOREIGN KEY (farmaco_id) REFERENCES farmaci(id)
);

CREATE INDEX IF NOT EXISTS idx_lotti_azienda ON lotti_farmaco(azienda_id);
CREATE INDEX IF NOT EXISTS idx_lotti_farmaco ON lotti_farmaco(farmaco_id);
CREATE INDEX IF NOT EXISTS idx_lotti_scadenza ON lotti_farmaco(scadenza);

-- ============================================
-- TERRENI - Lavorazioni, Raccolti, Cicli
-- ============================================

CREATE TABLE IF NOT EXISTS lavorazioni_terreno (
  id INTEGER PRIMARY KEY,
  azienda_id INTEGER NOT NULL,
  terreno_id INTEGER,
  data TEXT,
  tipo TEXT,
  fattura_id INTEGER,
  costo_totale REAL,
  note TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  -- Campi sync
  synced_at TEXT,
  sync_status TEXT DEFAULT 'synced',
  local_updated_at TEXT,
  FOREIGN KEY (azienda_id) REFERENCES aziende(id),
  FOREIGN KEY (terreno_id) REFERENCES terreni(id)
);

CREATE INDEX IF NOT EXISTS idx_lavorazioni_azienda ON lavorazioni_terreno(azienda_id);
CREATE INDEX IF NOT EXISTS idx_lavorazioni_terreno ON lavorazioni_terreno(terreno_id);

CREATE TABLE IF NOT EXISTS raccolti_terreno (
  id INTEGER PRIMARY KEY,
  azienda_id INTEGER NOT NULL,
  terreno_id INTEGER,
  prodotto TEXT NOT NULL,
  data_inizio TEXT,
  data_fine TEXT,
  resa_quantita REAL,
  unita_misura TEXT,
  destinazione TEXT,
  prezzo_vendita REAL,
  note TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  -- Campi sync
  synced_at TEXT,
  sync_status TEXT DEFAULT 'synced',
  local_updated_at TEXT,
  FOREIGN KEY (azienda_id) REFERENCES aziende(id),
  FOREIGN KEY (terreno_id) REFERENCES terreni(id)
);

CREATE INDEX IF NOT EXISTS idx_raccolti_azienda ON raccolti_terreno(azienda_id);
CREATE INDEX IF NOT EXISTS idx_raccolti_terreno ON raccolti_terreno(terreno_id);

CREATE TABLE IF NOT EXISTS cicli_terreno (
  id INTEGER PRIMARY KEY,
  azienda_id INTEGER NOT NULL,
  terreno_id INTEGER NOT NULL,
  coltura TEXT NOT NULL,
  anno INTEGER,
  data_inizio TEXT,
  data_fine TEXT,
  superficie_coinvolta REAL,
  note TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  -- Campi sync
  synced_at TEXT,
  sync_status TEXT DEFAULT 'synced',
  local_updated_at TEXT,
  FOREIGN KEY (azienda_id) REFERENCES aziende(id),
  FOREIGN KEY (terreno_id) REFERENCES terreni(id)
);

CREATE INDEX IF NOT EXISTS idx_cicli_azienda ON cicli_terreno(azienda_id);
CREATE INDEX IF NOT EXISTS idx_cicli_terreno ON cicli_terreno(terreno_id);
CREATE INDEX IF NOT EXISTS idx_cicli_anno ON cicli_terreno(anno);

CREATE TABLE IF NOT EXISTS cicli_terreno_fasi (
  id INTEGER PRIMARY KEY,
  ciclo_id INTEGER NOT NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL,
  ordine INTEGER,
  data_inizio TEXT,
  data_fine TEXT,
  note TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  -- Campi sync
  synced_at TEXT,
  sync_status TEXT DEFAULT 'synced',
  local_updated_at TEXT,
  FOREIGN KEY (ciclo_id) REFERENCES cicli_terreno(id)
);

CREATE INDEX IF NOT EXISTS idx_cicli_fasi_ciclo ON cicli_terreno_fasi(ciclo_id);

CREATE TABLE IF NOT EXISTS cicli_terreno_costi (
  id INTEGER PRIMARY KEY,
  ciclo_id INTEGER NOT NULL,
  fase_id INTEGER,
  azienda_id INTEGER NOT NULL,
  terreno_id INTEGER NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'manuale',
  descrizione TEXT NOT NULL,
  data TEXT,
  importo REAL,
  fattura_amministrazione_id INTEGER,
  lavorazione_id INTEGER,
  note TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  -- Campi sync
  synced_at TEXT,
  sync_status TEXT DEFAULT 'synced',
  local_updated_at TEXT,
  FOREIGN KEY (ciclo_id) REFERENCES cicli_terreno(id),
  FOREIGN KEY (fase_id) REFERENCES cicli_terreno_fasi(id),
  FOREIGN KEY (azienda_id) REFERENCES aziende(id),
  FOREIGN KEY (terreno_id) REFERENCES terreni(id),
  FOREIGN KEY (fattura_amministrazione_id) REFERENCES fatture_amministrazione(id),
  FOREIGN KEY (lavorazione_id) REFERENCES lavorazioni_terreno(id)
);

CREATE INDEX IF NOT EXISTS idx_cicli_costi_ciclo ON cicli_terreno_costi(ciclo_id);
CREATE INDEX IF NOT EXISTS idx_cicli_costi_fase ON cicli_terreno_costi(fase_id);

-- ============================================
-- ATTREZZATURE - Ammortamenti
-- ============================================

CREATE TABLE IF NOT EXISTS ammortamenti (
  id INTEGER PRIMARY KEY,
  attrezzatura_id INTEGER NOT NULL,
  azienda_id INTEGER NOT NULL,
  anno INTEGER NOT NULL,
  mese INTEGER,
  importo REAL NOT NULL,
  note TEXT,
  created_at TEXT,
  updated_at TEXT,
  -- Campi sync
  synced_at TEXT,
  sync_status TEXT DEFAULT 'synced',
  local_updated_at TEXT,
  FOREIGN KEY (attrezzatura_id) REFERENCES attrezzature(id),
  FOREIGN KEY (azienda_id) REFERENCES aziende(id)
);

CREATE INDEX IF NOT EXISTS idx_ammortamenti_attrezzatura ON ammortamenti(attrezzatura_id);
CREATE INDEX IF NOT EXISTS idx_ammortamenti_azienda ON ammortamenti(azienda_id);
CREATE INDEX IF NOT EXISTS idx_ammortamenti_anno ON ammortamenti(anno);
`;

/**
 * Inizializza i metadati del database
 */
const INIT_META_SQL = `
INSERT OR REPLACE INTO _meta (key, value) VALUES ('schema_version', '${SCHEMA_VERSION}');
INSERT OR REPLACE INTO _meta (key, value) VALUES ('created_at', datetime('now'));
INSERT OR REPLACE INTO _meta (key, value) VALUES ('last_sync', NULL);
`;

module.exports = {
  SCHEMA_VERSION,
  CREATE_TABLES_SQL,
  INIT_META_SQL,
};

