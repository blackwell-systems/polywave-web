# IMPL: Merge Wave Button + Post-Merge Test Runner

## Suitability Assessment

Verdict: SUITABLE
test_command: `go test ./... && cd web && npm test -- --watchAll=false`
lint_command: `go vet ./...`

The work splits cleanly across three independent files (one new Go handler file, one
updated frontend hook, one updated WaveBoard component). Agent A owns the new Go
backend handler file `pkg/api/merge_test_handlers.go`; Agent B owns the SSE hook
extension `web/src/hooks/useWaveEvents.ts`; Agent C owns the WaveBoard UI changes
`web/src/components/WaveBoard.tsx` plus the API client additions in `web/src/api.ts`.
Agents B and C share no files with Agent A; Agent C depends on the SSE event types
Agent B defines but does not share files with B. The interfaces are fully
discoverable before implementation starts (SSE event names, POST endpoint paths,
and button conditions are all specifiable now). No investigation-first items exist.

Estimated times:
- Scout phase: ~15 min
- Agent execution: ~3 agents × 20 min avg, effectively 20 min parallel (single wave)
- Merge & verification: ~5 min
Total SAW time: ~40 min

Sequential baseline: ~3 agents × 20 min = 60 min sequential
Time savings: ~20 min (33% faster)

Recommendation: Clear speedup. Three independent agents, non-trivial logic,
Go build + npm test cycle is >30 s. Proceed.

---

## Scaffolds

No scaffolds needed — agents have independent type ownership. The two new SSE event
types (`merge_output`, `merge_complete`, `merge_conflict`, `test_output`,
`test_complete`, `test_failed`) are defined and consumed entirely within Agent B's
file (`useWaveEvents.ts`), with Agent C reading the hook's return type via the
already-shared `AppWaveState` interface extension (defined by Agent B). No
cross-agent struct duplication risk.

---

## Pre-Mortem

**Overall risk:** medium

**Failure modes:**

| Scenario | Likelihood | Impact | Mitigation |
|----------|-----------|--------|------------|
| Agent C tries to add SSE event listeners before Agent B defines them; type mismatch at compile time | medium | medium | Agent C's prompt specifies exact event names and AppWaveState fields to consume; it does not define them. If B deviates, C notes it in interface_deviations. |
| `engine.MergeWave` and `engine.RunVerification` don't stream output — they return only pass/fail | high | medium | Both engine functions currently take no `onEvent` callback; Agent A must wrap them with output capture (exec.Cmd stdout pipe) and publish `merge_output` / `test_output` SSE chunks manually in the new handler, rather than delegating to engine. Prompt calls this out explicitly. |
| Concurrent merge requests for same slug while a wave run is active | low | high | Agent A guards with a `mergingRuns sync.Map` similar to `activeRuns`, returning 409 if a merge for the slug is already in progress. |
| "All agents complete" check in WaveBoard is wrong — some agents may still be running while current wave is not yet fully known | medium | medium | Agent C uses the same per-wave agent list already computed in `state.waves`; the condition is: all agents in the current wave have `status === 'complete'`. This is already computed as `waveComplete === waveTotal`. |
| Test command from IMPL doc is multi-command string (e.g. `go test ./... && cd web && npm test`) | medium | medium | Agent A must run the test command via `sh -c "<cmd>"` rather than splitting on spaces. Document this in the handler. |
| Post-merge test runner button appears after every wave merge, not just the final merge | low | low | Acceptable UX — running tests after each wave is correct orchestrator procedure. Feature description says UI-only, not limited to final wave. |

---

## Known Issues

- `TestDoctorHelpIncludesFixNote` (if it exists in test suite) — pre-existing hang. Workaround: skip with `-skip`.
- `npm test` requires `--watchAll=false` flag in CI/non-interactive mode; the full test_command above includes it.
- The existing `engine.MergeWave` and `engine.RunVerification` functions do **not** accept streaming callbacks — they are synchronous and return only an error. The new GUI merge/test handlers must capture stdout/stderr using `exec.Cmd` pipes directly, bypassing the engine abstraction for the streaming concern. The engine is still called for its merge logic; see Agent A prompt for the workaround pattern.

---

## Dependency Graph

