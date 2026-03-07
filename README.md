# scout-and-wave-go

[![Blackwell Systems™](https://raw.githubusercontent.com/blackwell-systems/blackwell-docs-theme/main/badge-trademark.svg)](https://github.com/blackwell-systems)
[![CI](https://github.com/blackwell-systems/scout-and-wave-go/actions/workflows/ci.yml/badge.svg)](https://github.com/blackwell-systems/scout-and-wave-go/actions/workflows/ci.yml)
[![Go Reference](https://pkg.go.dev/badge/github.com/blackwell-systems/scout-and-wave-go.svg)](https://pkg.go.dev/github.com/blackwell-systems/scout-and-wave-go)
[![Go Report Card](https://goreportcard.com/badge/github.com/blackwell-systems/scout-and-wave-go)](https://goreportcard.com/report/github.com/blackwell-systems/scout-and-wave-go)
![Version](https://img.shields.io/badge/version-0.11.0-blue)
[![Buy Me A Coffee](https://img.shields.io/badge/buy%20me%20a%20coffee-donate-yellow.svg)](https://buymeacoffee.com/blackwellsystems)

Go implementation of the [Scout-and-Wave protocol](https://github.com/blackwell-systems/scout-and-wave) for parallel agent coordination.

## Overview

SAW coordinates multiple AI agents working in parallel on non-overlapping parts of a codebase. Each agent gets an isolated git worktree; the orchestrator merges, verifies, and sequences waves automatically.

## Installation

```bash
go install github.com/blackwell-systems/scout-and-wave-go/cmd/saw@latest
```

## Usage

```bash
# Analyze a codebase and produce an IMPL doc
saw scout --feature "add OAuth support"

# Create shared type scaffold files from an IMPL doc
saw scaffold --impl docs/IMPL/IMPL-oauth.md

# Execute all waves automatically (no prompts)
saw wave --impl docs/IMPL/IMPL-oauth.md --auto

# Execute from a specific wave number
saw wave --impl docs/IMPL/IMPL-oauth.md --wave 2 --auto

# Merge a single wave manually (recovery)
saw merge --impl docs/IMPL/IMPL-oauth.md --wave 1

# Check wave/agent status
saw status --impl docs/IMPL/IMPL-oauth.md
saw status --impl docs/IMPL/IMPL-oauth.md --json
saw status --impl docs/IMPL/IMPL-oauth.md --missing

# Open the web UI (review IMPL docs + live wave dashboard)
saw serve

# Print version
saw --version
```

### Backend selection

`saw scout` and `saw scaffold` support a `--backend` flag and `SAW_BACKEND` environment variable:

| Value | Behavior |
|-------|----------|
| `api` | Calls the Anthropic API directly. Requires `ANTHROPIC_API_KEY`. |
| `cli` | Shells out to `claude --print`. Works with Claude Max plan — no API key needed. |
| `auto` | Uses `api` when `ANTHROPIC_API_KEY` is set, `cli` otherwise. **Default.** |

```bash
# Explicit flag
saw scout --feature "add OAuth support" --backend cli

# Persistent default via env var (flag takes precedence)
export SAW_BACKEND=cli
saw scout --feature "add OAuth support"
```

### Web UI (`saw serve`)

`saw serve` starts a local HTTP server and opens the browser automatically on macOS and Linux.

- **IMPL picker** — select any IMPL doc from the home screen; no manual slug entry required
- **Review screen** — suitability badge, file ownership table, wave diagram, interface contracts, approve/reject buttons
- **Wave dashboard** — live per-wave progress bars and agent cards (status, files, errors) streamed over SSE
- **Dark mode** — toggle persisted to `localStorage`

Flags: `--addr` (default `:8080`), `--impl-dir`, `--repo`, `--no-browser`

## Architecture

```
cmd/saw/           # CLI entry point (wave, status, scout, scaffold, merge, serve)
pkg/
├── orchestrator/  # 10-state machine + wave coordination + merge procedure + SSE events
├── protocol/      # IMPL doc parser + completion report extraction
├── worktree/      # Git worktree create/remove/cleanup
├── agent/
│   ├── backend/   # Backend interface (api + cli implementations)
│   └── ...        # Runner + completion polling
└── api/           # HTTP server, SSE broker, REST endpoints
internal/
└── git/           # Git CLI wrappers (worktree, merge, diff, rev-parse)
web/               # React + TypeScript + Tailwind (baked into binary via go:embed)
```

## Protocol Compliance

Implements [SAW Protocol v0.8.0](https://github.com/blackwell-systems/scout-and-wave/tree/main/protocol):

| Invariant | Description |
|-----------|-------------|
| I1 | Disjoint file ownership enforced pre-merge |
| I2 | Interface contracts precede parallel execution |
| I3 | Wave N+1 blocked until Wave N merged + verified |
| I4 | IMPL doc is single source of truth |
| I5 | Agents commit before reporting (enforced by merge trip wire) |
| I6 | Role separation: orchestrator does not do agent work |

**10-state machine:**

```
ScoutPending → Reviewed → ScaffoldPending → WavePending → WaveExecuting
                                                 ↑              ↓
                                            WaveVerified ← WaveMerging
                                                 ↓
                                             Complete
```

Terminal states: `NotSuitable`, `Complete`. Recovery state: `Blocked`.

## Protocol Reference

- [invariants.md](https://github.com/blackwell-systems/scout-and-wave/blob/main/protocol/invariants.md) — Six correctness guarantees (I1–I6)
- [state-machine.md](https://github.com/blackwell-systems/scout-and-wave/blob/main/protocol/state-machine.md) — Ten states and transitions
- [participants.md](https://github.com/blackwell-systems/scout-and-wave/blob/main/protocol/participants.md) — Four participant roles
- [message-formats.md](https://github.com/blackwell-systems/scout-and-wave/blob/main/protocol/message-formats.md) — YAML schemas

## License

MIT
