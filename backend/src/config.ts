import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  simconnect: {
    appName: 'ACARS System',
    pollInterval: parseInt(process.env.SIMCONNECT_POLL_INTERVAL || '1000', 10),
    reconnectInterval: parseInt(process.env.SIMCONNECT_RECONNECT_INTERVAL || '5000', 10),
  },
} as const;
