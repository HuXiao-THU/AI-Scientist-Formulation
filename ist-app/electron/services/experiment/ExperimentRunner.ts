import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { appendFileSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import type {
  ExperimentEvent,
  ExperimentRunContext,
  ExperimentRunResult,
  HarnessConfig,
  ISTNode,
  ISTProject
} from '@shared/types'
import { DEFAULT_HARNESS_CONFIG } from '@shared/types'
import { GitService } from '../git/GitService'
import { ensureWorkspace } from '../workspace/workspaceService'
import { safeErrorMessage, truncateText } from '../../utils/truncate'

type EventCallback = (event: ExperimentEvent) => void

const MAX_LOG_MESSAGE_LEN = 400
const MAX_ERROR_LEN = 500
const MAX_STDOUT_LINE = 64 * 1024
const MAX_IPC_RESULT_LEN = 900
const LOG_THROTTLE_MS = 250

function cleanSpawnEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  delete env.ELECTRON_NO_ATTACH_CONSOLE
  return env
}

function emitLog(
  onEvent: EventCallback,
  runId: string,
  nodeId: string,
  message: string
): void {
  onEvent({
    type: 'log',
    runId,
    nodeId,
    timestamp: new Date().toISOString(),
    message: truncateText(message, MAX_LOG_MESSAGE_LEN)
  })
}

function shortNodeId(nodeId: string): string {
  return nodeId.replace(/-/g, '').slice(0, 8)
}

function branchNameForNode(nodeId: string): string {
  return `exp/${shortNodeId(nodeId)}`
}

function findParentBranch(project: ISTProject, node: ISTNode): string {
  let current = node.parentId ? project.nodes[node.parentId] : undefined
  while (current) {
    if (current.type === 'experiment' && current.gitBranch) {
      return current.gitBranch
    }
    current = current.parentId ? project.nodes[current.parentId] : undefined
  }
  return 'main'
}

function buildPathContext(project: ISTProject, nodeId: string): string[] {
  const lines: string[] = []
  const nodes: ISTNode[] = []
  let current: ISTNode | undefined = project.nodes[nodeId]
  while (current) {
    nodes.unshift(current)
    current = current.parentId ? project.nodes[current.parentId] : undefined
  }
  for (const n of nodes) {
    const label = n.type === 'idea' ? 'Idea' : 'Experiment'
    lines.push(
      `[${label}] ${n.title || '(untitled)'}\n${n.description || '(no description)'}`
    )
  }
  return lines
}

function buildPrompt(
  project: ISTProject,
  node: ISTNode,
  workspacePath: string,
  parentBranch: string
): string {
  const pathLines = buildPathContext(project, node.id)
  return [
    'You are running a research experiment in a local git workspace.',
    '',
    '## Inspiration path (root → current)',
    ...pathLines.map((l, i) => `${i + 1}. ${l}`),
    '',
    '## Experiment task',
    node.description.trim() || node.title.trim() || '(no description provided)',
    '',
    '## Workspace rules',
    `- Work only inside: ${workspacePath}`,
    `- You are on git branch derived from: ${parentBranch}`,
    '- Modify or extend code from the parent branch baseline when applicable.',
    '- Sample dataset (if needed): data/cal_housing.csv (California Housing CSV).',
    '- Write a brief RESULT.md summarizing what you did, key metrics, and output file paths.',
    '- Keep changes reproducible; commit-worthy artifacts should be saved under the workspace.',
    '',
    'When finished, ensure RESULT.md exists with a concise summary.'
  ].join('\n')
}

function extractTextFromStreamEvent(payload: Record<string, unknown>): string | null {
  const type = String(payload.type ?? '')
  if (type === 'result') {
    const result = payload.result
    if (typeof result === 'string' && result.trim()) return result.trim()
    if (result && typeof result === 'object') {
      const r = result as Record<string, unknown>
      if (typeof r.result === 'string' && r.result.trim()) return r.result.trim()
    }
  }
  if (type === 'assistant') {
    const message = payload.message as Record<string, unknown> | undefined
    const content = message?.content
    if (Array.isArray(content)) {
      const parts = content
        .map((block) => {
          if (block && typeof block === 'object') {
            const b = block as Record<string, unknown>
            if (b.type === 'text' && typeof b.text === 'string') return b.text
          }
          return ''
        })
        .filter(Boolean)
      if (parts.length) return parts.join('\n')
    }
  }
  return null
}

