# Changelog

All notable changes to this project will be documented in this file.

## [0.16.0] - Unreleased

### Added

**Request Changes — inline IMPL editor with Claude revision**
- **RevisePanel** — "Request Changes" button opens a full revision panel replacing the review screen; "← Back" returns to review without changes
- **Ask Claude mode** — natural-language feedback field sends instructions to a Claude agent that reads and rewrites the IMPL doc in place; streams live output via SSE (`revise_output`, `revise_complete`, `revise_failed` events)
- **Manual edit mode** — raw markdown textarea with Save button for direct edits; atomic write via temp file + rename
- **Lock during revision** — manual edit textarea and Save button disabled while Claude is revising to prevent conflicts
- **Auto-reload** — ReviewScreen reloads the IMPL doc after Save or Claude revision completes

**Real-time Claude output streaming**
- **PTY + stream-json** — CLI backend now uses `--output-format stream-json` inside a PTY; Node.js line-buffers when connected to a terminal, enabling per-event streaming instead of batched end-of-run output
- **JSON fragment reassembly** — PTY set to 65535 columns; scanner accumulates wrapped JSON fragments until a complete object is parsed before processing
- **Rich event formatting** — `formatStreamEvent` converts stream-json events to human-readable lines: tool calls shown as `→ ToolName(arg)`, tool results indented and truncated at 400 chars, final event shown as `✓ complete`
- **1 MB scanner buffer** — handles large tool-result JSON lines without truncation

**Scout UX improvements**
- **Minimum description length** — Scout launcher requires at least 15 characters before enabling the Run button; error shown if keyboard shortcut bypasses the disabled state; prevents trivial/test inputs from launching full codebase scans
- **Completion banner** — scout_complete no longer auto-navigates; instead shows a "Plan ready → Review" green banner; user explicitly clicks to proceed after seeing output
- **Rotating status messages** — placeholder cycles through descriptive messages (Reading codebase, Mapping file ownership, etc.) while waiting for first output chunk

**Bug fixes**
- **NOT SUITABLE verdict parsing** — parser now handles `**Verdict: NOT SUITABLE**` (bold markdown) in addition to bare `Verdict:` lines; uses `strings.Contains` + `**` stripping
- **"Plan rejected" sticky banner** — `rejected` state now resets when selecting a different plan; was persisting across all plans in the sidebar
- **Scrollbar theme-aware** — scrollbar colors changed from hardcoded `rgb(134, 239, 172)` green to `hsl(var(--primary))`; scrollbar now follows the active theme (Gruvbox, Darcula, Catppuccin, Nord, default)
- **`useCallback` unused import** — removed unused `useCallback` import from ScoutLauncher.tsx that caused TypeScript build error

**New API endpoints**
- `POST /api/impl/{slug}/revise` — launches Claude revision agent, returns `run_id`
- `GET /api/impl/{slug}/revise/{runID}/events` — SSE stream for revision progress

---

## [0.15.0] - Unreleased

### Added

**GUI-driven protocol loop**
- **Scout launcher** — "New plan" button opens a full-screen launcher; type a feature description, click Run Scout, watch live output stream in; auto-navigates to review screen on completion
- **Back button** — Scout launcher has a "← Back" button to return to the review screen without completing a run
- **Wave gate** — `runWaveLoop` pauses between waves and publishes `wave_gate_pending` SSE event; WaveBoard shows a blue gate banner with "Proceed to Wave N+1" button
- **IMPL editor in gate banner** — when wave gate is pending, an inline IMPL doc editor appears in the banner; users can edit interface contracts before proceeding to the next wave
- **Re-run button** — failed agent cards show a "↺ Re-run" button that POSTs to the rerun endpoint and optimistically resets the agent to pending state
- **AgentCard output toggle** — "▼ Show more / ▲ Show less" toggle on agent output pane (shown when output > 200 chars); auto-scroll disabled when expanded

