import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { config } from './config.js';
import { NullSimConnectManager } from './simconnect/null-manager.js';
import type { ISimConnectManager } from './simconnect/types.js';
import { TelemetryService } from './services/telemetry.js';
import { setupWebSocket } from './websocket/handler.js';
import { healthRouter } from './routes/health.js';
import { aircraftRouter } from './routes/aircraft.js';
import { flightRouter } from './routes/flight.js';
import { fuelRouter } from './routes/fuel.js';
import { engineRouter } from './routes/engine.js';

const app = express();
const httpServer = createServer(app);

// Middleware
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

// SimConnect — conditionally loaded
let simConnect: ISimConnectManager;

if (config.simconnectEnabled) {
  try {
    const { SimConnectManager } = await import('./simconnect/connection.js');
    simConnect = new SimConnectManager();
    console.log('[Server] SimConnect enabled');
  } catch (err) {
    console.warn('[Server] SimConnect module not available — running in server-only mode');
    simConnect = new NullSimConnectManager();
  }
} else {
  console.log('[Server] SimConnect disabled (SIMCONNECT_ENABLED=false)');
  simConnect = new NullSimConnectManager();
}

const telemetry = new TelemetryService(simConnect);

// REST API routes
app.use('/api', healthRouter(simConnect));
app.use('/api', aircraftRouter(telemetry, config.simconnectEnabled));
app.use('/api', flightRouter(telemetry, config.simconnectEnabled));
app.use('/api', fuelRouter(telemetry, config.simconnectEnabled));
app.use('/api', engineRouter(telemetry, config.simconnectEnabled));

// WebSocket
setupWebSocket(httpServer, telemetry, simConnect);

// Start
httpServer.listen(config.port, () => {
  console.log(`[Server] ACARS backend running on http://localhost:${config.port}`);
  console.log(`[Server] REST API: http://localhost:${config.port}/api`);
  console.log(`[Server] WebSocket: ws://localhost:${config.port}`);

  // Begin SimConnect connection loop (no-op if disabled)
  simConnect.connect();
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down...');
  simConnect.disconnect();
  httpServer.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
  simConnect.disconnect();
  httpServer.close(() => process.exit(0));
});
