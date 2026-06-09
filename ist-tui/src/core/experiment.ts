import { Agent, type AgentEvent } from "@earendil-works/pi-agent-core";
import { getModel, streamSimple, type Model } from "@earendil-works/pi-ai";
import { mkdirSync } from "node:fs";
import type {
  ISTProject, ISTNode, ExperimentConfig,
  ExperimentLogEvent, ExperimentRunResult,
} from "./types.js";
import { getPathToRoot } from "./tree-model.js";
import { createISTTools } from "./tools.js";
import { GitWorkspace } from "./git.js";
import { safeErrorMessage } from "../utils/truncate.js";

export type LogCallback = (event: ExperimentLogEvent) => void;

function ts(): string { return new Date().toISOString(); }

// ─── Prompt builders ──────────────────────────────────────

export function buildSystemPrompt(
  project: ISTProject,
  node: ISTNode,
  workspacePath: string
): string {
  const path = getPathToRoot(project, node.id);
  const pathLines = path.map((n, i) => {
    const label = n.type === "idea" ? "Idea" : "Experiment";
    return `${i + 1}. [${label}] ${n.title || "(untitled)"}\n   ${n.description || "(no description)"}`;
  });

  return [
    "You are an autonomous research agent running a scientific experiment.",
    "",
    "## Research Path (root → current experiment)",
    ...pathLines,
    "",
    "## Experiment Task",
    node.description.trim() || node.title.trim() || "(no description provided)",
    "",
    "## Workspace",
    `- Work inside: ${workspacePath}`,
    "- Write code, run experiments, analyze results.",
    "- When finished, create RESULT.md summarizing key findings, metrics, and output file paths.",
    "- Keep changes reproducible.",
  ].join("\n");
}

export function buildUserPrompt(_node: ISTNode): string {
  return [
    "Execute the experiment described above.",
    "Write and run code as needed. Analyze the results.",
    "When done, create RESULT.md with a concise summary of your approach, key metrics, and output files.",
  ].join("\n");
}

// ─── Model resolution ─────────────────────────────────────

function resolveModel(config: ExperimentConfig): Model<any> {
  const { provider, model: modelId, baseUrl } = config;

  // Try built-in lookup first (works for anthropic, openai, etc.)
  try {
    const m = getModel(provider as any, modelId as any);
    if (m) return baseUrl ? { ...m, baseUrl } : m;
  } catch { /* fall through */ }

  // Manual construction for providers not in registry (e.g. deepseek direct API)
  return {
    id: modelId,
    name: modelId,
    api: provider === "deepseek" ? "openai-completions" as any : "anthropic" as any,
    provider,
    baseUrl: baseUrl ?? "https://api.deepseek.com/v1",
    reasoning: modelId.includes("reasoner") || modelId.includes("r1"),
    input: ["text" as const],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128_000,
    maxTokens: 32_000,
  };
}

// ─── API key ──────────────────────────────────────────────

function pickApiKey(provider: string): string | undefined {
  switch (provider) {
    case "deepseek":  return process.env.DEEPSEEK_API_KEY;
    case "openai":    return process.env.OPENAI_API_KEY;
    case "anthropic": return process.env.ANTHROPIC_API_KEY;
    default:          return process.env.DEEPSEEK_API_KEY
                        ?? process.env.OPENAI_API_KEY
                        ?? process.env.ANTHROPIC_API_KEY;
  }
}

// ─── Text extraction ──────────────────────────────────────

function extractText(msg: { content?: unknown }): string {
  const c = msg.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) {
    return c
      .filter((b): b is { type: "text"; text: string } =>
        typeof b === "object" && b !== null && (b as any).type === "text")
      .map(b => b.text).join("\n");
  }
  return "";
}

// ─── Agent factory ────────────────────────────────────────

export function createAgent(
  config: ExperimentConfig,
  workspacePath: string,
  onLog: LogCallback,
): Agent {
  const model = resolveModel(config);

  // Create workspace tools
  const tools = createISTTools({ cwd: workspacePath, workspacePath });

  const agent = new Agent({
    initialState: { model, systemPrompt: "", tools },
    streamFn: async (m, ctx, opts) => {
      const apiKey = config.apiKey
        ?? pickApiKey(config.provider);
      return streamSimple(m, ctx, { ...opts, apiKey } as any);
    },
  });

  // Map agent events → IST log events
  agent.subscribe((event: AgentEvent) => {
    switch (event.type) {
      case "tool_execution_start":
        onLog({ type: "tool_start", timestamp: ts(), message: `🔧 ${event.toolName}`, details: event.args });
        break;
      case "tool_execution_end":
        onLog({ type: "tool_end", timestamp: ts(), message: `✓ ${event.toolName}${event.isError ? " (error)" : ""}`, details: event.result });
        break;
      case "message_update":
        if (event.message.role === "assistant") {
          const text = extractText(event.message);
          if (text) onLog({ type: "assistant", timestamp: ts(), message: text });
        }
        break;
      case "agent_end":
        onLog({ type: "done", timestamp: ts(), message: "Experiment finished." });
        break;
      default:
        break;
    }
  });

  return agent;
}

// ─── Experiment runner ────────────────────────────────────

export async function runExperiment(
  project: ISTProject,
  node: ISTNode,
  workspacePath: string,
  config: ExperimentConfig,
  onLog: LogCallback,
  signal?: AbortSignal,
): Promise<ExperimentRunResult> {
  mkdirSync(workspacePath, { recursive: true });

  // Git: create experiment branch
  const git = new GitWorkspace(workspacePath);
  let branchName = "";
  try {
    await git.init();
    const shortId = node.id.replace(/-/g, "").slice(0, 8);
    branchName = `exp/${shortId}`;
    try { await git.createBranch(branchName, "main"); }
    catch { /* best effort */ }
  } catch { /* git unavailable, continue without */ }

  try {
    const systemPrompt = buildSystemPrompt(project, node, workspacePath);
    const userPrompt = buildUserPrompt(node);
    const agent = createAgent(config, workspacePath, onLog);

    agent.state.systemPrompt = systemPrompt;

    if (signal) {
      signal.addEventListener("abort", () => agent.abort(), { once: true });
    }

    await agent.waitForIdle();

    onLog({ type: "assistant", timestamp: ts(), message: "🚀 Starting experiment...\n" });
    await agent.prompt(userPrompt);
    await agent.waitForIdle();

    // Commit results
    if (branchName) {
      try { await git.commitAll(`experiment: ${node.title || node.id}`); }
      catch { /* best effort */ }
    }

    // Extract summary
    const messages = agent.state.messages;
    let summary = "";
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg && msg.role === "assistant") {
        summary = extractText(msg);
        if (summary) break;
      }
    }

    return {
      success: !agent.state.errorMessage,
      summary: summary.slice(0, 8000) || "Experiment completed.",
      error: agent.state.errorMessage,
      gitBranch: branchName || undefined,
    };
  } catch (err) {
    const error = safeErrorMessage(err);
    onLog({ type: "error", timestamp: ts(), message: error });
    return { success: false, summary: "", error, gitBranch: branchName || undefined };
  }
}