**New API endpoints**
- `POST /api/scout/run` — launches a Scout agent, returns `run_id`
- `GET /api/scout/{runID}/events` — SSE stream of scout output (`scout_output`, `scout_complete`, `scout_failed` events)
- `POST /api/wave/{slug}/gate/proceed` — unblocks the wave gate for a slug
- `POST /api/wave/{slug}/agent/{letter}/rerun` — stub endpoint for agent rerun (full implementation deferred)
- `GET /api/impl/{slug}/raw` — returns raw IMPL doc markdown as `text/plain`
- `PUT /api/impl/{slug}/raw` — atomically writes raw markdown to the IMPL doc on disk

**Bug fixes**
- **Completion report path fix** — orchestrator now polls the worktree copy of the IMPL doc (not the main repo copy) when waiting for agent completion reports; resolves the circular dependency that caused all wave runs to time out
- **`--cwd` flag removed** — CLI backend uses `cmd.Dir` instead of `--cwd` flag (removed in claude v2.x)
- **Nested Claude session** — stripped `CLAUDECODE` env var from agent subprocess so SAW works without an API key inside an existing Claude Code session

---

## [0.14.0] - Unreleased

### Added

**UI refinements**
- **Agent color coding** — consistent color scheme across all UI components: A=blue, B=green, C=orange, D=purple, E=pink, F=cyan, G=amber, H=violet, I=emerald, J=red, K=indigo; applied to agent cards (left border + header), dependency graph nodes, wave timeline badges
- **Sidebar dark mode background** — sidebar nav uses `#191919` background in dark mode for improved contrast
- **Double-click sidebar expand** — double-clicking the collapsed sidebar expands it
- **Sidebar width constraints** — sidebar capped at 10% screen width (down from 40%), minimum 140px; gives main content area up to 90% of screen width
- **Wider content layout** — ReviewScreen max width increased to 1600px (from 1152px) to prevent tab button wrapping
- **Conditional Pre-Mortem panel** — Pre-Mortem only auto-enabled if content exists
- **Default panel order** — panels open in order: Pre-Mortem (if exists), Wave Structure, Dependency Graph, File Ownership
- **Manual slug entry removed** — sidebar no longer includes manual slug input form
- **Wider scrollbar** — scrollbar width increased to 18px (from 14px) for better visibility

**E16 validator sub-rules (E16A/E16C)**
- **E16A: required block presence** — `ValidateIMPLDoc` now enforces that `impl-file-ownership`, `impl-dep-graph`, and `impl-wave-structure` blocks all appear when any typed block is present; fires only when `blockCount > 0` so pre-v0.10.0 docs are unaffected
- **E16C: out-of-band dep graph detection** — plain fenced blocks whose content matches `[A-Z]` agent refs and the word `Wave` produce a `warning`-type `ValidationError` (not an exit-1 error); prompts author to move the content into a typed `impl-dep-graph` block

**v0.10.0 protocol support**
- **Typed-block dispatch** — parser detects `` ```yaml type=impl-* `` fenced blocks as canonical section anchors; heading-based detection retained as fallback for pre-v0.10.0 docs
- **PreMortem parsing** — `ParseIMPLDoc` extracts `## Pre-Mortem` risk table into `IMPLDoc.PreMortem` (`*types.PreMortem`)
- **ScoutValidating state** — new `State` constant inserted between `ScoutPending` and `NotSuitable`; represents IMPL doc written, E16 validation in progress
- **E16 Go validator** — `protocol.ValidateIMPLDoc(path)` validates all typed blocks in an IMPL doc; returns `[]types.ValidationError` with block type, line number, and message; equivalent to `validate-impl.sh` reference implementation
- **New types** — `PreMortemRow`, `PreMortem`, `ValidationError` in `pkg/types/types.go`; `IMPLDoc.PreMortem *PreMortem` field

---

## [0.13.0] - 2026-03-07

### Added

**Multi-select toggle panel interface**
- **Toggle panels** — ReviewScreen refactored to use toggleable panel buttons; multiple panels can be active simultaneously and stack vertically
- **Overview always visible** — Overview panel displayed at top by default, no toggle button needed
- **Default panels** — Wave Structure and Dependency Graph pre-selected for immediate visibility

