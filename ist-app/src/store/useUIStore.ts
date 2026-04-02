import { create } from 'zustand'

interface UIState {
  selectedNodeId: string | null
  sidebarOpen: boolean
  /** Panel width in px when the node detail sidebar is open. Clamped to [0.25, 0.5] of window width when resizing. */
  sidebarWidthPx: number
  settingsOpen: boolean
  showWelcome: boolean
  deleteConfirmNodeId: string | null

  selectNode: (id: string | null) => void
  openSidebar: () => void
  closeSidebar: () => void
  setSidebarWidthPx: (width: number) => void
  toggleSettings: () => void
  setShowWelcome: (show: boolean) => void
  setDeleteConfirmNodeId: (id: string | null) => void
}

const defaultSidebarWidth = 320

export const useUIStore = create<UIState>((set) => ({
  selectedNodeId: null,
  sidebarOpen: false,
  sidebarWidthPx: defaultSidebarWidth,
  settingsOpen: false,
  showWelcome: true,
  deleteConfirmNodeId: null,

  selectNode: (id) =>
    set({ selectedNodeId: id, sidebarOpen: id !== null }),

  openSidebar: () => set({ sidebarOpen: true }),
  closeSidebar: () => set({ sidebarOpen: false, selectedNodeId: null }),
  setSidebarWidthPx: (width) => set({ sidebarWidthPx: width }),
  toggleSettings: () => set((s) => ({ settingsOpen: !s.settingsOpen })),
  setShowWelcome: (show) => set({ showWelcome: show }),
  setDeleteConfirmNodeId: (id) => set({ deleteConfirmNodeId: id })
}))
