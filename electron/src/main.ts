import { app, BrowserWindow, ipcMain, dialog, shell, Menu, session, nativeImage } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import { IpcChannels } from './ipc-channels';
import type { ISimConnectManager } from './simconnect/types';
import { NullSimConnectManager } from './simconnect/null-manager';
import { FlightPhaseService } from './simconnect/flight-phase';
import { ExceedanceDetector } from './simconnect/exceedance-detector';
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
    height: 460,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    center: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  splashWindow.loadFile(splashPath);

  splashWindow.once('ready-to-show', () => {
    splashExec(`setVersion(${JSON.stringify(app.getVersion())})`);
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

    // Re-check before downloading — electron-updater clears internal state
    // (updateInfoAndProvider) in some cases, causing "Please check update first".
    // A fresh check guarantees the state is set right before downloadUpdate().
    await autoUpdater.checkForUpdates();

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
    backgroundColor: '#000000',
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

  // Block navigation away from the app — prevents hijacking via malicious links
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowed = IS_DEV
      ? url.startsWith(VITE_DEV_URL)
      : url.startsWith('file://');
    if (!allowed) {
      event.preventDefault();
      shell.openExternal(url);
    }
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
  // Boot diagnostics buffer — stores messages from before the renderer is ready
  const bootDiag: Array<{ ts: string; level: string; msg: string }> = [];
  const pushDiag = (level: string, msg: string) => {
    const entry = { ts: new Date().toISOString(), level, msg };
    bootDiag.push(entry);
    console.log(`[SimConnect:${level}] ${msg}`);
    // Try sending to renderer immediately (may be null during boot)
    mainWindow?.webContents.send(IpcChannels.SIM_DIAGNOSTIC, entry);
  };

  let simConnectLoadError: string | undefined;
  try {
    pushDiag('info', 'Loading node-simconnect native module...');
    const { SimConnectManager } = require('./simconnect/connection');
    simConnect = new SimConnectManager();
    pushDiag('info', 'SimConnect module loaded successfully');
  } catch (err) {
    simConnectLoadError = (err as Error).message;
    const stack = (err as Error).stack?.split('\n').slice(0, 3).join(' | ') || '';
    pushDiag('error', `SimConnect module FAILED to load: ${simConnectLoadError}`);
    pushDiag('error', `Stack: ${stack}`);
    simConnect = new NullSimConnectManager();
  }

  // Local alias — guaranteed non-null after the try/catch above
  const sim = simConnect!;

  // Let the renderer pull current status on demand (avoids race with push events)
  ipcMain.handle(IpcChannels.SIM_REQUEST_STATUS, () => {
    const status = sim.getConnectionStatus();
    if (simConnectLoadError) {
      status.lastError = `Module load failed: ${simConnectLoadError}`;
    }
    return status;
  });

  // Forward SimConnect diagnostic events to renderer DevTools console
  sim.on('diagnostic', (event: { ts: string; level: string; msg: string }) => {
    mainWindow?.webContents.send(IpcChannels.SIM_DIAGNOSTIC, event);
  });

  // Let renderer pull full diagnostic log on demand (includes boot diagnostics)
  ipcMain.handle(IpcChannels.SIM_DIAGNOSTIC_LOG, () => {
    const managerLog = (sim as any).getDiagnosticLog?.() ?? [];
    return [...bootDiag, ...managerLog];
  });

  // Flush boot diagnostics to renderer once it's ready
  mainWindow?.webContents.once('did-finish-load', () => {
    for (const entry of bootDiag) {
      mainWindow?.webContents.send(IpcChannels.SIM_DIAGNOSTIC, entry);
    }
  });

  // Accumulate latest data from each SimConnect group
  const latestData: Record<string, unknown> = {};
  const phaseService = new FlightPhaseService();
  const exceedanceDetector = new ExceedanceDetector();
  let previousPhase = '';

  sim.on('positionUpdate', (data) => { latestData.position = data; });
  sim.on('engineUpdate', (data) => { latestData.engine = data; });
  sim.on('fuelUpdate', (data) => { latestData.fuel = data; });
  sim.on('flightStateUpdate', (data) => { latestData.flightState = data; });
  sim.on('autopilotUpdate', (data) => { latestData.autopilot = data; });
  sim.on('radioUpdate', (data) => { latestData.radio = data; });
  sim.on('aircraftInfoUpdate', (data) => {
    latestData.aircraftInfo = data;
    exceedanceDetector.setAircraftType(data.atcType || '');
  });

  sim.on('simStart', () => { phaseService.reset(); exceedanceDetector.reset(); });

  // Broadcast composed snapshot to renderer at poll interval
  sim.on('connected', (status) => {
    mainWindow?.webContents.send(IpcChannels.SIM_STATUS, status);
    if (!telemetryInterval) {
      telemetryInterval = setInterval(() => {
        if (!sim.connected || !mainWindow) return;

        // Flatten radio + aircraftInfo into aircraft to match AircraftData shape
        const radio = (latestData.radio ?? {}) as Record<string, unknown>;
        const info = (latestData.aircraftInfo ?? {}) as Record<string, unknown>;
        const position = (latestData.position ?? {}) as Record<string, number>;
        const flightState = (latestData.flightState ?? {}) as Record<string, unknown>;
        const engine = (latestData.engine ?? {}) as Record<string, unknown>;

        // Compute flight phase from accumulated telemetry
        const engines = (engine.engines ?? []) as Array<{ n1: number }>;
        const phase = phaseService.update({
          groundSpeed: position.groundSpeed ?? 0,
          verticalSpeed: position.verticalSpeed ?? 0,
          altitude: position.altitude ?? 0,
          altitudeAgl: position.altitudeAgl ?? 0,
          simOnGround: (flightState.simOnGround as boolean) ?? true,
          gearHandlePosition: (flightState.gearHandlePosition as boolean) ?? false,
          engineN1: engines[0]?.n1 ?? 0,
          parkingBrake: (flightState.parkingBrake as boolean) ?? true,
        });

        // Keep VPS relay phase in sync for heartbeats
        vpsRelay?.updatePhase(phase);

        // Detect exceedances from current telemetry
        const exceedancePosition = {
          latitude: position.latitude ?? 0,
          longitude: position.longitude ?? 0,
          altitude: position.altitude ?? 0,
          heading: position.heading ?? 0,
          airspeedIndicated: position.airspeedIndicated ?? 0,
          airspeedTrue: position.airspeedTrue ?? 0,
          groundSpeed: position.groundSpeed ?? 0,
          verticalSpeed: position.verticalSpeed ?? 0,
          pitch: position.pitch ?? 0,
          bank: position.bank ?? 0,
          altitudeAgl: position.altitudeAgl ?? 0,
          totalWeight: position.totalWeight ?? 0,
          gForce: position.gForce ?? 1,
        };
        const exceedanceEvents = exceedanceDetector.check(
          exceedancePosition,
          phase,
          (flightState.simOnGround as boolean) ?? true,
        );

        // Detect landing-triggered exceedances on phase change
        if (phase !== previousPhase) {
          const phaseEvents = exceedanceDetector.onPhaseChange(previousPhase, phase);
          exceedanceEvents.push(...phaseEvents);
          previousPhase = phase;
        }

        // Emit exceedances to renderer and VPS relay
        for (const evt of exceedanceEvents) {
          mainWindow?.webContents.send(IpcChannels.SIM_EXCEEDANCE, evt);
          vpsRelay?.emitExceedance(evt);
        }

        const snapshot = {
          aircraft: {
            position: latestData.position ?? {},
            autopilot: latestData.autopilot ?? {},
            ...radio,   // transponder, com1, com2, nav1, nav2
            ...info,     // title, atcId, atcType, atcModel
          },
          engine: latestData.engine ?? {},
          fuel: latestData.fuel ?? {},
          flight: { ...flightState, phase },
          timestamp: new Date().toISOString(),
        };
        mainWindow!.webContents.send(IpcChannels.SIM_TELEMETRY, snapshot);
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

  // Start connection loop AFTER all listeners are registered — ensures
  // the 'connected' event is never missed if MSFS is already running.
  sim.connect();

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
