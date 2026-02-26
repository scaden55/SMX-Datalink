import { create } from 'zustand';
import type { ActiveFlightHeartbeat } from '@acars/shared';

interface ActiveFlightsState {
  flights: ActiveFlightHeartbeat[];
  setFlights: (flights: ActiveFlightHeartbeat[]) => void;
}

export const useActiveFlightsStore = create<ActiveFlightsState>((set) => ({
  flights: [],
  setFlights: (flights) => set({ flights }),
}));
