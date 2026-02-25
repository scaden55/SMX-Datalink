import { app, BrowserWindow, ipcMain, dialog, shell, Menu, session, nativeImage } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import { IpcChannels } from './ipc-channels';

// Set AppUserModelId early so Windows uses our icon, not Electron's default
app.setAppUserModelId('com.sma.acars');

// ----- Constants -----

const IS_DEV = !app.isPackaged;
const VITE_DEV_PORT = parseInt(process.env.VITE_DEV_PORT || '5173', 10);
const VITE_DEV_URL = `http://localhost:${VITE_DEV_PORT}`;
// Use the multi-size .ico on Windows (nativeImage loads all embedded sizes as separate
// representations, giving the OS the best match for taskbar / title-bar / alt-tab).
// Fall back to the PNG source on other platforms.
const iconPath = process.platform === 'win32'
  ? path.join(__dirname, '..', 'assets', 'icon.ico')
  : path.join(__dirname, '..', 'assets', 'logos', 'chevron-dark.png');
const APP_ICON = nativeImage.createFromPath(iconPath);
console.log('[Electron] Icon loaded from', iconPath, '— empty?', APP_ICON.isEmpty(), 'size:', APP_ICON.getSize());

// ----- State -----

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
let isQuitting = false;

// ----- Splash Screen -----

function createSplash(): void {
  const splashPath = path.join(__dirname, '..', 'assets', 'splash.html');

  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: false,
    resizable: false,
    movable: false,
    center: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#0d1117',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  splashWindow.loadFile(splashPath);

  splashWindow.once('ready-to-show', () => {
    splashWindow?.show();
  });

  splashWindow.on('closed', () => {
    splashWindow = null;
  });
}

function closeSplash(): void {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
    splashWindow = null;
  }
}

// ----- Window Creation -----

function createWindow(): void {
  // Remove Electron's default application menu (File/Edit/View/Window/Help)
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    frame: false,
    icon: APP_ICON,
    autoHideMenuBar: true,
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
  } else {
    const indexPath = path.join(process.resourcesPath, 'frontend', 'index.html');
    mainWindow.loadFile(indexPath);
  }

  // Forward maximize state changes to renderer for titlebar icon updates
  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send(IpcChannels.WINDOW_MAXIMIZED_CHANGE, true);
  });
  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send(IpcChannels.WINDOW_MAXIMIZED_CHANGE, false);
  });

  // Show when ready — close splash and reveal main window
  mainWindow.once('ready-to-show', () => {
    closeSplash();
    // Explicitly set icon after window is ready (ensures taskbar picks it up)
    mainWindow?.setIcon(APP_ICON);
    mainWindow?.show();
    mainWindow?.focus();
  });

  // Handle window.open() calls from the renderer
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // SimBrief OFP generation — open as small child window that auto-closes
    if (url.includes('simbrief.com') || url.includes('navigraph.com')) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 600,
          height: 400,
          autoHideMenuBar: true,
          backgroundColor: '#1a1a2e',
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            // Persistent partition: cookies survive across popup closes and app restarts.
            // Chromium encrypts cookie values at rest via DPAPI (Windows) / Keychain (macOS).
            partition: 'persist:simbrief',
          },
        },
      };
    }

    // All other external links — open in system browser
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

  // Backend info (VPS-backed — always "connected")
  ipcMain.handle(IpcChannels.BACKEND_PORT, () => {
    return 3001;
  });

  ipcMain.handle(IpcChannels.BACKEND_STATUS, () => {
    return 'connected';
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

  // Clear SimBrief / Navigraph session (cookies, cache, storage)
  ipcMain.handle(IpcChannels.SIMBRIEF_CLEAR_SESSION, async () => {
    const ses = session.fromPartition('persist:simbrief');
    await ses.clearStorageData();
    return true;
  });

  // Developer tools toggle
  ipcMain.on(IpcChannels.DEVTOOLS_TOGGLE, () => {
    if (mainWindow?.webContents.isDevToolsOpened()) {
      mainWindow.webContents.closeDevTools();
    } else {
      mainWindow?.webContents.openDevTools({ mode: 'detach' });
    }
  });

  // Auto-updater (manual re-check from renderer)
  ipcMain.on(IpcChannels.UPDATE_CHECK, () => {
    if (!IS_DEV) autoUpdater.checkForUpdatesAndNotify();
  });

  ipcMain.on(IpcChannels.UPDATE_INSTALL, () => {
    autoUpdater.quitAndInstall();
  });
}

// ----- Auto-Updater Events -----

function setupAutoUpdater(): void {
  if (IS_DEV) return; // No auto-updates in development

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    console.log('[AutoUpdater] Update available:', info.version);
    mainWindow?.webContents.send(IpcChannels.UPDATE_AVAILABLE, info);
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[AutoUpdater] Already up to date.');
  });

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send(IpcChannels.UPDATE_PROGRESS, progress);
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[AutoUpdater] Update downloaded:', info.version);
    mainWindow?.webContents.send(IpcChannels.UPDATE_DOWNLOADED, info);
  });

  autoUpdater.on('error', (err) => {
    console.error('[AutoUpdater] Error:', err.message);
    mainWindow?.webContents.send(IpcChannels.UPDATE_ERROR, err.message);
  });

  // Check for updates automatically after a short delay (let the window load first)
  setTimeout(() => {
    console.log('[AutoUpdater] Checking for updates...');
    autoUpdater.checkForUpdatesAndNotify();
  }, 5_000);
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
  closeSplash();
});

app.whenReady().then(async () => {
  registerIpcHandlers();
  setupAutoUpdater();

  // Show splash immediately so users see feedback during boot
  createSplash();

  // Packaged exe connects to VPS — no local backend needed
  // Dev mode uses external backend via `npm run dev:backend`
  console.log(`[Electron] Mode: ${IS_DEV ? 'dev (local backend via tsx watch)' : 'production (VPS backend)'}`);

  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});
