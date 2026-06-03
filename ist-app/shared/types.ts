export interface ISTProject {
  version: string
  rootNodeId: string
  nodes: Record<string, ISTNode>
  meta: {
    createdAt: string
    updatedAt: string
    workspacePath?: string
  }
}

export type RunStatus = 'idle' | 'running' | 'done' | 'failed'

export interface ISTNode {
  id: string
  type: 'idea' | 'experiment'
  title: string
  description: string
  parentId: string | null
  childrenIds: string[]
  createdAt: string
  updatedAt: string
  gitBranch?: string
  experimentResult?: string
  runStatus?: RunStatus
}

export type AIProvider = 'openai' | 'anthropic'

export interface AIConfig {
  provider: AIProvider
  baseUrl: string
  apiKey: string
  model: string
}

export interface HarnessConfig {
  command: string
  extraArgs: string[]
  model?: string
  permissionMode: string
}

export interface AppSettings {
  lastOpenedFile: string | null
  ai: AIConfig
  harness?: HarnessConfig
}

export interface ExperimentRunRequest {
  nodeId: string
  project: ISTProject
  istFilePath: string | null
  repoDataRoot?: string | null
}

export interface ExperimentRunResult {
  runId: string
  nodeId: string
  success: boolean
  gitBranch: string
  experimentResult: string
  runStatus: RunStatus
  error?: string
}

export type ExperimentEventType =
  | 'run_start'
  | 'log'
  | 'run_done'
  | 'run_failed'
  | 'run_stopped'

export interface ExperimentEvent {
  type: ExperimentEventType
  runId: string
  nodeId: string
  timestamp: string
  message?: string
  result?: ExperimentRunResult
}

export interface NodePosition {
  id: string
  x: number
  y: number
  width: number
  height: number
}

export interface LayoutResult {
  positions: Record<string, NodePosition>
  connections: ConnectionInfo[]
  totalWidth: number
  totalHeight: number
}

export interface ConnectionInfo {
  fromId: string
  toId: string
  type: 'idea' | 'experiment'
}

export const DEFAULT_HARNESS_CONFIG: HarnessConfig = {
  command: 'claude',
  extraArgs: [],
  permissionMode: 'bypassPermissions'
}
