import React, { useState } from 'react'
import { useTreeStore } from '../../store/useTreeStore'
import { useUIStore } from '../../store/useUIStore'
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

  if (!sidebarOpen || !node) return null

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

  return (
    <div className="w-80 h-full bg-white border-l border-gray-200 flex flex-col shadow-xl">
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
          <div>
            <button
              disabled
              className="w-full bg-gray-100 text-gray-500 rounded px-3 py-2 text-sm cursor-not-allowed border border-gray-200"
            >
              Run Experiment (coming soon)
            </button>
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
