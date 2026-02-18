import { create } from 'zustand';

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
  | 'flight-log';

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
}

export const useUIStore = create<UIState>((set) => ({
  viewMode: 'both',
  activeTab: 'airport-info',
  sidebarOpen: true,
  setViewMode: (mode) => set({ viewMode: mode }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  navCollapsed: false,
  setNavCollapsed: (collapsed) => set({ navCollapsed: collapsed }),
  toggleNav: () => set((s) => ({ navCollapsed: !s.navCollapsed })),
}));
