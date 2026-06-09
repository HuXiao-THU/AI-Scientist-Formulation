import { ipcMain, type WebContents } from 'electron'
import type {
  ExperimentEvent,
  ExperimentRunRequest,
  HarnessConfig
} from '@shared/types'
import { DEFAULT_HARNESS_CONFIG } from '@shared/types'
import { getExperimentRunner } from '../services/experiment/ExperimentRunner'
import { loadProjectFromFile } from '../services/project/projectLoader'
import { findRepoDataRoot } from '../services/workspace/repoDataRoot'
import { readStore, writeStore } from '../store'
import { safeErrorMessage, truncateText } from '../utils/truncate'

const activeRunByNode = new Map<string, string>()

function sanitizeEvent(event: ExperimentEvent): ExperimentEvent {
  const sanitized: ExperimentEvent = {
    ...event,
    message: event.message ? truncateText(event.message, 400) : event.message
  }
  if (sanitized.result) {
    sanitized.result = {
      ...sanitized.result,
      experimentResult: truncateText(sanitized.result.experimentResult, 900),
      error: sanitized.result.error
        ? truncateText(sanitized.result.error, 500)
        : sanitized.result.error
    }
  }
  return sanitized
}

function sendEvent(webContents: WebContents, event: ExperimentEvent): void {
  try {
    webContents.send('experiment:event', sanitizeEvent(event))
  } catch (err) {
    console.error('Failed to send experiment event:', err)
  }
}

async function loadHarnessConfig(): Promise<HarnessConfig> {
  const store = readStore()
  const stored = store.harnessConfig as HarnessConfig | undefined
  return { ...DEFAULT_HARNESS_CONFIG, ...stored }
}

export function registerExperimentHandlers(): void {
  ipcMain.handle(
    'experiment:run',
    async (event, request: ExperimentRunRequest) => {
      try {
        const { nodeId } = request
        if (activeRunByNode.has(nodeId)) {
          throw new Error('An experiment is already running for this node')
        }

        if (!request.istFilePath?.trim()) {
          throw new Error('请先保存工程文件后再运行实验')
        }

        const project = await loadProjectFromFile(request.istFilePath)
        const harness = await loadHarnessConfig()
        const runner = getExperimentRunner()

        return await runner.run(
          {
            nodeId: request.nodeId,
            project,
            istFilePath: request.istFilePath,
            repoDataRoot: request.repoDataRoot ?? findRepoDataRoot()
          },
          harness,
          (ev) => {
            if (ev.type === 'run_start') {
              activeRunByNode.set(nodeId, ev.runId)
            }
            sendEvent(event.sender, ev)
            if (
              ev.type === 'run_done' ||
              ev.type === 'run_failed' ||
              ev.type === 'run_stopped'
            ) {
              activeRunByNode.delete(nodeId)
            }
          }
        )
      } catch (err) {
        throw new Error(safeErrorMessage(err, 500))
      }
    }
  )

  ipcMain.handle('experiment:stop', async (_event, nodeId: string) => {
    const runId = activeRunByNode.get(nodeId)
    if (!runId) return false
    const stopped = getExperimentRunner().stop(runId)
    if (stopped) activeRunByNode.delete(nodeId)
    return stopped
  })

  ipcMain.handle('experiment:getHarnessConfig', async () => {
    return loadHarnessConfig()
  })

  ipcMain.handle(
    'experiment:setHarnessConfig',
    async (_event, config: HarnessConfig) => {
      const store = readStore()
      store.harnessConfig = { ...DEFAULT_HARNESS_CONFIG, ...config }
      writeStore(store)
    }
  )
}
