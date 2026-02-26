import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { IpcChannels } from './ipc-channels';

/**
 * Secure IPC bridge exposed to renderer via window.electronAPI.
 *
 * - contextIsolation: true
 * - nodeIntegration: false
 * - Only whitelisted channels are accessible
 */

// Channels the renderer is allowed to send TO main
const SEND_CHANNELS = new Set<string>([
  IpcChannels.WINDOW_CLOSE,
  IpcChannels.WINDOW_MINIMIZE,
  IpcChannels.WINDOW_MAXIMIZE_TOGGLE,
  IpcChannels.APP_QUIT,
  IpcChannels.APP_MINIMIZE,
  IpcChannels.APP_MAXIMIZE,
  IpcChannels.UPDATE_CHECK,
  IpcChannels.UPDATE_INSTALL,
  IpcChannels.DEVTOOLS_TOGGLE,
]);

// Channels the renderer is allowed to invoke (request/response)
const INVOKE_CHANNELS = new Set<string>([
  IpcChannels.APP_IS_MAXIMIZED,
  IpcChannels.BACKEND_PORT,
  IpcChannels.BACKEND_STATUS,
  IpcChannels.SETTINGS_GET,
  IpcChannels.SETTINGS_SET,
  IpcChannels.SETTINGS_GET_ALL,
  IpcChannels.FILE_OPEN_DIALOG,
  IpcChannels.FILE_SAVE_DIALOG,
  IpcChannels.SIMBRIEF_CLEAR_SESSION,
  IpcChannels.RELAY_AUTH,
]);

// Channels the renderer is allowed to listen to FROM main
const RECEIVE_CHANNELS = new Set<string>([
  IpcChannels.BACKEND_STATUS,
  IpcChannels.SIM_STATUS,
  IpcChannels.SIM_TELEMETRY,
  IpcChannels.UPDATE_AVAILABLE,
  IpcChannels.UPDATE_DOWNLOADED,
  IpcChannels.UPDATE_PROGRESS,
  IpcChannels.UPDATE_ERROR,
  IpcChannels.WINDOW_MAXIMIZED_CHANGE,
]);

const electronAPI = {
  // --- Window Controls ---
  windowClose: () => ipcRenderer.send(IpcChannels.WINDOW_CLOSE),
  windowMinimize: () => ipcRenderer.send(IpcChannels.WINDOW_MINIMIZE),
  windowMaximizeToggle: () => ipcRenderer.send(IpcChannels.WINDOW_MAXIMIZE_TOGGLE),
  isMaximized: () => ipcRenderer.invoke(IpcChannels.APP_IS_MAXIMIZED) as Promise<boolean>,

  // --- App ---
  quit: () => ipcRenderer.send(IpcChannels.APP_QUIT),

  // --- Backend ---
  getBackendPort: () => ipcRenderer.invoke(IpcChannels.BACKEND_PORT) as Promise<number>,
  getBackendStatus: () => ipcRenderer.invoke(IpcChannels.BACKEND_STATUS) as Promise<string>,

  // --- Settings ---
  getSetting: (key: string) => ipcRenderer.invoke(IpcChannels.SETTINGS_GET, key),
  setSetting: (key: string, value: unknown) => ipcRenderer.invoke(IpcChannels.SETTINGS_SET, key, value),
  getAllSettings: () => ipcRenderer.invoke(IpcChannels.SETTINGS_GET_ALL),

  // --- File Dialogs ---
  openFileDialog: (options?: Electron.OpenDialogOptions) =>
    ipcRenderer.invoke(IpcChannels.FILE_OPEN_DIALOG, options),
  saveFileDialog: (options?: Electron.SaveDialogOptions) =>
    ipcRenderer.invoke(IpcChannels.FILE_SAVE_DIALOG, options),

  // --- SimBrief Session ---
  clearSimbriefSession: () => ipcRenderer.invoke(IpcChannels.SIMBRIEF_CLEAR_SESSION) as Promise<boolean>,

  // --- Relay Auth ---
  setRelayAuth: (data: { token: string; userId: number; callsign: string; vpsUrl: string }) =>
    ipcRenderer.invoke(IpcChannels.RELAY_AUTH, data),

  // --- Developer Tools ---
  toggleDevTools: () => ipcRenderer.send(IpcChannels.DEVTOOLS_TOGGLE),

  // --- Auto-Updater ---
  checkForUpdates: () => ipcRenderer.send(IpcChannels.UPDATE_CHECK),
  installUpdate: () => ipcRenderer.send(IpcChannels.UPDATE_INSTALL),

  // --- Generic Event Listeners (scoped to allowed channels) ---
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    if (!RECEIVE_CHANNELS.has(channel)) {
      console.warn(`[preload] Blocked listen on disallowed channel: ${channel}`);
      return () => {};
    }

    const listener = (_event: IpcRendererEvent, ...args: unknown[]) => callback(...args);
    ipcRenderer.on(channel, listener);

    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  },

  once: (channel: string, callback: (...args: unknown[]) => void) => {
    if (!RECEIVE_CHANNELS.has(channel)) {
      console.warn(`[preload] Blocked once on disallowed channel: ${channel}`);
      return;
    }
    ipcRenderer.once(channel, (_event: IpcRendererEvent, ...args: unknown[]) => callback(...args));
  },

  // --- Generic Send / Invoke (scoped to allowed channels) ---
  send: (channel: string, ...args: unknown[]) => {
    if (!SEND_CHANNELS.has(channel)) {
      console.warn(`[preload] Blocked send on disallowed channel: ${channel}`);
      return;
    }
    ipcRenderer.send(channel, ...args);
  },

  invoke: (channel: string, ...args: unknown[]) => {
    if (!INVOKE_CHANNELS.has(channel)) {
      console.warn(`[preload] Blocked invoke on disallowed channel: ${channel}`);
      return Promise.reject(new Error(`Channel not allowed: ${channel}`));
    }
    return ipcRenderer.invoke(channel, ...args);
  },

  // --- Platform info ---
  platform: process.platform,
  isElectron: true,
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// TypeScript declaration for the renderer side
export type ElectronAPI = typeof electronAPI;
