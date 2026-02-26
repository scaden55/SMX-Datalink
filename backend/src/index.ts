import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { config } from './config.js';
import { NullSimConnectManager } from './simconnect/null-manager.js';
import type { ISimConnectManager } from './simconnect/types.js';
import { TelemetryService } from './services/telemetry.js';
import { setupWebSocket } from './websocket/handler.js';
import { initializeDatabase, closeDatabase } from './db/index.js';
import { seedDatabase } from './db/seed.js';
import { healthRouter } from './routes/health.js';
import { aircraftRouter } from './routes/aircraft.js';
import { flightRouter } from './routes/flight.js';
import { fuelRouter } from './routes/fuel.js';
import { engineRouter } from './routes/engine.js';
import { authRouter } from './routes/auth.js';
import { adminRouter } from './routes/admin.js';
import { scheduleRouter } from './routes/schedules.js';
import { flightPlanRouter } from './routes/flight-plan.js';
import { dispatchRouter } from './routes/dispatch.js';
import { faaRouter } from './routes/faa.js';
import { fleetManageRouter } from './routes/fleet.js';
import { logbookRouter } from './routes/logbook.js';
import { reportsRouter } from './routes/reports.js';
import { leaderboardRouter } from './routes/leaderboard.js';
import { newsRouter } from './routes/news.js';
import { adminUsersRouter } from './routes/admin-users.js';
import { adminSchedulesRouter } from './routes/admin-schedules.js';
import { adminAirportsRouter } from './routes/admin-airports.js';
import { adminPirepsRouter } from './routes/admin-pireps.js';
import { adminFinancesRouter } from './routes/admin-finances.js';
import { adminSettingsRouter } from './routes/admin-settings.js';
import { adminAuditRouter } from './routes/admin-audit.js';
import { adminMaintenanceRouter } from './routes/admin-maintenance.js';
import { notificationsRouter } from './routes/notifications.js';
import { SettingsService } from './services/settings.js';
import { AuthService } from './services/auth.js';
import { VatsimService } from './services/vatsim.js';
import { vatsimRouter } from './routes/vatsim.js';
import { airportDetailRouter } from './routes/airports.js';
import { trackRouter } from './routes/track.js';
import { navdataRouter } from './routes/navdata.js';
import { regulatoryRouter } from './routes/regulatory.js';
import { cargoRouter } from './routes/cargo.js';
import { TrackService } from './services/track.js';
import { FlightEventTracker } from './services/flight-event-tracker.js';
import { CharterGeneratorService, currentMonth } from './services/charter-generator.js';
import { VatsimEventsService } from './services/vatsim-events.js';
import { needsAirportData, importAirportData } from './services/airport-data.js';
import { logger } from './lib/logger.js';

// Initialize database before anything else
initializeDatabase();
seedDatabase();
new SettingsService().seedDefaults();

const app = express();
const httpServer = createServer(app);

// Security headers
app.use(helmet());

// CORS
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: config.maxBodySize }));

// Rate limiting on auth endpoints — 15 requests per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/refresh', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many refresh requests' },
}));

// SimConnect — conditionally loaded
let simConnect: ISimConnectManager;

if (config.simconnectEnabled) {
  try {
    const { SimConnectManager } = await import('./simconnect/connection.js');
    simConnect = new SimConnectManager();
    logger.info('Server', 'SimConnect enabled');
  } catch (err) {
    logger.warn('Server', 'SimConnect module not available — running in server-only mode');
    simConnect = new NullSimConnectManager();
  }
} else {
  logger.info('Server', 'SimConnect disabled (SIMCONNECT_ENABLED=false)');
  simConnect = new NullSimConnectManager();
}

const telemetry = new TelemetryService(simConnect);
const flightEventTracker = new FlightEventTracker();

// Root
app.get('/', (_req, res) => {
  res.json({ name: 'SMX ACARS API', version: '1.0.0', status: 'online' });
});

// REST API routes
app.use('/api', healthRouter(simConnect));
app.use('/api', aircraftRouter(telemetry, config.simconnectEnabled));
app.use('/api', flightRouter(telemetry, config.simconnectEnabled));
app.use('/api', fuelRouter(telemetry, config.simconnectEnabled));
app.use('/api', engineRouter(telemetry, config.simconnectEnabled));
app.use('/api', authRouter());
app.use('/api', scheduleRouter());
app.use('/api', adminRouter());
app.use('/api', flightPlanRouter());
app.use('/api', faaRouter());
app.use('/api', fleetManageRouter());
app.use('/api', logbookRouter());
app.use('/api', reportsRouter());
app.use('/api', leaderboardRouter());
app.use('/api', newsRouter());
app.use('/api', adminUsersRouter());
app.use('/api', adminSchedulesRouter());
app.use('/api', adminAirportsRouter());
app.use('/api', adminPirepsRouter());
app.use('/api', adminFinancesRouter());
app.use('/api', adminSettingsRouter());
app.use('/api', adminAuditRouter());
app.use('/api', adminMaintenanceRouter());
app.use('/api', notificationsRouter());
app.use('/api', airportDetailRouter());
app.use('/api', trackRouter());
app.use('/api', navdataRouter());
app.use('/api', regulatoryRouter());
app.use('/api', cargoRouter());

