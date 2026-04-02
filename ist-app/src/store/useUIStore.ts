import { create } from 'zustand'

interface UIState {
  selectedNodeId: string | null
  sidebarOpen: boolean
  settingsOpen: boolean
  showWelcome: boolean
  deleteConfirmNodeId: string | null

  selectNode: (id: string | null) => void
  openSidebar: () => void
  closeSidebar: () => void
  toggleSettings: () => void
  setShowWelcome: (show: boolean) => void
  setDeleteConfirmNodeId: (id: string | null) => void
}

export const useUIStore = create<UIState>((set) => ({
  selectedNodeId: null,
  sidebarOpen: false,
  settingsOpen: false,
  showWelcome: true,
  deleteConfirmNodeId: null,

  selectNode: (id) =>
    set({ selectedNodeId: id, sidebarOpen: id !== null }),

  openSidebar: () => set({ sidebarOpen: true }),
  closeSidebar: () => set({ sidebarOpen: false, selectedNodeId: null }),
  toggleSettings: () => set((s) => ({ settingsOpen: !s.settingsOpen })),
  setShowWelcome: (show) => set({ showWelcome: show }),
  setDeleteConfirmNodeId: (id) => set({ deleteConfirmNodeId: id })
}))
