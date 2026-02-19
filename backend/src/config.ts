import 'dotenv/config';

const isDev = process.env.NODE_ENV !== 'production';

if (!isDev && !process.env.JWT_SECRET) {
  throw new Error('[Config] JWT_SECRET environment variable is required in production');
}

if (!isDev && !process.env.SIMBRIEF_API_KEY) {
  console.warn('[Config] SIMBRIEF_API_KEY not set — SimBrief integration will not work');
}

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  simconnectEnabled: process.env.SIMCONNECT_ENABLED !== 'false',
  simconnect: {
    appName: 'ACARS System',
    pollInterval: parseInt(process.env.SIMCONNECT_POLL_INTERVAL || '1000', 10),
    reconnectInterval: parseInt(process.env.SIMCONNECT_RECONNECT_INTERVAL || '5000', 10),
  },
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  jwtAccessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
  jwtRefreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  dbPath: process.env.DB_PATH || './data/acars.db',
  simbriefApiKey: process.env.SIMBRIEF_API_KEY || '',
  /** Maximum JSON body size for Express requests */
  maxBodySize: process.env.MAX_BODY_SIZE || '1mb',
} as const;
