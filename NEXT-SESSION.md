# Next Session: Bootstrap with SAW

## Repository Status

**Created:** 2026-03-06
**State:** Initialized, ready for SAW bootstrap

### What's Here

- ✅ Go module initialized (`github.com/blackwell-systems/scout-and-wave-go`)
- ✅ Directory structure created (cmd, pkg, internal, docs, examples)
- ✅ Requirements documented (`docs/REQUIREMENTS.md`)
- ✅ Implementation plan written (`docs/PLAN.md`)
- ✅ README, LICENSE, .gitignore configured

### What's Next

## Continue with SAW Bootstrap

From a new session, pick up with:

```bash
cd ~/code/scout-and-wave-go

# Launch SAW bootstrap to generate IMPL doc
/saw bootstrap "Go orchestrator implementing SAW protocol v0.8.0"
```

**This will:**
1. Scout analyzes `docs/REQUIREMENTS.md` and `docs/PLAN.md`
2. Scout generates `docs/IMPL/IMPL-bootstrap.md` with:
   - Wave 1: Protocol parsing, state machine, worktree manager (3 agents, parallel)
   - Wave 2: LLM client, agent runner (2 agents, parallel)
   - Wave 3: Merge operations, CLI (2 agents, parallel)
3. Scout shows you the architecture design
4. You review and approve
5. Scaffold Agent creates `pkg/types/scaffold-types.go` (shared types)
6. Wave 1 agents launch in parallel worktrees
7. Orchestrator merges → launches Wave 2 → merges → launches Wave 3
8. Result: Working MVP that can execute waves from IMPL docs

## Alternative: Manual First Agent

If you want to start smaller without SAW bootstrap:

```bash
cd ~/code/scout-and-wave-go

# Create a minimal main.go
cat > cmd/saw/main.go << 'EOF'
package main

import "fmt"

func main() {
    fmt.Println("scout-and-wave-go v0.1.0")
    fmt.Println("Go implementation of SAW protocol v0.8.0")
}
EOF

# Build and test
go build ./cmd/saw
./saw
```

Then implement agents one at a time, following `docs/PLAN.md` structure.

## Key Files to Review

Before running bootstrap, review:
- `docs/REQUIREMENTS.md` — Architectural decisions, MVP scope
- `docs/PLAN.md` — 7 agents across 3 waves, interface contracts

## Protocol Reference

While implementing, reference:
- https://github.com/blackwell-systems/scout-and-wave/tree/main/protocol/
- Key: `invariants.md` (I1-I6), `state-machine.md` (7 states)

## Expected Timeline

**With SAW bootstrap:**
- Scout analysis: 3-5 min
- Wave 1 (3 agents): 10-15 min
- Wave 2 (2 agents): 8-12 min
- Wave 3 (2 agents): 8-12 min
- **Total:** ~30-45 min to working MVP

**Manual implementation:**
- Agent A: 20-30 min
- Agent B: 20-30 min
- ... (7 agents × 25 min avg = 3 hours)

SAW bootstrap parallelizes 70% of the work.

## Validation

After bootstrap completes:

```bash
# Verify build
go build ./cmd/saw

# Verify tests (will exist after Wave 3)
go test ./...

# Verify can execute a simple wave
./saw wave --impl examples/simple-wave.md
```

---

**Ready for next session.** Run `/saw bootstrap "..."` to continue.
