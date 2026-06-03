import { app } from 'electron'
import { copyFileSync, existsSync, mkdirSync } from 'fs'
import { dirname, isAbsolute, join, resolve } from 'path'
import type { ISTProject } from '@shared/types'
import { GitService } from '../git/GitService'

export function resolveWorkspacePath(
  istFilePath: string | null,
  metaWorkspacePath?: string
): string {
  if (metaWorkspacePath?.trim()) {
    const trimmed = metaWorkspacePath.trim()
    if (isAbsolute(trimmed)) return trimmed
    if (istFilePath) return resolve(dirname(istFilePath), trimmed)
    return resolve(trimmed)
  }
  if (istFilePath) {
    const base = istFilePath.replace(/\.ist$/i, '')
    return `${base}-workspace`
  }
  return join(app.getPath('userData'), 'ist-default-workspace')
}

function copySampleDataset(workspacePath: string, repoDataRoot: string | null | undefined): void {
  if (!repoDataRoot) return
  const source = join(repoDataRoot, 'data', 'cal_housing.csv')
  if (!existsSync(source)) return
  const destDir = join(workspacePath, 'data')
  mkdirSync(destDir, { recursive: true })
  const dest = join(destDir, 'cal_housing.csv')
  if (!existsSync(dest)) {
    copyFileSync(source, dest)
  }
}

export async function ensureWorkspace(
  project: ISTProject,
  istFilePath: string | null,
  repoDataRoot?: string | null
): Promise<string> {
  const workspacePath = resolveWorkspacePath(istFilePath, project.meta.workspacePath)
  mkdirSync(workspacePath, { recursive: true })

  const git = new GitService(workspacePath)
  const hadGit = existsSync(join(workspacePath, '.git'))
  await git.initIfNeeded()

  if (!hadGit) {
    copySampleDataset(workspacePath, repoDataRoot)
    const gitAfterData = new GitService(workspacePath)
    await gitAfterData.commitAll('chore: initialize IST workspace with sample data')
  }

  return workspacePath
}

export function defaultWorkspacePathForIst(istFilePath: string): string {
  return resolveWorkspacePath(istFilePath, undefined)
}
