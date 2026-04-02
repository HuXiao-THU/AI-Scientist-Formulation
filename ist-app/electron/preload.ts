import { contextBridge, ipcRenderer } from 'electron'
import type { ISTProject, AIConfig } from '@shared/types'

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
  }
}

contextBridge.exposeInMainWorld('electronAPI', api)

export type ElectronAPI = typeof api
