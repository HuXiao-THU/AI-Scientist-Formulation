import type { ISTNode, ISTProject } from "../core/types.js";
import { getChildren, getPathToRoot } from "../core/tree-model.js";
import { theme } from "./theme.js";
import { truncateToWidth, padToWidth, visualWidth } from "../utils/truncate.js";

/** A flattened node with display metadata */
export interface FlatNode {
  node: ISTNode;
  indent: number;
  isLast: boolean;
  /** Stack of booleans: for each ancestor level, does the line continue? */
  continues: boolean[];
}

/** Flatten the project tree for display. */
export function flattenTree(
  project: ISTProject,
  _selectedId: string | null
): FlatNode[] {
  const result: FlatNode[] = [];
  const root = project.nodes[project.rootNodeId];
  if (!root) return result;

  const stack: {
    nodeId: string;
    indent: number;
    continues: boolean[];
    isLast: boolean;
  }[] = [];

  // Push root's children in reverse order (so first child is processed first)
  const rootChildren = getChildren(project, root.id);
  for (let i = rootChildren.length - 1; i >= 0; i--) {
    stack.push({
      nodeId: rootChildren[i].id,
      indent: 0,
      continues: [],
      isLast: i === rootChildren.length - 1,
    });
  }

  while (stack.length > 0) {
    const { nodeId, indent, continues, isLast } = stack.pop()!;
    const node = project.nodes[nodeId];
    if (!node) continue;

    result.push({ node, indent, isLast, continues });

    const children = getChildren(project, node.id);
    if (children.length > 0) {
      const newContinues = [...continues, !isLast];
      for (let i = children.length - 1; i >= 0; i--) {
        stack.push({
          nodeId: children[i].id,
          indent: indent + 1,
          continues: newContinues,
          isLast: i === children.length - 1,
        });
      }
    }
  }

  return result;
}

/** Render the tree into lines */
export function renderTree(
  project: ISTProject,
  selectedId: string | null,
  width: number
): string[] {
  const flatNodes = flattenTree(project, selectedId);
  const lines: string[] = [];

  // Compute path from root to selected node for branch highlighting
  const selectedPath = new Set<string>();
  if (selectedId) {
    const path = getPathToRoot(project, selectedId);
    for (const n of path) selectedPath.add(n.id);
  }

  // Render root node first (always on path)
  const root = project.nodes[project.rootNodeId];
  if (root) {
    const isSelected = root.id === selectedId;
    const line = renderNodeLine(root, isSelected, true, "", width);
    lines.push(line);
  }

  for (const fn of flatNodes) {
    const isSelected = fn.node.id === selectedId;
    const onPath = selectedPath.has(fn.node.id);
    const prefix = buildTreePrefix(fn.indent, fn.isLast, fn.continues);
    const line = renderNodeLine(fn.node, isSelected, onPath, prefix, width);
    lines.push(line);
  }

  return lines;
}

/** Build ASCII tree prefix like "  ├─ " or "  └─ " or "  │  " */
function buildTreePrefix(
  indent: number,
  isLast: boolean,
  continues: boolean[]
): string {
  if (indent === 0) return isLast ? "└─ " : "├─ ";

  let prefix = "";
  for (let i = 0; i < indent; i++) {
    if (i < continues.length && continues[i]) {
      prefix += "│  ";
    } else {
      prefix += "   ";
    }
  }
  prefix += isLast ? "└─ " : "├─ ";
  return prefix;
}

/** Render a single node line */
function renderNodeLine(
  node: ISTNode,
  isSelected: boolean,
  onPath: boolean,
  treePrefix: string,
  width: number
): string {
  // Status icon
  let statusIcon = "";
  if (node.type === "experiment") {
    switch (node.runStatus) {
      case "running":
        statusIcon = theme.running("◉");
        break;
      case "done":
        statusIcon = theme.done("✓");
        break;
      case "failed":
        statusIcon = theme.failed("✗");
        break;
      default:
        statusIcon = theme.idle("○");
    }
  } else {
    statusIcon = onPath ? theme.idea("●") : theme.idle("○");
  }

  // Type badge
  const badge =
    node.type === "idea" ? theme.badge.idea("[I]") : theme.badge.experiment("[E]");

  // Title text — dim non-path nodes
  const title = node.title || "(untitled)";
  // Reserve space for prefix + icon + badge + margins
  const prefixVisualWidth = visualWidth(treePrefix);
  const reserved = prefixVisualWidth + 7; // icon(2) + space + badge(4) + margin
  const maxTitleWidth = Math.max(10, width - reserved);
  const truncatedTitle = truncateToWidth(title, maxTitleWidth);
  const displayTitle = onPath ? truncatedTitle : theme.muted(truncatedTitle);

  // Build line
  let line = `${treePrefix}${statusIcon} ${badge} ${displayTitle}`;

  // Highlight selected
  if (isSelected) {
    line = theme.bg.selected(line) + " ←";
  }

  // Pad to target visual width
  line = padToWidth(line, width);
  return line;
}
