# Polywave Roadmap

## Vision

**Polywave is the only agent coordination framework that solves merge conflicts by design — parallel agents own disjoint files, branches merge cleanly, and humans review the plan before any code is written.**

Competitive positioning:
- Single-agent tools (simple loop, great DX, serial execution — one agent, one task)
- Parallel-capable tools (parallel stories, rich desktop app, complex surface area, vague on merge safety)
- Polywave: protocol-driven parallelism, hard merge safety guarantees, human review gate, zero merge conflicts by construction

Distribution strategy: `/polywave` skill + subagents for orchestration (already works, zero setup); Wails desktop app for rich wave monitoring with native OS distribution.

**Repo structure:**
```
polywave-go/       github.com/blackwell-systems/polywave-go (engine)
  pkg/engine/            wave runner, scout runner, merge, worktree mgmt
  pkg/protocol/          IMPL doc parser
  internal/git/          git commands

polywave-web/      github.com/blackwell-systems/polywave-web (current repo)
  pkg/api/               HTTP adapter over engine (imports engine module)
  web/                   React frontend
  cmd/polywave/               web server binary

polywave-app/      Wails desktop app (future)
  cmd/polywave-app/           Wails binary
  src/                   React frontend (shared from polywave-web)
```

---

## Current Status

**Protocol & engine** — Core protocol (I1–I6 invariants, E1–E41+ execution rules), Go orchestration engine, E16 validator, scaffold build verification (E22), per-agent context extraction (E23), engine extraction complete (`polywave-go` standalone module), cross-repo wave support, single-agent rerun (`RunSingleAgent`), unified tool system (`pkg/tools` Workshop), markdown system fully removed (YAML-only manifests), base commit tracking for post-merge verification, duplicate completion report detection, E24 retry loop (engine-side — `polywave-tools retry` command, `pkg/retry` package), closed-loop gate retry (R3).

**Web UI** — 3-column layout, Scout launcher, ReviewScreen (15+ panels), WaveBoard (failure-type action buttons, notes callout, scope-hint reruns, timeout badge + rerun), RevisePanel, GitActivity, CommandPalette, Settings, ThemePicker, SVG dep graph (animated during execution), wave gate, cancellation, desktop notifications, ManifestValidation panel, WorktreePanel (modal overlay with batch delete), QualityGatesPanel (required/optional display with command table), per-agent context toggle in ReviewScreen.

**Streaming** — PTY + `--output-format stream-json` pipeline, JSON fragment reassembly, SSE broker (2048-channel), auto_retry_started / auto_retry_exhausted events cached for late clients.

**API** — 30+ routes covering scout (+ rerun), wave, single-agent rerun, merge, test, diff, worktree (+ cleanup), chat, config, context, scaffold rerun, manifest validate/load/wave/completion, per-agent context extraction, step-level retry/skip/force-complete, recovery controls. All endpoints YAML-only.

See CHANGELOG.md for full version history.

---

## Phase 2: Deepen the Intelligence

### Verification Loop UI (Auto-Retry Visualization)

**Why:** The engine has E24 verification loop and `polywave-tools retry` command. The web UI has no visibility into retry chains — users see failures with no indication that a fix wave exists or is running.

**Scope:**
- IMPL list: show retry chain hierarchy (e.g., "Feature X → Fix Wave 1 → Fix Wave 2")
- ReviewScreen: "Retry Context" panel when viewing a fix-wave IMPL doc
  - Shows parent IMPL doc link, original quality gate failure output, safe point SHA
  - "View Original Feature" button jumps to parent IMPL
- WaveBoard: distinguish fix waves visually (orange badge: "Fix Wave 1/2")
- After 2 retries, show escalation state: "Manual intervention required"

**Success criteria:**
- User sees full retry history without reading raw IMPL docs
- Clear path from fix wave back to original feature

---

### Enhanced Agent Progress Indicators

**Why:** WaveBoard shows agent status (running/complete/failed) but execution is a black box — no indication of what the agent is currently doing within its run.

**Scope:**
- WaveBoard agent cards: show current file + action in real-time
  - Examples: "Writing: src/api/handlers.go", "Running: go build ./...", "Tool: Edit"
- Progress percentage: commits made / expected files (from file ownership table)
- Progress bar per agent (0–100% based on file count)
- Tooltip on hover: full command or tool call details

**Success criteria:**
- Wave execution is no longer a black box — see exactly what each agent is doing

---

### Persistent Memory Viewer

**Why:** `pkg/protocol/memory.go` has `ProjectMemory`, `LoadProjectMemory`, `SaveProjectMemory` — but the web UI has no way to view or edit project memory entries. Basic context view exists via ContextViewerPanel (raw text); remaining work adds structured browsing and memory provenance.

**Scope:**
- Settings screen: "Project Memory" tab
  - Table view: Type | Content | Tags | Source Wave | Actions
  - Filter by type (pattern/pitfall/preference), search by tags
  - Edit/delete entries inline
- Scout execution panel: show "Memories Applied" count with expandable list
  - "3 memories applied to this Scout run" → expands to show which memories + relevance scores
- ReviewScreen: "Learned from this wave" callout after completion
  - Shows what new memories were extracted from completion reports

**Success criteria:**
- User sees which past learnings influenced the current Scout run
- Memory system is transparent and editable beyond raw text

---

### Wave Timeout Diagnostics

**Why:** Timeout failure type exists with distinct badge and rerun button. No diagnostic detail is surfaced — user cannot tell what the agent was doing at the time of timeout or configure the limit without editing IMPL docs directly.

