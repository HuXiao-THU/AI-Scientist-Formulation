export type RunStatus = "idle" | "running" | "done" | "failed";

export interface ISTNode {
  id: string;
  type: "idea" | "experiment";
  title: string;
  description: string;
  parentId: string | null;
  childrenIds: string[];
  createdAt: string;
  updatedAt: string;
  gitBranch?: string;
  experimentResult?: string;
  runStatus?: RunStatus;
}

export interface ISTProject {
  version: string;
  rootNodeId: string;
  nodes: Record<string, ISTNode>;
  meta: {
    createdAt: string;
    updatedAt: string;
    workspacePath?: string;
  };
}

export interface ExperimentConfig {
  /** LLM provider (e.g. "anthropic", "openai") */
  provider: string;
  /** Model ID (e.g. "claude-sonnet-4-6") */
  model: string;
  /** API key for the provider */
  apiKey?: string;
  /** Base URL override */
  baseUrl?: string;
}

/** Log event emitted during experiment execution */
export interface ExperimentLogEvent {
  type: "tool_start" | "tool_end" | "assistant" | "error" | "done";
  timestamp: string;
  message: string;
  details?: unknown;
}

export interface ExperimentRunResult {
  success: boolean;
  summary: string;
  error?: string;
  gitBranch?: string;
}
