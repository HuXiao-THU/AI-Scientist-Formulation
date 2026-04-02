import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { ISTProject, ISTNode } from '@shared/types'

interface TreeState {
  project: ISTProject | null
  filePath: string | null
  isDirty: boolean

  initNewProject: () => void
  loadProject: (project: ISTProject, filePath: string) => void
  setFilePath: (path: string) => void
  markClean: () => void

  addNode: (parentId: string, type: 'idea' | 'experiment') => string
  updateNode: (id: string, updates: Partial<Pick<ISTNode, 'title' | 'description'>>) => void
  deleteNode: (id: string) => void

  getNode: (id: string) => ISTNode | undefined
  getChildren: (id: string) => ISTNode[]
  getPathFromRoot: (id: string) => ISTNode[]
  getSubtreeNodes: (id: string) => ISTNode[]
}

function createEmptyProject(): ISTProject {
  const rootId = uuidv4()
  const now = new Date().toISOString()
  return {
    version: '1.0.0',
    rootNodeId: rootId,
    nodes: {
      [rootId]: {
        id: rootId,
        type: 'idea',
        title: '',
        description: '',
        parentId: null,
        childrenIds: [],
        createdAt: now,
        updatedAt: now
      }
    },
    meta: {
      createdAt: now,
      updatedAt: now
    }
  }
}

export const useTreeStore = create<TreeState>((set, get) => ({
  project: null,
  filePath: null,
  isDirty: false,

  initNewProject: () => {
    set({ project: createEmptyProject(), filePath: null, isDirty: false })
  },

  loadProject: (project, filePath) => {
    set({ project, filePath, isDirty: false })
  },

  setFilePath: (path) => {
    set({ filePath: path })
  },

  markClean: () => {
    set({ isDirty: false })
  },

  addNode: (parentId, type) => {
    const state = get()
    if (!state.project) return ''

    const parent = state.project.nodes[parentId]
    if (!parent) return ''
    if (parent.type === 'experiment') return ''

    const newId = uuidv4()
    const now = new Date().toISOString()
    const newNode: ISTNode = {
      id: newId,
      type,
      title: '',
      description: '',
      parentId,
      childrenIds: [],
      createdAt: now,
      updatedAt: now
    }

    const updatedParent = {
      ...parent,
      childrenIds: [...parent.childrenIds, newId],
      updatedAt: now
    }

    set({
      project: {
        ...state.project,
        nodes: {
          ...state.project.nodes,
          [parentId]: updatedParent,
          [newId]: newNode
        },
        meta: { ...state.project.meta, updatedAt: now }
      },
      isDirty: true
    })

    return newId
  },

  updateNode: (id, updates) => {
    const state = get()
    if (!state.project) return

    const node = state.project.nodes[id]
    if (!node) return

    const now = new Date().toISOString()
    set({
      project: {
        ...state.project,
        nodes: {
          ...state.project.nodes,
          [id]: { ...node, ...updates, updatedAt: now }
        },
        meta: { ...state.project.meta, updatedAt: now }
      },
      isDirty: true
    })
  },

  deleteNode: (id) => {
    const state = get()
    if (!state.project) return
    if (id === state.project.rootNodeId) return

    const node = state.project.nodes[id]
    if (!node) return

    const collectIds = (nodeId: string): string[] => {
      const n = state.project!.nodes[nodeId]
      if (!n) return [nodeId]
      return [nodeId, ...n.childrenIds.flatMap(collectIds)]
    }
    const idsToRemove = new Set(collectIds(id))

    const newNodes = { ...state.project.nodes }
    for (const rid of idsToRemove) {
      delete newNodes[rid]
    }

    if (node.parentId && newNodes[node.parentId]) {
      const parent = newNodes[node.parentId]
      newNodes[node.parentId] = {
        ...parent,
        childrenIds: parent.childrenIds.filter((cid) => cid !== id),
        updatedAt: new Date().toISOString()
      }
    }

    set({
      project: {
        ...state.project,
        nodes: newNodes,
        meta: { ...state.project.meta, updatedAt: new Date().toISOString() }
      },
      isDirty: true
    })
  },

  getNode: (id) => {
    return get().project?.nodes[id]
  },

  getChildren: (id) => {
    const proj = get().project
    if (!proj) return []
    const node = proj.nodes[id]
    if (!node) return []
    return node.childrenIds
      .map((cid) => proj.nodes[cid])
      .filter((n): n is ISTNode => !!n)
  },

  getPathFromRoot: (id) => {
    const proj = get().project
    if (!proj) return []
    const path: ISTNode[] = []
    let current: ISTNode | undefined = proj.nodes[id]
    while (current) {
      path.unshift(current)
      current = current.parentId ? proj.nodes[current.parentId] : undefined
    }
    return path
  },

  getSubtreeNodes: (id) => {
    const proj = get().project
    if (!proj) return []
    const result: ISTNode[] = []
    const collect = (nodeId: string) => {
      const n = proj.nodes[nodeId]
      if (!n) return
      result.push(n)
      n.childrenIds.forEach(collect)
    }
    collect(id)
    return result
  }
}))