// VATSIM service
const vatsimService = new VatsimService(config.vatsim);
app.use('/api', vatsimRouter(vatsimService));

// WebSocket
const io = setupWebSocket(httpServer, telemetry, simConnect, vatsimService, flightEventTracker);

// Register dispatch router with io for real-time broadcasts
app.use('/api', dispatchRouter(io, telemetry, flightEventTracker));

// Periodic cleanup of expired refresh tokens (every hour)
const authService = new AuthService();
const trackCleanupService = new TrackService();
const cleanupInterval = setInterval(() => {
  try {
    authService.cleanupExpiredTokens();
  } catch (err) {
    logger.error('Server', 'Token cleanup error', err);
  }
  try {
    const deleted = trackCleanupService.cleanup();
    if (deleted > 0) logger.info('Server', `Track cleanup: removed ${deleted} rows older than 30 days`);
  } catch (err) {
    logger.error('Server', 'Track cleanup error', err);
  }
}, 60 * 60 * 1000);
cleanupInterval.unref();

// Daily charter generation & VATSIM event refresh (every 24 hours)
const charterDailyGen = new CharterGeneratorService();
const vatsimEventsDaily = new VatsimEventsService();
const charterInterval = setInterval(() => {
  try {
    // Month rollover check — generate new month's charters if needed
    if (charterDailyGen.needsGeneration(currentMonth())) {
      charterDailyGen.generateMonthlyCharters();
    }
    // Cleanup expired charters
    charterDailyGen.cleanupExpired();
  } catch (err) {
    logger.error('Server', 'Daily charter generation error', err);
  }
  // VATSIM events poll (async) — cleanup expired event charters, then regenerate for today
  vatsimEventsDaily.pollEvents()
    .then(() => {
      charterDailyGen.cleanupExpired();
      vatsimEventsDaily.generateEventCharters();
    })
    .catch(err => logger.error('Server', 'Daily VATSIM events poll error', err));
}, 24 * 60 * 60 * 1000);
charterInterval.unref();

// Start
httpServer.listen(config.port, '0.0.0.0', () => {
  logger.info('Server', `ACARS backend running on http://0.0.0.0:${config.port}`);
  logger.info('Server', `REST API: http://localhost:${config.port}/api`);
  logger.info('Server', `WebSocket: ws://localhost:${config.port}`);

  // Begin SimConnect connection loop (no-op if disabled)
  simConnect.connect();

  // Start VATSIM polling
  vatsimService.start();

  // ── Ensure airport data + charter generation on startup ─────
  const charterGen = new CharterGeneratorService();
  const vatsimEventsService = new VatsimEventsService();

  (async () => {
    // Auto-import OurAirports data on first run (needed for charter generation)
    try {
      if (needsAirportData()) {
        await importAirportData();
      }
    } catch (err) {
      logger.error('Server', 'Airport data import failed — charter generation may not work', err);
    }

    // Charter generation (runs after airport data is available)
    try {
      if (charterGen.needsGeneration(currentMonth())) {
        const result = charterGen.generateMonthlyCharters();
        logger.info('Server', `Startup charter generation: ${result.charterCount} charters`);
      }
    } catch (err) {
      logger.error('Server', 'Startup charter generation failed', err);
    }

    // VATSIM events poll — cleanup expired, then generate for today
    try {
      await vatsimEventsService.pollEvents();
      charterGen.cleanupExpired();
      const created = vatsimEventsService.generateEventCharters();
      if (created > 0) logger.info('Server', `Startup event charters: ${created} created`);
    } catch (err) {
      logger.error('Server', 'Startup VATSIM events poll failed', err);
    }
  })();
});

// Graceful shutdown
function shutdown(): void {
  logger.info('Server', 'Shutting down...');
  clearInterval(cleanupInterval);
  clearInterval(charterInterval);
  vatsimService.stop();
  io.close();
  simConnect.disconnect();
  closeDatabase();
  httpServer.close(() => process.exit(0));
  // Force exit after 5 seconds if connections don't close
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
