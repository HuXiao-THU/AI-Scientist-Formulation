import React from 'react'
import type { NodePosition } from '@shared/types'

interface ExperimentNodeProps {
  position: NodePosition
  title: string
  isSelected: boolean
  onSelect: (id: string) => void
}

export const ExperimentNode: React.FC<ExperimentNodeProps> = ({
  position,
  title,
  isSelected,
  onSelect
}) => {
  return (
    <g>
      <rect
        x={position.x}
        y={position.y}
        width={position.width}
        height={position.height}
        rx={6}
        ry={6}
        fill={isSelected ? '#d1d5db' : '#f3f4f6'}
        stroke={isSelected ? '#6b7280' : '#9ca3af'}
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
        fill="#374151"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {title || 'New Experiment'}
      </text>
    </g>
  )
}
