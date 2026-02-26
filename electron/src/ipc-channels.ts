/**
 * Typed IPC channel constants shared between main process and preload script.
 * Keep in sync — both files import from here.
 */

export const IpcChannels = {
  // App lifecycle
  APP_QUIT: 'app:quit',
  APP_MINIMIZE: 'app:minimize',
  APP_MAXIMIZE: 'app:maximize',
  APP_IS_MAXIMIZED: 'app:is-maximized',

  // Window controls (frameless titlebar)
  WINDOW_CLOSE: 'window:close',
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE_TOGGLE: 'window:maximize-toggle',

  // Backend server status
  BACKEND_STATUS: 'backend:status',
  BACKEND_PORT: 'backend:port',

  // SimConnect status (forwarded from backend)
  SIM_STATUS: 'sim:status',
  SIM_TELEMETRY: 'sim:telemetry',

  // Relay auth (renderer → main after login)
  RELAY_AUTH: 'relay:auth',

  // Auto-updater
  UPDATE_CHECK: 'update:check',
  UPDATE_AVAILABLE: 'update:available',
  UPDATE_DOWNLOADED: 'update:downloaded',
  UPDATE_INSTALL: 'update:install',
  UPDATE_PROGRESS: 'update:progress',
  UPDATE_ERROR: 'update:error',

  // Settings (read/write app settings on disk)
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_GET_ALL: 'settings:get-all',

  // SimBrief session
  SIMBRIEF_CLEAR_SESSION: 'simbrief:clear-session',

  // Developer tools
  DEVTOOLS_TOGGLE: 'devtools:toggle',

  // Window maximize state (main → renderer)
  WINDOW_MAXIMIZED_CHANGE: 'window:maximized-change',

  // File system (scoped)
  FILE_OPEN_DIALOG: 'file:open-dialog',
  FILE_SAVE_DIALOG: 'file:save-dialog',
} as const;

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];
