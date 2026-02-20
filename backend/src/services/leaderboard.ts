import { getDb } from '../db/index.js';
import type { LeaderboardEntry, LeaderboardResponse } from '@acars/shared';

export class LeaderboardService {

  getLeaderboard(month?: string): LeaderboardResponse {
    const { where, params, period } = this.buildFilter(month);

    const sql = `
      SELECT
        u.callsign,
        u.first_name || ' ' || u.last_name AS pilot_name,
        COUNT(*)                            AS flights,
        COALESCE(SUM(l.flight_time_min), 0) AS hours_min,
        COALESCE(SUM(l.cargo_lbs), 0)       AS cargo_lbs,
        AVG(l.landing_rate_fpm)             AS landing_rate_fpm,
        AVG(l.score)                        AS avg_score
      FROM logbook l
      LEFT JOIN users u ON u.id = l.user_id
      ${where}
      GROUP BY l.user_id
      ORDER BY flights DESC, hours_min DESC
      LIMIT 10
    `;

    const rows = getDb().prepare(sql).all(...params) as any[];
    const entries: LeaderboardEntry[] = rows.map((r, i) => ({
      rank: i + 1,
      callsign: r.callsign ?? 'Unknown',
      pilotName: r.pilot_name ?? 'Unknown',
      flights: r.flights,
      hoursMin: r.hours_min ?? 0,
      cargoLbs: r.cargo_lbs ?? 0,
      landingRateFpm: r.landing_rate_fpm != null ? Math.round(r.landing_rate_fpm) : null,
      avgScore: r.avg_score != null ? Math.round(r.avg_score) : null,
    }));

    return { period, entries };
  }

  private buildFilter(month?: string): {
    where: string;
    params: unknown[];
    period: string;
  } {
    if (!month) {
      const now = new Date();
      month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    const [y, m] = month.split('-').map(Number);
    const start = `${y}-${String(m).padStart(2, '0')}-01T00:00:00`;
    const nextMonth = m === 12
      ? `${y + 1}-01-01T00:00:00`
      : `${y}-${String(m + 1).padStart(2, '0')}-01T00:00:00`;

    return {
      where: "WHERE l.status = 'approved' AND l.actual_dep >= ? AND l.actual_dep < ?",
      params: [start, nextMonth],
      period: month,
    };
  }
}
