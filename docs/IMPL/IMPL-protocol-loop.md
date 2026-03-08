# IMPL: Protocol Loop — Wave Gate & Control Endpoints

This document tracks the wave gate mechanism and control endpoint additions to the SAW server.

---

### Agent C - Completion Report

```yaml type=impl-completion-report
status: complete
worktree: .claude/worktrees/wave1-agent-C
branch: saw/wave1-agent-C
commit: 8f7e83599216bb410c9b50c953573c441c7f4b86
files_changed:
  - pkg/api/wave_runner.go
files_created: []
interface_deviations: []
out_of_scope_deps: []
tests_added: []
verification: PASS (go build ./..., go vet ./..., go test ./pkg/api/...)
```

**Implementation notes:**

1. `gateChannels sync.Map` — package-level, keyed by slug, values are `chan bool` (buffered 1). Created fresh per gate crossing, deleted after use in all code paths (proceed, cancel, timeout).

2. `runWaveLoop` gate logic — inserted after `UpdateIMPLStatus` for each wave except the last (`i < len(waves)-1`). Uses a `select` with a 30-minute `time.After` timeout. Publishes `wave_gate_pending` before blocking, `wave_gate_resolved` on true, `run_failed` on false or timeout.

3. `handleWaveGateProceed` — looks up slug in `gateChannels`, type-asserts to `chan bool`, does a non-blocking send of `true`. Returns 404 if no gate is pending for the slug (prevents silent no-ops on stale requests). Returns 202 on success.

4. `handleWaveAgentRerun` — stub only. Parses `slug` and `letter` from path values, returns 202 with a JSON body noting the stub status. Full implementation (re-spawning worktree, re-running agent, updating IMPL doc) is deferred.

**downstream_action_required: true**

The orchestrator must add the following route registrations to `pkg/api/server.go` in the `New()` function, after the existing `POST /api/wave/{slug}/start` line:

```go
s.mux.HandleFunc("POST /api/wave/{slug}/gate/proceed", s.handleWaveGateProceed)
s.mux.HandleFunc("POST /api/wave/{slug}/agent/{letter}/rerun", s.handleWaveAgentRerun)
```

**handleWaveAgentRerun follow-up required:** The stub returns 202 but performs no action. A follow-up task should implement: locating the agent's worktree, re-invoking the agent subprocess, collecting the new completion report, and updating IMPL doc status.
