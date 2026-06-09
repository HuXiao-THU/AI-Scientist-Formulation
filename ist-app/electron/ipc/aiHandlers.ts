import { ipcMain } from 'electron'
import type { AIConfig } from '@shared/types'
import { createAIService } from '../services/ai/AIService'
import { safeErrorMessage } from '../utils/truncate'

export function registerAIHandlers(): void {
  ipcMain.handle('ai:generateTitle', async (_event, description: string, config: AIConfig) => {
    try {
      const service = createAIService(config)
      return await service.generateTitle(description)
    } catch (err) {
      throw new Error(safeErrorMessage(err, 500))
    }
  })

  ipcMain.handle(
    'ai:summarize',
    async (
      _event,
      context: { pathFromRoot: string[]; subtreeNodes: string[] },
      config: AIConfig
    ) => {
      try {
        const service = createAIService(config)
        return await service.summarize(context)
      } catch (err) {
        throw new Error(safeErrorMessage(err, 500))
      }
    }
  )
}
