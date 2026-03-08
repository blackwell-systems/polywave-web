# IMPL: Git Activity Sidebar (v0.15.4 Phase A)

## Suitability Assessment

Verdict: SUITABLE
test_command: `go test ./... && cd web && npx vitest run`
lint_command: `go vet ./...`

The feature splits cleanly along the Go/TypeScript boundary: Agent A owns all
new Go files (`pkg/git/activity.go`, route registration in `pkg/api/git_activity.go`,
and a new route wired into `pkg/api/server.go`) while Agent B owns the React
frontend components and a shared types file. The interface contract between
them is a well-defined SSE event shape (`git_activity` event carrying a
`GitActivitySnapshot` JSON payload) which can be fully specified before either
agent begins. No shared Go or TypeScript types cross the agent boundary at
runtime — the boundary is the HTTP wire protocol. Build/test cycles take
roughly 30–60 seconds (Go build + frontend tsc + vitest), and each agent
touches 4–6 files with non-trivial logic (polling loop, SVG animation, SSE
hook). Parallelization value is high.

Pre-implementation scan results:
- Total items: 2 work tracks (Go backend, React frontend)
- Already implemented: 0 items
- Partially implemented: 0 items
- To-do: 2 items (both proceed as planned)

Estimated times:
- Scout phase: ~10 min (dependency mapping, interface contracts, IMPL doc)
- Agent execution: ~30 min (2 agents × ~15 min avg, run in parallel)
- Merge & verification: ~5 min
Total SAW time: ~45 min

Sequential baseline: ~50 min (2 agents × ~25 min sequential including waits)
Time savings: ~5 min (10% faster) plus the coordination artifact value as a
spec for the SSE wire contract.

Recommendation: Clear speedup on implementation time; the IMPL doc also serves
as the authoritative wire-protocol spec between Go and TypeScript teams.

---

## Scaffolds

One TypeScript types file is needed before Wave 1 so both agents agree on the
shared event shape that crosses the SSE wire boundary. The Scaffold Agent must
create this file before Wave 1 launches.

| File | Contents | Import path | Status |
|------|----------|-------------|--------|
| `web/src/types/gitActivity.ts` | `GitCommit`, `GitBranch`, `GitActivitySnapshot` interfaces; `GitActivityEvent` type | `../types/gitActivity` | pending |

Exact contents the Scaffold Agent must write to
`web/src/types/gitActivity.ts`:

```typescript
// Git activity types — shared between useGitActivity hook and GitActivitySidebar.
// These mirror the Go types in pkg/git/activity.go exactly.

export interface GitCommit {
  sha: string          // short 7-char SHA
  message: string      // first line of commit message
  author: string       // author name
  timestamp: string    // ISO 8601 timestamp
  files_changed: number
}

export interface GitBranch {
  name: string         // e.g. "wave1-agent-a"
  agent: string        // uppercase letter, e.g. "A"
  wave: number
  commits: GitCommit[]
  merged: boolean      // true when branch has been merged to main
  merge_commit?: string // SHA of the merge commit on main, present when merged === true
  status: 'pending' | 'running' | 'complete' | 'failed'
}

export interface GitActivitySnapshot {
  slug: string
  main_commits: GitCommit[]   // commits on main since wave started
  branches: GitBranch[]       // one entry per active agent branch
  polled_at: string           // ISO 8601 server timestamp
}

// The SSE event payload type sent by the backend on the git_activity event name.
export type GitActivityEvent = GitActivitySnapshot
```

---

## Pre-Mortem

**Overall risk:** medium

**Failure modes:**

| Scenario | Likelihood | Impact | Mitigation |
|----------|-----------|--------|------------|
| `git log` unavailable when no worktrees exist (wave not yet running) | high | low | `pkg/git/activity.go` returns empty snapshot gracefully; sidebar shows "no activity" state |
| SVG layout breaks at narrow viewport widths or with many agents (>4) | medium | medium | Sidebar uses `overflow-x: auto` scroll; BranchLane min-width capped at available space |
| Polling loop leaks goroutines if the HTTP client disconnects mid-stream | medium | high | Agent A must use `r.Context().Done()` to stop the ticker goroutine; covered in agent test |
| Agent B imports `GitActivitySnapshot` before Scaffold Agent creates the file | low | high | Scaffold must be verified complete before Wave 1 launches (checklist gate) |
| The `agent_complete` SSE event carries a `branch` field that already exists in `AgentStatus`; git activity branch names must match exactly | medium | medium | Agent A derives branch name with `fmt.Sprintf("wave%d-agent-%s", wave, strings.ToLower(agent))` matching worktree.Manager convention |
| vitest run fails due to missing jsdom environment in new test files | low | medium | Agent B must add `// @vitest-environment jsdom` header to test files that render SVG |

