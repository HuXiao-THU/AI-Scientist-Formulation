import React from 'react'
import { useUIStore } from '../store/useUIStore'
import { useTreeStore } from '../store/useTreeStore'

export const DeleteConfirm: React.FC = () => {
  const nodeId = useUIStore((s) => s.deleteConfirmNodeId)
  const setDeleteConfirmNodeId = useUIStore((s) => s.setDeleteConfirmNodeId)
  const closeSidebar = useUIStore((s) => s.closeSidebar)
  const deleteNode = useTreeStore((s) => s.deleteNode)
  const project = useTreeStore((s) => s.project)

  if (!nodeId || !project) return null

  const node = project.nodes[nodeId]
  if (!node) return null

  const childCount = node.childrenIds.length

  const handleConfirm = () => {
    deleteNode(nodeId)
    setDeleteConfirmNodeId(null)
    closeSidebar()
  }

  const handleCancel = () => {
    setDeleteConfirmNodeId(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[#16213e] rounded-xl shadow-2xl border border-[#2a2a4a] w-[360px] p-5">
        <h3 className="text-base font-semibold text-gray-200 mb-3">
          Confirm Delete
        </h3>
        <p className="text-sm text-gray-400 mb-4">
          {childCount > 0
            ? `This node has ${childCount} child node(s). Deleting will remove the entire subtree. This action cannot be undone.`
            : 'This node has content. Are you sure you want to delete it? This action cannot be undone.'}
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 text-sm bg-red-600 hover:bg-red-500 text-white font-medium rounded transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
