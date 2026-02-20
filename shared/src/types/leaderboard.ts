export interface LeaderboardEntry {
  rank: number;
  callsign: string;
  pilotName: string;
  flights: number;
  hoursMin: number;
  cargoLbs: number;
  landingRateFpm: number | null;
  avgScore: number | null;
}

export interface LeaderboardResponse {
  period: string;
  entries: LeaderboardEntry[];
}
