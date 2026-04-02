import { ipcMain } from 'electron'
import type { AIConfig } from '@shared/types'
import { createAIService } from '../services/ai/AIService'

export function registerAIHandlers(): void {
  ipcMain.handle('ai:generateTitle', async (_event, description: string, config: AIConfig) => {
    const service = createAIService(config)
    return service.generateTitle(description)
  })

  ipcMain.handle('ai:summarize', async (_event, context: { pathFromRoot: string[]; subtreeNodes: string[] }, config: AIConfig) => {
    const service = createAIService(config)
    return service.summarize(context)
  })
}
