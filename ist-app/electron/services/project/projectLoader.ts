import { readFile } from 'fs/promises'
import type { ISTProject } from '@shared/types'

export async function loadProjectFromFile(istFilePath: string): Promise<ISTProject> {
  const content = await readFile(istFilePath, 'utf-8')
  return JSON.parse(content) as ISTProject
}
