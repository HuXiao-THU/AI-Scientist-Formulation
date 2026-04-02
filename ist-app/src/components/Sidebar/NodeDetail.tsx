import React, { useState, useEffect } from 'react'
import { useTreeStore } from '../../store/useTreeStore'
import { useUIStore } from '../../store/useUIStore'

export const NodeDetail: React.FC = () => {
  const selectedNodeId = useUIStore((s) => s.selectedNodeId)
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const closeSidebar = useUIStore((s) => s.closeSidebar)
  const setDeleteConfirmNodeId = useUIStore((s) => s.setDeleteConfirmNodeId)

  const project = useTreeStore((s) => s.project)
  const updateNode = useTreeStore((s) => s.updateNode)

  const node = selectedNodeId && project ? project.nodes[selectedNodeId] : null

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (node) {
      setTitle(node.title)
      setDescription(node.description)
    }
  }, [node?.id, node?.title, node?.description])

  if (!sidebarOpen || !node) return null

  const isRoot = project?.rootNodeId === node.id

  const handleTitleBlur = () => {
    if (title !== node.title) {
      updateNode(node.id, { title })
    }
  }

  const handleDescBlur = () => {
    if (description !== node.description) {
      updateNode(node.id, { description })
    }
  }

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

  return (
    <div className="w-80 h-full bg-[#16213e] border-l border-[#2a2a4a] flex flex-col shadow-xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a4a]">
        <h3 className="text-sm font-semibold text-gray-300">Node Details</h3>
        <button
          onClick={closeSidebar}
          className="text-gray-400 hover:text-white text-lg leading-none"
        >
          &times;
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Type</label>
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
          <label className="block text-xs text-gray-400 mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            }}
            placeholder="Enter title..."
            className="w-full bg-[#0f1a30] border border-[#2a2a4a] rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleDescBlur}
            placeholder="Enter description..."
            rows={6}
            className="w-full bg-[#0f1a30] border border-[#2a2a4a] rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-amber-500 resize-y"
          />
        </div>

        {node.type === 'experiment' && (
          <div>
            <button
              disabled
              className="w-full bg-gray-600 text-gray-400 rounded px-3 py-2 text-sm cursor-not-allowed"
            >
              Run Experiment (coming soon)
            </button>
          </div>
        )}

        {!isRoot && (
          <div className="pt-2">
            <button
              onClick={handleDelete}
              className="w-full bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded px-3 py-2 text-sm transition-colors"
            >
              Delete Node
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
