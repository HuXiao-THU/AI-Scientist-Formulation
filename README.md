# IST — Idea Search Tree

**Autonomous AI research agent with a TUI-native interface.** IST models research as a tree of ideas and experiments, delegating each experiment to an LLM-powered agent that writes code, runs analyses, and reports results — all within a keyboard-driven terminal UI.

## Philosophy

Human researchers explore ideas through **trial and error** — forming hypotheses, running experiments, analyzing results, and branching into new directions. IST mirrors this process:

- **Ideas** form a tree. Each idea spawns sub-ideas or concrete experiments.
- **Experiments** are executed by an AI agent that writes code, runs it, and summarizes findings.
- **Results** flow back up the tree, enabling informed branching decisions.

The key research question IST explores: **given finite LLM context windows and the need to compress information between tree levels, which research problems are solvable, and which require engineering breakthroughs?**

## Architecture

```
ist-tui/
└── src/
    ├── cli.ts              # TUI main loop + keyboard input
    ├── app.ts              # Application state machine
    ├── core/
    │   ├── types.ts        # IST data model (ISTProject, ISTNode)
    │   ├── ist-file.ts     # .ist file persistence
    │   ├── tree-model.ts   # Tree CRUD operations
    │   └── experiment.ts   # Agent harness (pi-agent-core)
    ├── tui/
    │   ├── tree-view.ts    # ASCII tree rendering
    │   ├── node-detail.ts  # Detail panel with editing
    │   └── log-panel.ts    # Streaming experiment log
    └── utils/
        └── truncate.ts     # Text utilities
```

### Stack

| Layer | Technology |
|-------|-----------|
| TUI rendering | Terminal ANSI escapes |
| Agent harness | [`@earendil-works/pi-agent-core`](https://github.com/earendil-works/pi) |
| LLM abstraction | [`@earendil-works/pi-ai`](https://github.com/earendil-works/pi) |
| Runtime | Node.js ≥ 22, TypeScript |

### Why TUI instead of GUI?

The initial Electron-based GUI suffered from native crashes (Node.js buffer assertion failures in the Electron framework). Switching to a pure terminal TUI eliminates process separation, IPC serialization, and native UI framework dependencies — the agent runs in-process with direct event streaming.

## Quick Start

### Prerequisites

- **Node.js** ≥ 22
- An Anthropic API key (set `ANTHROPIC_API_KEY` in your environment)

### Install & Run

```bash
cd ist-tui
npm install
npm run dev
```

Or open an existing `.ist` project:

```bash
npm run dev -- /path/to/project.ist
```

### Keyboard Controls

| Key | Action |
|-----|--------|
| `↑` `↓` | Navigate tree |
| `i` | Add idea child |
| `e` | Add experiment child |
| `r` | Run experiment (on experiment node) |
| `s` | Save project |
| `Tab` | Edit title |
| `Del` | Delete node |
| `q` | Quit |

## How It Works

### 1. Build the Research Tree

Start with a root idea, then branch out:

```
● [I] California Housing Price Prediction          ← root idea
├─ ● [I] Linear Regression Baseline
│  └─ ○ [E] Run Linear Regression                   ← experiment
├─ ● [I] Random Forest Comparison
│  └─ ○ [E] Run Random Forest
└─ ● [I] Gradient Boosting Methods
   ├─ ○ [E] Run XGBoost
   └─ ○ [E] Run LightGBM
```

- `●` Yellow = Idea node
- `○` Gray = Experiment node
- `✓` Green = Completed experiment
- `✗` Red = Failed experiment

### 2. Run an Experiment

Select an experiment node and press `r`. IST:
1. Builds a system prompt from the full research path (root → current node)
2. Creates a pi `Agent` with code-execution tools
3. The agent writes code, runs it, analyzes results
4. A streaming log panel shows progress in real-time
5. Results are saved to the experiment node and the `.ist` file

### 3. Iterate and Branch

Review results, add new ideas or experiments as children, and continue exploring. The tree preserves the full research trajectory for later analysis.

## CCTS Model (Research Background)

IST is informed by the **Context-Constrained Tree Search (CCTS)** framework, which formalizes autonomous AI research under LLM context window limits:

$$d^* = \left\lfloor \frac{C - S - D}{\alpha \cdot \overline{\Delta I}} \right\rfloor$$

Where:
- **$C$** — total context window (tokens)
- **$S$** — static overhead (system prompt + problem framing)
- **$D$** — per-experiment task demand (code + env + reasoning + output)
- **$\overline{\Delta I}$** — mean information gain per experiment
- **$\alpha$** — compression ratio (ideal = 1, LLM summarization ≈ 8–16)

The **solvability condition**: a research problem is solvable under context budget $C$ when $d^* \geq k^*$, where $k^*$ is the minimum number of experiments needed to reach a solution.

See [idea.md](idea.md) for the original research framing.

## Project Status

- [x] TUI tree navigation and editing
- [x] Agent harness integration (pi-agent-core)
- [x] Experiment execution with streaming logs
- [x] `.ist` file persistence
- [ ] Built-in tool registration (bash, read, write)
- [ ] Git workspace per experiment
- [ ] AI Summarize for idea nodes
- [ ] Session persistence (JSONL)
- [ ] CCTS context budget tracking
- [ ] Multi-provider support (OpenAI, etc.)

## Branches

| Branch | Description |
|--------|-------------|
| `main` | Stable base |
| `TUI` | Active development — TUI-native IST |
| `GUI` | Archived — Electron-based GUI (Phase 1) |

## License

[Apache License 2.0](LICENSE)
