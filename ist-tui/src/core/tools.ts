/**
 * IST built-in tools for the experiment agent.
 */
import type { AgentTool, AgentToolResult } from "@earendil-works/pi-agent-core";
import { Type } from "@earendil-works/pi-ai";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const execFileAsync = promisify(execFile);

// ─── Bash ─────────────────────────────────────────────────

const BashSchema = Type.Object({
  command: Type.String({ description: "Shell command to execute" }),
  timeout: Type.Optional(Type.Number({ description: "Timeout in seconds (default 120)" })),
});

export function createBashTool(cwd: string): AgentTool<typeof BashSchema> {
  return {
    name: "bash",
    label: "Bash",
    description:
      "Execute a shell command in the workspace. Returns stdout, stderr, and exit code. Use for running scripts, installing packages, and testing code.",
    parameters: BashSchema,
    async execute(
      _toolCallId: string,
      params: { command: string; timeout?: number },
      signal?: AbortSignal
    ): Promise<AgentToolResult<string>> {
      const timeout = (params.timeout ?? 120) * 1000;
      try {
        const { stdout, stderr } = await execFileAsync("bash", ["-c", params.command], {
          cwd,
          timeout,
          signal,
          maxBuffer: 1024 * 1024,
          encoding: "utf-8",
        });
        return {
          content: [{ type: "text", text: stdout || "(no output)" }],
          details: JSON.stringify({ stdout, stderr, exitCode: 0 }),
        };
      } catch (err: any) {
        const stdout = err.stdout ?? "";
        const stderr = err.stderr ?? "";
        const exitCode = err.code ?? 1;
        const killed = err.killed ?? false;
        const text = [stdout, stderr, killed ? "(timed out)" : `exit: ${exitCode}`]
          .filter(Boolean).join("\n") || "(no output)";
        return {
          content: [{ type: "text", text }],
          details: JSON.stringify({ stdout, stderr, exitCode, killed }),
        };
      }
    },
  };
}

// ─── Read ─────────────────────────────────────────────────

const ReadSchema = Type.Object({
  file_path: Type.String({ description: "Path to the file to read, relative to workspace" }),
  offset: Type.Optional(Type.Number({ description: "Line number to start from (1-indexed)" })),
  limit: Type.Optional(Type.Number({ description: "Max lines to read" })),
});

export function createReadTool(workspacePath: string): AgentTool<typeof ReadSchema> {
  return {
    name: "read",
    label: "Read",
    description: "Read a file from the workspace. Returns content with line numbers.",
    parameters: ReadSchema,
    async execute(
      _toolCallId: string,
      params: { file_path: string; offset?: number; limit?: number },
      _signal?: AbortSignal
    ): Promise<AgentToolResult<string>> {
      const fullPath = params.file_path.startsWith("/")
        ? params.file_path : `${workspacePath}/${params.file_path}`;
      try {
        const content = await readFile(fullPath, "utf-8");
        const lines = content.split("\n");
        const start = Math.max(0, (params.offset ?? 1) - 1);
        const end = params.limit ? start + params.limit : lines.length;
        const numbered = lines.slice(start, end)
          .map((l, i) => `${String(start + i + 1).padStart(4)}  ${l}`).join("\n");
        return {
          content: [{ type: "text", text: numbered || "(empty)" }],
          details: JSON.stringify({ path: fullPath, totalLines: lines.length }),
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Error: ${err.message}` }],
          details: JSON.stringify({ error: err.message }),
        };
      }
    },
  };
}

// ─── Write ────────────────────────────────────────────────

const WriteSchema = Type.Object({
  file_path: Type.String({ description: "Path relative to workspace" }),
  content: Type.String({ description: "Content to write" }),
});

export function createWriteTool(workspacePath: string): AgentTool<typeof WriteSchema> {
  return {
    name: "write",
    label: "Write",
    description: "Write content to a file. Creates parent directories if needed.",
    parameters: WriteSchema,
    async execute(
      _toolCallId: string,
      params: { file_path: string; content: string },
      _signal?: AbortSignal
    ): Promise<AgentToolResult<string>> {
      const fullPath = params.file_path.startsWith("/")
        ? params.file_path : `${workspacePath}/${params.file_path}`;
      try {
        await mkdir(dirname(fullPath), { recursive: true });
        await writeFile(fullPath, params.content, "utf-8");
        return {
          content: [{ type: "text", text: `Wrote ${params.content.length} bytes to ${params.file_path}` }],
          details: JSON.stringify({ path: fullPath, bytes: params.content.length }),
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Error: ${err.message}` }],
          details: JSON.stringify({ error: err.message }),
        };
      }
    },
  };
}

// ─── Collection ───────────────────────────────────────────

export function createISTTools(opts: { cwd: string; workspacePath: string }): AgentTool[] {
  return [
    createBashTool(opts.cwd),
    createReadTool(opts.workspacePath),
    createWriteTool(opts.workspacePath),
  ];
}
