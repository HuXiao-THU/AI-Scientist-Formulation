# IST TUI — Development Plan

## Status
- ✅ Architecture decided: pi-tui + pi-agent-core
- ✅ Git cleanup done, `GUI` branch backs up Electron version
- ✅ Initial skeleton built, compiles and launches

## Stack
- `@earendil-works/pi-tui` — TUI rendering
- `@earendil-works/pi-agent-core` — Agent harness (replaces Claude Code CLI)
- `@earendil-works/pi-ai` — LLM abstraction

## Next Steps
1. Agent tool registration (bash, read, write)
2. Real LLM API key config (read from env or config file)
3. AI Summarize feature
4. Git workspace integration (branch per experiment)
5. Session persistence (JSONL like pi's approach)
6. Add more keyboard shortcuts and polish
7. Package as `ist` CLI command
