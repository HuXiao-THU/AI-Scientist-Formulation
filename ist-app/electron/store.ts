import { ipcMain } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type { HarnessConfig } from '@shared/types'
import { DEFAULT_HARNESS_CONFIG } from '@shared/types'

const storePath = join(app.getPath('userData'), 'settings.json')

export function readStore(): Record<string, unknown> {
  try {
    if (existsSync(storePath)) {
      return JSON.parse(readFileSync(storePath, 'utf-8'))
    }
  } catch {
    // ignore
  }
  return {}
}

export function writeStore(data: Record<string, unknown>): void {
  writeFileSync(storePath, JSON.stringify(data, null, 2), 'utf-8')
}

export function getHarnessConfig(): HarnessConfig {
  const store = readStore()
  const stored = store.harnessConfig as HarnessConfig | undefined
  return { ...DEFAULT_HARNESS_CONFIG, ...stored }
}

export function registerStoreHandlers(): void {
  ipcMain.handle('store:get', (_event, key: string) => {
    const store = readStore()
    return store[key] ?? null
  })

  ipcMain.handle('store:set', (_event, key: string, value: unknown) => {
    const store = readStore()
    store[key] = value
    writeStore(store)
  })
}