**Enhanced visualizations**
- **Timeline wave structure** — vertical timeline rail with typed nodes (filled dots for waves, hollow for orchestrator steps, ring for complete); merge lanes between waves showing branch count and gating
- **Subtle agent badges** — 10% opacity backgrounds with colored borders instead of solid fills (supports A-K agents), 48px to match DAG node size
- **SVG dependency DAG** — interactive directed acyclic graph with bezier curve edges, arrow markers, colored wave column backgrounds, and high-contrast inverted tooltips on hover
- **Custom scrollbar** — subtle green scrollbar (green-300 light, green-400 dark) for better immersion
- **Click-ordered panels** — toggled panels render in click order, not fixed order
- **Sticky toggle bar** — panel buttons pin to top on scroll with full-width backdrop blur and subtle tint; activates only when scrolled (IntersectionObserver)
- **Timeline status** — wave/merge/complete dots reflect IMPL doc_status: hollow when active, filled when complete
- **Astral jewel dots** — SVG timeline nodes with radial gradients, inner highlights, and outer glow filters replace flat CSS circles; jewels dim when pending, illuminate when complete

**Markdown rendering**
- **Full markdown in all panels** — shared `MarkdownContent` component renders proper markdown (headings, lists, bold, inline code) across Agent Prompts, Interface Contracts, Post-Merge Checklist, and Known Issues
- **Syntax-highlighted code blocks** — fenced code blocks render with language-specific highlighting (Go, TypeScript, Rust, etc.) via react-syntax-highlighter
- **Dark/light theme support** — VS Code Dark+/Light themes switch automatically
- **Realistic demo prompts** — Agent Prompts in demo IMPL fleshed out with full multi-paragraph instructions (role, files, requirements, verification)

**Parser extensions**
- **5 new IMPL sections** — ParseIMPLDoc extracts: Known Issues, Scaffolds detail, Interface Contracts, Dependency Graph, Post-Merge Checklist
- **New types** — KnownIssue and ScaffoldFile types in pkg/types/types.go
- **Test coverage** — 6 new parser tests (24/24 passing)

**API layer extensions**
- **6 new response fields** — known_issues, scaffolds_detail, interface_contracts_text, dependency_graph_text, post_merge_checklist_text, agent_prompts
- **3 new API types** — KnownIssueEntry, ScaffoldFileEntry, AgentPromptEntry with mapper functions

**TypeScript types**
- **Extended IMPLDocResponse** — 3 new interfaces in web/src/types.ts

**Demo content**
- **demo-complex IMPL** — complex 3-wave structure with 11 agents (A-K), scaffold step, rich dependencies for UI showcase

**Strategic planning**
- **ROADMAP.md** — documents SAW as provider-agnostic infrastructure; Phase 1 includes multi-provider backend, live agent observability, UI polish, demo/docs
- **Live Agent Observability (v0.14.0)** — roadmap entry for SSE-based real-time agent output, completion report streaming, git activity feed, and wave progress indicators

### Fixed

- **Dependency graph not parsing** — `parseKnownIssuesSection` skipped `---` separators instead of breaking, consuming the next section header from the scanner; downstream sections (Dependency Graph, Interface Contracts) were never reached
- **Dependency graph duplicate waves** — frontend parser matched summary lines like "Wave 2 dependencies:" as wave headers; now extracts only code-fenced content and uses stricter regex
- **Duplicate File Ownership header** — removed CardHeader from FileOwnershipPanel to avoid duplicate title

---

- **E15: IMPL doc completion lifecycle** — parser recognizes `<!-- SAW:COMPLETE YYYY-MM-DD -->` tag and populates `DocStatus`/`CompletedAt` on `IMPLDoc`
- **API: `doc_status` field** — `GET /api/impl/{slug}` returns `doc_status: "ACTIVE" | "COMPLETE"` and `completed_at`
- **API: rich list endpoint** — `GET /api/impl` returns `[{slug, doc_status}]` instead of bare strings; enables picker filtering without full parse
- **Web UI: active/complete picker grouping** — active IMPL docs appear first; completed docs grouped under a muted "Completed" divider

### Fixed

