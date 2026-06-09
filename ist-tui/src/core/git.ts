import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { join } from "node:path";

const execAsync = promisify(execFile);

export class GitWorkspace {
  constructor(private cwd: string) {}

  private async run(args: string[]): Promise<string> {
    const { stdout } = await execAsync("git", args, { cwd: this.cwd, encoding: "utf-8" });
    return stdout.trim();
  }

  async init(): Promise<void> {
    if (!existsSync(join(this.cwd, ".git"))) {
      await this.run(["init", "-b", "main"]);
      await this.run(["config", "user.email", "ist@local.dev"]);
      await this.run(["config", "user.name", "IST"]);
    }
  }

  async hasChanges(): Promise<boolean> {
    try {
      const status = await this.run(["status", "--porcelain"]);
      return status.length > 0;
    } catch { return false; }
  }

  async commitAll(message: string): Promise<boolean> {
    try {
      await this.run(["add", "-A"]);
      const status = await this.run(["status", "--porcelain"]);
      if (!status) return false;
      await this.run(["commit", "-m", message]);
      return true;
    } catch { return false; }
  }

  async branchExists(name: string): Promise<boolean> {
    try { await this.run(["rev-parse", "--verify", name]); return true; }
    catch { return false; }
  }

  async createBranch(name: string, base: string): Promise<void> {
    const exists = await this.branchExists(name);
    if (!exists) {
      const baseOk = await this.branchExists(base);
      if (baseOk) {
        await this.run(["checkout", "-b", name, base]);
      } else {
        await this.run(["checkout", "-b", name]);
      }
    } else {
      await this.run(["checkout", name]);
    }
  }

  async currentBranch(): Promise<string> {
    try { return await this.run(["rev-parse", "--abbrev-ref", "HEAD"]); }
    catch { return "main"; }
  }
}