function buildCommand(
  config: HarnessConfig,
  workspacePath: string
): string[] {
  const cmd = [
    config.command,
    '-p',
    '--input-format',
    'text',
    '--output-format',
    'stream-json',
    '--verbose',
    '--add-dir',
    workspacePath,
    '--no-session-persistence',
    '--permission-mode',
    config.permissionMode || 'bypassPermissions'
  ]
  if (config.model?.trim()) {
    cmd.push('--model', config.model.trim())
  }
  if (config.extraArgs?.length) {
    cmd.push(...config.extraArgs)
  }
  return cmd
}

export class ExperimentRunner {
  private activeRuns = new Map<string, ChildProcessWithoutNullStreams>()

  stop(runId: string): boolean {
    const proc = this.activeRuns.get(runId)
    if (!proc) return false
    proc.kill('SIGTERM')
    setTimeout(() => {
      if (!proc.killed) proc.kill('SIGKILL')
    }, 3000)
    return true
  }

  async run(
    request: ExperimentRunContext,
    harnessConfig: HarnessConfig,
    onEvent: EventCallback
  ): Promise<ExperimentRunResult> {
    const config = { ...DEFAULT_HARNESS_CONFIG, ...harnessConfig }
    const runId = randomUUID()
    const { nodeId, project } = request
    const node = project.nodes[nodeId]
    if (!node || node.type !== 'experiment') {
      throw new Error('Node is not an experiment')
    }

    const workspacePath = await ensureWorkspace(
      project,
      request.istFilePath,
      request.repoDataRoot
    )
    const branch = branchNameForNode(nodeId)
    const parentBranch = findParentBranch(project, node)
    const git = new GitService(workspacePath)
    await git.initIfNeeded()
    await git.ensureBranch(branch, parentBranch)

    const runDir = join(workspacePath, '.ist-runs', runId)
    mkdirSync(runDir, { recursive: true })
    const prompt = buildPrompt(project, node, workspacePath, parentBranch)
    writeFileSync(join(runDir, 'prompt.md'), prompt, 'utf-8')

    const command = buildCommand(config, workspacePath)
    writeFileSync(join(runDir, 'command.json'), JSON.stringify({ command }, null, 2))

    const timestamp = () => new Date().toISOString()
    onEvent({
      type: 'run_start',
      runId,
      nodeId,
      timestamp: timestamp(),
      message: `Starting experiment on branch ${branch}`
    })

    const stdoutLogPath = join(runDir, 'stdout.jsonl')
    const logLines: string[] = []
    let lastAssistantText = ''
    let pendingLog: string | null = null
    let logFlushTimer: ReturnType<typeof setTimeout> | null = null

    const flushPendingLog = (): void => {
      if (logFlushTimer) {
        clearTimeout(logFlushTimer)
        logFlushTimer = null
      }
      if (pendingLog) {
        emitLog(onEvent, runId, nodeId, pendingLog)
        pendingLog = null
      }
    }

    const scheduleLog = (message: string): void => {
      pendingLog = message
      if (logFlushTimer) return
      logFlushTimer = setTimeout(() => {
        logFlushTimer = null
        if (pendingLog) {
          emitLog(onEvent, runId, nodeId, pendingLog)
          pendingLog = null
        }
      }, LOG_THROTTLE_MS)
    }

    return new Promise<ExperimentRunResult>((resolve) => {
      let proc: ChildProcessWithoutNullStreams
      try {
        proc = spawn(command[0], command.slice(1), {
          cwd: workspacePath,
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: false,
          env: cleanSpawnEnv()
        })
      } catch (err) {
        const error = safeErrorMessage(err, MAX_ERROR_LEN)
        const result: ExperimentRunResult = {
          runId,
          nodeId,
          success: false,
          gitBranch: branch,
          experimentResult: '',
          runStatus: 'failed',
          error
        }
        onEvent({ type: 'run_failed', runId, nodeId, timestamp: timestamp(), result })
        resolve(result)
        return
      }

      this.activeRuns.set(runId, proc)

      // Prevent EPIPE crash when child exits before stdin is flushed
      proc.stdin.on('error', () => {
        // Ignore stdin errors — the close/error handler will deal with the process result
      })

      proc.stdin.write(prompt)
      proc.stdin.end()

      const stderrChunks: string[] = []
      proc.stderr.on('data', (chunk: Buffer) => {
        stderrChunks.push(chunk.toString('utf-8'))
      })

      let stdoutBuffer = ''
      proc.stdout.on('data', (chunk: Buffer) => {
        stdoutBuffer += chunk.toString('utf-8')
        const parts = stdoutBuffer.split('\n')
        stdoutBuffer = parts.pop() ?? ''
        for (const rawLine of parts) {
          const line = rawLine.trim()
          if (!line) continue
          if (line.length > MAX_STDOUT_LINE) {
            appendFileSync(
              stdoutLogPath,
              `${line.slice(0, MAX_STDOUT_LINE)}...[truncated]\n`
            )
            scheduleLog('[Claude output line truncated]')
            continue
          }
          appendFileSync(stdoutLogPath, `${line}\n`)
          let payload: Record<string, unknown>
          try {
            payload = JSON.parse(line) as Record<string, unknown>
          } catch {
            scheduleLog('[non-json stdout line]')
            continue
          }
          const extracted = extractTextFromStreamEvent(payload)
          if (extracted) {
            lastAssistantText = extracted
            logLines.push(extracted)
            scheduleLog(extracted)
          }
        }
      })

      proc.on('close', async (code) => {
        try {
          flushPendingLog()
          this.activeRuns.delete(runId)
          const stderrText = stderrChunks.join('').trim()
          if (stderrText) {
            writeFileSync(join(runDir, 'stderr.txt'), stderrText, 'utf-8')
          }

          const committed = await git.commitAll(`experiment: ${node.title || nodeId}`)
          const summary =
            lastAssistantText ||
            logLines[logLines.length - 1] ||
            (code === 0 ? 'Experiment completed.' : stderrText || 'Experiment failed.')

          const success = code === 0
          const fullSummary = summary.slice(0, 8000)
          const result: ExperimentRunResult = {
            runId,
            nodeId,
            success,
            gitBranch: branch,
            experimentResult: truncateText(fullSummary, MAX_IPC_RESULT_LEN),
            runStatus: success ? 'done' : 'failed',
            error: success
              ? undefined
              : truncateText(stderrText || `Process exited with code ${code}`, MAX_ERROR_LEN)
          }

          writeFileSync(
            join(runDir, 'result.json'),
            JSON.stringify(
              { ...result, experimentResult: fullSummary, exitCode: code, committed },
              null,
              2
            )
          )

          onEvent({
            type: success ? 'run_done' : 'run_failed',
            runId,
            nodeId,
            timestamp: timestamp(),
            result
          })
          resolve(result)
        } catch (err) {
          const result: ExperimentRunResult = {
            runId,
            nodeId,
            success: false,
            gitBranch: branch,
            experimentResult: '',
            runStatus: 'failed',
            error: safeErrorMessage(err, MAX_ERROR_LEN)
          }
          onEvent({ type: 'run_failed', runId, nodeId, timestamp: timestamp(), result })
          resolve(result)
        }
      })

      proc.on('error', async (err) => {
        this.activeRuns.delete(runId)
        const result: ExperimentRunResult = {
          runId,
          nodeId,
          success: false,
          gitBranch: branch,
          experimentResult: '',
          runStatus: 'failed',
          error: safeErrorMessage(err, MAX_ERROR_LEN)
        }
        onEvent({ type: 'run_failed', runId, nodeId, timestamp: timestamp(), result })
        resolve(result)
      })
    })
  }
}

let runnerInstance: ExperimentRunner | null = null

export function getExperimentRunner(): ExperimentRunner {
  if (!runnerInstance) runnerInstance = new ExperimentRunner()
  return runnerInstance
}
