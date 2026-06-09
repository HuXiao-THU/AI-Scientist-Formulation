import { randomUUID } from "node:crypto";
import type { ISTNode, ISTProject } from "./types.js";

export function addChild(
  project: ISTProject,
  parentId: string,
  type: "idea" | "experiment"
): string {
  const parent = project.nodes[parentId];
  if (!parent) throw new Error(`Parent node ${parentId} not found`);
  if (parent.type === "experiment") {
    throw new Error("Cannot add child to experiment node");
  }
  // Experiment nodes can only have idea parents
  if (type === "experiment" && parent.type !== "idea") {
    throw new Error("Experiment nodes must have an idea parent");
  }

  const now = new Date().toISOString();
  const id = randomUUID();
  const node: ISTNode = {
    id,
    type,
    title: "",
    description: "",
    parentId,
    childrenIds: [],
    createdAt: now,
    updatedAt: now,
  };

  project.nodes[id] = node;
  parent.childrenIds.push(id);
  project.meta.updatedAt = now;
  return id;
}

export function deleteNode(
  project: ISTProject,
  nodeId: string
): void {
  const node = project.nodes[nodeId];
  if (!node) return;
  if (nodeId === project.rootNodeId) return; // cannot delete root

  // Recursively delete children
  for (const childId of [...node.childrenIds]) {
    deleteNode(project, childId);
  }

  // Remove from parent's children list
  if (node.parentId) {
    const parent = project.nodes[node.parentId];
    if (parent) {
      parent.childrenIds = parent.childrenIds.filter((id) => id !== nodeId);
    }
  }

  delete project.nodes[nodeId];
  project.meta.updatedAt = new Date().toISOString();
}

export function updateNode(
  project: ISTProject,
  nodeId: string,
  patch: Partial<Pick<ISTNode, "title" | "description" | "runStatus" | "experimentResult" | "gitBranch">>
): void {
  const node = project.nodes[nodeId];
  if (!node) throw new Error(`Node ${nodeId} not found`);
  Object.assign(node, patch, { updatedAt: new Date().toISOString() });
  project.meta.updatedAt = new Date().toISOString();
}

/** Get the path from root to a node (root first) */
export function getPathToRoot(
  project: ISTProject,
  nodeId: string
): ISTNode[] {
  const path: ISTNode[] = [];
  let current: ISTNode | undefined = project.nodes[nodeId];
  while (current) {
    path.unshift(current);
    current = current.parentId ? project.nodes[current.parentId] : undefined;
  }
  return path;
}

/** Get all descendant nodes under a node (including the node itself) */
export function getSubtree(
  project: ISTProject,
  nodeId: string
): ISTNode[] {
  const result: ISTNode[] = [];
  const stack = [nodeId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    const node = project.nodes[id];
    if (node) {
      result.push(node);
      stack.push(...node.childrenIds);
    }
  }
  return result;
}

/** Get children of a node, sorted by creation time */
export function getChildren(
  project: ISTProject,
  nodeId: string
): ISTNode[] {
  const node = project.nodes[nodeId];
  if (!node) return [];
  return node.childrenIds
    .map((id) => project.nodes[id])
    .filter(Boolean)
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
}