```yaml type=impl-dep-graph
Wave 1 (3 parallel agents — backend handler, SSE hook extension, UI wiring):

    [A] pkg/api/merge_test_handlers.go  (NEW)
         Implements POST /api/wave/{slug}/merge and POST /api/wave/{slug}/test.
         Registers routes in server.go. Streams merge/test output via existing
         sseBroker. Guards with mergingRuns sync.Map.
         ✓ root (no dependencies on other agents)

    [B] web/src/hooks/useWaveEvents.ts  (MODIFY)
         Adds merge/test SSE event listeners. Extends AppWaveState with
         wavesMergeState map and testRunState per wave. No dependency on A or C.
         ✓ root (no dependencies on other agents)

    [C] web/src/components/WaveBoard.tsx  (MODIFY)
        web/src/api.ts                    (MODIFY)
         Adds Merge Wave and Run Tests buttons. Reads new AppWaveState fields
         from Agent B's hook. Calls new API endpoints (same paths A registers).
         depends on: [A] (endpoint paths), [B] (AppWaveState shape)
         NOTE: Agents B and C do not share files. C reads types defined by B
         via the AppWaveState interface; these are fully specified in Interface
         Contracts below so C can implement without B completing first.
```

File conflicts resolved: Agent A creates a new file (`merge_test_handlers.go`)
rather than adding to `wave_runner.go` or `server.go`. The only change to
`server.go` is two `s.mux.HandleFunc(...)` lines — but to keep ownership
disjoint, Agent A adds these registrations directly in the new file using an
`init()`-style approach is not idiomatic; instead, Agent A adds a method
`registerMergeTestRoutes(s *Server)` called from `New()` in `server.go`.

**Ownership conflict note on server.go:** `server.go` is touched by Agent A
(to add two route registrations) but is not touched by any other agent. This
is safe — only Agent A modifies it.

---

## Interface Contracts

### New HTTP Endpoints (Agent A defines, Agent C calls)

```
POST /api/wave/{slug}/merge
  Request body: {"wave": <int>}
  Response: 202 Accepted
  Error: 409 Conflict if merge already in progress for slug
  Error: 404 if no IMPL doc found for slug
  SSE channel: same /api/wave/{slug}/events broker key
  SSE events published:
    merge_started   {"slug": string, "wave": int}
    merge_output    {"slug": string, "wave": int, "chunk": string}
    merge_complete  {"slug": string, "wave": int, "status": "success"}
    merge_failed    {"slug": string, "wave": int, "error": string, "conflicting_files": []string}

POST /api/wave/{slug}/test
  Request body: {"wave": <int>}
  Response: 202 Accepted
  Error: 409 Conflict if test already in progress for slug
  Error: 404 if no IMPL doc found for slug
  SSE channel: same /api/wave/{slug}/events broker key
  SSE events published:
    test_started    {"slug": string, "wave": int}
    test_output     {"slug": string, "wave": int, "chunk": string}
    test_complete   {"slug": string, "wave": int, "status": "pass"}
    test_failed     {"slug": string, "wave": int, "status": "fail", "output": string}
```

### Extended AppWaveState (Agent B defines, Agent C consumes)

```typescript
// Extension to AppWaveState in useWaveEvents.ts

export interface WaveMergeState {
  status: 'idle' | 'merging' | 'success' | 'failed'
  output: string          // accumulated stdout from merge
  conflictingFiles: string[]
  error?: string
}

export interface WaveTestState {
  status: 'idle' | 'running' | 'pass' | 'fail'
  output: string          // accumulated stdout/stderr from test run
}

// AppWaveState gains two new fields:
export interface AppWaveState {
  // ... existing fields unchanged ...
  wavesMergeState: Map<number, WaveMergeState>   // keyed by wave number
  wavesTestState: Map<number, WaveTestState>      // keyed by wave number
}
```

### New API client functions (Agent C adds to api.ts)

```typescript
export async function mergeWave(slug: string, wave: number): Promise<void>
export async function runWaveTests(slug: string, wave: number): Promise<void>
```

### New Go request body types (Agent A defines in merge_test_handlers.go)

```go
type MergeWaveRequest struct {
    Wave int `json:"wave"`
}

type TestWaveRequest struct {
    Wave int `json:"wave"`
}
```

---

## File Ownership

