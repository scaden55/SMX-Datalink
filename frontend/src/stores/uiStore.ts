import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ViewMode = 'planning' | 'map' | 'both';

export type InfoTab =
  | 'weather'
  | 'notam'
  | 'airport-info'
  | 'suitability'
  | 'ofp'
  | 'messages'
  | 'tracks'
  | 'advisories'
  | 'flight-log'
  | 'cargo';

interface UIState {
  // Existing dispatch view state
  viewMode: ViewMode;
  activeTab: InfoTab;
  sidebarOpen: boolean;
  setViewMode: (mode: ViewMode) => void;
  setActiveTab: (tab: InfoTab) => void;
  toggleSidebar: () => void;

  // Global navigation state
  navCollapsed: boolean;
  setNavCollapsed: (collapsed: boolean) => void;
  toggleNav: () => void;

  // Developer mode
  devMode: boolean;
  setDevMode: (enabled: boolean) => void;
  debugOverlayOpen: boolean;
  toggleDebugOverlay: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      viewMode: 'both',
      activeTab: 'airport-info',
      sidebarOpen: true,
      setViewMode: (mode) => set({ viewMode: mode }),
      setActiveTab: (tab) => set({ activeTab: tab }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

      navCollapsed: false,
      setNavCollapsed: (collapsed) => set({ navCollapsed: collapsed }),
      toggleNav: () => set((s) => ({ navCollapsed: !s.navCollapsed })),

      devMode: false,
      setDevMode: (enabled) => set({ devMode: enabled }),
      debugOverlayOpen: false,
      toggleDebugOverlay: () => set((s) => ({ debugOverlayOpen: !s.debugOverlayOpen })),
    }),
    {
      name: 'acars-ui',
      partialize: (state) => ({
        navCollapsed: state.navCollapsed,
        devMode: state.devMode,
      }),
    },
  ),
);
