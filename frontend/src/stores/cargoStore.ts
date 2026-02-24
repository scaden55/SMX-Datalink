import { create } from 'zustand';
import type { CargoConfig, CargoManifest, CargoCategoryCode } from '@acars/shared';

interface CargoState {
  // Configuration (user preferences)
  config: CargoConfig;
  setCargoMode: (mode: CargoConfig['cargoMode']) => void;
  setPrimaryCategory: (cat: CargoCategoryCode) => void;
  setUseRealWorldCompanies: (use: boolean) => void;

  // Generated manifest
  manifest: CargoManifest | null;
  setManifest: (m: CargoManifest | null) => void;

  // Loading state
  generating: boolean;
  setGenerating: (g: boolean) => void;

  // Reset
  clearCargo: () => void;
}

export const useCargoStore = create<CargoState>((set) => ({
  config: {
    cargoMode: 'mixed',
    primaryCategory: 'general_freight',
    useRealWorldCompanies: false,
  },
  setCargoMode: (mode) => set((s) => ({ config: { ...s.config, cargoMode: mode } })),
  setPrimaryCategory: (cat) => set((s) => ({ config: { ...s.config, primaryCategory: cat } })),
  setUseRealWorldCompanies: (use) => set((s) => ({ config: { ...s.config, useRealWorldCompanies: use } })),

  manifest: null,
  setManifest: (m) => set({ manifest: m }),

  generating: false,
  setGenerating: (g) => set({ generating: g }),

  clearCargo: () => set({ manifest: null, generating: false }),
}));
