/**
 * Migrazioni Database Locale
 * 
 * Gestisce l'aggiornamento dello schema quando cambia la versione.
 * Se lo schema è obsoleto, ricrea le tabelle.
 */

const localDb = require('./localDb');
const { SCHEMA_VERSION, CREATE_TABLES_SQL, INIT_META_SQL } = require('./schema');

/**
 * Verifica e applica migrazioni se necessario
 */
function applyMigrations() {
  if (!localDb.isAvailable()) {
    console.log('[Migrations] Database non disponibile, skip migrazioni');
    return false;
  }

  try {
    const currentVersion = localDb.getSyncMeta('schema_version');
    const targetVersion = SCHEMA_VERSION.toString();

    console.log(`[Migrations] Versione corrente: ${currentVersion || 'nessuna'}, target: ${targetVersion}`);

    // Se non c'è versione o è diversa, ricrea schema
    if (!currentVersion || currentVersion !== targetVersion) {
      console.log('[Migrations] Schema obsoleto, ricreazione tabelle...');
      
      // Backup dati esistenti (solo sync_status per non perdere stato sync)
      const backupData = {};
      try {
        const tables = ['animali', 'sedi', 'stabilimenti', 'box', 'fornitori', 'fatture_amministrazione'];
        for (const table of tables) {
          const pending = localDb.getPendingSync(table);
          if (pending.length > 0) {
            backupData[table] = pending;
            console.log(`[Migrations] Backup ${pending.length} record pending da ${table}`);
          }
        }
      } catch (e) {
        console.warn('[Migrations] Errore backup dati:', e.message);
      }

      // Elimina tutte le tabelle
      const dropTables = `
        DROP TABLE IF EXISTS _sync_log;
        DROP TABLE IF EXISTS _meta;
        DROP TABLE IF EXISTS animali;
        DROP TABLE IF EXISTS sedi;
        DROP TABLE IF EXISTS stabilimenti;
        DROP TABLE IF EXISTS box;
        DROP TABLE IF EXISTS aziende;
        DROP TABLE IF EXISTS fornitori;
        DROP TABLE IF EXISTS fatture_amministrazione;
        DROP TABLE IF EXISTS partite_animali;
        DROP TABLE IF EXISTS partite_animali_animali;
        DROP TABLE IF EXISTS componenti_alimentari;
        DROP TABLE IF EXISTS mangimi_confezionati;
        DROP TABLE IF EXISTS farmaci;
        DROP TABLE IF EXISTS somministrazioni;
        DROP TABLE IF EXISTS terreni;
        DROP TABLE IF EXISTS attrezzature;
        DROP TABLE IF EXISTS scadenze_attrezzature;
        DROP TABLE IF EXISTS assicurazioni_aziendali;
        DROP TABLE IF EXISTS contratti_soccida;
        DROP TABLE IF EXISTS impostazioni;
        DROP TABLE IF EXISTS movimentazioni;
      `;
      
      localDb.db.exec(dropTables);

      // Ricrea schema
      localDb.db.exec(CREATE_TABLES_SQL);
      localDb.db.exec(INIT_META_SQL);

      // Ripristina dati pending (solo sync_status)
      for (const [table, records] of Object.entries(backupData)) {
        for (const record of records) {
          try {
            // Re-inserisci solo se ha sync_status pending
            if (record.sync_status === 'pending') {
              localDb.insert(table, record, false); // Non marcare come pending (già lo è)
            }
          } catch (e) {
            console.warn(`[Migrations] Errore ripristino record ${table}/${record.id}:`, e.message);
          }
        }
      }

      // Aggiorna versione
      localDb.updateSyncMeta('schema_version', targetVersion);
      console.log('[Migrations] ✅ Schema aggiornato alla versione', targetVersion);
      return true;
    } else {
      console.log('[Migrations] Schema già aggiornato');
      return false;
    }
  } catch (error) {
    console.error('[Migrations] Errore applicazione migrazioni:', error);
    return false;
  }
}

module.exports = {
  applyMigrations,
};