---

## Known Issues

None identified. The existing test suite passes cleanly. No known pre-existing
failures relevant to this feature.

---

## Dependency Graph

```yaml type=impl-dep-graph
Wave 0 (Scaffold Agent):
    [Scaffold] web/src/types/gitActivity.ts
         Create shared TypeScript types for git activity wire protocol.
         ✓ root (no dependencies on other agents)

Wave 1 (2 parallel agents):
    [A] pkg/git/activity.go
        pkg/api/git_activity.go
        pkg/api/server.go  (route registration only — append-only)
         Poll git log for active worktree branches, package as GitActivitySnapshot,
         stream via new SSE endpoint GET /api/git/{slug}/activity.
         ✓ root (no dependencies on other wave-1 agents)

    [B] web/src/types/gitActivity.ts  (READ-ONLY — created by Scaffold)
        web/src/hooks/useGitActivity.ts
        web/src/components/git/GitActivitySidebar.tsx
        web/src/components/git/BranchLane.tsx
        web/src/components/git/CommitDot.tsx
        web/src/components/WaveBoard.tsx  (layout change — two-column)
         Subscribe to git activity SSE endpoint, render animated branch lane SVG.
         depends on: [Scaffold] (reads web/src/types/gitActivity.ts)
```

File conflict note: `pkg/api/server.go` is modified by Agent A (one new
`HandleFunc` line). No other agent touches it. Agent B does not touch any Go
file. `web/src/components/WaveBoard.tsx` is owned by Agent B only.

---

## Interface Contracts

### Go: `pkg/git/activity.go`

```go
package git

import "time"

// Commit represents a single git commit on an agent branch or main.
type Commit struct {
    SHA          string    `json:"sha"`            // 7-char short SHA
    Message      string    `json:"message"`         // first line only
    Author       string    `json:"author"`
    Timestamp    time.Time `json:"timestamp"`
    FilesChanged int       `json:"files_changed"`
}

// Branch represents one agent worktree branch and its commits since fork.
type Branch struct {
    Name        string   `json:"name"`         // e.g. "wave1-agent-a"
    Agent       string   `json:"agent"`        // uppercase letter e.g. "A"
    Wave        int      `json:"wave"`
    Commits     []Commit `json:"commits"`
    Merged      bool     `json:"merged"`
    MergeCommit string   `json:"merge_commit,omitempty"`
    Status      string   `json:"status"` // "pending"|"running"|"complete"|"failed"
}

// ActivitySnapshot is the complete state of all agent branches at a point in time.
type ActivitySnapshot struct {
    Slug        string    `json:"slug"`
    MainCommits []Commit  `json:"main_commits"`
    Branches    []Branch  `json:"branches"`
    PolledAt    time.Time `json:"polled_at"`
}

// Poller polls git log for worktree branches associated with a SAW run.
type Poller struct { /* unexported fields */ }

// NewPoller creates a Poller for the repository at repoPath, scoped to slug.
func NewPoller(repoPath, slug string) *Poller

// Snapshot returns the current ActivitySnapshot by reading git log for each
// active worktree branch. Returns an empty snapshot (not an error) when no
// worktrees exist.
func (p *Poller) Snapshot() (ActivitySnapshot, error)
```

### Go: `pkg/api/git_activity.go`

```go
// handleGitActivity serves GET /api/git/{slug}/activity.
// Upgrades to SSE, then polls git.Poller.Snapshot() every 5 seconds and
// emits a "git_activity" event with the JSON-encoded ActivitySnapshot as data.
// Stops when the client disconnects (r.Context().Done()).
func (s *Server) handleGitActivity(w http.ResponseWriter, r *http.Request)
```

Route registered in `pkg/api/server.go` (Agent A appends one line to the
existing route registration block in `New()`):

```go
s.mux.HandleFunc("GET /api/git/{slug}/activity", s.handleGitActivity)
```

### TypeScript: `web/src/hooks/useGitActivity.ts`

```typescript
import { GitActivitySnapshot } from '../types/gitActivity'

// useGitActivity subscribes to GET /api/git/{slug}/activity via EventSource.
// Returns the latest snapshot or null before the first event arrives.
// Gracefully returns null (not an error) when no worktrees exist.
export function useGitActivity(slug: string): GitActivitySnapshot | null
```

### TypeScript: `web/src/components/git/GitActivitySidebar.tsx`

```typescript
import { GitActivitySnapshot } from '../../types/gitActivity'

interface GitActivitySidebarProps {
  slug: string
  snapshot: GitActivitySnapshot | null
}

export default function GitActivitySidebar(props: GitActivitySidebarProps): JSX.Element
```

### TypeScript: `web/src/components/git/BranchLane.tsx`

