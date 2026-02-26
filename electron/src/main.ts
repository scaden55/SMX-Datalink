import { app, BrowserWindow, ipcMain, dialog, shell, Menu, session, nativeImage } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import { IpcChannels } from './ipc-channels';
import type { ISimConnectManager } from './simconnect/types';
import { NullSimConnectManager } from './simconnect/null-manager';
import { VpsRelay } from './relay';

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
let simConnect: ISimConnectManager | null = null;
let vpsRelay: VpsRelay | null = null;
let telemetryInterval: ReturnType<typeof setInterval> | null = null;

// ----- Splash Screen -----

function createSplash(): void {
  const splashPath = path.join(__dirname, '..', 'assets', 'splash.html');

  splashWindow = new BrowserWindow({
    width: 400,
    height: 340,
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

function splashExec(js: string): Promise<unknown> {
  if (!splashWindow || splashWindow.isDestroyed()) return Promise.resolve();
  return splashWindow.webContents.executeJavaScript(js);
}

async function checkForUpdateDuringSplash(): Promise<void> {
  if (IS_DEV) return; // No updates in dev

  autoUpdater.autoDownload = false;

  try {
    const result = await autoUpdater.checkForUpdates();
    if (!result || !result.updateInfo) return; // No update

    // Compare versions — if current version is same, skip
    const current = app.getVersion();
    if (result.updateInfo.version === current) return;

    // Show update prompt on splash
    await splashExec(`showUpdate(${JSON.stringify(result.updateInfo.version)})`);

    // Wait for user decision (Promise resolves when button is clicked)
    const action = await splashExec(`
      new Promise(resolve => {
        document.getElementById('btn-download').onclick = () => resolve('download');
        document.getElementById('btn-skip').onclick = () => resolve('skip');
      })
    `);

    if (action !== 'download') return;

    // User chose to download
    await splashExec('showDownloading()');

    // Wire up progress (cleaned up in finally to avoid listener leak)
    const onProgress = (progress: { percent: number }) => {
      splashExec(`setProgress(${Math.round(progress.percent)})`);
    };
    autoUpdater.on('download-progress', onProgress);

    try {
      // Start download and wait for completion
      await autoUpdater.downloadUpdate();
    } finally {
      autoUpdater.removeListener('download-progress', onProgress);
    }

    // Download complete — show installing
    await splashExec('showInstalling()');

    // Brief UX pause, then quit+install. quitAndInstall exits the process on success;
    // if it somehow fails, this function returns and the app continues normally.
    setTimeout(() => autoUpdater.quitAndInstall(false, true), 1500);
    return;

  } catch (err) {
    console.error('[AutoUpdater] Splash update error:', err);
    // Show error on splash, let user continue
    const msg = (err as Error).message ?? 'Unknown error';
    await splashExec(`showError(${JSON.stringify(msg)})`);
    await splashExec(`
      new Promise(resolve => {
        document.getElementById('btn-continue').onclick = () => resolve('continue');
      })
    `);
    // User clicked continue — proceed to app
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
  if (IS_DEV) return;

  autoUpdater.autoDownload = false;
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
  simConnect?.disconnect();
  vpsRelay?.stop();
  if (telemetryInterval) clearInterval(telemetryInterval);
});

app.whenReady().then(async () => {
  registerIpcHandlers();

  // Show splash immediately so users see feedback during boot
  createSplash();

  // Check for updates during splash (blocks until resolved or skipped)
  await checkForUpdateDuringSplash();

  // Set up auto-updater for runtime re-checks (after splash update check)
  setupAutoUpdater();

  // Packaged exe connects to VPS — no local backend needed
  // Dev mode uses external backend via `npm run dev:backend`
  console.log(`[Electron] Mode: ${IS_DEV ? 'dev (local backend via tsx watch)' : 'production (VPS backend)'}`);

  createWindow();

  // ── SimConnect ─────────────────────────────────────────────
  try {
    const { SimConnectManager } = require('./simconnect/connection');
    simConnect = new SimConnectManager();
    console.log('[Electron] SimConnect module loaded');
  } catch (err) {
    console.warn('[Electron] SimConnect not available:', (err as Error).message);
    simConnect = new NullSimConnectManager();
  }

  // Local alias — guaranteed non-null after the try/catch above
  const sim = simConnect!;

  sim.connect();

  // Accumulate latest data from each SimConnect group
  const latestData: Record<string, unknown> = {};
  sim.on('positionUpdate', (data) => { latestData.position = data; });
  sim.on('engineUpdate', (data) => { latestData.engine = data; });
  sim.on('fuelUpdate', (data) => { latestData.fuel = data; });
  sim.on('flightStateUpdate', (data) => { latestData.flightState = data; });
  sim.on('autopilotUpdate', (data) => { latestData.autopilot = data; });
  sim.on('radioUpdate', (data) => { latestData.radio = data; });
  sim.on('aircraftInfoUpdate', (data) => { latestData.aircraftInfo = data; });

  // Broadcast composed snapshot to renderer at poll interval
  sim.on('connected', (status) => {
    mainWindow?.webContents.send(IpcChannels.SIM_STATUS, status);
    if (!telemetryInterval) {
      telemetryInterval = setInterval(() => {
        if (!sim.connected || !mainWindow) return;
        const snapshot = {
          aircraft: {
            position: latestData.position ?? {},
            autopilot: latestData.autopilot ?? {},
            radio: latestData.radio ?? {},
            info: latestData.aircraftInfo ?? {},
          },
          engine: latestData.engine ?? {},
          fuel: latestData.fuel ?? {},
          flight: latestData.flightState ?? {},
          timestamp: new Date().toISOString(),
        };
        mainWindow!.webContents.send(IpcChannels.SIM_TELEMETRY, snapshot);
        vpsRelay?.sendTelemetry(snapshot);
      }, 200);
    }
  });

  sim.on('disconnected', () => {
    mainWindow?.webContents.send(IpcChannels.SIM_STATUS, sim.getConnectionStatus());
    if (telemetryInterval) {
      clearInterval(telemetryInterval);
      telemetryInterval = null;
    }
  });

  // VPS relay — started when renderer sends auth info after login
  ipcMain.handle(IpcChannels.RELAY_AUTH, (_event, data: { token: string; userId: number; callsign: string; vpsUrl: string }) => {
    if (vpsRelay) {
      // Token refresh — just update the auth, don't recreate
      vpsRelay.updateAuth(data.token);
      return true;
    }

    // Initial setup — create new relay
    vpsRelay = new VpsRelay(sim, {
      vpsUrl: data.vpsUrl,
      heartbeatIntervalMs: 30_000,
      token: data.token,
      userId: data.userId,
      callsign: data.callsign,
    });
    vpsRelay.start();
    return true;
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