- **Wave structure diagram showing only 1 wave** — parser now regroups agents using file ownership table wave numbers when IMPL doc lacks `## Wave N` headers
- **Scaffold node missing from wave diagram** — API now detects scaffold files from file ownership table and sets `scaffold.required: true`
- **Scaffold rows sorted last in file ownership table** — Scaffold Agent now sorted first (before Wave 1), then by wave number, then by agent letter
- **Light mode file ownership table contrast** — row background colors darkened from `-50` to `-100` for better visibility
- **Cold-start audit findings (P0-P3)** — port mismatch in README (`:8080` → `localhost:7432`), prerequisites section, IMPL doc/jargon definitions, quickstart workflow, `--help` exit code, missing-flag usage hints, build-from-source docs, sample IMPL doc, protocol repo relationship, changelog version gap note

---

## [0.11.0] - 2026-03-07

### Added

**Backend interface abstraction (`pkg/agent/backend`)**
- `backend.Backend` interface in `pkg/agent/backend/backend.go` — single abstraction for all LLM execution paths
- `backend.Config` — backend-agnostic configuration (model, max tokens, max turns)
- API backend (`pkg/agent/backend/api/`) — extracts existing Anthropic SDK client into a `Backend` implementation; behavior identical to prior releases
- CLI backend (`pkg/agent/backend/cli/`) — shells out to `claude --print`; enables Claude Max plan users to run SAW without an API key
- Runner refactored to accept `backend.Backend`; `Sender`/`ToolRunner` split removed from the public surface

**`--backend` flag and `SAW_BACKEND` env var**
- `saw scout` and `saw scaffold` accept `--backend <api|cli|auto>`
- `SAW_BACKEND` env var provides a persistent default; flag takes precedence
- `auto` mode: selects API backend when `ANTHROPIC_API_KEY` is set, CLI backend otherwise

**Parser improvements**
- File ownership table 4th-column detection — parser reads the header row to determine whether the column is `Action` or `Depends On` and populates the correct field on `FileOwnershipInfo`
- Flexible agent header parsing: accepts both `###` and `####` heading levels, and both `:` and `—` as name separators
- Auto-wave creation from agent headers when an explicit wave section is absent
- `FileOwnershipInfo` enriched with `Agent`, `Wave`, `Action`, and `DependsOn` fields

## [0.10.0] - 2026-03-07

### Added

**SSE bridge**
- `OrchestratorEvent`, `EventPublisher`, and `SetEventPublisher` in `pkg/orchestrator/events.go` — event types emitted during wave execution with strongly-typed payloads (`AgentStartedPayload`, `AgentCompletePayload`, `AgentFailedPayload`, `WaveCompletePayload`, `RunCompletePayload`)
- API layer maps orchestrator events to SSE without the orchestrator importing `pkg/api`

**Wave start endpoint**
- `POST /api/wave/{slug}/start` — triggers wave execution for a reviewed IMPL doc
- Active-run guard via `sync.Map` prevents duplicate concurrent runs for the same slug

**Web UI — dark mode**
- `useDarkMode` hook — reads and persists preference to `localStorage`, applies `dark` class on `<html>`
- `DarkModeToggle` component — sun/moon button wired to the hook; all web components updated for dark-mode compatibility via Tailwind `dark:` variants

**Web UI — IMPL picker**
- Home screen lists available IMPL docs; users select from the picker instead of typing a slug manually

**Web UI — wave start wiring**
- `startWave` call added to `App.tsx` after the user approves an IMPL doc; the UI transitions to the `WaveBoard` live dashboard automatically

> **Note:** Versions 0.3.0–0.9.x were internal development iterations and not publicly released.

## [0.2.0] - 2026-03-07

### Added

**Web UI backend (`saw serve`)**
- `saw serve` — start a local HTTP server for reviewing IMPL docs and monitoring wave execution
- `pkg/api/server.go` — HTTP server with graceful shutdown, stdlib `net/http` only
- `pkg/api/impl.go` — `GET /api/impl/{slug}` returns parsed IMPL doc as structured JSON; `POST /api/impl/{slug}/approve` and `/reject` publish SSE events
- `pkg/api/wave.go` — SSE broker with per-slug pub/sub; `GET /api/wave/{slug}/events` streams agent status updates
- `pkg/api/types.go` — shared response types (`IMPLDocResponse`, `SSEEvent`, etc.)
- CLI flags: `--addr`, `--impl-dir`, `--repo`, `--no-browser`
- Auto-opens browser on macOS/Linux

