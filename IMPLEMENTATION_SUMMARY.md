# Agent C Wave 2 Implementation Summary

## Overview
Successfully implemented the `POST /api/wave/{slug}/resolve-conflicts` endpoint for the Scout & Wave web server.

## Files Modified

### 1. `pkg/api/merge_test_handlers.go`
**Added:**
- `resolveConflictsFunc` package variable (test seam) for dependency injection in tests
- `handleResolveConflicts()` HTTP handler method
- `RegisterConflictRoutes()` method for route registration

**Handler Implementation Details:**
- **Route:** `POST /api/wave/{slug}/resolve-conflicts`
- **Request Body:** Reuses `MergeWaveRequest` type `{"wave": <int>}`
- **Concurrency Guard:** Reuses `s.mergingRuns` sync.Map (merge and resolve are mutually exclusive)
- **Returns:** HTTP 202 Accepted immediately
- **Background Processing:**
  - Reads `saw.config.json` for model configuration (same pattern as chat_handler.go)
  - Calls `engine.ResolveConflicts()` with `OnProgress` callback
  - Publishes SSE events via broker:
    - `conflict_resolving` - per-file, status="resolving"
    - `conflict_resolved` - per-file, status="resolved"
    - `conflict_resolution_failed` - on error (includes error message)
    - `merge_complete` - on success (indicates all conflicts resolved and committed)
  - Defers cleanup: `s.mergingRuns.Delete(slug)`

**Error Handling:**
- Returns 400 Bad Request for invalid JSON body
- Returns 409 Conflict if merge or resolution already in progress for slug
- Publishes `conflict_resolution_failed` event with error details on engine failure

### 2. `pkg/api/merge_test_handlers_test.go`
**Added:**
- `TestHandleResolveConflicts_Returns202` - Verifies 202 response and event publishing
- `TestHandleResolveConflicts_409OnConcurrent` - Verifies mutual exclusion with merge operations

**Test Coverage:**
- Uses `resolveConflictsFunc` test seam to inject no-op implementation
- Verifies HTTP status codes (202, 409)
- Validates SSE event publishing via broker subscription
- Confirms goroutine cleanup completes before test ends
- Tests mutual exclusion: pre-loading `s.mergingRuns` prevents concurrent operations

## Route Registration
The route must be wired in `server.go` by calling:
```go
s.RegisterConflictRoutes()
```

This will be handled by the integration agent (Agent D owns server.go).

## Interface Contracts Implemented

### Engine Call
```go
engine.ResolveConflicts(ctx, engine.ResolveConflictsOpts{
    IMPLPath: implPath,
    RepoPath: s.cfg.RepoPath,
    WaveNum:  wave,
    OnProgress: func(file string, status string) {
        // Publish SSE events based on status
    },
})
```

### SSE Event Payloads
1. **conflict_resolving**: `{"slug": str, "wave": int, "file": str}`
2. **conflict_resolved**: `{"slug": str, "wave": int, "file": str}`
3. **conflict_resolution_failed**: `{"slug": str, "wave": int, "error": str}`
4. **merge_complete**: `{"slug": str, "wave": int, "status": "success"}`

## Design Decisions

### 1. Reuse mergingRuns for Concurrency Control
**Rationale:** Merge and conflict resolution are mutually exclusive operations on the same repository. They both manipulate the Git index and working tree, so allowing concurrent execution would lead to race conditions and corruption. Using the same `sync.Map` ensures mutual exclusion without adding a new field to the Server struct.

### 2. Reuse MergeWaveRequest Type
**Rationale:** The request body shape is identical (`{"wave": int}`), so creating a duplicate type would violate DRY. Both endpoints need to know which wave's merge/conflicts to handle.

### 3. Model Configuration from saw.config.json
**Rationale:** Matches the pattern established in `chat_handler.go` (lines 118-125). The SAWConfig struct contains an `Agent.ChatModel` field that should be used for Claude API calls to respect user model preferences.

### 4. SSE Event Names
**Chosen Names:** `conflict_resolving`, `conflict_resolved`, `conflict_resolution_failed`
**Rationale:** These follow the existing naming convention in the codebase (snake_case for events) and clearly indicate progress stages. The "conflict_" prefix avoids ambiguity with other resolution operations.

### 5. Test Seam Pattern
**Implementation:** Package-level `resolveConflictsFunc` variable
**Rationale:** Allows tests to inject a no-op implementation, avoiding real Git operations and Claude API calls. This is the same pattern used for `mergeWaveFunc` in the same file.

## Verification Gates

### Build
```bash
cd /Users/dayna.blackwell/code/scout-and-wave-web/.claude/worktrees/wave2-agent-C
go build ./...
```
**Status:** ✅ PASS

### Lint
```bash
go vet ./...
```
**Status:** ✅ PASS

### Tests
```bash
go test ./pkg/api/ -run TestHandleResolveConflicts -count=1 -v
```
**Output:**
```
=== RUN   TestHandleResolveConflicts_Returns202
--- PASS: TestHandleResolveConflicts_Returns202 (0.00s)
=== RUN   TestHandleResolveConflicts_409OnConcurrent
--- PASS: TestHandleResolveConflicts_409OnConcurrent (0.00s)
PASS
ok      github.com/blackwell-systems/scout-and-wave-web/pkg/api    0.247s
```
**Status:** ✅ PASS

## Integration Notes

### For Agent D (Integration)
1. Call `s.RegisterConflictRoutes()` in `server.go`'s `New()` function after existing route registrations
2. The route will be: `s.mux.HandleFunc("POST /api/wave/{slug}/resolve-conflicts", s.handleResolveConflicts)`

### For Frontend (TypeScript)
The API function signature should be:
```typescript
export async function resolveConflicts(slug: string, wave: number): Promise<void>
```

Example fetch call:
```typescript
const response = await fetch(`/api/wave/${slug}/resolve-conflicts`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ wave })
});
```

## Dependencies
- `engine.ResolveConflicts` from scout-and-wave-go (Agent A, Wave 1)
- `engine.ResolveConflictsOpts` struct (Agent A, Wave 1)
- Existing Server infrastructure: `s.resolveIMPLPath()`, `s.makePublisher()`, `s.mergingRuns`

## Constraints Satisfied
✅ Reused `MergeWaveRequest` type (no new request type created)
✅ Reused `mergingRuns` for mutual exclusion (no new Server field added)
✅ SSE event names match specification exactly
✅ Did NOT modify `server.go` (provided `RegisterConflictRoutes()` instead)
✅ Followed existing code patterns (especially `handleWaveMerge` structure)
✅ Test seam pattern for unit testing without external dependencies
