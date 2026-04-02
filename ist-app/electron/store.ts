import { ipcMain } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

const storePath = join(app.getPath('userData'), 'settings.json')

function readStore(): Record<string, unknown> {
  try {
    if (existsSync(storePath)) {
      return JSON.parse(readFileSync(storePath, 'utf-8'))
    }
  } catch {
    // ignore
  }
  return {}
}

function writeStore(data: Record<string, unknown>): void {
  writeFileSync(storePath, JSON.stringify(data, null, 2), 'utf-8')
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
