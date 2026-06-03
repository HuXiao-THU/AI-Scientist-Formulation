import { create } from 'zustand'
import type { ExperimentEvent, ExperimentRunResult } from '@shared/types'

interface ExperimentState {
  activeNodeId: string | null
  activeRunId: string | null
  logs: string[]
  lastResult: ExperimentRunResult | null

  appendLog: (line: string) => void
  clearLogs: () => void
  handleEvent: (event: ExperimentEvent) => void
  reset: () => void
}

export const useExperimentStore = create<ExperimentState>((set, get) => ({
  activeNodeId: null,
  activeRunId: null,
  logs: [],
  lastResult: null,

  appendLog: (line) => {
    set((s) => ({ logs: [...s.logs, line] }))
  },

  clearLogs: () => set({ logs: [] }),

  handleEvent: (event) => {
    if (event.type === 'run_start') {
      set({
        activeNodeId: event.nodeId,
        activeRunId: event.runId,
        logs: event.message ? [event.message] : []
      })
      return
    }
    if (event.type === 'log' && event.message) {
      get().appendLog(event.message)
      return
    }
    if (
      (event.type === 'run_done' || event.type === 'run_failed' || event.type === 'run_stopped') &&
      event.result
    ) {
      set({
        activeNodeId: null,
        activeRunId: null,
        lastResult: event.result
      })
    }
  },

  reset: () =>
    set({
      activeNodeId: null,
      activeRunId: null,
      logs: [],
      lastResult: null
    })
}))
