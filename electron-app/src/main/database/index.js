/**
 * Database Module Exports
 */

const localDb = require('./localDb');
const syncManager = require('./syncManager');
const { registerDatabaseHandlers, initializeDatabase, cleanup } = require('./ipcHandlers');
const { SCHEMA_VERSION, CREATE_TABLES_SQL, INIT_META_SQL } = require('./schema');

module.exports = {
  // Database locale
  localDb,
  
  // Sync manager
  syncManager,
  
  // IPC handlers
  registerDatabaseHandlers,
  initializeDatabase,
  cleanup,
  
  // Schema
  SCHEMA_VERSION,
  CREATE_TABLES_SQL,
  INIT_META_SQL,
};

