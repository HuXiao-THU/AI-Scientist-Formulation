import React, { useState } from 'react'
import { useTreeStore } from '../../store/useTreeStore'
import { useUIStore } from '../../store/useUIStore'
import { useExperimentStore } from '../../store/useExperimentStore'
import type { AIConfig } from '@shared/types'

export const NodeDetail: React.FC = () => {
  const selectedNodeId = useUIStore((s) => s.selectedNodeId)
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const closeSidebar = useUIStore((s) => s.closeSidebar)
  const setDeleteConfirmNodeId = useUIStore((s) => s.setDeleteConfirmNodeId)

  const project = useTreeStore((s) => s.project)
  const updateNode = useTreeStore((s) => s.updateNode)
  const getPathFromRoot = useTreeStore((s) => s.getPathFromRoot)
  const getSubtreeNodes = useTreeStore((s) => s.getSubtreeNodes)

  const node = selectedNodeId && project ? project.nodes[selectedNodeId] : null

  const [aiLoading, setAiLoading] = useState<'title' | 'summarize' | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [expError, setExpError] = useState<string | null>(null)

  const activeExpNodeId = useExperimentStore((s) => s.activeNodeId)
  const clearExpLogs = useExperimentStore((s) => s.clearLogs)
  const filePath = useTreeStore((s) => s.filePath)
  const setWorkspacePath = useTreeStore((s) => s.setWorkspacePath)

  if (!sidebarOpen || !node) return null

  const isExperimentRunning =
    node.type === 'experiment' &&
    (node.runStatus === 'running' || activeExpNodeId === node.id)

  const isRoot = project?.rootNodeId === node.id

  const handleDelete = () => {
    if (isRoot) return
    const hasContent = node.title.trim() || node.description.trim()
    const hasChildren = node.childrenIds.length > 0
    if (hasContent || hasChildren) {
      setDeleteConfirmNodeId(node.id)
    } else {
      useTreeStore.getState().deleteNode(node.id)
      closeSidebar()
    }
  }

  const getAIConfig = async (): Promise<AIConfig | null> => {
    if (!window.electronAPI?.store) return null
    const config = (await window.electronAPI.store.get('aiConfig')) as AIConfig | null
    if (!config?.apiKey) {
      setAiError('Please configure AI settings first (API Key required)')
      return null
    }
    return config
  }

  const handleGenerateTitle = async () => {
    const desc = node.description.trim()
    if (!desc) {
      setAiError('Please enter a description first')
      return
    }
    const config = await getAIConfig()
    if (!config) return

    setAiLoading('title')
    setAiError(null)
    try {
      const generatedTitle = await window.electronAPI.ai.generateTitle(desc, config)
      if (generatedTitle) {
        updateNode(node.id, { title: generatedTitle })
      }
    } catch (err) {
      setAiError(`Failed to generate title: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setAiLoading(null)
    }
  }

  const handleSummarize = async () => {
    if (node.type !== 'idea') return
    const config = await getAIConfig()
    if (!config) return

    setAiLoading('summarize')
    setAiError(null)
    try {
      const pathNodes = getPathFromRoot(node.id)
      const subtreeNodes = getSubtreeNodes(node.id)

      const pathFromRoot = pathNodes.map(
        (n) => `[${n.type}] ${n.title || '(untitled)'}: ${n.description || '(no description)'}`
      )
      const subtreeTexts = subtreeNodes.map(
        (n) => `[${n.type}] ${n.title || '(untitled)'}: ${n.description || '(no description)'}`
      )

      const summary = await window.electronAPI.ai.summarize(
        { pathFromRoot, subtreeNodes: subtreeTexts },
        config
      )
      if (summary) {
        if (!useTreeStore.getState().project?.nodes[node.id]) return
        updateNode(node.id, { description: summary.trim() })
      }
    } catch (err) {
      setAiError(`Failed to summarize: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setAiLoading(null)
    }
  }

  const handleRunExperiment = async () => {
    if (node.type !== 'experiment' || !project) return
    if (!window.electronAPI?.experiment) {
      setExpError('Experiment API unavailable')
      return
    }
    const desc = node.description.trim()
    if (!desc) {
      setExpError('Please enter an experiment description first')
      return
    }

    setExpError(null)
    clearExpLogs()
    updateNode(node.id, { runStatus: 'running' })

    if (!project.meta.workspacePath && filePath) {
      const baseName = filePath.split(/[/\\]/).pop()?.replace(/\.ist$/i, '') ?? 'project'
      setWorkspacePath(`${baseName}-workspace`)
    }

    try {
      await window.electronAPI.experiment.run({
        nodeId: node.id,
        project: useTreeStore.getState().project!,
        istFilePath: filePath
      })
    } catch (err) {
      updateNode(node.id, { runStatus: 'failed' })
      setExpError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleStopExperiment = async () => {
    if (!window.electronAPI?.experiment) return
    await window.electronAPI.experiment.stop(node.id)
    updateNode(node.id, { runStatus: 'idle' })
  }

  const runStatusLabel =
    node.runStatus === 'running'
      ? 'Running'
      : node.runStatus === 'done'
        ? 'Done'
        : node.runStatus === 'failed'
          ? 'Failed'
          : 'Idle'

  return (
    <div className="w-full min-w-0 h-full bg-white border-l border-gray-200 flex flex-col shadow-xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-800">Node Details</h3>
        <button
          onClick={closeSidebar}
          className="text-gray-500 hover:text-gray-900 text-lg leading-none"
        >
          &times;
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Type</label>
          <div
            className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
              node.type === 'idea'
                ? 'bg-amber-200 text-amber-800'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            {node.type === 'idea' ? 'Idea' : 'Experiment'}
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-600 mb-1">Title</label>
          <input
            type="text"
            value={node.title}
            onChange={(e) => updateNode(node.id, { title: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            }}
            placeholder="Enter title..."
            className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-amber-500"
          />
          <button
            onClick={handleGenerateTitle}
            disabled={aiLoading !== null}
            className="mt-1.5 w-full text-xs px-2 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {aiLoading === 'title' ? 'Generating...' : 'AI Generate Title'}
          </button>
        </div>

        <div>
          <label className="block text-xs text-gray-600 mb-1">
            Description
          </label>
          <textarea
            value={node.description}
            onChange={(e) => updateNode(node.id, { description: e.target.value })}
            placeholder="Enter description..."
            rows={6}
            className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-amber-500 resize-y"
          />
        </div>

        {node.type === 'idea' && (
          <button
            onClick={handleSummarize}
            disabled={aiLoading !== null}
            className="w-full text-xs px-2 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-900 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {aiLoading === 'summarize' ? 'Summarizing...' : 'AI Summarize'}
          </button>
        )}

        {aiError && (
          <div className="text-xs text-red-700 bg-red-50 rounded px-2 py-1.5 border border-red-100">
            {aiError}
          </div>
        )}

        {node.type === 'experiment' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>Status</span>
              <span
                className={
                  node.runStatus === 'running'
                    ? 'text-amber-700 font-medium'
                    : node.runStatus === 'done'
                      ? 'text-green-700'
                      : node.runStatus === 'failed'
                        ? 'text-red-700'
                        : 'text-gray-500'
                }
              >
                {runStatusLabel}
              </span>
            </div>
            {node.gitBranch && (
              <div className="text-xs text-gray-500">
                Branch: <code className="text-gray-700">{node.gitBranch}</code>
              </div>
            )}
            {isExperimentRunning ? (
              <button
                onClick={handleStopExperiment}
                className="w-full bg-red-50 hover:bg-red-100 text-red-800 rounded px-3 py-2 text-sm border border-red-200 transition-colors"
              >
                Stop Experiment
              </button>
            ) : (
              <button
                onClick={handleRunExperiment}
                disabled={aiLoading !== null}
                className="w-full bg-amber-500 hover:bg-amber-400 text-amber-950 font-medium rounded px-3 py-2 text-sm transition-colors disabled:opacity-50"
              >
                Run Experiment
              </button>
            )}
            {node.experimentResult && (
              <div>
                <label className="block text-xs text-gray-600 mb-1">Result</label>
                <pre className="text-xs bg-gray-50 border border-gray-200 rounded p-2 whitespace-pre-wrap max-h-40 overflow-y-auto text-gray-800">
                  {node.experimentResult}
                </pre>
              </div>
            )}
            {expError && (
              <div className="text-xs text-red-700 bg-red-50 rounded px-2 py-1.5 border border-red-100">
                {expError}
              </div>
            )}
          </div>
        )}

        {!isRoot && (
          <div className="pt-2">
            <button
              onClick={handleDelete}
              className="w-full bg-red-50 hover:bg-red-100 text-red-700 rounded px-3 py-2 text-sm transition-colors border border-red-100"
            >
              Delete Node
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
