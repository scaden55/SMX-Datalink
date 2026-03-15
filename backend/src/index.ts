import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
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
import { adminDashboardRouter } from './routes/admin-dashboard.js';
import { adminFinancialKpisRouter } from './routes/admin-financial-kpis.js';
import { adminMaintenanceSummaryRouter } from './routes/admin-maintenance-summary.js';
import { adminFlightActivityRouter } from './routes/admin-flight-activity.js';
import { adminReportsRouter } from './routes/admin-reports.js';
import { adminNotificationsRouter } from './routes/admin-notifications.js';
import { adminSearchRouter } from './routes/admin-search.js';
import { adminRevenueModelRouter } from './routes/admin-revenue-model.js';
import { adminDiscrepancyRouter } from './routes/admin-discrepancies.js';
import { adminMelMasterRouter } from './routes/admin-mel-master.js';
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
import { discrepancyRouter } from './routes/discrepancies.js';
import { ataChaptersRouter } from './routes/ata-chapters.js';
import { melBriefingRouter } from './routes/mel-briefing.js';
import { TrackService } from './services/track.js';
import { FlightEventTracker } from './services/flight-event-tracker.js';
import { MaintenanceService } from './services/maintenance.js';
import { BidExpirationService } from './services/bid-expiration.js';
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

// Trust Nginx reverse proxy — required for correct client IP in rate limiting
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
  contentSecurityPolicy: config.isDev ? false : {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://api.fontshare.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", "wss:", "ws:", "https://cdn.jsdelivr.net", ...config.corsOrigin],
      fontSrc: ["'self'", "https://cdn.fontshare.com"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
      objectSrc: ["'none'"],
    },
  },
}));

// CORS — supports multiple origins via comma-separated CORS_ORIGIN env var
// When CORS_ORIGIN is '*', use true to reflect the request origin (needed with credentials: true)
const corsOrigin = config.corsOrigin.length === 1 && config.corsOrigin[0] === '*'
  ? true
  : config.corsOrigin;
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: config.maxBodySize }));
app.use(hpp());

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

// VATSIM service (created early so routers can reference it)
const vatsimService = new VatsimService(config.vatsim);

// WebSocket (created early so routers that need `io` can be registered in order)
const io = setupWebSocket(httpServer, telemetry, simConnect, vatsimService, flightEventTracker);

// ── REST API routes ──────────────────────────────────────────────
// IMPORTANT: Registration order matters! Routers with exact paths (e.g. /airports,
// /fleet, /bids/my) must be registered BEFORE routers with param wildcards
// (e.g. /airports/:icao) to prevent the wildcard from shadowing the exact match.

app.use('/api', healthRouter(simConnect, io));
app.use('/api', authRouter());
app.use('/api', scheduleRouter(io));          // /airports, /fleet, /bids/*, /schedules/*
app.use('/api', dispatchRouter(io, telemetry, flightEventTracker)); // /dispatch/flights/*
app.use('/api', fleetManageRouter(io));       // /fleet/manage/*
app.use('/api', aircraftRouter(telemetry, config.simconnectEnabled));
app.use('/api', flightRouter(telemetry, config.simconnectEnabled));
app.use('/api', fuelRouter(telemetry, config.simconnectEnabled));
app.use('/api', engineRouter(telemetry, config.simconnectEnabled));
app.use('/api', flightPlanRouter());
app.use('/api', faaRouter());
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
app.use('/api', adminDashboardRouter());
app.use('/api', adminFinancialKpisRouter());
app.use('/api', adminMaintenanceSummaryRouter());
app.use('/api', adminFlightActivityRouter());
app.use('/api', adminReportsRouter());
app.use('/api', adminNotificationsRouter());
app.use('/api', adminSearchRouter());
app.use('/api', adminRevenueModelRouter());
app.use('/api', adminDiscrepancyRouter());
app.use('/api', adminMelMasterRouter());
app.use('/api', notificationsRouter());
app.use('/api', airportDetailRouter());       // /airports/:icao (AFTER scheduleRouter's /airports)
app.use('/api', trackRouter());
app.use('/api', navdataRouter());
app.use('/api', regulatoryRouter());
app.use('/api', cargoRouter());
app.use('/api', discrepancyRouter());
app.use('/api', ataChaptersRouter());
app.use('/api', melBriefingRouter());
app.use('/api', vatsimRouter(vatsimService));

// Serve admin frontend static files
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const adminDistPath = join(__dirname, '../admin-dist');
// Redirect /admin to /admin/ so relative asset paths resolve correctly
app.get('/admin', (req, res, next) => {
  if (req.path === '/admin' && !req.originalUrl.endsWith('/')) {
    return res.redirect(301, '/admin/');
  }
  next();
});
// Serve admin static assets (JS, CSS, fonts, images)
app.use('/admin', express.static(adminDistPath, { redirect: false, index: false }));
// SPA fallback — serve index.html for /admin/ and all admin sub-routes
app.use('/admin', (_req, res) => {
  res.sendFile(join(adminDistPath, 'index.html'));
});

// Bid expiration sweep (every 5 minutes)
const bidExpiration = new BidExpirationService(io);
bidExpiration.start();

// Periodic cleanup of expired refresh tokens (every hour)
const authService = new AuthService();
const trackCleanupService = new TrackService();
const maintenanceService = new MaintenanceService();
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
  try {
    const expired = maintenanceService.expireOverdueMELs();
    if (expired > 0) logger.info('Server', `MEL auto-expire: ${expired} deferral(s) expired`);
  } catch (err) {
    logger.error('Server', 'MEL auto-expire error', err);
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
  bidExpiration.stop();
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

// Catch unhandled errors so they don't crash the server silently
process.on('uncaughtException', (err) => {
  logger.error('Process', 'Uncaught exception', err);
  // Exit after logging — process is in an unknown state
  shutdown();
});

process.on('unhandledRejection', (reason) => {
  logger.error('Process', 'Unhandled promise rejection', reason);
});
