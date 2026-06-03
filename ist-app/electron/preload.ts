import { contextBridge, ipcRenderer } from 'electron'
import type {
  ISTProject,
  AIConfig,
  ExperimentEvent,
  ExperimentRunRequest,
  ExperimentRunResult,
  HarnessConfig
} from '@shared/types'

const api = {
  file: {
    save: (filePath: string, data: ISTProject): Promise<void> =>
      ipcRenderer.invoke('file:save', filePath, data),
    open: (filePath: string): Promise<ISTProject> =>
      ipcRenderer.invoke('file:open', filePath),
    showSaveDialog: (): Promise<string | null> =>
      ipcRenderer.invoke('file:showSaveDialog'),
    showOpenDialog: (): Promise<string | null> =>
      ipcRenderer.invoke('file:showOpenDialog')
  },
  ai: {
    generateTitle: (description: string, config: AIConfig): Promise<string> =>
      ipcRenderer.invoke('ai:generateTitle', description, config),
    summarize: (context: { pathFromRoot: string[]; subtreeNodes: string[] }, config: AIConfig): Promise<string> =>
      ipcRenderer.invoke('ai:summarize', context, config)
  },
  store: {
    get: (key: string): Promise<unknown> =>
      ipcRenderer.invoke('store:get', key),
    set: (key: string, value: unknown): Promise<void> =>
      ipcRenderer.invoke('store:set', key, value)
  },
  experiment: {
    run: (request: ExperimentRunRequest): Promise<ExperimentRunResult> =>
      ipcRenderer.invoke('experiment:run', request),
    stop: (nodeId: string): Promise<boolean> =>
      ipcRenderer.invoke('experiment:stop', nodeId),
    getHarnessConfig: (): Promise<HarnessConfig> =>
      ipcRenderer.invoke('experiment:getHarnessConfig'),
    setHarnessConfig: (config: HarnessConfig): Promise<void> =>
      ipcRenderer.invoke('experiment:setHarnessConfig', config),
    onEvent: (callback: (event: ExperimentEvent) => void): (() => void) => {
      const listener = (_: Electron.IpcRendererEvent, event: ExperimentEvent): void => {
        callback(event)
      }
      ipcRenderer.on('experiment:event', listener)
      return () => {
        ipcRenderer.removeListener('experiment:event', listener)
      }
    }
  }
}

contextBridge.exposeInMainWorld('electronAPI', api)

export type ElectronAPI = typeof api
