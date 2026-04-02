import type { ISTProject, ISTNode, NodePosition, LayoutResult, ConnectionInfo } from '@shared/types'

const NODE_HEIGHT = 36
const NODE_PADDING_H = 24
const NODE_MIN_WIDTH = 100
/** Upper bound to avoid absurd titles; must not clip real UI text (previously 300 caused overlap). */
const NODE_MAX_WIDTH = 1600
const H_GAP = 60
const V_GAP = 16

/** Horizontal space for +Idea / +Experiment controls east of the idea rect (see IdeaNode.tsx: +6, width 16). */
export const IDEA_NODE_RIGHT_GUTTER = 22

function estimateCharDisplayWidth(ch: string): number {
  const cp = ch.codePointAt(0) ?? 0
  if (cp <= 0x20) return 4
  if (cp < 0x80) return 7.2
  return 13
}

function ideaLayoutSpan(rectWidth: number): number {
  return rectWidth + IDEA_NODE_RIGHT_GUTTER
}

const PLACEHOLDER_IDEA = 'New Idea'
const PLACEHOLDER_EXPERIMENT = 'New Experiment'

function estimateNodeWidth(title: string, type: 'idea' | 'experiment' = 'idea'): number {
  const displayText = title || (type === 'idea' ? PLACEHOLDER_IDEA : PLACEHOLDER_EXPERIMENT)
  let textWidth = NODE_PADDING_H * 2
  for (const ch of displayText) {
    textWidth += estimateCharDisplayWidth(ch)
  }
  return Math.max(NODE_MIN_WIDTH, Math.min(NODE_MAX_WIDTH, textWidth))
}

interface SubtreeMetrics {
  width: number
  height: number
  experimentColumnHeight: number
  ideaColumnHeight: number
}

