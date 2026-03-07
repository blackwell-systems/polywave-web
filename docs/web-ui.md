# Web UI Design

`saw serve` starts a local HTTP server (default `localhost:7432`). No hosted infrastructure, no auth, no data leaves the machine. The frontend is a React app embedded in the Go binary via `go:embed`.

## Architecture

```
cmd/saw/main.go          saw serve → starts HTTP server
pkg/api/server.go        HTTP + SSE handlers
pkg/api/impl.go          IMPL doc JSON endpoint
pkg/api/wave.go          Wave control + SSE stream
web/                     React frontend (built to static files)
```

The API layer is thin. It exposes what the orchestrator already tracks. No separate database - the IMPL doc and git state are the source of truth.

## API

### Endpoints

```
GET  /api/impl/{slug}            Parsed IMPL doc as structured JSON
POST /api/impl/{slug}/approve    Triggers saw wave
POST /api/impl/{slug}/reject     Kills the plan
GET  /api/wave/{slug}/events     SSE stream of agent status updates
```

### IMPL Doc Response

`GET /api/impl/{slug}` returns:

```json
{
  "slug": "caching-layer",
  "suitability": {
    "verdict": "SUITABLE",
    "rationale": "Work decomposes into 3 independent files with clear interfaces"
  },
  "file_ownership": [
    {
      "file": "pkg/cache/client.go",
      "agent": "agent-a",
      "wave": 1,
      "action": "create"
    },
    {
      "file": "pkg/cache/redis.go",
      "agent": "agent-b",
      "wave": 1,
      "action": "create"
    }
  ],
  "waves": [
    {
      "number": 1,
      "agents": ["agent-a", "agent-b"],
      "dependencies": []
    },
    {
      "number": 2,
      "agents": ["agent-c"],
      "dependencies": [1]
    }
  ],
  "scaffold": {
    "required": true,
    "files": ["pkg/cache/types.go"],
    "contracts": [
      {
        "name": "CacheClient",
        "signature": "type CacheClient interface { Get(key string) ([]byte, error); Set(key string, val []byte, ttl time.Duration) error }",
        "file": "pkg/cache/types.go"
      }
    ]
  },
  "pre_mortem": {
    "overall_risk": "low",
    "failure_modes": []
  }
}
```

### SSE Events

`GET /api/wave/{slug}/events` streams:

```
event: scaffold_started
data: {"files": ["pkg/cache/types.go"]}

event: scaffold_complete
data: {"status": "complete"}

event: agent_started
data: {"agent": "agent-a", "wave": 1, "files": ["pkg/cache/client.go"]}

event: agent_complete
data: {"agent": "agent-a", "wave": 1, "status": "complete", "branch": "wave1-agent-a"}

event: agent_failed
data: {"agent": "agent-b", "wave": 1, "status": "failed", "failure_type": "fixable", "message": "missing import"}

event: gate_result
data: {"gate": "test", "passed": true, "duration_seconds": 4.2}

event: wave_complete
data: {"wave": 1, "merge_status": "clean"}

event: run_complete
data: {"status": "complete", "waves": 2, "agents": 5}
```

Events map directly to orchestrator state machine transitions.

## Screens

### Review Screen

Shown after `saw scout`, before `saw wave`. The human decides whether to approve the plan.

**Layout (top to bottom):**

1. Suitability verdict - SUITABLE / NOT SUITABLE / SUITABLE WITH CAVEATS, color-coded. If NOT SUITABLE, the rest of the screen is grayed out.
2. File ownership table - every file, which agent owns it, which wave. Color-coded by agent. Files in the same package grouped visually.
3. Wave structure - visual diagram. Wave 1 agents in parallel, Wave 2 agents in parallel, dependency arrows between waves. Scaffold Agent shown before Wave 1 if present.
4. Interface contracts - code blocks showing exact signatures the Scaffold Agent will create.
5. Pre-mortem - failure modes with likelihood/impact (when available).
6. Action buttons - Approve / Request Changes / Reject.

**Interaction:** Human reads top to bottom and clicks one of three buttons. Approve triggers `POST /api/impl/{slug}/approve`. Should take 30-60 seconds to review a well-structured plan.

**What is NOT on this screen:** agent prompts, git branch names, worktree paths, raw IMPL doc markdown.

### Wave Execution Board

Shown during `saw wave`. Live updates via SSE.

**Layout:**

- Agent cards arranged by wave. Each card shows: agent name, assigned files, status (pending / running / complete / failed).
- Status updates stream in as SSE events. Cards transition visually on state change.
- Failed agents show failure_type badge with appropriate action (retry / escalate).
- Wave progress bar per wave. Overall progress bar across all waves.
- Merge status shown after each wave completes.

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Backend | Go `net/http` | Already the engine language, stdlib handles HTTP + SSE natively |
| Frontend | React + TypeScript | Standard, large ecosystem for the table/diagram components needed |
| Bundler | Vite | Fast builds, clean output for `go:embed` |
| Styling | Tailwind CSS | Utility-first, no component library needed |
| SSE client | Native `EventSource` | Built into browsers, auto-reconnect, no library needed |
| Embedding | `go:embed` | Frontend builds to `web/dist/`, embedded in Go binary at compile time |

## Build

```bash
cd web && npm run build    # builds to web/dist/
cd .. && go build ./cmd/saw  # embeds web/dist/ via go:embed
```

Single binary. `go install` still works. `saw serve` starts the server and opens the browser.

## Not In Scope (v1)

- Authentication / multi-user
- Remote hosting
- Persistent history / analytics
- Agent log streaming (just status events)
- Editing the IMPL doc in the browser (use your editor)
