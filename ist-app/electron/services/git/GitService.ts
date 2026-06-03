import { execFile } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'
import { join } from 'path'

const execFileAsync = promisify(execFile)

export class GitService {
  constructor(private readonly cwd: string) {}

  private async run(args: string[]): Promise<string> {
    const { stdout } = await execFileAsync('git', args, {
      cwd: this.cwd,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024
    })
    return stdout.trim()
  }

  async initIfNeeded(): Promise<void> {
    if (!existsSync(join(this.cwd, '.git'))) {
      await this.run(['init', '-b', 'main'])
      await this.run(['config', 'user.email', 'ist@local.dev'])
      await this.run(['config', 'user.name', 'IST'])
    }
  }

  async currentBranch(): Promise<string> {
    return this.run(['rev-parse', '--abbrev-ref', 'HEAD'])
  }

  async branchExists(name: string): Promise<boolean> {
    try {
      await this.run(['rev-parse', '--verify', name])
      return true
    } catch {
      return false
    }
  }

  async checkout(branch: string): Promise<void> {
    await this.run(['checkout', branch])
  }

  async ensureBranch(name: string, startPoint: string): Promise<void> {
    const exists = await this.branchExists(name)
    if (exists) {
      await this.checkout(name)
      return
    }
    const startExists = await this.branchExists(startPoint)
    if (startExists) {
      await this.run(['checkout', '-b', name, startPoint])
    } else {
      await this.run(['checkout', '-b', name])
    }
  }

  async commitAll(message: string): Promise<boolean> {
    await this.run(['add', '-A'])
    try {
      const status = await this.run(['status', '--porcelain'])
      if (!status) return false
      await this.run(['commit', '-m', message])
      return true
    } catch {
      return false
    }
  }
}
