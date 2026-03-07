# Implementation Plan: scout-and-wave-go

**Status:** Ready for SAW bootstrap
**Phase:** MVP (Wave Agent execution only)
**Target Protocol Version:** 0.8.0

---

## Architecture Overview

### Core Components

```
scout-and-wave-go/
├── cmd/saw/           # CLI entry point
├── pkg/
│   ├── orchestrator/  # State machine + wave coordination
│   ├── protocol/      # IMPL doc parsing + validation
│   ├── worktree/      # Git worktree management
│   └── agent/         # LLM API client + execution
└── internal/git/      # Git command wrappers
```

### Data Flow

```
1. Parse IMPL doc → Extract wave structure, agent prompts
2. Validate state → Ensure preconditions met (I1-I6)
3. Create worktrees → One per agent, isolated branches
4. Launch agents → Parallel execution via Anthropic API
5. Monitor completion → Parse reports written to IMPL doc
6. Merge wave → Sequential merge + verification
7. Cleanup → Remove worktrees, update state
```

---

## Agent Breakdown (Recommended Waves)

### Wave 1: Foundation (3 agents, parallel)

**Agent A - Protocol Parsing**
- Files: `pkg/protocol/impl_doc.go`, `pkg/protocol/parser.go`, `pkg/protocol/types.go`
- Parse IMPL doc markdown structure
- Extract embedded YAML blocks (wave structure, agents, completion reports)
- Validate required sections exist
- Interface: `ParseIMPLDoc(path string) (*IMPLDoc, error)`

**Agent B - State Machine**
- Files: `pkg/orchestrator/state.go`, `pkg/orchestrator/transitions.go`, `pkg/orchestrator/orchestrator.go`
- Implement 7 states (from protocol/state-machine.md)
- Enforce valid transitions
- Track current wave, agent statuses
- Interface: `TransitionTo(newState State) error`

**Agent C - Worktree Manager**
- Files: `pkg/worktree/manager.go`, `internal/git/commands.go`
- Create worktrees via `git worktree add`
- Track worktree paths and branches
- Cleanup on success/failure
- Interface: `Create(wave int, agent string) (path string, error)`

### Wave 2: Execution (2 agents, parallel)

**Agent D - LLM Client**
- Files: `pkg/agent/client.go`, `pkg/agent/stream.go`
- Anthropic SDK integration
- Stream agent responses
- Handle tool use (future: file operations)
- Interface: `CallAPI(prompt string) (*Response, error)`

**Agent E - Agent Runner**
- Files: `pkg/agent/runner.go`, `pkg/agent/completion.go`
- Execute agent prompt in worktree context
- Parse completion reports from IMPL doc
- Validate agent completed successfully
- Interface: `Execute(prompt string, worktreePath string) (*CompletionReport, error)`

### Wave 3: Merge & CLI (2 agents, parallel)

**Agent F - Merge Operations**
- Files: `pkg/orchestrator/merge.go`, `pkg/orchestrator/verification.go`
- Implement merge procedure (from protocol/procedures.md)
- Post-merge verification gates
- Conflict detection (should never happen with I1)
- Interface: `MergeWave(waveNum int, agents []string) error`

**Agent G - CLI**
- Files: `cmd/saw/main.go`, `cmd/saw/commands.go`
- Command parsing (`wave`, `status`)
- Output formatting (progress, errors)
- Exit codes (0 = success, 1 = blocked)
- Interface: `main()` + subcommands

---

## Interface Contracts

### pkg/protocol

```go
type IMPLDoc struct {
    FeatureName   string
    Status        string
    Waves         []Wave
    FileOwnership map[string]string // file -> agent letter
}

type Wave struct {
    Number int
    Agents []Agent
}

type Agent struct {
    Letter      string
    Prompt      string
    FilesOwned  []string
}

type CompletionReport struct {
    Status            string   // "complete" | "partial" | "blocked"
    Commit            string
    FilesChanged      []string
    FilesCreated      []string
    Verification      string
}

func ParseIMPLDoc(path string) (*IMPLDoc, error)
func ValidateInvariants(doc *IMPLDoc) error
```