```yaml type=impl-file-ownership
| File | Agent | Wave | Depends On |
|------|-------|------|------------|
| `pkg/api/merge_test_handlers.go` (new) | A | 1 | — |
| `pkg/api/server.go` (modify: 2 route registrations) | A | 1 | — |
| `web/src/hooks/useWaveEvents.ts` (modify) | B | 1 | — |
| `web/src/components/WaveBoard.tsx` (modify) | C | 1 | A (endpoint paths), B (AppWaveState shape) |
| `web/src/api.ts` (modify) | C | 1 | A (endpoint paths) |
```

---

## Wave Structure

```yaml type=impl-wave-structure
Wave 1: [A] [B] [C]   <- 3 parallel agents (all work is independent at the file level)
```

All three agents run in Wave 1. Agent C depends on interface contracts from A and B,
but those contracts are fully specified above. C does not need A or B to complete;
it implements against the specified contracts.

---

## Wave 1

Wave 1 delivers the complete feature: backend endpoints with SSE streaming (Agent A),
hook state management (Agent B), and the UI buttons + banners (Agent C). All three
agents work on disjoint files. Merging all three produces the working feature.

---

### Agent A — Backend: Merge + Test SSE Handlers

**Role:** Implement `POST /api/wave/{slug}/merge` and `POST /api/wave/{slug}/test`
handlers in a new file. Register routes in `server.go`. Stream output via the
existing SSE broker.

**Context:**
- Working directory: `/Users/dayna.blackwell/code/scout-and-wave-web`
- Language: Go
- Existing patterns to follow: `pkg/api/wave_runner.go` (background goroutine +
  publish pattern), `pkg/api/scout.go` (runID + goroutine + broker pattern)

**Files to create or modify:**
- `pkg/api/merge_test_handlers.go` — NEW: all handler code, request types,
  background runner functions
- `pkg/api/server.go` — MODIFY: add 2 route registrations in `New()`:
  ```go
  s.mux.HandleFunc("POST /api/wave/{slug}/merge", s.handleWaveMerge)
  s.mux.HandleFunc("POST /api/wave/{slug}/test", s.handleWaveTest)
  ```

**Implementation details:**

1. **`handleWaveMerge`** (`POST /api/wave/{slug}/merge`):
   - Decode `MergeWaveRequest{Wave int}` from body
   - Guard with `mergingRuns sync.Map` — return 409 if already merging for this slug
   - Return 202, then in background goroutine:
     - Publish `merge_started {"slug", "wave"}`
     - Call `engine.MergeWave(ctx, engine.RunMergeOpts{IMPLPath, RepoPath, WaveNum})`
     - `engine.MergeWave` is **not streaming** — it returns only error. Agent A does
       NOT attempt to add streaming inside the engine. Instead, publish a single
       `merge_output` chunk with "Merging wave N agents..." before the call, then
       the result event after.
     - On success: publish `merge_complete {"slug", "wave", "status": "success"}`
     - On error: detect if the error string contains "conflict" or "CONFLICT";
       extract conflicting file names if possible; publish
       `merge_failed {"slug", "wave", "error": string, "conflicting_files": []string}`
     - Call `mergingRuns.Delete(slug)` in defer

2. **`handleWaveTest`** (`POST /api/wave/{slug}/test`):
   - Decode `TestWaveRequest{Wave int}` from body
   - Guard with `testingRuns sync.Map` — return 409 if already testing
   - Return 202, then in background goroutine:
     - Publish `test_started {"slug", "wave"}`
     - Parse IMPL doc to get `doc.TestCommand` using `engine.ParseIMPLDoc`
     - Build command: run via `sh -c "<testCommand>"` to handle compound commands
       like `go test ./... && cd web && npm test --watchAll=false`
     - Pipe stdout+stderr; for each line read, publish `test_output {"slug", "wave", "chunk"}`
     - On exit 0: publish `test_complete {"slug", "wave", "status": "pass"}`
     - On non-zero exit: publish `test_failed {"slug", "wave", "status": "fail", "output": accumulatedOutput}`
     - Defer `testingRuns.Delete(slug)`

3. **State fields to add to `Server` struct** in `server.go`:
   ```go
   mergingRuns sync.Map // slug -> struct{}
   testingRuns sync.Map // slug -> struct{}
   ```