```typescript
import { GitBranch, GitCommit } from '../../types/gitActivity'

interface BranchLaneProps {
  branch: GitBranch
  mainCommits: GitCommit[]
  totalWidth: number  // available SVG width in px
}

export default function BranchLane(props: BranchLaneProps): JSX.Element
```

### TypeScript: `web/src/components/git/CommitDot.tsx`

```typescript
import { GitCommit } from '../../types/gitActivity'

interface CommitDotProps {
  commit: GitCommit
  color: string       // hex color from getAgentColor()
  x: number           // SVG x coordinate
  y: number           // SVG y coordinate
  isPulse: boolean    // true for most-recent commit on running agent
}

export default function CommitDot(props: CommitDotProps): JSX.Element
```

### SSE wire contract

- Endpoint: `GET /api/git/{slug}/activity`
- Event name: `git_activity`
- Data: JSON-encoded `ActivitySnapshot` (Go) / `GitActivitySnapshot` (TS)
- Field name mapping is exact (Go struct json tags match TS interface fields)
- Poll interval: 5 seconds server-side
- Graceful degradation: when `branches` array is empty, sidebar renders
  "Waiting for agents..." placeholder

---

## File Ownership

```yaml type=impl-file-ownership
| File | Agent | Wave | Depends On |
|------|-------|------|------------|
| `web/src/types/gitActivity.ts` | Scaffold | 0 | — |
| `pkg/git/activity.go` | A | 1 | — |
| `pkg/api/git_activity.go` | A | 1 | — |
| `pkg/api/server.go` | A | 1 | — |
| `web/src/hooks/useGitActivity.ts` | B | 1 | Scaffold |
| `web/src/components/git/GitActivitySidebar.tsx` | B | 1 | Scaffold |
| `web/src/components/git/BranchLane.tsx` | B | 1 | Scaffold |
| `web/src/components/git/CommitDot.tsx` | B | 1 | Scaffold |
| `web/src/components/WaveBoard.tsx` | B | 1 | Scaffold |
```

---

## Wave Structure

```yaml type=impl-wave-structure
Wave 0:  [Scaffold]               <- 1 agent (type scaffold file)
              | (Scaffold complete)
Wave 1:  [A] [B]                  <- 2 parallel agents (Go backend + React frontend)
```

---

## Wave 0

The Scaffold Agent creates `web/src/types/gitActivity.ts` with the exact
TypeScript interfaces defined in the Scaffolds section above. This file is
the wire-protocol contract that both Agent A (which must produce JSON matching
these shapes) and Agent B (which consumes them) depend on. Wave 1 must not
launch until this file is present.

---

## Wave 1

Wave 1 launches after the Scaffold Agent completes. Both agents run in
parallel with fully disjoint file ownership. Agent A owns all Go files; Agent
B owns all TypeScript/React files. They share only the SSE wire protocol
defined in the Interface Contracts section.

### Agent A - Go Git Activity Backend

**Field 0 — CRITICAL: Isolation Verification**

Before writing any code, verify you are in the correct worktree and on the
correct branch:

```bash
pwd   # must end with .claude/worktrees/wave1-agent-a
git branch --show-current  # must print: wave1-agent-a
```

If either check fails, stop immediately and do not proceed. Contact the
orchestrator.

**Field 1 — File Ownership**

You own exactly these files. Do not read or write any file outside this list:

- `pkg/git/activity.go` — NEW: git polling logic
- `pkg/api/git_activity.go` — NEW: SSE handler for git activity endpoint
- `pkg/api/server.go` — MODIFY: add one route registration line to `New()`

Do not modify `pkg/git/commands.go`, `pkg/api/wave.go`, `pkg/api/types.go`,
or any test file outside `pkg/git/` and `pkg/api/`.

**Field 2 — Interfaces You Must Implement**

Implement exactly these signatures (from the Interface Contracts section):

```go
// In pkg/git/activity.go:

type Commit struct {
    SHA          string    `json:"sha"`
    Message      string    `json:"message"`
    Author       string    `json:"author"`
    Timestamp    time.Time `json:"timestamp"`
    FilesChanged int       `json:"files_changed"`
}

type Branch struct {
    Name        string   `json:"name"`
    Agent       string   `json:"agent"`
    Wave        int      `json:"wave"`
    Commits     []Commit `json:"commits"`
    Merged      bool     `json:"merged"`
    MergeCommit string   `json:"merge_commit,omitempty"`
    Status      string   `json:"status"`
}

type ActivitySnapshot struct {
    Slug        string    `json:"slug"`
    MainCommits []Commit  `json:"main_commits"`
    Branches    []Branch  `json:"branches"`
    PolledAt    time.Time `json:"polled_at"`
}

type Poller struct { /* your unexported fields */ }

func NewPoller(repoPath, slug string) *Poller

func (p *Poller) Snapshot() (ActivitySnapshot, error)

// In pkg/api/git_activity.go:
func (s *Server) handleGitActivity(w http.ResponseWriter, r *http.Request)
```

