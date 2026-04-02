import React from 'react'
import type { NodePosition } from '@shared/types'

interface IdeaNodeProps {
  position: NodePosition
  title: string
  isRoot: boolean
  isSelected: boolean
  onSelect: (id: string) => void
  onAddIdea: (id: string) => void
  onAddExperiment: (id: string) => void
}

export const IdeaNode: React.FC<IdeaNodeProps> = ({
  position,
  title,
  isRoot,
  isSelected,
  onSelect,
  onAddIdea,
  onAddExperiment
}) => {
  return (
    <g>
      <rect
        x={position.x}
        y={position.y}
        width={position.width}
        height={position.height}
        rx={8}
        ry={8}
        fill={isSelected ? '#fbbf24' : '#fef3c7'}
        stroke={isSelected ? '#d97706' : '#f59e0b'}
        strokeWidth={isSelected ? 2.5 : 1.5}
        style={{ cursor: 'pointer' }}
        onClick={(e) => {
          e.stopPropagation()
          onSelect(position.id)
        }}
      />
      <text
        x={position.x + position.width / 2}
        y={position.y + position.height / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={13}
        fontWeight={isRoot ? 600 : 400}
        fill="#78350f"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {title || (isRoot ? 'Root Idea' : 'New Idea')}
      </text>

      {/* +Idea button */}
      <g
        style={{ cursor: 'pointer' }}
        onClick={(e) => {
          e.stopPropagation()
          onAddIdea(position.id)
        }}
      >
        <rect
          x={position.x + position.width + 6}
          y={position.y + 2}
          width={16}
          height={14}
          rx={3}
          fill="#fef3c7"
          stroke="#f59e0b"
          strokeWidth={1}
          opacity={0.85}
        />
        <text
          x={position.x + position.width + 14}
          y={position.y + 10}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={11}
          fontWeight={700}
          fill="#d97706"
          style={{ pointerEvents: 'none' }}
        >
          +
        </text>
      </g>

      {/* +Experiment button */}
      <g
        style={{ cursor: 'pointer' }}
        onClick={(e) => {
          e.stopPropagation()
          onAddExperiment(position.id)
        }}
      >
        <rect
          x={position.x + position.width + 6}
          y={position.y + 20}
          width={16}
          height={14}
          rx={3}
          fill="#e5e7eb"
          stroke="#9ca3af"
          strokeWidth={1}
          opacity={0.85}
        />
        <text
          x={position.x + position.width + 14}
          y={position.y + 28}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={11}
          fontWeight={700}
          fill="#6b7280"
          style={{ pointerEvents: 'none' }}
        >
          +
        </text>
      </g>
    </g>
  )
}