**Tests to write** in `pkg/api/merge_test_handlers_test.go`:
- `TestHandleWaveMerge_Returns409WhenAlreadyMerging` — inject second request while first is running
- `TestHandleWaveTest_Returns409WhenAlreadyTesting`
- `TestHandleWaveMerge_Returns202AndPublishesMergeStarted` — mock `engine.MergeWave` via seam variable similar to `runWaveLoopFunc`
- `TestHandleWaveTest_PublishesTestOutput` — mock exec with a test helper

**Verification gate:**
```bash
cd /Users/dayna.blackwell/code/scout-and-wave-web
go build ./...
go vet ./...
go test ./pkg/api/... -run TestHandleWaveMerge -run TestHandleWaveTest -v
```

**Interface contracts (what downstream agents depend on):**
- Route paths: `POST /api/wave/{slug}/merge` and `POST /api/wave/{slug}/test`
- SSE event names: `merge_started`, `merge_output`, `merge_complete`, `merge_failed`,
  `test_started`, `test_output`, `test_complete`, `test_failed`
- All published on the existing `slug` SSE broker key (same stream as wave events)

**Completion report format:** Standard 9-field format. Include `files_changed`,
`interface_deviations` (note any SSE event name changes), `status`.

---

### Agent B — Frontend Hook: Merge + Test SSE State

**Role:** Extend `useWaveEvents.ts` to listen for the new merge and test SSE events
and surface them in `AppWaveState`.

**Context:**
- Working directory: `/Users/dayna.blackwell/code/scout-and-wave-web`
- Language: TypeScript + React
- File to modify: `web/src/hooks/useWaveEvents.ts`

**Current state of file:** The hook subscribes to `/api/wave/{slug}/events` and
handles: `scaffold_started`, `scaffold_complete`, `agent_started`, `agent_complete`,
`agent_failed`, `agent_output`, `wave_complete`, `run_complete`, `run_failed`,
`wave_gate_pending`, `wave_gate_resolved`. No merge or test event handling exists.

**Implementation details:**

1. **Define new state interfaces** at the top of the file (or inline):
   ```typescript
   interface WaveMergeState {
     status: 'idle' | 'merging' | 'success' | 'failed'
     output: string
     conflictingFiles: string[]
     error?: string
   }

   interface WaveTestState {
     status: 'idle' | 'running' | 'pass' | 'fail'
     output: string
   }
   ```

2. **Extend `AppWaveState`:**
   ```typescript
   export interface AppWaveState {
     // ... all existing fields, unchanged ...
     wavesMergeState: Map<number, WaveMergeState>
     wavesTestState: Map<number, WaveTestState>
   }
   ```

3. **Initialize in `useState`:**
   ```typescript
   const [state, setState] = useState<AppWaveState>({
     // ... existing fields ...
     wavesMergeState: new Map(),
     wavesTestState: new Map(),
   })
   ```