In `pkg/api/server.go`, add exactly this line to the route registration block
inside `New()`, after the existing `handleWaveEvents` registration:

```go
s.mux.HandleFunc("GET /api/git/{slug}/activity", s.handleGitActivity)
```

**Field 3 — Interfaces You May Call**

You may call these existing functions:

- `internal/git.Run(repoPath string, args ...string) (string, error)` — execute git commands
- `internal/git.WorktreeList(repoPath string) ([][2]string, error)` — list active worktrees
- `internal/git.RevParse(repoPath, ref string) (string, error)` — resolve ref to SHA

For the SSE handler in `pkg/api/git_activity.go`, you may reference the
existing `sseBroker` pattern in `pkg/api/wave.go` as a style guide, but do
NOT use the broker for this endpoint — the git activity handler does its own
polling loop directly, writing SSE frames via `fmt.Fprintf` and `flusher.Flush()`.

**Field 4 — What to Implement**

*`pkg/git/activity.go`*

Implement `Poller.Snapshot()` which:
1. Calls `git.WorktreeList(p.repoPath)` to enumerate active worktrees.
2. For each worktree, parses the branch name with the regex
   `wave(\d+)-agent-([a-z])` to extract wave number and agent letter.
3. For each branch, runs `git log --oneline --format="%H %an %aI %s" <branch> ^main`
   (commits on branch not on main) using `git.Run`. Parse output into
   `[]Commit` (truncate SHA to 7 chars). If the branch name has no commits
   ahead of main, `Commits` is `[]Commit{}` (not nil).
4. Detects merged branches: run `git branch --merged main` and check if the
   branch name is in the output. If merged, populate `MergeCommit` using
   `git log --format="%H" -1 main` to get the latest merge commit SHA.
5. Populates `MainCommits` from `git log --oneline --format="%H %an %aI %s" main -20`.
6. Returns an `ActivitySnapshot` with `Slug` = `p.slug`, `PolledAt` = `time.Now().UTC()`.
7. If `WorktreeList` returns 0 entries, returns an empty snapshot (empty
   `Branches`, empty `MainCommits`, no error).

Status field derivation for each branch: you do not have access to the SSE
agent status stream from this package. Default `Status` to `"running"` for
all branches returned by WorktreeList. The frontend will reconcile status
from the wave events stream it already receives via `useWaveEvents`.

*`pkg/api/git_activity.go`*

Implement `handleGitActivity` which:
1. Reads `slug` from `r.PathValue("slug")`.
2. Sets SSE headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`,
   `Connection: keep-alive`. Check `http.Flusher`; return 500 if not available.
3. Creates a `git.NewPoller(s.cfg.RepoPath, slug)`.
4. Polls immediately (do not wait for first tick), marshals snapshot to JSON,
   writes `event: git_activity\ndata: <json>\n\n`, flushes.
5. Starts a `time.NewTicker(5 * time.Second)` loop:
   - On tick: call `poller.Snapshot()`, marshal, write SSE frame, flush.
   - On `r.Context().Done()`: stop ticker and return.
6. If `poller.Snapshot()` returns an error, log to stderr and continue
   (do not close the stream; the next poll may succeed).

**Field 5 — Tests to Write**

Write tests in `pkg/git/activity_test.go` and `pkg/api/git_activity_test.go`.

`pkg/git/activity_test.go`:
- `TestPoller_EmptySnapshot` — calls `Snapshot()` in a real temp git repo with
  no worktrees; verifies `Branches` is empty, `MainCommits` is empty, no error.
- `TestPoller_ParsesBranchName` — creates a temp git repo, creates a worktree
  named `wave1-agent-a` with one commit; verifies `Branches[0].Agent == "A"`,
  `Branches[0].Wave == 1`, `len(Branches[0].Commits) == 1`.
- `TestPoller_SnapshotNoBranches` — verifies graceful return when `WorktreeList`
  yields no agent branches (main worktree only).

`pkg/api/git_activity_test.go`:
- `TestHandleGitActivity_ContentType` — uses `httptest.ResponseRecorder` with
  pre-cancelled context; verifies `Content-Type: text/event-stream` header.
- `TestHandleGitActivity_EmitsEvent` — uses `httptest.Server` (needed for real
  Flusher); cancels the connection after one SSE frame; verifies the response
  body contains `event: git_activity`.

**Field 6 — Verification Gate**

Run these commands in order inside your worktree. All must pass before
submitting your completion report:

```bash
go build ./...
go vet ./...
go test ./pkg/git/... -run TestPoller -v -timeout 60s
go test ./pkg/api/... -run TestHandleGitActivity -v -timeout 60s
```

**Field 7 — Constraints**

- Do NOT add any new Go module dependencies. Use only `internal/git.Run` for
  git operations; do not shell out directly.
- The polling interval is exactly 5 seconds (hardcoded); do not make it
  configurable in this phase.
- Branch name parsing must use the convention `wave%d-agent-%s` with lowercase
  agent letter (matching `worktree.Manager.Create` output). Uppercase the
  agent letter when populating `Branch.Agent`.
- `pkg/git/activity.go` must be in `package git` (same package as `commands.go`).
- `pkg/api/git_activity.go` must be in `package api`.
- The `server.go` change is exactly one line added to the route block in
  `New()`. Do not restructure `New()` or touch any other line.
- SSE frame format must be: `event: git_activity\ndata: <json>\n\n`
  (double newline terminator). Match the format in `pkg/api/wave.go`'s
  `handleWaveEvents`.

**Field 8 — Report**

When complete, append this completion report to your worktree's copy of this
IMPL doc:

```
## Agent A Completion Report

