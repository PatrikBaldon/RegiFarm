const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Database locale e sync
const { registerDatabaseHandlers, initializeDatabase, cleanup } = require('./database/ipcHandlers');

let mainWindow;

function createWindow() {
  const isMac = process.platform === 'darwin';
  
  const windowOptions = {
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    icon: path.join(__dirname, '..', '..', 'public', 'RegiFarm_Logo.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false, // Allow localhost connections in dev
      // Content Security Policy più permissiva per sviluppo
      // In produzione, rimuovere webSecurity: false
    },
  };
  
  // Su Mac usa hiddenInset per avere i traffic lights integrati nella titlebar
  if (isMac) {
    windowOptions.titleBarStyle = 'hiddenInset';
  }
  // Su Windows usa frame: true (default) per avere i controlli standard
  // L'header custom sarà posizionato sotto la titlebar standard
  
  mainWindow = new BrowserWindow(windowOptions);

  // In development, load from webpack dev server
  const isDev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    // In production: path assoluto al build frontend.
    // Con npm run start la cwd è la root del progetto; con app impacchettata usiamo __dirname.
    const indexPath = app.isPackaged
      ? path.join(__dirname, '../../output/index.html')
      : path.join(process.cwd(), 'electron-app', 'output', 'index.html');
    const indexPathResolved = path.resolve(indexPath);
    mainWindow.loadFile(indexPathResolved);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC handlers
ipcMain.handle('save-pdf', async (event, pdfBuffer, defaultFilename) => {
  try {
    const window = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePath } = await dialog.showSaveDialog(window || mainWindow, {
      title: 'Salva Piano Uscita PDF',
      defaultPath: defaultFilename,
      filters: [
        { name: 'PDF Files', extensions: ['pdf'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (!canceled && filePath) {
      fs.writeFileSync(filePath, pdfBuffer);
      return { success: true, path: filePath };
    }
    return { success: false, canceled: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

app.whenReady().then(() => {
  // Inizializza database locale
  console.log('[Main] Inizializzazione database locale...');
  initializeDatabase();
  
  // Registra IPC handlers per database e sync
  registerDatabaseHandlers();
  
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Importa syncManager per gestire la sync in background
const { getSyncManager } = require('./database/ipcHandlers');

let isQuitting = false;
let backgroundSyncInProgress = false;

app.on('window-all-closed', async (event) => {
  // Verifica se ci sono modifiche pendenti (su tutte le piattaforme)
  const syncManager = getSyncManager();
  if (syncManager && syncManager.hasPendingChanges() && !isQuitting) {
    // Ci sono modifiche pendenti: mantieni l'app in background
    event.preventDefault();
    
    const pendingCount = syncManager.getPendingChangesCount();
    console.log(`[Main] Modifiche pendenti (${pendingCount}), mantengo app in background per sync...`);
    
    // Nascondi tutte le finestre ma mantieni il processo attivo
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(win => {
      if (!win.isDestroyed()) {
        win.hide();
      }
    });
    
    // Avvia sync in background
    backgroundSyncInProgress = true;
    syncManager.onBackgroundSyncComplete = (result) => {
      console.log('[Main] Sync in background completata:', result);
      backgroundSyncInProgress = false;
      
      // Ora può chiudere l'app (solo su Windows/Linux, su Mac rimane in dock)
      if (process.platform !== 'darwin') {
        isQuitting = true;
        app.quit();
      }
    };
    
    // Avvia sync in background
    syncManager.startBackgroundSync().catch(err => {
      console.error('[Main] Errore durante sync in background:', err);
      backgroundSyncInProgress = false;
      // Anche in caso di errore, chiudi l'app dopo un breve delay (solo su Windows/Linux)
      if (process.platform !== 'darwin') {
        setTimeout(() => {
          isQuitting = true;
          app.quit();
        }, 1000);
      }
    });
  } else {
    // Nessuna modifica pendente: chiudi normalmente (solo su Windows/Linux)
  if (process.platform !== 'darwin') {
    app.quit();
  }
    // Su macOS, l'app rimane attiva anche quando tutte le finestre sono chiuse
  }
});

// Gestione chiusura forzata (Cmd+Q su Mac, Alt+F4 su Windows)
app.on('before-quit', async (event) => {
  if (isQuitting) {
    // Già in fase di chiusura, procedi
    return;
  }

  // Verifica se ci sono modifiche pendenti
  const syncManager = getSyncManager();
  if (syncManager && syncManager.hasPendingChanges() && !backgroundSyncInProgress) {
    // Ci sono modifiche pendenti: previeni la chiusura e avvia sync in background
    event.preventDefault();
    
    const pendingCount = syncManager.getPendingChangesCount();
    console.log(`[Main] Chiusura richiesta con ${pendingCount} modifiche pendenti, avvio sync in background...`);
    
    // Nascondi tutte le finestre
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(win => {
      if (!win.isDestroyed()) {
        win.hide();
      }
    });
    
    // Avvia sync in background
    backgroundSyncInProgress = true;
    syncManager.onBackgroundSyncComplete = (result) => {
      console.log('[Main] Sync in background completata:', result);
      backgroundSyncInProgress = false;
      
      // Ora può chiudere l'app
      isQuitting = true;
      app.quit();
    };
    
    // Avvia sync in background
    syncManager.startBackgroundSync().catch(err => {
      console.error('[Main] Errore durante sync in background:', err);
      backgroundSyncInProgress = false;
      // Anche in caso di errore, chiudi l'app dopo un breve delay
      setTimeout(() => {
        isQuitting = true;
        app.quit();
      }, 1000);
    });
  } else {
    // Nessuna modifica pendente o sync già in corso: procedi con la chiusura
    isQuitting = true;
  console.log('[Main] Cleanup prima della chiusura...');
  cleanup();
  }
});

app.on('will-quit', () => {
  console.log('[Main] Applicazione in chiusura...');
  cleanup();
});

