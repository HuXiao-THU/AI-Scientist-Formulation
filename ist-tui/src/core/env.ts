/**
 * Minimal .env file loader.
 * Reads KEY=VALUE pairs from a file and sets them on process.env.
 * Does NOT overwrite existing env vars.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/** Find the .env file: looks at project root, then walking up */
function findEnvFile(fromDir: string): string | null {
  let dir = resolve(fromDir);
  for (let i = 0; i < 5; i++) {
    const candidate = `${dir}/.env`;
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/** Parse a .env file and return key-value pairs. Ignores comments and blank lines. */
function parseEnv(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    let value = line.slice(eqIdx + 1).trim();
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key) result[key] = value;
  }
  return result;
}

/** Load .env into process.env (does NOT override existing values). */
export function loadEnv(fromDir?: string): void {
  const cwd = fromDir ?? (typeof process !== "undefined" ? process.cwd() : "/");
  const envPath = findEnvFile(cwd);
  if (!envPath) return;

  const content = readFileSync(envPath, "utf-8");
  const parsed = parseEnv(content);

  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
