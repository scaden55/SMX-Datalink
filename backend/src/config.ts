import 'dotenv/config';
import { randomBytes } from 'crypto';
import { logger } from './lib/logger.js';

const isDev = process.env.NODE_ENV !== 'production';

if (!isDev && !process.env.JWT_SECRET) {
  throw new Error('[Config] JWT_SECRET environment variable is required in production');
}

if (!isDev && !process.env.CORS_ORIGIN) {
  logger.warn('Config', 'CORS_ORIGIN not set — defaulting to http://localhost:5173');
}

if (!isDev && !process.env.SIMBRIEF_API_KEY) {
  logger.warn('Config', 'SIMBRIEF_API_KEY not set — SimBrief integration will not work');
}

// Generate a random dev secret on startup so it's never guessable
const devJwtSecret = randomBytes(64).toString('hex');

export const config = {
  isDev,
  port: parseInt(process.env.PORT || '3001', 10),
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map(s => s.trim()),
  simconnectEnabled: process.env.SIMCONNECT_ENABLED !== 'false',
  simconnect: {
    appName: 'ACARS System',
    pollInterval: parseInt(process.env.SIMCONNECT_POLL_INTERVAL || '200', 10),
    reconnectInterval: parseInt(process.env.SIMCONNECT_RECONNECT_INTERVAL || '5000', 10),
  },
  jwtSecret: process.env.JWT_SECRET || devJwtSecret,
  jwtAccessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
  jwtRefreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  dbPath: process.env.DB_PATH || './data/acars.db',
  simbriefApiKey: process.env.SIMBRIEF_API_KEY || '',
  /** Maximum JSON body size for Express requests */
  maxBodySize: process.env.MAX_BODY_SIZE || '1mb',
  vatsim: {
    enabled: process.env.VATSIM_ENABLED !== 'false',
    pollIntervalMs: parseInt(process.env.VATSIM_POLL_INTERVAL || '15000', 10),
    dataUrl: process.env.VATSIM_DATA_URL || 'https://data.vatsim.net/v3/vatsim-data.json',
    transceiversUrl: process.env.VATSIM_TRANSCEIVERS_URL || 'https://data.vatsim.net/v3/transceivers-data.json',
  },
} as const;