4. **Add SSE event listeners** in the `useEffect`:

   ```typescript
   es.addEventListener('merge_started', (event: MessageEvent) => {
     const data = JSON.parse(event.data) as { slug: string; wave: number }
     setState(prev => {
       const next = new Map(prev.wavesMergeState)
       next.set(data.wave, { status: 'merging', output: '', conflictingFiles: [] })
       return { ...prev, wavesMergeState: next }
     })
   })

   es.addEventListener('merge_output', (event: MessageEvent) => {
     const data = JSON.parse(event.data) as { slug: string; wave: number; chunk: string }
     setState(prev => {
       const next = new Map(prev.wavesMergeState)
       const cur = next.get(data.wave) ?? { status: 'merging', output: '', conflictingFiles: [] }
       next.set(data.wave, { ...cur, output: cur.output + data.chunk })
       return { ...prev, wavesMergeState: next }
     })
   })

   es.addEventListener('merge_complete', (event: MessageEvent) => {
     const data = JSON.parse(event.data) as { slug: string; wave: number; status: string }
     setState(prev => {
       const next = new Map(prev.wavesMergeState)
       const cur = next.get(data.wave) ?? { status: 'idle', output: '', conflictingFiles: [] }
       next.set(data.wave, { ...cur, status: 'success' })
       return { ...prev, wavesMergeState: next }
     })
   })

   es.addEventListener('merge_failed', (event: MessageEvent) => {
     const data = JSON.parse(event.data) as {
       slug: string; wave: number; error: string; conflicting_files: string[]
     }
     setState(prev => {
       const next = new Map(prev.wavesMergeState)
       const cur = next.get(data.wave) ?? { status: 'idle', output: '', conflictingFiles: [] }
       next.set(data.wave, { ...cur, status: 'failed', error: data.error, conflictingFiles: data.conflicting_files ?? [] })
       return { ...prev, wavesMergeState: next }
     })
   })

   es.addEventListener('test_started', (event: MessageEvent) => {
     const data = JSON.parse(event.data) as { slug: string; wave: number }
     setState(prev => {
       const next = new Map(prev.wavesTestState)
       next.set(data.wave, { status: 'running', output: '' })
       return { ...prev, wavesTestState: next }
     })
   })

   es.addEventListener('test_output', (event: MessageEvent) => {
     const data = JSON.parse(event.data) as { slug: string; wave: number; chunk: string }
     setState(prev => {
       const next = new Map(prev.wavesTestState)
       const cur = next.get(data.wave) ?? { status: 'running', output: '' }
       next.set(data.wave, { ...cur, output: cur.output + data.chunk })
       return { ...prev, wavesTestState: next }
     })
   })

   es.addEventListener('test_complete', (event: MessageEvent) => {
     const data = JSON.parse(event.data) as { slug: string; wave: number; status: string }
     setState(prev => {
       const next = new Map(prev.wavesTestState)
       const cur = next.get(data.wave) ?? { status: 'idle', output: '' }
       next.set(data.wave, { ...cur, status: 'pass' })
       return { ...prev, wavesTestState: next }
     })
   })

   es.addEventListener('test_failed', (event: MessageEvent) => {
     const data = JSON.parse(event.data) as {
       slug: string; wave: number; status: string; output: string
     }
     setState(prev => {
       const next = new Map(prev.wavesTestState)
       const cur = next.get(data.wave) ?? { status: 'idle', output: '' }
       next.set(data.wave, { ...cur, status: 'fail', output: data.output })
       return { ...prev, wavesTestState: next }
     })
   })
   ```

5. **Export the new interfaces** so `WaveBoard.tsx` can import them:
   ```typescript
   export type { WaveMergeState, WaveTestState }
   ```

**Verification gate:**
```bash
cd /Users/dayna.blackwell/code/scout-and-wave-web/web
command npm run build
```
The TypeScript compiler will catch type errors. No existing tests cover the hook
directly; Agent B does not need to write new tests (the hook is covered by the
E2E flow), but should confirm the build passes.

**Interface contracts delivered:**
- `AppWaveState.wavesMergeState: Map<number, WaveMergeState>`
- `AppWaveState.wavesTestState: Map<number, WaveTestState>`
- `WaveMergeState` and `WaveTestState` exported interfaces

---

### Agent C — Frontend UI: WaveBoard Buttons + Banners

**Role:** Add the Merge Wave button and Run Tests button to `WaveBoard.tsx`.
Add `mergeWave` and `runWaveTests` functions to `api.ts`.

**Context:**
- Working directory: `/Users/dayna.blackwell/code/scout-and-wave-web`
- Language: TypeScript + React + Tailwind CSS
- Files to modify:
  - `web/src/components/WaveBoard.tsx`
  - `web/src/api.ts`

**What already exists in WaveBoard.tsx:**
- Per-wave rows rendered from `state.waves`
- `wave.complete` and `wave.merge_status` already tracked in WaveState
- Wave gate banner (blue) with "Proceed to Wave N" button — good visual reference
- Re-run button (amber) per agent — good button styling reference
- `state.runComplete` banner (green) at top for overall completion

**Implementation details:**

1. **Add to `api.ts`:**

   ```typescript
   export async function mergeWave(slug: string, wave: number): Promise<void> {
     const r = await fetch(`/api/wave/${encodeURIComponent(slug)}/merge`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ wave }),
     })
     if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`)
   }

   export async function runWaveTests(slug: string, wave: number): Promise<void> {
     const r = await fetch(`/api/wave/${encodeURIComponent(slug)}/test`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ wave }),
     })
     if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`)
   }
   ```

