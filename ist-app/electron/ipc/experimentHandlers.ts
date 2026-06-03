import { ipcMain, type WebContents } from 'electron'
import type {
  ExperimentEvent,
  ExperimentRunRequest,
  HarnessConfig
} from '@shared/types'
import { DEFAULT_HARNESS_CONFIG } from '@shared/types'
import { getExperimentRunner } from '../services/experiment/ExperimentRunner'
import { findRepoDataRoot } from '../services/workspace/repoDataRoot'
import { readStore, writeStore } from '../store'

const activeRunByNode = new Map<string, string>()

function sendEvent(webContents: WebContents, event: ExperimentEvent): void {
  webContents.send('experiment:event', event)
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
      const { nodeId } = request
      if (activeRunByNode.has(nodeId)) {
        throw new Error('An experiment is already running for this node')
      }

      const harness = await loadHarnessConfig()
      const runner = getExperimentRunner()
      const enrichedRequest: ExperimentRunRequest = {
        ...request,
        repoDataRoot: request.repoDataRoot ?? findRepoDataRoot()
      }

      const resultPromise = runner.run(
        enrichedRequest,
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

      return resultPromise
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
