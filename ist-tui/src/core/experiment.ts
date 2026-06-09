import { Agent, type AgentEvent } from "@earendil-works/pi-agent-core";
import { getModel, streamSimple, type Model } from "@earendil-works/pi-ai";
import type {
  ISTProject,
  ISTNode,
  ExperimentConfig,
  ExperimentLogEvent,
  ExperimentRunResult,
} from "./types.js";
import { getPathToRoot } from "./tree-model.js";
import { safeErrorMessage } from "../utils/truncate.js";

export type LogCallback = (event: ExperimentLogEvent) => void;

function ts(): string {
  return new Date().toISOString();
}

/** Build the system prompt describing the IST research context */
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
    "You are an autonomous research agent running an experiment in a local workspace.",
    "",
    "## Research Path (root → current experiment)",
    ...pathLines,
    "",
    "## Experiment Task",
    node.description.trim() || node.title.trim() || "(no description provided)",
    "",
    "## Workspace Rules",
    `- Work inside: ${workspacePath}`,
    "- Write code, run experiments, analyze results.",
    "- When finished, write RESULT.md summarizing key findings, metrics, and output file paths.",
    "- Keep changes reproducible.",
  ].join("\n");
}

/** Build the user prompt that kicks off the experiment */
export function buildUserPrompt(node: ISTNode): string {
  return [
    "Execute the experiment described in the system prompt.",
    "Write and run code as needed. Analyze results.",
    "When done, create RESULT.md with a concise summary of your approach, key metrics, and output files.",
  ].join("\n");
}

/** Resolve a Model from pi-ai's built-in registry, or construct a minimal one */
function resolveModel(config: ExperimentConfig): Model<any> {
  // Try built-in lookup first
  try {
    const m = getModel(config.provider as any, config.model as any);
    if (m) {
      // Apply baseUrl override if provided
      return config.baseUrl ? { ...m, baseUrl: config.baseUrl } : m;
    }
  } catch {
    // Fall through to manual construction
  }

  // Construct minimal model for unknown providers
  return {
    id: config.model,
    name: config.model,
    api: "anthropic" as any,
    provider: config.provider,
    baseUrl: config.baseUrl ?? "https://api.anthropic.com",
    reasoning: false,
    input: ["text" as const],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 200_000,
    maxTokens: 32_000,
  };
}

/** Extract text content from an agent message */
function extractText(msg: { content?: unknown }): string {
  const content = msg.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter(
        (b): b is { type: "text"; text: string } =>
          typeof b === "object" && b !== null && (b as any).type === "text"
      )
      .map((b) => b.text)
      .join("\n");
  }
  return "";
}

/** Create an Agent with IST event logging */
export function createAgent(
  config: ExperimentConfig,
  onLog: LogCallback
): Agent {
  const model = resolveModel(config);

  const agent = new Agent({
    initialState: {
      model,
      systemPrompt: "",
      tools: [],
    },
    streamFn: async (m, context, options) => {
      const apiKey =
        config.apiKey ??
        process.env.ANTHROPIC_API_KEY ??
        process.env.OPENAI_API_KEY;
      return streamSimple(m, context, {
        ...options,
        apiKey,
      });
    },
  });

  // Map agent events → IST log events
  agent.subscribe((event: AgentEvent) => {
    switch (event.type) {
      case "tool_execution_start":
        onLog({
          type: "tool_start",
          timestamp: ts(),
          message: `🔧 ${event.toolName}`,
          details: event.args,
        });
        break;
      case "tool_execution_end":
        onLog({
          type: "tool_end",
          timestamp: ts(),
          message: `✓ ${event.toolName}${event.isError ? " (error)" : ""}`,
          details: event.result,
        });
        break;
      case "message_update":
        if (event.message.role === "assistant") {
          const text = extractText(event.message);
          if (text) {
            onLog({ type: "assistant", timestamp: ts(), message: text });
          }
        }
        break;
      case "agent_end":
        onLog({ type: "done", timestamp: ts(), message: "Experiment finished." });
        break;
    }
  });

  return agent;
}

/** Run a single experiment */
export async function runExperiment(
  project: ISTProject,
  node: ISTNode,
  workspacePath: string,
  config: ExperimentConfig,
  onLog: LogCallback,
  signal?: AbortSignal
): Promise<ExperimentRunResult> {
  try {
    const systemPrompt = buildSystemPrompt(project, node, workspacePath);
    const userPrompt = buildUserPrompt(node);
    const agent = createAgent(config, onLog);

    agent.state.systemPrompt = systemPrompt;

    if (signal) {
      signal.addEventListener(
        "abort",
        () => { agent.abort(); },
        { once: true }
      );
    }

    await agent.waitForIdle();

    onLog({
      type: "assistant",
      timestamp: ts(),
      message: "🚀 Starting experiment...\n",
    });

    await agent.prompt(userPrompt);
    await agent.waitForIdle();

    // Extract summary from last assistant message
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
    };
  } catch (err) {
    const error = safeErrorMessage(err);
    onLog({ type: "error", timestamp: ts(), message: error });
    return { success: false, summary: "", error };
  }
}