2. **Import new state types in WaveBoard.tsx:**
   ```typescript
   import type { WaveMergeState, WaveTestState } from '../hooks/useWaveEvents'
   import { mergeWave, runWaveTests } from '../api'
   ```

3. **Consume new state from hook:**
   The `state` object from `useWaveEvents(slug)` now includes
   `state.wavesMergeState` and `state.wavesTestState`. These are `Map<number, ...>`
   keyed by wave number.

4. **Logic for Merge Wave button:**
   - Show when: all agents in this wave have `status === 'complete'`
     AND `mergeState?.status` is `'idle'` or `undefined`
     AND the wave gate is NOT pending (to avoid showing during gate review)
   - Condition: `waveComplete === waveTotal && waveTotal > 0 && !mergeState || mergeState.status === 'idle'`
   - While merging: show spinner / "Merging..." label
   - On success: wave card border turns green; show green "Wave N merged" banner below card
   - On failure: show red conflict banner with list of conflicting files

5. **Logic for Run Tests button:**
   - Show when: `mergeState?.status === 'success'`
     AND `testState?.status` is `'idle'` or `undefined`
   - While running: show spinner / "Running tests..." label
   - On pass: green "Tests passed" banner
   - On fail: red "Tests failed" banner with scrollable output block

6. **UI structure to add inside the per-wave `<div key={wave.wave}>` block,**
   **after the agents row, before the wave gate banner:**

   ```tsx
   {/* Merge Wave section */}
   {(() => {
     const mergeState = state.wavesMergeState?.get(wave.wave)
     const testState = state.wavesTestState?.get(wave.wave)
     const allComplete = waveComplete === waveTotal && waveTotal > 0
     const mergeStatus = mergeState?.status ?? 'idle'
     const testStatus = testState?.status ?? 'idle'

     return (
       <>
         {/* Merge button — visible when all agents complete and not yet merged */}
         {allComplete && (mergeStatus === 'idle') && !hasGate && (
           <button
             onClick={() => void handleMergeWave(wave.wave)}
             className="mt-3 text-sm font-medium px-4 py-1.5 rounded-md bg-violet-600 text-white hover:bg-violet-700 transition-colors"
           >
             Merge Wave {wave.wave}
           </button>
         )}

         {/* Merging in progress */}
         {mergeStatus === 'merging' && (
           <div className="mt-3 bg-violet-50 border border-violet-200 rounded-lg px-4 py-2 text-violet-700 text-sm animate-pulse dark:bg-violet-950 dark:border-violet-800 dark:text-violet-400">
             Merging Wave {wave.wave}...
           </div>
         )}

         {/* Merge success — green card tint + Run Tests button */}
         {mergeStatus === 'success' && (
           <div className="mt-3 space-y-2">
             <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-green-800 text-sm dark:bg-green-950 dark:border-green-800 dark:text-green-400">
               Wave {wave.wave} merged successfully
             </div>

             {/* Run Tests button */}
             {testStatus === 'idle' && (
               <button
                 onClick={() => void handleRunTests(wave.wave)}
                 className="text-sm font-medium px-4 py-1.5 rounded-md bg-teal-600 text-white hover:bg-teal-700 transition-colors"
               >
                 Run Tests
               </button>
             )}

             {/* Tests running */}
             {testStatus === 'running' && (
               <div className="bg-teal-50 border border-teal-200 rounded-lg px-4 py-2 text-teal-700 text-sm animate-pulse dark:bg-teal-950 dark:border-teal-800 dark:text-teal-400">
                 Running tests...
               </div>
             )}

             {/* Tests passed */}
             {testStatus === 'pass' && (
               <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-green-800 text-sm dark:bg-green-950 dark:border-green-800 dark:text-green-400">
                 Tests passed
               </div>
             )}

             {/* Tests failed */}
             {testStatus === 'fail' && (
               <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 space-y-2 dark:bg-red-950 dark:border-red-800">
                 <p className="text-red-800 text-sm font-medium dark:text-red-400">Tests failed</p>
                 {testState?.output && (
                   <pre className="text-xs font-mono text-red-700 bg-red-100 dark:bg-red-900 dark:text-red-300 rounded p-2 overflow-y-auto max-h-48 whitespace-pre-wrap break-all">
                     {testState.output}
                   </pre>
                 )}
               </div>
             )}
           </div>
         )}

         {/* Merge failed — red conflict banner */}
         {mergeStatus === 'failed' && (
           <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3 space-y-1 dark:bg-red-950 dark:border-red-800">
             <p className="text-red-800 text-sm font-medium dark:text-red-400">
               Merge failed: {mergeState?.error}
             </p>
             {(mergeState?.conflictingFiles?.length ?? 0) > 0 && (
               <ul className="mt-1 space-y-0.5">
                 {mergeState!.conflictingFiles.map(f => (
                   <li key={f} className="font-mono text-xs text-red-700 dark:text-red-300">{f}</li>
                 ))}
               </ul>
             )}
           </div>
         )}
       </>
     )
   })()}
   ```