export function computeLayout(project: ISTProject): LayoutResult {
  const positions: Record<string, NodePosition> = {}
  const connections: ConnectionInfo[] = []

  const root = project.nodes[project.rootNodeId]
  if (!root) return { positions, connections, totalWidth: 0, totalHeight: 0 }

  const metrics = new Map<string, SubtreeMetrics>()

  function computeMetrics(nodeId: string): SubtreeMetrics {
    const node = project.nodes[nodeId]
    if (!node) return { width: 0, height: 0, experimentColumnHeight: 0, ideaColumnHeight: 0 }

    const nodeWidth = estimateNodeWidth(node.title, node.type)

    if (node.type === 'experiment') {
      const m: SubtreeMetrics = {
        width: nodeWidth,
        height: NODE_HEIGHT,
        experimentColumnHeight: 0,
        ideaColumnHeight: 0
      }
      metrics.set(nodeId, m)
      return m
    }

    const experimentChildren = node.childrenIds
      .map((id) => project.nodes[id])
      .filter((n): n is ISTNode => !!n && n.type === 'experiment')

    const ideaChildren = node.childrenIds
      .map((id) => project.nodes[id])
      .filter((n): n is ISTNode => !!n && n.type === 'idea')

    let expColumnHeight = 0
    let maxExpWidth = 0
    for (const exp of experimentChildren) {
      computeMetrics(exp.id)
      maxExpWidth = Math.max(maxExpWidth, estimateNodeWidth(exp.title, 'experiment'))
      if (expColumnHeight > 0) expColumnHeight += V_GAP
      expColumnHeight += NODE_HEIGHT
    }

    /** Same column as this idea: experiments share x; child ideas start after the widest of them. */
    const columnAnchorWidth = Math.max(ideaLayoutSpan(nodeWidth), maxExpWidth)

    let ideaColumnHeight = 0
    let ideaColumnMaxWidth = 0
    for (const idea of ideaChildren) {
      const childMetrics = computeMetrics(idea.id)
      if (ideaColumnHeight > 0) ideaColumnHeight += V_GAP
      const childTotalHeight =
        NODE_HEIGHT +
        (childMetrics.experimentColumnHeight > 0
          ? V_GAP + childMetrics.experimentColumnHeight
          : 0) +
        (childMetrics.ideaColumnHeight > 0
          ? V_GAP + childMetrics.ideaColumnHeight
          : 0)
      ideaColumnHeight += childTotalHeight

      const childSubtreeWidth = columnAnchorWidth + H_GAP + childMetrics.width
      ideaColumnMaxWidth = Math.max(ideaColumnMaxWidth, childSubtreeWidth)
    }

    const rightColumnWidth =
      ideaChildren.length > 0 ? H_GAP + ideaColumnMaxWidth : 0

    const totalHeight = Math.max(
      NODE_HEIGHT +
        (expColumnHeight > 0 ? V_GAP + expColumnHeight : 0),
      NODE_HEIGHT +
        (ideaColumnHeight > 0 ? V_GAP + ideaColumnHeight : 0)
    )

    const m: SubtreeMetrics = {
      width: columnAnchorWidth + rightColumnWidth,
      height: totalHeight,
      experimentColumnHeight: expColumnHeight,
      ideaColumnHeight
    }
    metrics.set(nodeId, m)
    return m
  }

  function positionNode(nodeId: string, x: number, y: number): void {
    const node = project.nodes[nodeId]
    if (!node) return

    const nodeWidth = estimateNodeWidth(node.title, node.type)
    positions[nodeId] = {
      id: nodeId,
      x,
      y,
      width: nodeWidth,
      height: NODE_HEIGHT
    }

    if (node.type === 'experiment') return

    const experimentChildren = node.childrenIds
      .map((id) => project.nodes[id])
      .filter((n): n is ISTNode => !!n && n.type === 'experiment')

    const ideaChildren = node.childrenIds
      .map((id) => project.nodes[id])
      .filter((n): n is ISTNode => !!n && n.type === 'idea')

    let maxExpW = 0
    let expY = y + NODE_HEIGHT + V_GAP
    for (const exp of experimentChildren) {
      const expW = estimateNodeWidth(exp.title, 'experiment')
      maxExpW = Math.max(maxExpW, expW)
      positions[exp.id] = {
        id: exp.id,
        x,
        y: expY,
        width: expW,
        height: NODE_HEIGHT
      }
      connections.push({ fromId: nodeId, toId: exp.id, type: 'experiment' })
      expY += NODE_HEIGHT + V_GAP
    }

    const columnAnchorWidth = Math.max(ideaLayoutSpan(nodeWidth), maxExpW)

    let ideaY = y
    const ideaX = x + columnAnchorWidth + H_GAP
    for (const idea of ideaChildren) {
      positionNode(idea.id, ideaX, ideaY)
      connections.push({ fromId: nodeId, toId: idea.id, type: 'idea' })

      const childMetrics = metrics.get(idea.id)!
      const childExpHeight =
        childMetrics.experimentColumnHeight > 0
          ? V_GAP + childMetrics.experimentColumnHeight
          : 0
      const childIdeaHeight =
        childMetrics.ideaColumnHeight > 0
          ? V_GAP + childMetrics.ideaColumnHeight
          : 0
      const usedHeight = NODE_HEIGHT + Math.max(childExpHeight, childIdeaHeight)
      ideaY += usedHeight + V_GAP
    }
  }

  computeMetrics(project.rootNodeId)
  positionNode(project.rootNodeId, 100, 100)

  let maxX = 0
  let maxY = 0
  for (const pos of Object.values(positions)) {
    const n = project.nodes[pos.id]
    const rightEdge =
      n?.type === 'idea' ? pos.x + ideaLayoutSpan(pos.width) : pos.x + pos.width
    maxX = Math.max(maxX, rightEdge)
    maxY = Math.max(maxY, pos.y + pos.height)
  }

  return {
    positions,
    connections,
    totalWidth: maxX + 200,
    totalHeight: maxY + 200
  }
}
