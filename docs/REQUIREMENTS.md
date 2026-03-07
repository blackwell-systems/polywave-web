# Requirements: scout-and-wave-go

## Language & Ecosystem
Go 1.25+ / Standard library + Anthropic SDK

## Project Type
CLI tool (orchestrator for parallel agent coordination)

## Deployment Target
Compiled binary distribution (multi-platform: darwin/linux/windows)

## Key Concerns (3-6 major responsibility areas)
1. **Protocol State Machine** - Implement 7-state orchestrator (SUITABILITY_PENDING → COMPLETE)
2. **IMPL Doc Parsing** - Parse markdown + embedded YAML (wave structure, agent prompts, completion reports)
3. **Worktree Isolation** - Create/manage git worktrees for parallel agent execution
4. **Agent Execution** - Call Anthropic API, stream responses, handle tool use, parse completion reports
5. **Merge Operations** - Execute merge procedure, conflict detection, post-merge verification gates
6. **CLI Interface** - Command parsing, output formatting, interactive prompts

## Storage
Filesystem (IMPL docs in `docs/IMPL/`, worktrees in `.claude/worktrees/`)

## External Integrations
- Anthropic API (Claude Sonnet 4.5+)
- Git CLI (`git worktree`, `git merge`, etc.)

## Source Codebase (if porting/adapting)
Reference implementation: https://github.com/blackwell-systems/scout-and-wave/tree/main/implementations/claude-code/

The Claude Code implementation demonstrates:
- How to parse IMPL docs (prompts/saw-skill.md lines 20-50)
- Agent prompt structure (prompts/agent-template.md)
- Merge procedure (prompts/saw-merge.md)

**We are NOT porting the Claude Code implementation.** We are implementing the protocol from scratch in Go, using the protocol specs as the authoritative source.

## Architectural Decisions Already Made
- **Separate repo strategy** - Not nested under `implementations/` to support Go module structure
- **Protocol v0.8.0 target** - Implement protocol as documented in main repo's `protocol/` directory
- **Standard library first** - Use stdlib where possible, add dependencies only when necessary
- **Single binary distribution** - Compile to standalone executable (`cmd/saw/main.go`)
- **MVP scope** - Start with Wave Agent execution (manual IMPL docs), defer Scout/Scaffold agents to phase 2
- **State immutability** - Protocol state transitions are validated, not assumed
- **Explicit worktree management** - No implicit cleanup, orchestrator owns worktree lifecycle

## MVP Feature Set (Phase 1)
1. Parse existing IMPL doc (created manually or by Claude Code)
2. Read wave structure and agent prompts
3. Create git worktrees for wave agents
4. Execute agents via Anthropic API
5. Parse completion reports
6. Merge wave branches
7. Cleanup worktrees

**Deferred to Phase 2:**
- Scout agent (codebase analysis, IMPL doc generation)
- Scaffold agent (shared type files)
- Interactive prompts (auto mode for MVP)

## Non-Goals
- GUI/web interface
- Database persistence (filesystem is sufficient)
- Multi-repo orchestration (protocol limitation documented)
- Real-time progress streaming (batch output acceptable for MVP)

## Success Criteria
1. Successfully execute a 3-agent wave from pre-existing IMPL doc
2. All 6 invariants enforced (I1-I6)
3. State machine transitions validated
4. Merge completes without conflicts (disjoint file ownership)
5. Post-merge verification gates run correctly
6. Worktrees cleaned up on success/failure
