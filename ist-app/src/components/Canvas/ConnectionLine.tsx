import React from 'react'
import type { NodePosition, ConnectionInfo } from '@shared/types'
import { IDEA_NODE_RIGHT_GUTTER } from '../../layout/treeLayout'

interface ConnectionLineProps {
  connection: ConnectionInfo
  positions: Record<string, NodePosition>
}

export const ConnectionLine: React.FC<ConnectionLineProps> = ({
  connection,
  positions
}) => {
  const from = positions[connection.fromId]
  const to = positions[connection.toId]
  if (!from || !to) return null

  const isIdea = connection.type === 'idea'
  const strokeColor = isIdea ? '#eab308' : '#6b7280'
  const strokeWidth = isIdea ? 2.5 : 2

  let d: string
  if (isIdea) {
    const startX = from.x + from.width + IDEA_NODE_RIGHT_GUTTER
    const startY = from.y + from.height / 2
    const endX = to.x
    const endY = to.y + to.height / 2
    const cp = (endX - startX) * 0.5
    d = `M ${startX} ${startY} C ${startX + cp} ${startY}, ${endX - cp} ${endY}, ${endX} ${endY}`
  } else {
    const startX = from.x + from.width / 2
    const startY = from.y + from.height
    const endX = to.x + to.width / 2
    const endY = to.y
    const cp = (endY - startY) * 0.5
    d = `M ${startX} ${startY} C ${startX} ${startY + cp}, ${endX} ${endY - cp}, ${endX} ${endY}`
  }

  return (
    <path
      d={d}
      fill="none"
      stroke={strokeColor}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
  )
}