### pkg/orchestrator

```go
type State int
const (
    SuitabilityPending State = iota
    NotSuitable
    Reviewed
    WavePending
    WaveExecuting
    WaveMerged
    Complete
)

type Orchestrator struct {
    state       State
    implDoc     *protocol.IMPLDoc
    repoPath    string
    currentWave int
}

func New(repoPath string, implDocPath string) (*Orchestrator, error)
func (o *Orchestrator) TransitionTo(newState State) error
func (o *Orchestrator) RunWave(waveNum int) error
func (o *Orchestrator) MergeWave(waveNum int) error
```

### pkg/worktree

```go
type Manager struct {
    repoPath string
    active   map[string]string // worktree path -> branch name
}

func New(repoPath string) *Manager
func (m *Manager) Create(wave int, agent string) (string, error)
func (m *Manager) Remove(path string) error
func (m *Manager) CleanupAll() error
```

### pkg/agent

```go
type Runner struct {
    client    *Client
    worktrees *worktree.Manager
}

func New(apiKey string) *Runner
func (r *Runner) Execute(prompt string, worktreePath string) (*protocol.CompletionReport, error)
func (r *Runner) ParseCompletionReport(implDocPath string, agentLetter string) (*protocol.CompletionReport, error)
```

---

## Scaffolds (Shared Types)

### scaffold-types.go

```go
package types

// State machine states (shared by orchestrator and protocol packages)
type State int

const (
    SuitabilityPending State = iota
    NotSuitable
    Reviewed
    WavePending
    WaveExecuting
    WaveMerged
    Complete
)

// CompletionStatus values
type CompletionStatus string

const (
    StatusComplete CompletionStatus = "complete"
    StatusPartial  CompletionStatus = "partial"
    StatusBlocked  CompletionStatus = "blocked"
)
```

---

## Dependencies

```go
// go.mod
module github.com/blackwell-systems/scout-and-wave-go

go 1.25

require (
    github.com/anthropics/anthropic-sdk-go v0.2.0 // Anthropic API
    gopkg.in/yaml.v3 v3.0.1                        // YAML parsing
)
```

---

## Verification Gates

### Per-Agent (Scoped)
- Agent's worktree has at least one commit
- Completion report exists in IMPL doc
- Status field is not "blocked"
- Files changed match ownership table

### Post-Merge (Unscoped)
- All agent branches merged successfully
- No merge conflicts occurred
- Repository builds successfully (`go build ./...`)
- Repository tests pass (`go test ./...`)

---

## Known Constraints

1. **I1 (Disjoint File Ownership):** File ownership table in IMPL doc must be validated before worktree creation
2. **I2 (Interface Contracts):** Scaffolds must exist and compile before Wave 1 launches
3. **E7 (Agent Failure Handling):** If any agent reports `status: blocked`, wave does not merge
4. **Cross-repo limitation:** Orchestrator and target repo must be the same (Go implementation operates on itself during bootstrap)

---

## Bootstrap Execution Strategy

This plan is designed for **SAW bootstrap** execution:

```bash
cd ~/code/scout-and-wave-go
/saw bootstrap "Go orchestrator implementing SAW protocol v0.8.0"
```

The Scout will:
1. Read `docs/REQUIREMENTS.md` (already created)
2. Read this plan document
3. Generate `docs/IMPL/IMPL-bootstrap.md` with:
   - 3 waves (7 agents total)
   - File ownership table (each agent owns disjoint files)
   - Interface contracts (scaffolds for shared types)
   - Agent prompts (9-field structure)

Then proceed with Wave 1 → Wave 2 → Wave 3 execution.

---

## Success Criteria

**MVP complete when:**
1. ✅ `saw wave --impl path/to/IMPL.md` executes successfully
2. ✅ 3 agents run in parallel, isolated worktrees
3. ✅ Merge completes without conflicts
4. ✅ Post-merge verification passes
5. ✅ Binary compiles: `go build ./cmd/saw`
6. ✅ Can orchestrate a simple 2-agent wave

**Demo scenario:** Execute Wave 1 from manually-created IMPL doc with 2 agents modifying disjoint files.
