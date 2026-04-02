import React from 'react'
import type { LayoutResult } from '@shared/types'
import { useTreeStore } from '../../store/useTreeStore'
import { useUIStore } from '../../store/useUIStore'
import { IdeaNode } from './IdeaNode'
import { ExperimentNode } from './ExperimentNode'
import { ConnectionLine } from './ConnectionLine'

interface TreeRendererProps {
  layout: LayoutResult | null
}

export const TreeRenderer: React.FC<TreeRendererProps> = ({ layout }) => {
  const project = useTreeStore((s) => s.project)
  const addNode = useTreeStore((s) => s.addNode)
  const selectedNodeId = useUIStore((s) => s.selectedNodeId)
  const selectNode = useUIStore((s) => s.selectNode)

  if (!project || !layout) return null

  const handleAddIdea = (parentId: string) => {
    const newId = addNode(parentId, 'idea')
    if (newId) selectNode(newId)
  }

  const handleAddExperiment = (parentId: string) => {
    const newId = addNode(parentId, 'experiment')
    if (newId) selectNode(newId)
  }

  const handleCanvasClick = () => {
    selectNode(null)
  }

  return (
    <svg
      width={layout.totalWidth}
      height={layout.totalHeight}
      onClick={handleCanvasClick}
      style={{ minWidth: '100%', minHeight: '100%' }}
    >
      {layout.connections.map((conn, i) => (
        <ConnectionLine
          key={`conn-${i}`}
          connection={conn}
          positions={layout.positions}
        />
      ))}

      {Object.values(layout.positions).map((pos) => {
        const node = project.nodes[pos.id]
        if (!node) return null

        if (node.type === 'idea') {
          return (
            <IdeaNode
              key={pos.id}
              position={pos}
              title={node.title}
              isRoot={pos.id === project.rootNodeId}
              isSelected={pos.id === selectedNodeId}
              onSelect={selectNode}
              onAddIdea={handleAddIdea}
              onAddExperiment={handleAddExperiment}
            />
          )
        }

        return (
          <ExperimentNode
            key={pos.id}
            position={pos}
            title={node.title}
            isSelected={pos.id === selectedNodeId}
            onSelect={selectNode}
          />
        )
      })}
    </svg>
  )
}
