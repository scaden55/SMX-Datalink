/**
 * Type declarations for the Electron preload bridge.
 * Available on window.electronAPI when running inside Electron.
 * Undefined when running in a regular browser (dev mode without Electron).
 */

interface ElectronAPI {
  // Window controls
  windowClose: () => void;
  windowMinimize: () => void;
  windowMaximizeToggle: () => void;
  isMaximized: () => Promise<boolean>;

  // App
  quit: () => void;

  // Backend
  getBackendPort: () => Promise<number>;
  getBackendStatus: () => Promise<string>;

  // Settings
  getSetting: (key: string) => Promise<unknown>;
  setSetting: (key: string, value: unknown) => Promise<void>;
  getAllSettings: () => Promise<Record<string, unknown>>;

  // File dialogs
  openFileDialog: (options?: unknown) => Promise<{ canceled: boolean; filePaths: string[] }>;
  saveFileDialog: (options?: unknown) => Promise<{ canceled: boolean; filePath: string }>;

  // Developer tools
  toggleDevTools: () => void;

  // Auto-updater
  checkForUpdates: () => void;
  installUpdate: () => void;

  // Event listeners
  on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
  once: (channel: string, callback: (...args: unknown[]) => void) => void;

  // Generic IPC
  send: (channel: string, ...args: unknown[]) => void;
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;

  // Platform info
  platform: string;
  isElectron: true;
}

interface Window {
  electronAPI?: ElectronAPI;
}