**Web UI frontend (React + TypeScript + Tailwind)**
- `web/` — Vite-based React project with TypeScript and Tailwind CSS
- `ReviewScreen` — IMPL doc review with suitability badge, file ownership table, wave structure diagram, interface contracts display, and approve/reject action buttons
- `WaveBoard` — live wave execution dashboard with per-wave progress bars, agent cards showing status/files/errors, and scaffold status row
- `useWaveEvents` — SSE hook that subscribes to `/api/wave/{slug}/events` and maintains live agent/wave state
- `AgentCard` — color-coded status badges (pending/running/complete/failed) with file list and failure details
- `ProgressBar` — animated progress bar with label and percentage
- `web/embed.go` + `pkg/api/embed.go` — `go:embed` integration bakes `web/dist/` into the Go binary; single `saw` binary serves the React app
- `Makefile` — `make build` runs `npm run build` then `go build`; `make clean` removes artifacts

## [0.1.1] - 2026-03-06

### Added
- Binary releases for Linux, macOS, and Windows (amd64 + arm64) via GoReleaser
- GitHub Actions release workflow triggered on `v*` tags
- GitHub repository topics for discoverability
- Test coverage improved from 66.8% to 73.6%
- `go tool cover` coverage reporting in CI
- Godoc comments on all exported symbols for pkg.go.dev

### Changed
- GoReleaser config: version injected via ldflags (`-X main.version={{.Version}}`); archive includes version in filename; Windows uses `.zip`
- `saw --version` now reports the build-time version (not hardcoded `v0.1.0`)

## [0.1.0] - 2026-03-06

Initial release of the Go implementation of the Scout-and-Wave protocol.

### Added

**CLI (`saw`)**
- `saw wave` — execute all waves in an IMPL doc; `--wave N` to start from a specific wave; `--auto` to run all waves without prompts
- `saw merge` — standalone merge recovery subcommand (`--impl`, `--wave`)
- `saw scout` — launch a Scout agent to analyze the codebase and produce an IMPL doc
- `saw scaffold` — launch a Scaffold Agent to create shared type scaffold files
- `saw status` — print wave/agent completion status; `--json` for machine-readable output; `--missing` to list agents without completion reports
- `saw --version` / `saw --help`

**Orchestrator (`pkg/orchestrator`)**
- 10-state machine: `ScoutPending → Reviewed → ScaffoldPending → WavePending → WaveExecuting → WaveMerging → WaveVerified → Complete` (+ `NotSuitable`, `Blocked`)
- Concurrent agent launch via `errgroup` — all agents in a wave run in parallel
- `UpdateIMPLStatus` — ticks IMPL doc status checkboxes after wave completion
- Merge and post-merge verification via injected function seams (testable without git)

**Protocol (`pkg/protocol`)**
- IMPL doc parser: extracts feature name, waves, agents, test command, and metadata
- Completion report parser: reads YAML blocks from agent-named sections
- `UpdateIMPLStatus` / `UpdateIMPLStatusBytes`: ticks `[ ]` → `[x]` checkboxes for completed agents

**Agent (`pkg/agent`)**
- Anthropic API client with streaming support (`claude-opus-4-5`)
- `Runner.ExecuteWithTools` — agentic tool-use loop (up to N iterations)
- `StandardTools` — file read/write/list/search/shell tools scoped to a worktree path
- `WaitForCompletion` — polls IMPL doc for agent completion report with timeout

**Worktree (`pkg/worktree`)**
- `Manager.Create` — creates a `saw/wave{N}-agent-{X}` branch and worktree from HEAD
- `Manager.Remove` — removes worktree and deletes the branch

**Git (`internal/git`)**
- Wrappers for: `worktree add/remove`, `merge --no-ff`, `diff --name-only`, `rev-parse`, `merge --abort`
- Conflict detection from merge output

### Protocol compliance

Implements [SAW Protocol v0.8.0](https://github.com/blackwell-systems/scout-and-wave/tree/main/protocol) invariants I1–I6.