7. **Add handler functions in WaveBoard.tsx:**

   ```typescript
   async function handleMergeWave(waveNum: number): Promise<void> {
     try {
       await mergeWave(slug, waveNum)
     } catch (err) {
       // SSE stream will report the failure; no local state needed
       console.error('mergeWave request failed:', err)
     }
   }

   async function handleRunTests(waveNum: number): Promise<void> {
     try {
       await runWaveTests(slug, waveNum)
     } catch (err) {
       console.error('runWaveTests request failed:', err)
     }
   }
   ```

**Verification gate:**
```bash
cd /Users/dayna.blackwell/code/scout-and-wave-web/web
command npm run build
```
TypeScript build must pass with no errors. Check that no implicit `any` types appear.

**Note on state.wavesMergeState:** This is a `Map<number, WaveMergeState>` — React's
`useState` diffing does not detect mutations to Maps. Agent B initializes it fresh on
each `setState` call by spreading `new Map(prev.wavesMergeState)`. Agent C reads it
via `state.wavesMergeState?.get(wave.wave)` — this is safe as long as the hook returns
a stable reference on each state update, which it does because B creates a new Map
each time.

---

## Wave Execution Loop

After Wave 1 completes, work through the checklist below.

### Orchestrator Post-Merge Checklist

After wave 1 completes:

- [ ] Read all agent completion reports — confirm all `status: complete`; if any
      `partial` or `blocked`, stop and resolve before merging
- [ ] Conflict prediction — cross-reference `files_changed` lists; flag any file
      appearing in >1 agent's list before touching the working tree
      (especially watch for `web/src/hooks/useWaveEvents.ts` vs `web/src/components/WaveBoard.tsx` — should be disjoint)
- [ ] Review `interface_deviations` — update downstream agent prompts for any
      item with `downstream_action_required: true`
      (Agent C depends on SSE event names from Agent A — check for any deviations)
- [ ] Merge each agent: `git merge --no-ff <branch> -m "Merge wave1-agent-{X}: <desc>"`
- [ ] Worktree cleanup: `git worktree remove <path>` + `git branch -d <branch>` for each
- [ ] Post-merge verification:
      - [ ] Linter auto-fix pass: `go vet ./...` (check mode only, no auto-fix needed)
      - [ ] `go build ./... && go vet ./... && cd web && command npm run build && go test ./...` ← full suite
- [ ] Fix any cascade failures — `web/src/types.ts` is a cascade candidate if
      `WaveState` or `AppWaveState` shape changes; check that existing consumers
      (ReviewScreen, etc.) still compile
- [ ] Tick status checkboxes in this IMPL doc for completed agents
- [ ] Feature-specific steps:
      - [ ] Rebuild Go binary: `go build -o saw ./cmd/saw`
      - [ ] Restart server: `pkill -f "saw serve"; ./saw serve &>/tmp/saw-serve.log &`
      - [ ] Manual smoke test: open the WaveBoard for any IMPL slug with complete agents
            and verify the Merge Wave button appears
- [ ] Commit: `git commit -m "feat: merge wave button and post-merge test runner"`
- [ ] No next wave — this is a single-wave plan.

### Status

| Wave | Agent | Description | Status |
|------|-------|-------------|--------|
| 1 | A | Backend: merge + test SSE handlers + route registration | TO-DO |
| 1 | B | Frontend hook: merge/test SSE state management | TO-DO |
| 1 | C | Frontend UI: WaveBoard merge button + test runner buttons + api.ts | TO-DO |
| — | Orch | Post-merge: rebuild binary, restart server, smoke test | TO-DO |
