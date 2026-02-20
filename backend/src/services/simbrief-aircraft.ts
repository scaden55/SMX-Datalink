import type { SimBriefAircraftType } from '@acars/shared';

const SIMBRIEF_AIRFRAMES_URL = 'https://www.simbrief.com/api/inputs.airframes.json';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  aircraft: SimBriefAircraftType[];
  fetchedAt: number;
}

export class SimBriefAircraftService {
  private cache: CacheEntry | null = null;
  private inflight: Promise<SimBriefAircraftType[]> | null = null;

  /** Search cached SimBrief airframes by ICAO code, name, or engine string */
  async search(query: string): Promise<SimBriefAircraftType[]> {
    const all = await this.getAll();
    if (!query || query.length < 2) return all.slice(0, 50);

    const q = query.toLowerCase();
    return all.filter(a =>
      a.aircraftIcao.toLowerCase().includes(q) ||
      a.aircraftName.toLowerCase().includes(q) ||
      (a.engines || '').toLowerCase().includes(q)
    );
  }

  /** Fetch (or return cached) full airframes list */
  private async getAll(): Promise<SimBriefAircraftType[]> {
    if (this.cache && Date.now() - this.cache.fetchedAt < CACHE_TTL_MS) {
      return this.cache.aircraft;
    }

    // Deduplicate concurrent fetches
    if (this.inflight) return this.inflight;

    this.inflight = this.fetchAndTransform();
    try {
      const result = await this.inflight;
      return result;
    } finally {
      this.inflight = null;
    }
  }

  private async fetchAndTransform(): Promise<SimBriefAircraftType[]> {
    console.log('[SimBrief] Fetching airframes database...');
    const resp = await fetch(SIMBRIEF_AIRFRAMES_URL);
    if (!resp.ok) throw new Error(`SimBrief API returned ${resp.status}`);

    // API returns a flat object keyed by ICAO code: { "B738": {...}, "A320": {...}, ... }
    const data = await resp.json() as Record<string, any>;
    const result: SimBriefAircraftType[] = [];

    for (const [icao, entry] of Object.entries(data)) {
      if (!icao || typeof entry !== 'object') continue;

      // Weight/equipment data lives in airframes[0].airframe_options
      const afVariant = Array.isArray(entry.airframes) ? entry.airframes[0] : null;
      const opts = afVariant?.airframe_options ?? {};

      const mtow = this.parseLbs(entry.aircraft_mtow_lbs ?? opts.mtow);
      const oew = this.parseLbs(opts.oew);
      const mzfw = this.parseLbs(opts.mzfw);
      const mlw = this.parseLbs(opts.mlw);
      const maxFuel = this.parseLbs(opts.maxfuel);
      const ceiling = this.parseInt(entry.aircraft_ceiling ?? opts.ceiling);
      const maxPax = this.parseInt(opts.maxpax ?? entry.aircraft_passengers);

      // Speed: could be "Mach 0.78" or numeric kts
      const rawSpeed = entry.aircraft_speed ?? '0';
      let speed = 0;
      if (typeof rawSpeed === 'string' && rawSpeed.toLowerCase().startsWith('mach')) {
        const mach = parseFloat(rawSpeed.replace(/[^0-9.]/g, ''));
        speed = Math.round(mach * 573); // Mach to kts approximation
      } else {
        speed = this.parseInt(rawSpeed);
      }

      result.push({
        aircraftIcao: icao.toUpperCase(),
        aircraftName: entry.aircraft_name ?? entry.aircraft_search ?? icao,
        engines: String(entry.aircraft_engines ?? opts.engines ?? ''),
        passengers: maxPax,
        mtowLbs: mtow,
        speed,
        ceilingFt: ceiling,
        fuelflowLbs: this.parseInt(entry.aircraft_fuelflow_lbs),
        isCargo: entry.aircraft_is_cargo === true || entry.aircraft_is_cargo === 1,
        oewLbs: oew,
        mzfwLbs: mzfw,
        mlwLbs: mlw,
        maxFuelLbs: maxFuel,
        maxPax,
        cat: opts.cat ?? '',
        equipCode: opts.equip ?? '',
        transponderCode: opts.transponder ?? '',
        pbn: opts.pbn ?? '',
      });
    }

    this.cache = { aircraft: result, fetchedAt: Date.now() };
    console.log(`[SimBrief] Cached ${result.length} aircraft types`);
    return result;
  }

  private parseLbs(val: unknown): number {
    if (typeof val === 'number') return Math.round(val);
    if (typeof val === 'string') return globalThis.parseInt(val, 10) || 0;
    return 0;
  }

  private parseInt(val: unknown): number {
    if (typeof val === 'number') return Math.round(val);
    if (typeof val === 'string') return globalThis.parseInt(val, 10) || 0;
    return 0;
  }

  get cachedAt(): string | null {
    return this.cache ? new Date(this.cache.fetchedAt).toISOString() : null;
  }
}