**Scope:**
- Completion report: "Agent timed out" section with:
  - Last known file being edited
  - Partial progress percentage
- Settings: configure default timeout per project (overridable per IMPL)

**Success criteria:**
- User can identify what agent was doing when timeout occurred
- Timeout duration is configurable without editing IMPL docs

---

### Pre-Wave Quality Gates Editing

**Why:** QualityGatesPanel shows gate configuration during review but is read-only. Users must open a text editor to adjust gates before approving a wave.

**Scope:**
- "Edit Gates" inline: toggle required/optional per gate, add/remove gates — writes back via `PUT /api/impl/{slug}/raw`
- Panel collapses to a summary line when gates are default/standard: "3 gates configured (2 required)"

**Success criteria:**
- Gate configuration adjustable in one click without opening a text editor

---

### Large IMPL Doc Scalability

**Why:** Per-agent context API exists (`GET /api/impl/{slug}/agent/{letter}/context`) and AgentContextToggle shows trimmed payloads in ReviewScreen. The wave launch path still passes the full IMPL doc to every agent regardless of size, and ReviewScreen parses the full doc on every panel switch.

**Scope:**
- Wave launch path: pass per-agent context payload instead of full IMPL doc when invoking wave agents via `/api/wave/{slug}/start`
- Lazy-load IMPL doc sections in ReviewScreen: fetch and parse only the active panel, not the full doc on every view switch

**Success criteria:**
- 14-agent IMPL doc launches with the same per-agent context size as a 5-agent one
- ReviewScreen initial load stays under 1 second regardless of IMPL doc length

---

## Phase 3: Native App

### Wails Desktop App

**Why:** The web server is the wrong distribution primitive for end users. The `/polywave` skill handles orchestration — the UI's job is monitoring, and monitoring deserves a real native app.

**Scope:**
- New `polywave-app` repo: Wails app importing `polywave-go`
- Replace `net/http` handlers with Wails bound methods
- Replace SSE `EventSource` with `runtime.EventsEmit` / `EventsOn`
- Replace `fetch` calls in `api.ts` with Wails JS bindings
- React frontend carries over as-is — WebKit/WebView2 renders it unchanged
- SVG dep graph, wave board, all components work without modification

**What you get:**
- `brew install --cask polywave` on Mac, MSI on Windows, AppImage on Linux
- No port, no server process — double-click and it works
- Real OS notifications, menu bar wave progress indicator
- Hot reload in dev mode via `wails dev`
- Cross-platform via goreleaser

---

### Multi-Provider Backends

Polywave agents are Claude-native today. This milestone decouples the engine from Anthropic's API so any model with tool-use support can run Scout, Wave, and Scaffold agents.

**Providers:**
- **OpenAI** — GPT-4o, o3, o4-mini via OpenAI API
- **LiteLLM** — proxy gateway covering 100+ models; single config for team deployments
- **Ollama** — local inference (Llama 3, Qwen, Mistral, etc.); fully air-gapped option
- **Kimi** (Moonshot AI) — strong code reasoning, long context; competitive on cost
- **Google Gemini** — Gemini 2.5 Pro via Vertex AI or AI Studio
- Any provider with OpenAI-compatible `/v1/chat/completions` endpoint

**Interface:**
- `--backend claude|openai|litellm|ollama|gemini|kimi` flag on all `polywave` commands
- Auto-detection from env vars: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `MOONSHOT_API_KEY`, `OLLAMA_HOST`
- Per-agent model override: Scout on Claude Opus, Wave agents on a cheaper model
- `polywave backends list` — show detected providers and their status

**Translation layer:**
- Normalize tool-use format across providers
- Streaming response normalization (SSE format differs per provider)
- Token counting abstraction
- Retry/backoff per provider's rate limit headers

---

### MCP Server

`mcp-server-polywave` package. Tools: `polywave_scout`, `polywave_wave`, `polywave_status`, `polywave_approve`. Expose Polywave engine to any MCP-capable host.

---

### GitHub Integration

GitHub App that posts IMPL doc reviews as PR comments. Approval workflow in GitHub. Wave results posted back to PR.

---

## Phase 4: Scale (v1.0.0+)

- **v1.0.0** — Production hardening: OpenTelemetry, structured logging, cost tracking, sandboxed execution
- **v1.1.0** — Team features: multi-user review, role-based access, audit log, IMPL templates
- **v1.2.0** — Enterprise: self-hosted, SAML/SSO, on-prem LLM support

---

## Stretch Goals

- **Visual IMPL Builder** — drag-and-drop wave/agent definition, visual dep graph editor
- **Agent Marketplace** — publish custom agent prompts, community IMPL templates

---

## Current Focus

**Now:** Phase 2 intelligence features
- Verification loop / retry chain UI (engine-side E24 exists; UI visualization absent)
- Enhanced agent progress indicators (current file + action, progress bars)
- Persistent memory viewer (structured table, memories applied count)
- Wave timeout diagnostics (last known file, settings config)
- Pre-wave quality gates editing (inline toggle required/optional)
- Large IMPL scalability (per-agent context in wave launch, lazy-load panels)

**Then:** Wails desktop app. Engine extraction complete — import `polywave-go`, replace HTTP/SSE with Wails bindings, React frontend unchanged. Ships as native cross-platform app.

**Goal:** By Wails release, Polywave is installable in one command on Mac/Windows/Linux with full OS integration.

---

Last reviewed: 2026-03-24