status: complete | partial | blocked
branch: wave1-agent-a
files_changed:
  - pkg/git/activity.go
  - pkg/api/git_activity.go
  - pkg/api/server.go
interface_deviations: none | <description>
downstream_action_required: false | true
notes: <any observations for the orchestrator>
tests_added: <list test names>
verification_output: <paste last 20 lines of go test output>
```

---

### Agent B - React Git Activity Frontend

**Field 0 — CRITICAL: Isolation Verification**

Before writing any code, verify you are in the correct worktree and on the
correct branch:

```bash
pwd   # must end with .claude/worktrees/wave1-agent-b
git branch --show-current  # must print: wave1-agent-b
```

If either check fails, stop immediately and do not proceed. Contact the
orchestrator.

**Field 1 — File Ownership**

You own exactly these files. Do not read or write any file outside this list:

- `web/src/types/gitActivity.ts` — READ-ONLY (created by Scaffold Agent; import from here, never modify)
- `web/src/hooks/useGitActivity.ts` — NEW: SSE hook for git activity stream
- `web/src/components/git/GitActivitySidebar.tsx` — NEW: sidebar container
- `web/src/components/git/BranchLane.tsx` — NEW: single lane component
- `web/src/components/git/CommitDot.tsx` — NEW: animated commit marker
- `web/src/components/WaveBoard.tsx` — MODIFY: two-column layout

Do not modify `web/src/hooks/useWaveEvents.ts`, `web/src/types.ts`,
`web/src/lib/agentColors.ts`, `web/src/components/AgentCard.tsx`, or any
Go file.

**Field 2 — Interfaces You Must Implement**

Implement exactly these signatures (from the Interface Contracts section):

```typescript
// web/src/hooks/useGitActivity.ts
export function useGitActivity(slug: string): GitActivitySnapshot | null

// web/src/components/git/GitActivitySidebar.tsx
interface GitActivitySidebarProps {
  slug: string
  snapshot: GitActivitySnapshot | null
}
export default function GitActivitySidebar(props: GitActivitySidebarProps): JSX.Element

// web/src/components/git/BranchLane.tsx
interface BranchLaneProps {
  branch: GitBranch
  mainCommits: GitCommit[]
  totalWidth: number
}
export default function BranchLane(props: BranchLaneProps): JSX.Element

