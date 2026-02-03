/**
 * Script per forzare una sincronizzazione completa
 * 
 * Uso: node scripts/force-sync.js <azienda_id>
 * 
 * Questo script resetta i metadati di sync e forza una full sync
 * Utile dopo operazioni di pulizia database come rimozione duplicati
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');

// Importa i moduli del database
const localDb = require('../src/main/database/localDb');
const syncManager = require('../src/main/database/syncManager');

async function forceSync(aziendaId) {
  console.log('Forzatura sincronizzazione completa...');
  console.log(`Azienda ID: ${aziendaId}`);
  
  // Inizializza database
  if (!localDb.isAvailable()) {
    localDb.init();
  }
  
  // Reset sync
  const result = await syncManager.resetSync(aziendaId);
  
  if (result.success) {
    console.log('✅ Sincronizzazione completata con successo!');
    console.log(`   Record scaricati: ${result.pulled || 0}`);
  } else {
    console.error('❌ Errore durante la sincronizzazione:', result.error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Leggi azienda_id da argomenti
const aziendaId = process.argv[2];
if (!aziendaId) {
  console.error('ERRORE: Devi specificare l\'azienda_id');
  console.log('Uso: node scripts/force-sync.js <azienda_id>');
  process.exit(1);
}

forceSync(parseInt(aziendaId, 10));

