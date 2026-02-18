import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { config } from './config.js';
import { SimConnectManager } from './simconnect/connection.js';
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

// SimConnect
const simConnect = new SimConnectManager();
const telemetry = new TelemetryService(simConnect);

// REST API routes
app.use('/api', healthRouter(simConnect));
app.use('/api', aircraftRouter(telemetry));
app.use('/api', flightRouter(telemetry));
app.use('/api', fuelRouter(telemetry));
app.use('/api', engineRouter(telemetry));

// WebSocket
setupWebSocket(httpServer, telemetry, simConnect);

// Start
httpServer.listen(config.port, () => {
  console.log(`[Server] ACARS backend running on http://localhost:${config.port}`);
  console.log(`[Server] REST API: http://localhost:${config.port}/api`);
  console.log(`[Server] WebSocket: ws://localhost:${config.port}`);

  // Begin SimConnect connection loop
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
