import type {
  VatsimPilot,
  VatsimController,
  VatsimAtis,
  VatsimGeneral,
  VatsimTransceiverEntry,
  VatsimControllerWithPosition,
  VatsimDataSnapshot,
  VatsimFlightStatus,
} from '@acars/shared';
import { VatsimBoundaryService } from './vatsim-boundaries.js';
import { getDb } from '../db/index.js';

interface VatsimDataFeed {
  general: VatsimGeneral;
  pilots: VatsimPilot[];
  controllers: VatsimController[];
  atis: VatsimAtis[];
}

interface VatsimConfig {
  enabled: boolean;
  pollIntervalMs: number;
  dataUrl: string;
  transceiversUrl: string;
}

/**
 * Polls the public VATSIM v3 data feed on a configurable interval,
 * enriches controllers with transceiver positions + boundary IDs,
 * and caches the result in memory for REST + WebSocket consumers.
 */
export class VatsimService {
  private snapshot: VatsimDataSnapshot | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private detectionTimer: ReturnType<typeof setInterval> | null = null;
  private boundaryService: VatsimBoundaryService;
  private config: VatsimConfig;
  private onUpdate?: (snapshot: VatsimDataSnapshot) => void;
  private onFlightStatus?: (status: VatsimFlightStatus) => void;

  constructor(config: VatsimConfig) {
    this.config = config;
    this.boundaryService = new VatsimBoundaryService();
  }

  /** Register callback for snapshot updates (used by WebSocket handler) */
  setOnUpdate(cb: (snapshot: VatsimDataSnapshot) => void): void {
    this.onUpdate = cb;
  }

  /** Register callback for flight VATSIM status changes */
  setOnFlightStatus(cb: (status: VatsimFlightStatus) => void): void {
    this.onFlightStatus = cb;
  }

  /** Start polling loop */
  start(): void {
    if (!this.config.enabled) {
      console.log('[VatsimService] Disabled by config');
      return;
    }

    console.log(`[VatsimService] Starting poll every ${this.config.pollIntervalMs / 1000}s`);
    // Fetch immediately, then on interval
    this.poll();
    this.pollTimer = setInterval(() => this.poll(), this.config.pollIntervalMs);

    // Active flight detection every 30s
    this.detectionTimer = setInterval(() => this.checkActiveFlightsVatsimStatus(), 30_000);
  }

  /** Stop polling */
  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.detectionTimer) {
      clearInterval(this.detectionTimer);
      this.detectionTimer = null;
    }
    console.log('[VatsimService] Stopped');
  }

  /** Get the latest cached snapshot */
  getSnapshot(): VatsimDataSnapshot | null {
    return this.snapshot;
  }

  /** Get boundary service (for REST route to serve GeoJSON) */
  getBoundaryService(): VatsimBoundaryService {
    return this.boundaryService;
  }

  /**
   * Find a pilot on VATSIM matching a callsign, optionally filtered by dep/arr airports.
   * Used for auto-detecting VATSIM connections for SMA flights.
   */
  findPilotOnVatsim(callsign: string, depIcao?: string, arrIcao?: string): VatsimPilot | null {
    if (!this.snapshot) return null;

    const normalCallsign = callsign.toUpperCase().replace(/[-\s]/g, '');

    for (const pilot of this.snapshot.pilots) {
      const pilotCs = pilot.callsign.toUpperCase().replace(/[-\s]/g, '');
      if (pilotCs !== normalCallsign) continue;

      // If dep/arr filters provided, check flight plan
      if (depIcao || arrIcao) {
        if (!pilot.flight_plan) continue;
        if (depIcao && pilot.flight_plan.departure !== depIcao) continue;
        if (arrIcao && pilot.flight_plan.arrival !== arrIcao) continue;
      }

      return pilot;
    }

    return null;
  }

  // ── Private ───────────────────────────────────────────────────

  private async poll(): Promise<void> {
    try {
      const [dataRes, transRes] = await Promise.all([
        fetch(this.config.dataUrl),
        fetch(this.config.transceiversUrl),
      ]);

      if (!dataRes.ok || !transRes.ok) {
        console.warn(`[VatsimService] Poll failed: data=${dataRes.status} trans=${transRes.status}`);
        return;
      }

      const data = await dataRes.json() as VatsimDataFeed;
      const transceivers = await transRes.json() as VatsimTransceiverEntry[];

      // Build callsign -> position map from transceivers
      const posMap = new Map<string, { lat: number; lon: number }>();
      for (const entry of transceivers) {
        if (entry.transceivers.length > 0) {
          const t = entry.transceivers[0];
          posMap.set(entry.callsign, { lat: t.latDeg, lon: t.lonDeg });
        }
      }

      // Enrich controllers with positions + boundary IDs
      const controllers: VatsimControllerWithPosition[] = data.controllers.map((ctrl) => {
        const pos = posMap.get(ctrl.callsign);
        const parsed = this.boundaryService.parseCallsign(ctrl.callsign);
        const boundaryId = this.boundaryService.resolveBoundary(ctrl.callsign, ctrl.facility);
        return {
          ...ctrl,
          latitude: pos?.lat ?? null,
          longitude: pos?.lon ?? null,
          boundaryId,
          parsed,
        };
      });

      this.snapshot = {
        general: data.general,
        pilots: data.pilots,
        controllers,
        atis: data.atis,
        updatedAt: new Date().toISOString(),
      };

      // Notify subscribers
      if (this.onUpdate) {
        this.onUpdate(this.snapshot);
      }
    } catch (err) {
      console.warn('[VatsimService] Poll error:', err);
    }
  }

  /**
   * Check active flights against VATSIM pilot list.
   * Updates the DB and emits status events for changed flights.
   */
  private checkActiveFlightsVatsimStatus(): void {
    if (!this.snapshot) return;

    try {
      const db = getDb();
      const rows = db.prepare(`
        SELECT ab.id AS bid_id, u.callsign AS pilot_callsign,
               sf.dep_icao, sf.arr_icao,
               ab.vatsim_connected
        FROM active_bids ab
        JOIN users u ON u.id = ab.user_id
        JOIN scheduled_flights sf ON sf.id = ab.schedule_id
      `).all() as Array<{
        bid_id: number;
        pilot_callsign: string;
        dep_icao: string;
        arr_icao: string;
        vatsim_connected: number;
      }>;

      for (const row of rows) {
        const pilot = this.findPilotOnVatsim(row.pilot_callsign, row.dep_icao, row.arr_icao);
        const nowConnected = pilot !== null;
        const wasConnected = row.vatsim_connected === 1;

        if (nowConnected !== wasConnected) {
          db.prepare(`
            UPDATE active_bids
            SET vatsim_connected = ?, vatsim_callsign = ?, vatsim_cid = ?
            WHERE id = ?
          `).run(
            nowConnected ? 1 : 0,
            pilot?.callsign ?? null,
            pilot?.cid ?? null,
            row.bid_id,
          );

          const status: VatsimFlightStatus = {
            bidId: row.bid_id,
            vatsimConnected: nowConnected,
            vatsimCallsign: pilot?.callsign ?? null,
            vatsimCid: pilot?.cid ?? null,
          };

          if (this.onFlightStatus) {
            this.onFlightStatus(status);
          }
        }
      }
    } catch (err) {
      console.warn('[VatsimService] Flight status check error:', err);
    }
  }
}