// web/src/components/git/CommitDot.tsx
interface CommitDotProps {
  commit: GitCommit
  color: string
  x: number
  y: number
  isPulse: boolean
}
export default function CommitDot(props: CommitDotProps): JSX.Element
```

**Field 3 — Interfaces You May Call**

You may call or import these existing utilities:

- `getAgentColor(agent: string): string` from `web/src/lib/agentColors.ts` —
  returns hex color for an agent letter; use this for commit dot and lane colors.
- `getAgentColorWithOpacity(agent: string, opacity: number): string` from
  `web/src/lib/agentColors.ts` — for lane background tints.
- `useWaveEvents(slug: string): AppWaveState` from `web/src/hooks/useWaveEvents.ts` —
  already called in `WaveBoard.tsx`; you use its return value to map agent
  status onto the branch lanes. Do not open a second EventSource for wave events.
- All types in `web/src/types/gitActivity.ts` (created by Scaffold Agent).

**Field 4 — What to Implement**

*`web/src/hooks/useGitActivity.ts`*

Implement `useGitActivity(slug)` using the standard React `useState` /
`useEffect` / `useRef` pattern matching `useWaveEvents.ts`:
- Opens `new EventSource('/api/git/' + slug + '/activity')`.
- Listens for `git_activity` event; parses `JSON.parse(event.data)` as
  `GitActivitySnapshot`.
- Returns the latest snapshot (or `null` before the first event).
- Closes the EventSource on cleanup.

*`web/src/components/git/CommitDot.tsx`*

A pure SVG component. Renders a `<circle>` at `(x, y)` with `r=5`, filled
with `color`. When `isPulse` is true, wraps it in an animated outer ring
(CSS animation: `animate-pulse` on a second, slightly larger circle with
20% opacity of the same color). Shows a `<title>` tooltip with
`commit.message` (first 60 chars) and `commit.sha`. No external deps.

*`web/src/components/git/BranchLane.tsx`*

Renders one horizontal lane as an SVG `<g>` group (intended to be composed
into a parent `<svg>` in GitActivitySidebar). Draws:
1. A horizontal line (the "branch rail") in the agent color at 70% opacity.
2. A `CommitDot` for each commit in `branch.commits`, spaced evenly along
   the rail left-to-right.
3. When `branch.merged === true`: a bezier curve (`<path d="M ... C ...">`)
   from the last commit dot up to the main rail position. The curve is drawn
   in the agent color at 80% opacity, stroke-width 2, fill none.
4. A status icon on the right edge: `⏳` for `running`, `✓` for `complete`,
   `✗` for `failed`, `·` for `pending` — rendered as a `<text>` element.
5. Agent label on the left edge: the agent letter in the agent color.

When `branch.commits` is empty, renders only the agent label and a dashed
horizontal rail (stroke-dasharray="4 4").

*`web/src/components/git/GitActivitySidebar.tsx`*

Renders the full sidebar:
1. When `snapshot === null` or `snapshot.branches.length === 0`, renders a
   placeholder: `<div>No git activity yet.</div>`.
2. Otherwise, renders an `<svg>` with one row per branch (each row is a
   `<BranchLane>` placed via SVG `transform="translate(0, N * rowHeight)"`).
3. Above the branch lanes, renders the main rail as a thin line with dots
   for `snapshot.main_commits` (using a neutral color, e.g. `#6b7280`).
4. The SVG has `width="100%"`, `height` calculated as `(branches.length + 1) * rowHeight`,
   where `rowHeight = 60`.
5. The sidebar container div has `className="w-full overflow-x-auto"`.

*`web/src/components/WaveBoard.tsx`*

Change the layout from a single-column `max-w-4xl` container to a two-column
split. The left column (70% width) contains the existing wave rows and
scaffold row unchanged. The right column (30% width) contains
`<GitActivitySidebar slug={slug} snapshot={gitSnapshot} />`.

Concretely:
- Call `useGitActivity(slug)` at the top of `WaveBoard` to get `gitSnapshot`.
- Replace the outer `<div className="max-w-4xl mx-auto space-y-6">` with a
  flex two-column layout. Example structure:
  ```tsx
  <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
    <div className="flex gap-6 items-start">
      <div className="flex-1 min-w-0 space-y-6">
        {/* existing header, progress bar, banners, scaffold row, wave rows, empty state */}
      </div>
      <div className="w-80 shrink-0 sticky top-6">
        <GitActivitySidebar slug={slug} snapshot={gitSnapshot} />
      </div>
    </div>
  </div>
  ```
- The sidebar is sticky (`sticky top-6`) so it stays visible while scrolling.

**Field 5 — Tests to Write**

Create `web/src/components/git/GitActivitySidebar.test.tsx`:

- `renders no-activity placeholder when snapshot is null` — renders
  `<GitActivitySidebar slug="test" snapshot={null} />` and verifies the
  placeholder text is in the document.
- `renders branch lanes for each branch in snapshot` — renders with a mock
  snapshot containing 2 branches; verifies 2 lane elements are rendered
  (e.g. by `data-testid` attributes or agent letter text content).
- `renders merged bezier path when branch is merged` — renders with one merged
  branch; verifies an SVG `<path>` element is in the document.

Create `web/src/hooks/useGitActivity.test.ts`:
- `returns null before first event` — mocks `EventSource`, verifies initial
  return value is `null`.
- `returns snapshot after git_activity event` — fires a mock `git_activity`
  event; verifies the hook returns the parsed snapshot.

Add `// @vitest-environment jsdom` at the top of each test file.

Use `@testing-library/react` for component tests. Mock `EventSource` globally
in test setup (add `global.EventSource = MockEventSource` as needed).

**Field 6 — Verification Gate**

Run these commands in order from inside `web/` in your worktree. All must pass
before submitting your completion report:

