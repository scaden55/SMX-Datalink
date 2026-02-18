import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import { fork, ChildProcess } from 'child_process';
import { IpcChannels } from './ipc-channels';

// ----- Constants -----

const IS_DEV = !app.isPackaged;
const BACKEND_PORT = parseInt(process.env.BACKEND_PORT || '3001', 10);
const VITE_DEV_PORT = parseInt(process.env.VITE_DEV_PORT || '5173', 10);
const VITE_DEV_URL = `http://localhost:${VITE_DEV_PORT}`;
// In dev mode, backend runs externally via tsx watch — Electron only forks in production
const SKIP_BACKEND_FORK = IS_DEV && process.env.ELECTRON_SKIP_BACKEND !== 'false';
const BACKEND_READY_TIMEOUT = 15_000; // ms

// ----- State -----

let mainWindow: BrowserWindow | null = null;
let backendProcess: ChildProcess | null = null;
let backendReady = false;
let isQuitting = false;

// ----- Backend Server -----

function getBackendEntryPath(): string {
  if (IS_DEV) {
    return path.join(__dirname, '..', '..', 'backend', 'dist', 'index.js');
  }
  return path.join(process.resourcesPath, 'backend', 'index.js');
}

function getBackendEnvPath(): string {
  if (IS_DEV) {
    return path.join(__dirname, '..', '..', 'backend');
  }
  return path.join(process.resourcesPath, 'backend');
}

function startBackend(): Promise<void> {
  return new Promise((resolve, reject) => {
    const entryPath = getBackendEntryPath();
    const cwd = getBackendEnvPath();

    console.log(`[Electron] Starting backend: ${entryPath}`);

    backendProcess = fork(entryPath, [], {
      cwd,
      env: {
        ...process.env,
        PORT: String(BACKEND_PORT),
        CORS_ORIGIN: IS_DEV ? VITE_DEV_URL : `file://`,
        ELECTRON_RUN_AS_NODE: undefined,
      },
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });

    const timeout = setTimeout(() => {
      // If backend doesn't crash within timeout, assume it started
      if (!backendReady) {
        backendReady = true;
        console.log(`[Electron] Backend assumed ready (timeout)`);
        resolve();
      }
    }, BACKEND_READY_TIMEOUT);

    backendProcess.stdout?.on('data', (data: Buffer) => {
      const msg = data.toString().trim();
      console.log(`[Backend] ${msg}`);

      if (msg.includes('ACARS backend running') && !backendReady) {
        backendReady = true;
        clearTimeout(timeout);
        console.log(`[Electron] Backend ready on port ${BACKEND_PORT}`);
        resolve();
      }
    });

    backendProcess.stderr?.on('data', (data: Buffer) => {
      console.error(`[Backend:err] ${data.toString().trim()}`);
    });

    backendProcess.on('exit', (code) => {
      console.log(`[Electron] Backend exited with code ${code}`);
      backendProcess = null;
      backendReady = false;

      if (!isQuitting) {
        // Notify renderer that backend died
        mainWindow?.webContents.send(IpcChannels.BACKEND_STATUS, 'disconnected');
      }
    });

    backendProcess.on('error', (err) => {
      console.error(`[Electron] Backend spawn error:`, err);
      clearTimeout(timeout);
      reject(err);
    });
  });
}

function stopBackend(): void {
  if (backendProcess) {
    console.log(`[Electron] Stopping backend...`);
    backendProcess.kill('SIGTERM');
    backendProcess = null;
    backendReady = false;
  }
}

// ----- Window Creation -----

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0d1117',
    show: false, // show after ready-to-show
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // needed for preload contextBridge
      webSecurity: true,
    },
  });

  // Load content
  if (IS_DEV) {
    mainWindow.loadURL(VITE_DEV_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    const indexPath = path.join(process.resourcesPath, 'frontend', 'index.html');
    mainWindow.loadFile(indexPath);
  }

  // Show when ready (avoids white flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  // Open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ----- IPC Handlers -----

function registerIpcHandlers(): void {
  // Window controls
  ipcMain.on(IpcChannels.WINDOW_CLOSE, () => {
    mainWindow?.close();
  });

  ipcMain.on(IpcChannels.WINDOW_MINIMIZE, () => {
    mainWindow?.minimize();
  });

  ipcMain.on(IpcChannels.WINDOW_MAXIMIZE_TOGGLE, () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.handle(IpcChannels.APP_IS_MAXIMIZED, () => {
    return mainWindow?.isMaximized() ?? false;
  });

  ipcMain.on(IpcChannels.APP_QUIT, () => {
    app.quit();
  });

  ipcMain.on(IpcChannels.APP_MINIMIZE, () => {
    mainWindow?.minimize();
  });

  ipcMain.on(IpcChannels.APP_MAXIMIZE, () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  // Backend info
  ipcMain.handle(IpcChannels.BACKEND_PORT, () => {
    return BACKEND_PORT;
  });

  ipcMain.handle(IpcChannels.BACKEND_STATUS, () => {
    return backendReady ? 'connected' : 'disconnected';
  });

  // File dialogs
  ipcMain.handle(IpcChannels.FILE_OPEN_DIALOG, async (_event, options) => {
    if (!mainWindow) return { canceled: true, filePaths: [] };
    return dialog.showOpenDialog(mainWindow, options);
  });

  ipcMain.handle(IpcChannels.FILE_SAVE_DIALOG, async (_event, options) => {
    if (!mainWindow) return { canceled: true, filePath: '' };
    return dialog.showSaveDialog(mainWindow, options);
  });

  // Auto-updater
  ipcMain.on(IpcChannels.UPDATE_CHECK, () => {
    if (!IS_DEV) {
      autoUpdater.checkForUpdatesAndNotify();
    }
  });

  ipcMain.on(IpcChannels.UPDATE_INSTALL, () => {
    autoUpdater.quitAndInstall();
  });
}

// ----- Auto-Updater Events -----

function setupAutoUpdater(): void {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send(IpcChannels.UPDATE_AVAILABLE, info);
  });

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send(IpcChannels.UPDATE_PROGRESS, progress);
  });

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send(IpcChannels.UPDATE_DOWNLOADED, info);
  });

  autoUpdater.on('error', (err) => {
    mainWindow?.webContents.send(IpcChannels.UPDATE_ERROR, err.message);
  });
}

// ----- App Lifecycle -----

// Prevent multiple instances
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

app.on('before-quit', () => {
  isQuitting = true;
});

app.whenReady().then(async () => {
  registerIpcHandlers();
  setupAutoUpdater();

  // Start backend server (skipped in dev — backend runs externally via tsx watch)
  if (SKIP_BACKEND_FORK) {
    console.log(`[Electron] Dev mode — skipping backend fork (using external backend on :${BACKEND_PORT})`);
    backendReady = true;
  } else {
    try {
      await startBackend();
    } catch (err) {
      console.error('[Electron] Failed to start backend:', err);
    }
  }

  createWindow();
});

app.on('window-all-closed', () => {
  stopBackend();
  app.quit();
});

app.on('quit', () => {
  stopBackend();
});
