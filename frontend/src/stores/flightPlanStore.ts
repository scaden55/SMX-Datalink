import { create } from 'zustand';
import type { FlightPlan, FlightPlanProgress } from '@acars/shared';

interface FlightPlanState {
  flightPlan: FlightPlan | null;
  progress: FlightPlanProgress | null;
  setFlightPlan: (plan: FlightPlan) => void;
  setProgress: (progress: FlightPlanProgress) => void;
}

export const useFlightPlanStore = create<FlightPlanState>((set) => ({
  flightPlan: null,
  progress: null,
  setFlightPlan: (plan) => set({ flightPlan: plan }),
  setProgress: (progress) => set({ progress }),
}));