```bash
# From repo root (worktree):
cd web
npx tsc --noEmit
npx vitest run --reporter=verbose src/hooks/useGitActivity.test.ts src/components/git/GitActivitySidebar.test.tsx
```

If the broader test suite is needed:
```bash
npx vitest run
```

**Field 7 — Constraints**

- No new npm dependencies. SVG is written directly in React (no D3, no
  react-spring, no animation library). Use Tailwind CSS classes and inline
  styles only.
- The `<svg>` in `GitActivitySidebar` must be responsive: `width="100%"` with
  a fixed `viewBox` width of 600 and `preserveAspectRatio="xMidYMid meet"`.
  This ensures the SVG scales to the 30% column without overflow.
- Commit dots are spaced at most 50px apart. With many commits, the rail
  compresses (minimum spacing 20px). Apply `Math.max(20, Math.min(50, availableWidth / commits.length))`.
- The `isPulse` prop is true only for the last commit in a branch with
  `status === 'running'`.
- Import `GitActivitySnapshot`, `GitBranch`, `GitCommit` exclusively from
  `../../types/gitActivity` (or `../types/gitActivity` from the hooks directory).
  Never copy-paste the type definitions.
- `WaveBoard.tsx` must preserve all existing behavior; only the layout wrapper
  changes. Do not remove or alter the header, progress bar, banners, scaffold
  row, wave rows, or empty state.
- When the `useGitActivity` hook receives a network error, it should log to
  console and continue attempting reconnection (same pattern as `useWaveEvents`).

**Field 8 — Report**

When complete, append this completion report to your worktree's copy of this
IMPL doc:

```
## Agent B Completion Report

status: complete | partial | blocked
branch: wave1-agent-b
files_changed:
  - web/src/hooks/useGitActivity.ts
  - web/src/components/git/GitActivitySidebar.tsx
  - web/src/components/git/BranchLane.tsx
  - web/src/components/git/CommitDot.tsx
  - web/src/components/WaveBoard.tsx
interface_deviations: none | <description>
downstream_action_required: false | true
notes: <any observations for the orchestrator>
tests_added: <list test names>
verification_output: <paste last 20 lines of vitest output>
```

---

## Wave Execution Loop

After Wave 0 (Scaffold) and Wave 1 complete, work through this checklist in
order.

### Orchestrator Post-Merge Checklist

After Wave 0 (Scaffold) completes:

- [ ] Verify `web/src/types/gitActivity.ts` exists and contains all four
      exported types: `GitCommit`, `GitBranch`, `GitActivitySnapshot`,
      `GitActivityEvent`
- [ ] Confirm the file compiles: `cd web && npx tsc --noEmit`
- [ ] Launch Wave 1 (both Agent A and Agent B in parallel)

After Wave 1 completes:

- [ ] Read all agent completion reports — confirm all `status: complete`; if any
      `partial` or `blocked`, stop and resolve before merging
- [ ] Conflict prediction — cross-reference `files_changed` lists; flag any file
      appearing in >1 agent's list (none expected; `pkg/api/server.go` is owned
      by A only, `WaveBoard.tsx` by B only)
- [ ] Review `interface_deviations` — update downstream agent prompts for any
      item with `downstream_action_required: true`
- [ ] Merge Agent A: `git merge --no-ff wave1-agent-a -m "Merge wave1-agent-a: Go git activity backend"`
- [ ] Merge Agent B: `git merge --no-ff wave1-agent-b -m "Merge wave1-agent-b: React git activity sidebar"`
- [ ] Worktree cleanup: `git worktree remove .claude/worktrees/wave1-agent-a` + `git branch -d wave1-agent-a`
- [ ] Worktree cleanup: `git worktree remove .claude/worktrees/wave1-agent-b` + `git branch -d wave1-agent-b`
- [ ] Post-merge verification:
      - [ ] Linter auto-fix pass: `go vet ./...` (check-mode only; no auto-fix for Go)
      - [ ] `go build ./... && go vet ./... && go test ./...`
      - [ ] `cd web && npx tsc --noEmit && npx vitest run`
- [ ] Fix any cascade failures — pay attention to cascade candidates listed below
- [ ] Tick status checkboxes in this IMPL doc for completed agents
- [ ] Update interface contracts for any deviations logged by agents
- [ ] Apply `out_of_scope_deps` fixes flagged in completion reports
- [ ] Feature-specific steps:
      - [ ] Rebuild Go binary with embedded frontend: `cd web && npm run build && cd .. && go build -o saw ./cmd/saw`
      - [ ] Restart server: `pkill -f "saw serve"; ./saw serve &>/tmp/saw-serve.log &`
      - [ ] Smoke test: open WaveBoard in browser, verify sidebar column appears
      - [ ] Smoke test: manually verify `GET /api/git/<slug>/activity` returns SSE frames
