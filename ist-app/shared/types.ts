export interface ISTProject {
  version: string
  rootNodeId: string
  nodes: Record<string, ISTNode>
  meta: {
    createdAt: string
    updatedAt: string
  }
}

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
}

export type AIProvider = 'openai' | 'anthropic'

export interface AIConfig {
  provider: AIProvider
  baseUrl: string
  apiKey: string
  model: string
}

export interface AppSettings {
  lastOpenedFile: string | null
  ai: AIConfig
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
