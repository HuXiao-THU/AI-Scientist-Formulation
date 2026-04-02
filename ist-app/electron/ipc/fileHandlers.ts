import { ipcMain, dialog } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import type { ISTProject } from '@shared/types'

export function registerFileHandlers(): void {
  ipcMain.handle('file:save', async (_event, filePath: string, data: ISTProject) => {
    const json = JSON.stringify(data, null, 2)
    await writeFile(filePath, json, 'utf-8')
  })

  ipcMain.handle('file:open', async (_event, filePath: string): Promise<ISTProject> => {
    const content = await readFile(filePath, 'utf-8')
    return JSON.parse(content) as ISTProject
  })

  ipcMain.handle('file:showSaveDialog', async (): Promise<string | null> => {
    const result = await dialog.showSaveDialog({
      filters: [{ name: 'Idea Search Tree', extensions: ['ist'] }],
      defaultPath: 'untitled.ist'
    })
    return result.canceled ? null : result.filePath ?? null
  })

  ipcMain.handle('file:showOpenDialog', async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      filters: [{ name: 'Idea Search Tree', extensions: ['ist'] }],
      properties: ['openFile']
    })
    return result.canceled ? null : result.filePaths[0] ?? null
  })
}