- [ ] Commit: `git commit -m "feat: git activity sidebar — animated branch lanes with real-time commit visualization"`

### Cascade Candidates

These files are NOT in any agent's scope but reference interfaces whose
behavior or layout changes. The post-merge verification gate is the only
catch:

- `web/src/components/App.tsx` — renders `WaveBoard`; the props contract
  (`slug: string`) is unchanged, so no edits expected, but verify it still
  compiles after the WaveBoard layout change.
- `web/src/components/AgentCard.tsx` — not modified; still receives the same
  `AgentStatus` prop. No cascade expected.
- `web/src/hooks/useWaveEvents.ts` — not modified; `WaveBoard` now also calls
  `useGitActivity` alongside it. Two EventSources open simultaneously is fine
  (tested in existing `useWaveEvents` integration tests).

### Status

| Wave | Agent | Description | Status |
|------|-------|-------------|--------|
| 0 | Scaffold | Create `web/src/types/gitActivity.ts` with GitCommit, GitBranch, GitActivitySnapshot, GitActivityEvent | TO-DO |
| 1 | A | Go: git poller, SSE handler, server route | TO-DO |
| 1 | B | React: hook, sidebar, branch lanes, commit dots, WaveBoard layout | COMPLETE |
| — | Orch | Post-merge integration, binary rebuild, smoke test | TO-DO |

## Agent B Completion Report

status: complete
branch: wave1-agent-B
files_changed:
  - web/src/types/gitActivity.ts
  - web/src/hooks/useGitActivity.ts
  - web/src/components/git/GitActivitySidebar.tsx
  - web/src/components/git/BranchLane.tsx
  - web/src/components/git/CommitDot.tsx
  - web/src/components/WaveBoard.tsx
interface_deviations: none
downstream_action_required: false
notes: Scaffold Agent had not yet created web/src/types/gitActivity.ts; Agent B created it from the exact contents specified in the IMPL doc Scaffolds section. node_modules were absent in the worktree; resolved by symlinking from the main repo web/node_modules. All interfaces implemented exactly as specified. WaveBoard two-column layout preserves all existing behavior.
tests_added:
  - useGitActivity > returns null before first event
  - useGitActivity > returns snapshot after git_activity event
  - GitActivitySidebar > renders no-activity placeholder when snapshot is null
  - GitActivitySidebar > renders branch lanes for each branch in snapshot
  - GitActivitySidebar > renders merged bezier path when branch is merged
verification_output: |
   RUN  v4.0.18
   ✓ src/hooks/useGitActivity.test.ts (2 tests) 8ms
   ✓ src/components/git/GitActivitySidebar.test.tsx (3 tests) 21ms
   ✓ src/components/ReviewScreen.test.tsx (5 tests) 34ms
   Test Files  3 passed (3)
         Tests  10 passed (10)
      Start at  22:35:29
      Duration  1.17s


## Agent A Completion Report

status: complete
branch: wave1-agent-A
files_changed:
  - pkg/git/activity.go
  - pkg/api/git_activity.go
  - pkg/api/server.go
interface_deviations: none
downstream_action_required: false
notes: |
  - Used %x00 (null byte) as git log field separator to handle author names with spaces.
  - pkg/git/activity.go imports internal/git aliased as igit to avoid name collision.
  - FilesChanged defaults to 0; spec did not specify a source git command for this field.
  - git init -b main used in tests to ensure main branch exists for ^main exclusion.
  - TestPoller_EmptySnapshot and TestPoller_SnapshotNoBranches cover different setups
    (bare repo vs repo with non-agent worktree) but both verify empty Branches slice.
tests_added:
  - TestPoller_EmptySnapshot
  - TestPoller_ParsesBranchName
  - TestPoller_SnapshotNoBranches
  - TestHandleGitActivity_ContentType
  - TestHandleGitActivity_EmitsEvent
verification_output: |
  === RUN   TestPoller_EmptySnapshot
  --- PASS: TestPoller_EmptySnapshot (0.12s)
  === RUN   TestPoller_ParsesBranchName
  --- PASS: TestPoller_ParsesBranchName (0.28s)
  === RUN   TestPoller_SnapshotNoBranches
  --- PASS: TestPoller_SnapshotNoBranches (0.20s)
  PASS
  ok  github.com/blackwell-systems/scout-and-wave-go/pkg/git 0.928s
  === RUN   TestHandleGitActivity_ContentType
  --- PASS: TestHandleGitActivity_ContentType (0.02s)
  === RUN   TestHandleGitActivity_EmitsEvent
  --- PASS: TestHandleGitActivity_EmitsEvent (0.11s)
  PASS
  ok  github.com/blackwell-systems/scout-and-wave-go/pkg/api 0.571s
