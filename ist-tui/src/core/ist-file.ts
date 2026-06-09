import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import type { ISTProject, ISTNode } from "./types.js";

const CURRENT_VERSION = "1.0";

export function createProject(): ISTProject {
  const rootId = randomUUID();
  const now = new Date().toISOString();
  const root: ISTNode = {
    id: rootId,
    type: "idea",
    title: "",
    description: "",
    parentId: null,
    childrenIds: [],
    createdAt: now,
    updatedAt: now,
  };
  return {
    version: CURRENT_VERSION,
    rootNodeId: rootId,
    nodes: { [rootId]: root },
    meta: { createdAt: now, updatedAt: now },
  };
}

export function loadProject(filePath: string): ISTProject {
  const content = readFileSync(filePath, "utf-8");
  return JSON.parse(content) as ISTProject;
}

export function saveProject(
  filePath: string,
  project: ISTProject
): void {
  project.meta.updatedAt = new Date().toISOString();
  writeFileSync(filePath, JSON.stringify(project, null, 2), "utf-8");
}

export function fileExists(filePath: string): boolean {
  return existsSync(filePath);
}

/** Derive workspace path from .ist file path */
export function workspacePath(istFilePath: string): string {
  return istFilePath.replace(/\.ist$/i, "") + "-workspace";
}
