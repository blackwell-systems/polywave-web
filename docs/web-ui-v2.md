# Web UI - Phase 2

Features deferred from v1. Build after the review screen and wave execution board are shipped and used.

## Agent Log Streaming

v1 shows agent status (pending / running / complete / failed). v2 streams agent output in real time.

**New SSE event:**

```
event: agent_log
data: {"agent": "agent-a", "wave": 1, "line": "Reading pkg/cache/client.go...", "timestamp": "2026-03-07T14:32:01Z"}
```

**UI:** Expandable panel on each agent card. Click to see live log output. Scrolls automatically. Collapsible so it doesn't overwhelm the wave execution board.

**Engine change:** The agent runner already captures stdout/stderr. Pipe it through the SSE stream with a per-agent event filter so the client can subscribe to one agent's logs without receiving all of them.

---

## Quality Gates Results View

v1 has no automated verification. When quality gates ship in the protocol (see ROADMAP.md), the web UI needs to surface their results.

**New SSE events:**

```
event: gate_started
data: {"agent": "agent-a", "wave": 1, "gate": "test", "command": "go test ./pkg/cache/..."}

event: gate_result
data: {"agent": "agent-a", "wave": 1, "gate": "test", "passed": true, "duration_seconds": 4.2, "summary": "ok"}

event: gate_result
data: {"agent": "agent-a", "wave": 1, "gate": "lint", "passed": false, "duration_seconds": 1.1, "summary": "2 issues found", "required": false}
```

**UI:** Gate results shown on each agent card after completion. Green/red/yellow badges for passed/failed-required/failed-optional. Expandable to see command output. Failed required gates show the failure_type badge and retry/escalate action.

**Stub report:** Shown as a dedicated gate result. Lists files and line numbers with stub patterns detected. Links to the file in the diff viewer if available.

---

## Project Memory View

Renders `docs/SAW.md` (see ROADMAP.md) as a browsable project knowledge base.

**New endpoint:**

```
GET /api/project/memory    Returns parsed docs/SAW.md as JSON
```

**UI sections:**

- Architecture overview - modules, paths, responsibilities
- Decisions timeline - chronological list of architectural decisions with rationale and which feature introduced them
- Conventions - naming, error handling, testing patterns
- Established interfaces - searchable/filterable table of interfaces created by prior SAW runs
- Features completed - timeline of completed features with wave/agent counts

**Interaction:** Read-only in v1 of this screen. The orchestrator updates `docs/SAW.md` after each completed feature automatically.

---

## Diff Viewer

Show what each agent actually changed before the merge.

**New endpoint:**

```
GET /api/wave/{slug}/diff/{agent}    Returns git diff for agent's worktree branch
```

**UI:** Side-by-side diff viewer accessible from the wave execution board after an agent completes. Allows the human to inspect changes before approving the merge. Not a code editor - view only.

---

## Not In Scope (v2)

- IMPL doc editing in browser (use your editor)
- Multi-project dashboard
- Team/collaboration features
- Authentication
- Remote hosting
