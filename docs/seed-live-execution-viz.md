# Seed: Live Execution Visualization

Animate the dependency graph and wave structure panels during live wave execution.

## Current State

- **DependencyGraphPanel** — static SVG with agent nodes, edges, wave columns. Rendered from IMPL doc text. Not reactive to execution.
- **WaveStructurePanel** — static timeline with jewel nodes (scout → scaffold → waves → merges → complete). Agent letters shown as colored boxes inside wave nodes. `filled` only true when `doc_status === 'COMPLETE'`.
- **LiveRail (right sidebar)** — WaveBoard + AgentCard consume SSE via `useWaveEvents`. Shows live status with glowing borders.
- **Gap:** Center panels and right sidebar don't share state. SSE data is trapped in LiveRail.

## Available SSE Data

From `useWaveEvents(slug)` → `AppWaveState`:

| Event | Data | Visual Trigger |
|-------|------|----------------|
| `scaffold_started/complete` | `scaffoldStatus` | Scaffold jewel fills |
| `agent_started` | `agent, wave, files, startedAt` | Node lights up, pulse |
| `agent_complete` | `agent, wave, status, branch` | Node fills solid, check |
| `agent_failed` | `agent, wave, failure_type` | Node turns red, shake |
| `wave_complete` | `wave, merge_status` | Wave merge jewel fills |
| `stage_transition` | `stage, status, wave_num` | Timeline step advances |
| `run_complete` | `status, waves, agents` | Complete jewel fills |

## Proposed Approach

### Shared Hook

New `useExecutionSync(slug)` hook returns agent status keyed by `"wave:agent"` for O(1) lookups. Both panels call this independently — no context provider needed, just a hook that wraps `useWaveEvents`.

```typescript
// useExecutionSync(slug) → { agents: Map<string, AgentStatus>, waveProgress: Map<number, {complete, total}>, scaffoldStatus }
```

### Wiring

1. `App.tsx` — pass `liveView === 'wave'` flag to ReviewScreen
2. `ReviewScreen` — thread `slug` to both panels when live
3. `DependencyGraphPanel` — call `useExecutionSync(slug)`, map node letter → status, apply CSS classes
4. `WaveStructurePanel` — call `useExecutionSync(slug)`, fill jewels progressively, light up agent boxes

### Animations

**Dep graph nodes:**
- `pending` → grayscale (current)
- `running` → agent color glow pulse (CSS `@keyframes nodePulse`)
- `complete` → solid fill + check overlay, brief scale flourish
- `failed` → red border + shake animation

**Dep graph edges:**
- Default: faint
- Upstream complete → brighten, optional dash-flow animation

**Wave structure jewels:**
- Fill progressively as agents complete (not all-or-nothing)
- Scaffold jewel fills on `scaffold_complete`
- Progress ring: `stroke-dasharray` based on `complete/total` ratio

**Agent boxes in wave nodes:**
- Same status-based glow/color as AgentCard (reuse `getStatusStyle`)

## Key Files

| File | Change |
|------|--------|
| `hooks/useSharedWaveExecution.ts` | **New** — shared hook |
| `types.ts` | Add `ExecutionStateMap` type |
| `App.tsx` | Thread `isLiveExecuting` prop |
| `ReviewScreen.tsx` | Pass `slug` to panels when live |
| `review/DependencyGraphPanel.tsx` | Hook + conditional node/edge styling |
| `review/WaveStructurePanel.tsx` | Hook + reactive jewels + agent boxes |
| `index.css` | Animation keyframes |

## Complexity

**Wave 1 (core):** Shared hook + prop threading + CSS animations on both panels. ~2 agents (dep graph + wave structure, independent). Low risk — purely additive.

**Wave 2 (optional):** Edge drawing with RAF, progress rings, execution replay/scrubber. Medium risk.

## Notes

- Use CSS transitions for state changes (performant, declarative). RAF only for continuous animations in Wave 2.
- Reuse `getAgentColor()` and `getStatusStyle()` from existing AgentCard for visual consistency.
- Both panels are independent — no cross-dependency between dep graph and wave structure work.
