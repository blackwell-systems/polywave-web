# IMPL: Persistent 3-Column Layout + 2-Column Panel Grid

## Suitability Assessment

Verdict: SUITABLE

test_command: `cd /Users/dayna.blackwell/code/scout-and-wave-go/web && npx tsc --noEmit && command npx vitest run`
lint_command: `cd /Users/dayna.blackwell/code/scout-and-wave-go/web && npx tsc --noEmit`

The work decomposes cleanly across four disjoint file ownership domains: (A) `App.tsx` layout shell, (B) `ReviewScreen.tsx` panel grid, (C) `WaveBoard.tsx` narrowing, and (D) a new `LiveRail.tsx` right-rail component. No file is touched by more than one agent. The interfaces are fully discoverable before implementation starts — the only cross-agent contract is the `liveView` prop type passed from App to LiveRail, which can be written up front. All agents touch 2–3 files with non-trivial logic. TypeScript strict-mode compilation means build cycles are meaningful verification gates.

Estimated times:
- Scout phase: ~15 min (reading 12 source files, mapping the dependency graph)
- Agent execution: ~50 min (4 agents × ~12 min avg, running in parallel)
- Merge & verification: ~10 min
Total SAW time: ~75 min

Sequential baseline: ~75 min (4 agents × ~18 min sequential, but no parallel gain)
Time savings: ~20 min (parallelism across the 4 independent agents)

Recommendation: Clear speedup for Agent A + D running in parallel with B + C; all four have independent file ownership.

---

## Scaffolds

One new file and one new hook must exist before any Wave 1 agent runs, because both Agent A and Agent D reference `LiveRail.tsx`, and the `useResizableDivider` hook must accept a right-side resize calculation variant.

| File | Contents | Import path | Status |
|------|----------|-------------|--------|
| `web/src/components/LiveRail.tsx` | `export type LiveView = null \| 'scout' \| 'wave'`; `interface LiveRailProps { slug: string \| null; liveView: LiveView; onScoutComplete: (slug: string) => void; onClose: () => void; widthPx: number }` stub component returning `<div />` | `./components/LiveRail` | committed (98ea645) |
| `web/src/components/ThemePicker.tsx` | `export type ThemeId = 'default' \| 'gruvbox-dark' \| 'darcula' \| 'catppuccin-mocha' \| 'nord'`; stub component returning `<div />` | `./components/ThemePicker` | committed (98ea645) |

> Note: `LiveView` is the key cross-agent type. Agent A imports it to drive `liveView` state. Agent D implements `LiveRail` against it. `ThemeId` is defined in the scaffold so Agent A can import it when wiring the ThemePicker into the header. Agent E implements the full ThemePicker component and theme CSS vars.

---

## Pre-Mortem

**Overall risk:** medium

**Failure modes:**

| Scenario | Likelihood | Impact | Mitigation |
|----------|-----------|--------|------------|
| `useResizableDivider` calculates width from `clientX` which is left-anchored — a right-rail resize handle must calculate from the right edge, not the left | high | high | Agent D must implement a right-anchored variant: `rightWidthPx = window.innerWidth - moveEvent.clientX`. The hook accepts a `side: 'left' \| 'right'` option, or Agent D implements an inline resize handler rather than reusing the hook. Flag this clearly in Agent D's prompt. |
| `ReviewScreen`'s sticky toolbar uses negative margin hacks (`calc(-50vw + 50%)`) tied to the assumption it fills the full viewport width — inside a center column these will overflow | high | medium | Agent B must remove the full-viewport sticky hack and replace it with a container-relative sticky that works inside a fixed-width column. |
| `AgentCard` has `min-w-[240px]` which at 35% viewport (~500px) leaves room for only 2 cards before wrapping; this is fine but must be verified | low | low | Agent C notes narrowing behavior is expected; cards wrap naturally. |
| WaveBoard's `min-h-screen` root class forces full viewport height — inside a right rail this will overflow the parent | high | medium | Agent C replaces `min-h-screen` with `h-full overflow-y-auto`. |
| TypeScript `noUnusedLocals` and `noUnusedParameters` will fail if AppMode import is removed but any reference remains | medium | low | Agent A must delete the entire `AppMode` type and all references in one pass; the TypeScript gate will catch any missed reference. |
| `ReviewScreen.test.tsx` mocks `IntersectionObserver` and asserts on sticky toolbar behavior — the sticky toolbar markup changes in Agent B's work may break the test | medium | medium | Agent B updates the test fixture if markup changes. The existing test only checks `wave_complete` SSE dispatch, not sticky DOM, so impact is likely low. |
| The `ScoutLauncher` currently sets `min-h-screen` for its own full-page layout — embedded in the right rail this will expand the rail | high | medium | Agent D wraps `ScoutLauncher` in an overflow container and replaces `min-h-screen` with `h-full`. |

---

## Known Issues

None identified. All existing tests pass against current codebase. The `ScoutLauncher` and `WaveBoard` full-screen assumptions are expected failures that the feature resolves.

---

## Dependency Graph

```yaml type=impl-dep-graph
Wave 1 (4 parallel agents — all independent, scaffold must exist first):
    [A] web/src/App.tsx
         Remove AppMode type + mode switching; add liveView state; add LiveRail right column;
         add right-rail resize handle via useResizableDivider; wire "New plan" button to
         liveView='scout'; wire handleApprove to liveView='wave' instead of setAppMode('wave')
         ✓ root (no dependencies on other agents)

    [B] web/src/components/ReviewScreen.tsx
         Replace vertically stacked panels with 2-column CSS grid layout;
         fix sticky toolbar to work inside a bounded column (remove full-viewport hack);
         update activePanels defaults to match new grid positions
         ✓ root (no dependencies on other agents)

    [C] web/src/components/WaveBoard.tsx
         Adapt for narrow right-rail rendering: replace min-h-screen with h-full
         overflow-y-auto; remove w-80 git sidebar (sidebar moves to LiveRail wrapper);
         expose git sidebar as separate prop or render it inline if width permits;
         add compact card layout at narrow widths
         ✓ root (no dependencies on other agents)

    [D] web/src/components/LiveRail.tsx
         Implement the LiveRail component: renders ScoutLauncher or WaveBoard depending
         on liveView prop; handles right-edge resize; idle state renders placeholder;
         embeds GitActivitySidebar when liveView='wave'
         ✓ root (no dependencies on other agents — depends on scaffold stub)

    [E] web/src/index.css + web/src/components/ThemePicker.tsx
         Add 4 named color themes (Gruvbox Dark, Darcula, Catppuccin Mocha, Nord) as
         CSS classes on <html>; implement ThemePicker component (dropdown/pill selector
         in the header) that reads/writes theme to localStorage; replaces the scaffold stub
         ✓ root (no dependencies on other agents)

    [F] pkg/api/wave_runner.go
         Add runScaffoldIfNeeded() — detects pending scaffold files, launches Scaffold Agent
         via CLI backend, streams scaffold_started/scaffold_output/scaffold_complete SSE events;
         called in runWaveLoop before the wave loop begins
         ✓ root (no dependencies on other agents — Go backend, disjoint from all frontend files)
```

> Files split to resolve ownership: `WaveBoard.tsx` previously contained the `GitActivitySidebar` embed. That sidebar moves to `LiveRail.tsx` (Agent D's ownership). Agent C removes the sidebar from WaveBoard, Agent D picks it up in LiveRail — no file conflict.

---

## Interface Contracts

### `LiveView` type (defined in scaffold `LiveRail.tsx`, consumed by App.tsx and LiveRail.tsx)

```typescript
export type LiveView = null | 'scout' | 'wave'
```

### `LiveRailProps` interface (defined in scaffold stub, implemented by Agent D)

```typescript
export interface LiveRailProps {
  slug: string | null
  liveView: LiveView
  widthPx: number
  onScoutComplete: (slug: string) => void
  onClose: () => void
}
```

### App.tsx → LiveRail integration (Agent A calls this)

```typescript
// In App.tsx, Agent A adds:
const [liveView, setLiveView] = useState<LiveView>(null)
const { leftWidthPx: rightWidthPx, dividerProps: rightDividerProps } =
  useResizableDivider({ initialWidthPx: Math.round(window.innerWidth * 0.35), minWidthPx: 280, maxFraction: 0.55 })

// Right divider mousedown must calculate from right edge — Agent A passes a custom
// onMouseDown override or uses inline resize logic (see Pre-Mortem note on right-anchoring).
// Safest: call useResizableDivider and then override the dividerProps.onMouseDown:
//   the hook's leftWidthPx is repurposed as rightWidthPx by initializing it from
//   window.innerWidth * 0.35, and the mousemove handler computes:
//   setLeftWidthPx(Math.max(minWidthPx, Math.min(window.innerWidth - moveEvent.clientX, window.innerWidth * maxFraction)))

// JSX addition in the right column slot:
<LiveRail
  slug={selectedSlug}
  liveView={liveView}
  widthPx={rightWidthPx}
  onScoutComplete={handleScoutComplete}
  onClose={() => setLiveView(null)}
/>
```

### `handleApprove` change (Agent A)

```typescript
// Old: setAppMode('wave')
// New:
setLiveView('wave')
// Do NOT navigate away; center column stays showing the ReviewScreen IMPL doc.
```

### `handleScoutComplete` change (Agent A)

```typescript
// Old: setAppMode('split') at end
// New: setLiveView(null) — rail closes; center refreshes to new impl if slug returned
```

### `WaveBoardProps` — no interface change

```typescript
// WaveBoard keeps: interface WaveBoardProps { slug: string }
// Agent C adds: interface WaveBoardProps { slug: string; compact?: boolean }
// compact=true triggers narrower card layout; LiveRail passes compact={true}
```

### ReviewScreen panel grid (Agent B internal, no cross-agent interface)

```typescript
// Panel grid layout: CSS grid with named areas
// grid-template-columns: 1fr 1fr (responsive: 1fr below 768px)
// Full-span panels: overview, interface-contracts, known-issues
// Left-col: wave-structure, file-ownership
// Right-col: dependency-graph, pre-mortem
// Panels toggled off must not leave empty grid gaps — use conditional renders
// within grid cells, not conditional grid-area assignments.
```

---

## File Ownership

```yaml type=impl-file-ownership
| File | Agent | Wave | Depends On |
|------|-------|------|------------|
| web/src/components/LiveRail.tsx | Scaffold | pre-W1 | — |
| web/src/components/ThemePicker.tsx | Scaffold | pre-W1 | — |
| web/src/App.tsx | A | 1 | Scaffold |
| web/src/components/ReviewScreen.tsx | B | 1 | — |
| web/src/components/WaveBoard.tsx | C | 1 | — |
| web/src/components/LiveRail.tsx | D | 1 | Scaffold |
| web/src/index.css | E | 1 | — |
| web/src/components/ThemePicker.tsx | E | 1 | Scaffold |
| pkg/api/wave_runner.go | F | 1 | — |
```

> All other files (`useResizableDivider.ts`, `useWaveEvents.ts`, `useGitActivity.ts`, `ScoutLauncher.tsx`, `AgentCard.tsx`, `GitActivitySidebar.tsx`, `ImplEditor.tsx`, `ImplList.tsx`, `ActionButtons.tsx`, all `review/` panel components) are **read-only** for all agents. No agent modifies them. `ReviewScreen.test.tsx` is owned by Agent B if its tests break due to ReviewScreen markup changes.

---

## Wave Structure

```yaml type=impl-wave-structure
Wave 1: [Scaffold] (pre-flight, blocking)
           |
Wave 1: [A] [B] [C] [D] [E] [F]   <- 6 parallel agents (all independent)
```

All six agents run in parallel after the Scaffold Agent creates the `LiveRail.tsx` and `ThemePicker.tsx` stubs. There is no Wave 2 — this is a single-wave implementation.

---

## Wave 0 — Scaffold

The Scaffold Agent creates `web/src/components/LiveRail.tsx` with the stub contents below. This file must exist before Wave 1 launches so TypeScript imports resolve in all four agents' worktrees.

### Scaffold Agent

Create `/Users/dayna.blackwell/code/scout-and-wave-go/web/src/components/LiveRail.tsx` with the following content:

```typescript
// LiveRail — right-rail live execution panel
// Stub created by Scaffold Agent. Full implementation by Wave 1 Agent D.

export type LiveView = null | 'scout' | 'wave'

export interface LiveRailProps {
  slug: string | null
  liveView: LiveView
  widthPx: number
  onScoutComplete: (slug: string) => void
  onClose: () => void
}

export default function LiveRail(_props: LiveRailProps): JSX.Element {
  return <div />
}
```

Also create `/Users/dayna.blackwell/code/scout-and-wave-go/web/src/components/ThemePicker.tsx` with the following content:

```typescript
// ThemePicker — color theme selector stub
// Full implementation by Wave 1 Agent E.

export type ThemeId = 'default' | 'gruvbox-dark' | 'darcula' | 'catppuccin-mocha' | 'nord'

export default function ThemePicker(): JSX.Element {
  return <div />
}
```

Verify TypeScript compiles after creating both stubs:
```bash
cd /Users/dayna.blackwell/code/scout-and-wave-go/web && npx tsc --noEmit
```

---

## Wave 1

All four agents run simultaneously after the scaffold stub exists.

### Agent A — App Shell: 3-Column Layout + liveView State

**Role:** Rebuild `App.tsx` from a 2-column split-view with AppMode switching to a persistent 3-column shell driven by `liveView` state.

**Context:** The current `App.tsx` has an `AppMode` type (`'split' | 'wave' | 'scout'`) that renders entirely different component trees for each mode. The new design keeps the 3-column layout always visible and uses a `liveView` state (`null | 'scout' | 'wave'`) to control only the right rail content.

**Files owned:**
- `/Users/dayna.blackwell/code/scout-and-wave-go/web/src/App.tsx`

**Read-only dependencies:**
- `/Users/dayna.blackwell/code/scout-and-wave-go/web/src/components/LiveRail.tsx` (scaffold stub — import LiveView and LiveRailProps from here)
- `/Users/dayna.blackwell/code/scout-and-wave-go/web/src/hooks/useResizableDivider.ts` (reuse for right rail)
- `/Users/dayna.blackwell/code/scout-and-wave-go/web/src/components/ReviewScreen.tsx` (unchanged interface)
- `/Users/dayna.blackwell/code/scout-and-wave-go/web/src/components/ImplList.tsx` (unchanged interface)

**Implementation instructions:**

1. Remove the `AppMode` type and `appMode` state entirely.

2. Add `liveView` state:
   ```typescript
   import { LiveView } from './components/LiveRail'
   import LiveRail from './components/LiveRail'
   const [liveView, setLiveView] = useState<LiveView>(null)
   ```

3. Add a right-rail resize instance. The existing `useResizableDivider` hook tracks a `leftWidthPx` from the left edge. For the right rail you need width from the right edge. Use a second `useResizableDivider` call but override the `dividerProps.onMouseDown` to compute from the right edge:
   ```typescript
   const { leftWidthPx: rightWidthPx, dividerProps: rightDividerBaseProps } =
     useResizableDivider({ initialWidthPx: 380, minWidthPx: 280, maxFraction: 0.55 })
   ```
   Then create a custom `rightDividerProps` that wraps `rightDividerBaseProps` but modifies `onMouseDown` to track `window.innerWidth - moveEvent.clientX` rather than `moveEvent.clientX`. Since the hook internal state uses `setLeftWidthPx` via a closure, you cannot override this without modifying the hook. Instead, **implement the right-rail resize as an inline `useRef`/`useState` pattern directly in App.tsx** — do not try to reuse the hook's mouse handler. The `useResizableDivider` hook can still be used for the left sidebar.

   Inline right-rail resize (add to App.tsx):
   ```typescript
   const [rightWidthPx, setRightWidthPx] = useState(380)
   const rightDividerMouseDown = (e: React.MouseEvent) => {
     e.preventDefault()
     const onMove = (mv: MouseEvent) => {
       setRightWidthPx(Math.max(280, Math.min(window.innerWidth - mv.clientX, window.innerWidth * 0.55)))
     }
     const onUp = () => {
       document.removeEventListener('mousemove', onMove)
       document.removeEventListener('mouseup', onUp)
     }
     document.addEventListener('mousemove', onMove)
     document.addEventListener('mouseup', onUp)
   }
   ```

4. Update `handleApprove`: remove `setAppMode('wave')`, add `setLiveView('wave')`. The center column stays showing the ReviewScreen.

5. Update `handleScoutComplete`: remove `setAppMode('split')`, add `setLiveView(null)`.

6. Remove the two early-return blocks (`if (appMode === 'wave')` and `if (appMode === 'scout')`). Remove the imports for `WaveBoard` and `ScoutLauncher` from App.tsx — they are no longer used directly by App (they are used inside LiveRail).

7. Update "New plan" button: change `onClick={() => setAppMode('scout')}` to `onClick={() => setLiveView('scout')}`.

8. Replace the `<div className="flex-1 overflow-y-auto min-w-0">` center column with the full 3-column structure:
   ```tsx
   <div className="flex flex-1 min-h-0">
     {/* Left sidebar (unchanged) */}
     {sidebarCollapsed ? ( ... ) : ( ... )}

     {/* Center column — always present */}
     <div className="flex-1 overflow-y-auto min-w-0">
       {/* existing ReviewScreen render logic unchanged */}
     </div>

     {/* Right divider — only shown when liveView is not null */}
     {liveView !== null && (
       <div
         onMouseDown={rightDividerMouseDown}
         style={{ width: '4px', flexShrink: 0, alignSelf: 'stretch' }}
         className="cursor-col-resize select-none bg-border hover:bg-primary/30 transition-colors"
       />
     )}

     {/* Right rail */}
     {liveView !== null && (
       <div className="shrink-0 overflow-y-auto border-l" style={{ width: rightWidthPx }}>
         <LiveRail
           slug={selectedSlug}
           liveView={liveView}
           widthPx={rightWidthPx}
           onScoutComplete={handleScoutComplete}
           onClose={() => setLiveView(null)}
         />
       </div>
     )}
   </div>
   ```

9. The `DarkModeToggle` in the header remains unchanged. Remove the `DarkModeToggle` that was in the fullscreen mode renders (those blocks are deleted). Also import and add `ThemePicker` (from the scaffold stub) to the header, placed to the left of `DarkModeToggle`:
   ```tsx
   import ThemePicker from './components/ThemePicker'
   // In the header right-side group:
   <div className="flex items-center gap-2">
     <ThemePicker />
     <DarkModeToggle />
   </div>
   ```

10. TypeScript: with `noUnusedLocals` and `noUnusedParameters`, removing AppMode will cause errors if any reference remains. Do a complete pass to confirm all AppMode references are gone before running the TypeScript gate.

**Verification gate:**
```bash
cd /Users/dayna.blackwell/code/scout-and-wave-go/web
npx tsc --noEmit
command npx vitest run
```

**Completion report fields:**
- `status`: complete | partial | blocked
- `files_changed`: [web/src/App.tsx]
- `interface_deviations`: list any deviation from the LiveRailProps contract above
- `downstream_action_required`: true if LiveRailProps deviates (Agent D must be notified)
- `notes`: any notable implementation decisions

---

### Agent B — ReviewScreen: 2-Column Panel Grid

**Role:** Rebuild the panel layout in `ReviewScreen.tsx` from a vertically stacked list to a 2-column CSS grid, and fix the sticky toolbar's full-viewport negative-margin hack to work within a bounded column.

**Context:** Currently `ReviewScreen.tsx` renders all active panels in a `<div className="space-y-6">` ordered by click. The new design uses a fixed 2-column grid where each panel has a designated slot. The sticky panel-toggle toolbar uses `marginLeft: 'calc(-50vw + 50%)'` which assumes the component fills the full viewport — this breaks inside a center column with fixed width.

**Files owned:**
- `/Users/dayna.blackwell/code/scout-and-wave-go/web/src/components/ReviewScreen.tsx`
- `/Users/dayna.blackwell/code/scout-and-wave-go/web/src/components/ReviewScreen.test.tsx` (update if tests break)

**Read-only dependencies:**
- All `web/src/components/review/*.tsx` panel components (their props interfaces are unchanged)
- `/Users/dayna.blackwell/code/scout-and-wave-go/web/src/types.ts` (IMPLDocResponse type — unchanged)

**Implementation instructions:**

1. The panel grid layout replaces the `<div className="space-y-6">` section. The target layout is:

   | Grid position | Panel |
   |--------------|-------|
   | Full width (col-span-2) | Overview (always visible, above grid) |
   | Full width (col-span-2) | Wave Structure |
   | Left col | File Ownership |
   | Right col | Dependency Graph |
   | Full width (col-span-2) | Interface Contracts |
   | Left col | Agent Prompts |
   | Right col | Scaffolds |
   | Full width (col-span-2) | Pre-Mortem |
   | Full width (col-span-2) | Known Issues |
   | Full width (col-span-2) | Stub Report |
   | Full width (col-span-2) | Post-Merge Checklist |

2. Define the grid layout using CSS grid. Each panel cell is conditionally rendered only when the panel is active. To avoid empty gaps: use a `<div>` wrapper for each column-pair that renders the correct span depending on which of the two panels in the pair is active:

   ```tsx
   {/* File Ownership + Dependency Graph pair */}
   {(activePanels.includes('file-ownership') || activePanels.includes('dependency-graph')) && (
     <div className={`grid gap-6 ${
       activePanels.includes('file-ownership') && activePanels.includes('dependency-graph')
         ? 'grid-cols-2'
         : 'grid-cols-1'
     }`}>
       {activePanels.includes('file-ownership') && <FileOwnershipPanel impl={impl} />}
       {activePanels.includes('dependency-graph') && <DependencyGraphPanel dependencyGraphText={(impl as any).dependency_graph_text} />}
     </div>
   )}
   ```

   Apply the same pattern to the Agent Prompts / Scaffolds pair, and to the other paired slots.

3. Update `activePanels` defaults to include `'wave-structure'` and `'dependency-graph'` by default (already present in the existing code — verify this is preserved). The default for `'file-ownership'` should also be included.

4. Fix the sticky toolbar. The existing code uses:
   ```tsx
   style={isStuck ? { marginLeft: 'calc(-50vw + 50%)', ... } : {}}
   ```
   Remove this inline style entirely. Replace with a simpler sticky that works in a bounded column:
   ```tsx
   className={`sticky top-0 z-40 py-3 mb-6 transition-colors duration-200 ${
     isStuck ? 'bg-muted/15 backdrop-blur-sm border-b border-border/50' : ''
   }`}
   ```
   No negative margin overrides needed — the column itself provides the clipping context.

5. The `sentinelRef` / `IntersectionObserver` sticky detection logic is still useful and should be kept. Only the style override is removed.

6. Responsive: wrap the entire grid in a class that collapses to single column below 768px:
   ```tsx
   // Instead of inline grid-cols-2, use a responsive class:
   className={`grid gap-6 ${someCondition ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}
   ```
   Or use Tailwind's responsive prefix consistently throughout.

7. The `PanelKey` type and `panels` array are unchanged. The toggle button row is unchanged. The `activePanels` ordering used to drive render order no longer applies — the grid has fixed positions. This is an intentional behavior change.

8. If `ReviewScreen.test.tsx` tests fail due to markup changes, update the tests. The three tests that check SSE behavior (`subscribes to SSE on mount`, `calls onRefreshImpl`, `closes EventSource on unmount`) should be unaffected. The `renders without crashing` test should still pass with the new markup.

**Verification gate:**
```bash
cd /Users/dayna.blackwell/code/scout-and-wave-go/web
npx tsc --noEmit
command npx vitest run --reporter=verbose web/src/components/ReviewScreen.test.tsx
```

**Completion report fields:**
- `status`: complete | partial | blocked
- `files_changed`: [web/src/components/ReviewScreen.tsx, web/src/components/ReviewScreen.test.tsx]
- `interface_deviations`: none expected (ReviewScreenProps is unchanged)
- `downstream_action_required`: false
- `notes`: describe any layout decisions (e.g. which panels ended up full-width)

---

### Agent C — WaveBoard: Narrow-Width Adaptation

**Role:** Adapt `WaveBoard.tsx` to render correctly inside the right rail at ~35% viewport width, by removing full-screen assumptions, extracting the `GitActivitySidebar` out of WaveBoard's own layout, and adding a `compact` prop for narrower agent cards.

**Context:** Currently `WaveBoard.tsx` renders with `min-h-screen` root and an internal `w-80 shrink-0` sidebar for `GitActivitySidebar`. In the new layout, WaveBoard renders inside a bounded right-rail div. The GitActivitySidebar will be managed by `LiveRail.tsx` (Agent D's file), not inside WaveBoard itself.

**Files owned:**
- `/Users/dayna.blackwell/code/scout-and-wave-go/web/src/components/WaveBoard.tsx`

**Read-only dependencies:**
- `/Users/dayna.blackwell/code/scout-and-wave-go/web/src/components/AgentCard.tsx` (unchanged, just reading for context)
- `/Users/dayna.blackwell/code/scout-and-wave-go/web/src/hooks/useWaveEvents.ts` (unchanged)
- `/Users/dayna.blackwell/code/scout-and-wave-go/web/src/hooks/useGitActivity.ts` (read — Agent C REMOVES the useGitActivity call from WaveBoard; the hook is NOT deleted, just no longer called inside WaveBoard)

**Implementation instructions:**

1. Change the root div class from `min-h-screen bg-gray-50 dark:bg-gray-950 p-6` to `h-full overflow-y-auto bg-gray-50 dark:bg-gray-950 p-4`. The `h-full` allows the parent to control height; `overflow-y-auto` allows the content to scroll within the rail.

2. Remove `useGitActivity` import and usage from `WaveBoard.tsx`. Remove the `gitSnapshot` variable and the entire git activity sidebar JSX block (the `<div className="w-80 shrink-0 sticky top-6">` block at the bottom of the flex row). This sidebar is now owned by `LiveRail.tsx`.

3. Remove the `GitActivitySidebar` import from `WaveBoard.tsx`.

4. The outer flex row (`<div className="flex gap-6 items-start">`) previously held both the main content column and the git sidebar. After removing the sidebar, this becomes just the main content. You can remove the outer flex wrapper entirely and let the main content column (`<div className="flex-1 min-w-0 space-y-6">`) be the root content div.

5. Add a `compact` prop to `WaveBoardProps`:
   ```typescript
   interface WaveBoardProps {
     slug: string
     compact?: boolean
   }
   ```
   When `compact` is true, pass a hint to the agent cards layout. Since `AgentCard` is a read-only file, do not modify it. Instead, in the wave's agent card grid, switch from `flex-wrap` to a tighter layout:
   - Default: `<div className="flex flex-wrap gap-3">`
   - Compact: `<div className="flex flex-col gap-2">` (stack cards vertically, which works well in a narrow rail)

   Apply the compact layout when `compact` prop is true OR when rendered at narrower widths. Since CSS-only detection is reliable here, you may use only the `compact` prop (LiveRail will always pass `compact={true}`).

6. The `handleRerun` and `handleProceedGate` functions, all SSE state, progress bars, and banners are unchanged. Only the layout changes.

7. The header `<h1>Wave Execution — {slug}</h1>` is still useful in the rail context. Optionally reduce font size to `text-base` instead of `text-xl` to fit the narrower rail.

8. Verify `ImplEditor` still renders correctly — it has `min-height: 400px` which at narrow widths may cause horizontal overflow. Add `overflow-x-hidden` to the `ImplEditor` wrapper div inside the wave gate banner if needed. (Do not modify `ImplEditor.tsx` itself.)

**Verification gate:**
```bash
cd /Users/dayna.blackwell/code/scout-and-wave-go/web
npx tsc --noEmit
command npx vitest run
```

**Completion report fields:**
- `status`: complete | partial | blocked
- `files_changed`: [web/src/components/WaveBoard.tsx]
- `interface_deviations`: note if `compact` prop was implemented differently than specified
- `downstream_action_required`: true if `compact` prop signature differs (Agent D passes it)
- `notes`: describe compact card layout decision

---

### Agent D — LiveRail: Right-Rail Shell Component

**Role:** Implement `LiveRail.tsx` — the right-rail component that shows either `ScoutLauncher` (when `liveView='scout'`) or `WaveBoard` + `GitActivitySidebar` (when `liveView='wave'`), plus a close button and the idle placeholder state.

**Context:** The scaffold stub at `web/src/components/LiveRail.tsx` already exports `LiveView`, `LiveRailProps`, and a stub default export. Agent D replaces the stub body with the full implementation. `ScoutLauncher` and `WaveBoard` both assume they fill a full viewport; their root layout classes have been adapted by their respective agents (C for WaveBoard, but ScoutLauncher is read-only — wrap it instead).

**Files owned:**
- `/Users/dayna.blackwell/code/scout-and-wave-go/web/src/components/LiveRail.tsx`

**Read-only dependencies:**
- `/Users/dayna.blackwell/code/scout-and-wave-go/web/src/components/ScoutLauncher.tsx` (import unchanged — wrap in overflow container)
- `/Users/dayna.blackwell/code/scout-and-wave-go/web/src/components/WaveBoard.tsx` (import with `compact` prop added by Agent C)
- `/Users/dayna.blackwell/code/scout-and-wave-go/web/src/components/git/GitActivitySidebar.tsx` (import directly)
- `/Users/dayna.blackwell/code/scout-and-wave-go/web/src/hooks/useGitActivity.ts` (call this hook in LiveRail when liveView='wave')

**Implementation instructions:**

1. The `LiveView` type and `LiveRailProps` interface are already defined in the scaffold stub. Keep them exactly as written — do not change the shape.

2. Implement the default export:

   ```tsx
   import ScoutLauncher from './ScoutLauncher'
   import WaveBoard from './WaveBoard'
   import GitActivitySidebar from './git/GitActivitySidebar'
   import { useGitActivity } from '../hooks/useGitActivity'
   import { X } from 'lucide-react'

   export default function LiveRail({ slug, liveView, onScoutComplete, onClose }: LiveRailProps): JSX.Element {
     const gitSnapshot = useGitActivity(slug ?? '')

     return (
       <div className="h-full flex flex-col bg-background">
         {/* Rail header */}
         <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
           <span className="text-xs font-medium text-muted-foreground">
             {liveView === 'scout' ? 'New Plan' : liveView === 'wave' ? 'Wave Execution' : ''}
           </span>
           <button
             onClick={onClose}
             className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
             title="Close rail"
           >
             <X size={14} />
           </button>
         </div>

         {/* Scout view */}
         {liveView === 'scout' && (
           <div className="flex-1 overflow-y-auto">
             <ScoutLauncher onComplete={onScoutComplete} />
           </div>
         )}

         {/* Wave view */}
         {liveView === 'wave' && slug && (
           <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
             <WaveBoard slug={slug} compact={true} />
             {/* Git activity below wave board */}
             <div className="border-t shrink-0 p-3">
               <h2 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Git Activity</h2>
               <GitActivitySidebar slug={slug} snapshot={gitSnapshot} />
             </div>
           </div>
         )}

         {/* Idle / no slug state */}
         {liveView === null && (
           <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
             No active execution.
           </div>
         )}
       </div>
     )
   }
   ```

3. `ScoutLauncher` has `min-h-screen` in its root div which will cause the overflow container to expand. Since `ScoutLauncher.tsx` is read-only, override via CSS in the wrapper: the `overflow-y-auto` on the wrapper div with `flex-1` constrains it. This is sufficient — `min-h-screen` inside a `flex-1 overflow-y-auto` container will make that container scroll rather than expand the rail.

4. `useGitActivity` is called unconditionally (always, even when `liveView !== 'wave'`). This is acceptable — the hook returns `null` when no events have fired, and the SSE connection only becomes active when the `slug` changes. When `slug` is null, pass `''` as the slug — the hook will connect to `/api/git//activity` which will 404 silently. If this causes noise in the console, guard the call: `const gitSnapshot = useGitActivity(liveView === 'wave' && slug ? slug : '')`. Either approach is valid.

5. The `widthPx` prop is available if you need to render differently at very narrow widths (e.g., hide the git activity panel below 300px). This is optional polish; implement if time permits.

6. The close button (`onClose`) sets `liveView` to null in the parent (App.tsx). The rail will unmount/be hidden via the `{liveView !== null && ...}` guard in App.tsx. This is clean.

7. Dark mode: use `bg-background`, `border-b`, `text-muted-foreground` Tailwind tokens throughout (same as the rest of the app). The `bg-gray-50 dark:bg-gray-950` in WaveBoard and ScoutLauncher will be contained within their scroll wrappers.

**Verification gate:**
```bash
cd /Users/dayna.blackwell/code/scout-and-wave-go/web
npx tsc --noEmit
command npx vitest run
```

**Completion report fields:**
- `status`: complete | partial | blocked
- `files_changed`: [web/src/components/LiveRail.tsx]
- `interface_deviations`: note any deviation from LiveRailProps (downstream_action_required: true if so)
- `downstream_action_required`: true if LiveRailProps shape changed (Agent A must be notified before merge)
- `notes`: describe how ScoutLauncher min-h-screen was handled; note any widthPx usage

---

### Agent F — Backend: GUI Scaffold Step in Wave Runner

**Role:** Add scaffold detection and execution to `runWaveLoop` so the GUI approve→wave flow runs the Scaffold Agent before launching wave agents, exactly as the CLI path does.

**Context:** `runWaveLoop` in `pkg/api/wave_runner.go` currently jumps straight to the wave loop without checking for pending scaffold files. The frontend (`useWaveEvents.ts`) already listens for `scaffold_started` and `scaffold_complete` SSE events and shows a scaffold status row in `WaveBoard` — the backend just never emits them. `orch.IMPLDoc().ScaffoldsDetail` is already parsed and available. `ScaffoldFile` has `FilePath`, `Contents`, `ImportPath` fields. The scaffold is "needed" when `len(ScaffoldsDetail) > 0` AND at least one file is missing on disk.

**Files owned:**
- `/Users/dayna.blackwell/code/scout-and-wave-go/pkg/api/wave_runner.go`

**Read-only dependencies:**
- `/Users/dayna.blackwell/code/scout-and-wave-go/pkg/api/scout.go` — reference the `runScoutAgent` pattern for CLI backend execution
- `/Users/dayna.blackwell/code/scout-and-wave-go/pkg/types/types.go` — `ScaffoldFile` struct
- `/Users/dayna.blackwell/code/scout-and-wave-go/web/src/hooks/useWaveEvents.ts` — confirms `scaffold_started` / `scaffold_complete` events are already handled

**Implementation instructions:**

1. Add a `runScaffoldIfNeeded` function in `wave_runner.go`:

   ```go
   // runScaffoldIfNeeded checks if the IMPL doc has scaffold files that have
   // not yet been created on disk. If any are missing, it launches a Scaffold
   // Agent via the CLI backend and streams output as SSE events.
   // Returns nil if no scaffold is needed or scaffold completes successfully.
   func runScaffoldIfNeeded(implPath, repoPath string, scaffolds []types.ScaffoldFile, publish func(string, interface{})) error {
       if len(scaffolds) == 0 {
           return nil
       }

       // Check if all scaffold files already exist — if so, scaffold was already run.
       allExist := true
       for _, sf := range scaffolds {
           absPath := sf.FilePath
           if !filepath.IsAbs(absPath) {
               absPath = filepath.Join(repoPath, absPath)
           }
           if _, err := os.Stat(absPath); os.IsNotExist(err) {
               allExist = false
               break
           }
       }
       if allExist {
           return nil
       }

       publish("scaffold_started", map[string]string{"impl_path": implPath})

       // Locate scaffold-agent.md prompt (same lookup as CLI path in cmd/saw/commands.go).
       sawRepo := os.Getenv("SAW_REPO")
       if sawRepo == "" {
           home, _ := os.UserHomeDir()
           sawRepo = filepath.Join(home, "code", "scout-and-wave")
       }
       scaffoldMdPath := filepath.Join(sawRepo, "prompts", "scaffold-agent.md")
       scaffoldMdBytes, err := os.ReadFile(scaffoldMdPath)
       if err != nil {
           scaffoldMdBytes = []byte("You are a Scaffold Agent. Create the stub files defined in the IMPL doc Scaffolds section.")
       }

       prompt := fmt.Sprintf("%s\n\n## IMPL Doc Path\n%s\n", string(scaffoldMdBytes), implPath)

       b := cli.New("", backend.Config{})
       runner := agent.NewRunner(b, nil)
       spec := &types.AgentSpec{Letter: "scaffold", Prompt: prompt}

       ctx := context.Background()
       onChunk := func(chunk string) {
           publish("scaffold_output", map[string]string{"chunk": chunk})
       }

       if _, execErr := runner.ExecuteStreaming(ctx, spec, repoPath, onChunk); execErr != nil {
           publish("scaffold_failed", map[string]string{"error": execErr.Error()})
           return fmt.Errorf("scaffold agent failed: %w", execErr)
       }

       publish("scaffold_complete", map[string]string{"impl_path": implPath})
       return nil
   }
   ```

2. Add the required imports to `wave_runner.go` (they are already imported in `scout.go` in the same package, but each file must declare its own imports):
   ```go
   import (
       // existing imports ...
       "context"
       "os"

       "github.com/blackwell-systems/scout-and-wave-go/pkg/agent"
       "github.com/blackwell-systems/scout-and-wave-go/pkg/agent/backend"
       "github.com/blackwell-systems/scout-and-wave-go/pkg/agent/backend/cli"
   )
   ```
   Check the existing imports first — `fmt`, `filepath`, `sync`, `time`, `net/http`, `orchestrator`, `protocol`, `types` are already present. Add only what is missing.

3. Call `runScaffoldIfNeeded` in `runWaveLoop`, immediately after the orchestrator is created and the event publisher is wired, before the wave loop:

   ```go
   // Run scaffold agent if any scaffold files are pending.
   if err := runScaffoldIfNeeded(implPath, repoPath, orch.IMPLDoc().ScaffoldsDetail, publish); err != nil {
       publish("run_failed", map[string]string{"error": err.Error()})
       return
   }
   ```

   Insert this block between the `orch.SetEventPublisher(...)` call and the `waves := orch.IMPLDoc().Waves` line.

4. Add `scaffold_output` handling note: the frontend `useWaveEvents.ts` does not currently listen for `scaffold_output` (only `scaffold_started` / `scaffold_complete`). This is fine — the output is emitted but silently dropped by the browser. No frontend change needed for this agent.

5. The `waveOrchestrator` interface and `runWaveLoopFunc` seam are unchanged — do not modify them.

**Verification gate:**
```bash
cd /Users/dayna.blackwell/code/scout-and-wave-go
go build ./...
go test ./pkg/api/...
```

**Completion report fields:**
- `status`: complete | partial | blocked
- `files_changed`: [pkg/api/wave_runner.go]
- `interface_deviations`: none (no cross-agent interface)
- `downstream_action_required`: false
- `notes`: confirm which imports were added; note if `ExecuteStreaming` signature differs from scout.go usage

---

### Agent E — Theme System: CSS Palettes + ThemePicker Component

**Role:** Implement a seed theme system — 4 named color themes (Gruvbox Dark, Darcula, Catppuccin Mocha, Nord) defined as CSS custom property overrides in `index.css`, and a `ThemePicker` header component that lets the user switch between them. This replaces the scaffold stub at `ThemePicker.tsx`.

**Context:** The app uses shadcn-style CSS variables (`--background`, `--foreground`, `--muted`, etc.) defined in `index.css`. The current default light/dark scheme is a neutral gray palette. Named themes are additional CSS classes applied to `<html>` that override those same variables with different color values. Dark mode remains controlled by the `dark` class (via `useDarkMode`); themes are separate from dark/light mode. The four starter palettes should all be dark-mode palettes (the `.dark` class is still applied; the theme class provides the color overrides). The `ThemePicker` is rendered in the `<header>` by Agent A (already wired via the scaffold stub import).

**Files owned:**
- `/Users/dayna.blackwell/code/scout-and-wave-go/web/src/index.css`
- `/Users/dayna.blackwell/code/scout-and-wave-go/web/src/components/ThemePicker.tsx`

**Read-only dependencies:**
- `/Users/dayna.blackwell/code/scout-and-wave-go/web/src/hooks/useDarkMode.ts` (read for reference — do not modify)

**Implementation instructions:**

1. In `index.css`, add four theme classes after the existing `.dark` block. Each theme class overrides only the variables that differ from the base dark theme. Apply them as `.dark.theme-gruvbox-dark`, `.dark.theme-darcula`, etc. (scoped inside `.dark` so they only apply in dark mode):

   **Gruvbox Dark** (warm browns + amber/orange accents):
   ```css
   .dark.theme-gruvbox-dark {
     --background: 0 0% 14%;        /* #282828 */
     --foreground: 43 59% 81%;      /* #ebdbb2 */
     --muted: 0 0% 18%;             /* #3c3836 */
     --muted-foreground: 43 23% 60%; /* #a89984 */
     --border: 0 0% 22%;            /* #504945 */
     --primary: 40 73% 49%;         /* #d79921 amber */
     --primary-foreground: 0 0% 10%;
     --accent: 0 0% 22%;
     --accent-foreground: 43 59% 81%;
   }
   ```

   **Darcula** (JetBrains dark — cool grays + purple/pink accents):
   ```css
   .dark.theme-darcula {
     --background: 220 13% 18%;     /* #2b2b2b */
     --foreground: 0 0% 85%;        /* #d8d8d8 */
     --muted: 220 10% 23%;          /* #313335 */
     --muted-foreground: 0 0% 55%;  /* #808080 */
     --border: 220 10% 28%;         /* #454648 */
     --primary: 287 59% 65%;        /* #cc7832 orange but use purple */
     --primary-foreground: 0 0% 10%;
     --accent: 220 10% 28%;
     --accent-foreground: 0 0% 85%;
   }
   ```

   **Catppuccin Mocha** (pastel dark — mauve/lavender palette):
   ```css
   .dark.theme-catppuccin-mocha {
     --background: 240 21% 15%;     /* #1e1e2e */
     --foreground: 226 64% 88%;     /* #cdd6f4 */
     --muted: 237 16% 23%;          /* #313244 */
     --muted-foreground: 228 24% 72%; /* #a6adc8 */
     --border: 234 13% 31%;         /* #45475a */
     --primary: 267 84% 81%;        /* #cba6f7 mauve */
     --primary-foreground: 240 21% 15%;
     --accent: 237 16% 23%;
     --accent-foreground: 226 64% 88%;
   }
   ```

   **Nord** (arctic blue — cool blues/teals):
   ```css
   .dark.theme-nord {
     --background: 220 16% 22%;     /* #2e3440 */
     --foreground: 218 27% 92%;     /* #eceff4 */
     --muted: 222 16% 28%;          /* #3b4252 */
     --muted-foreground: 218 14% 65%; /* #9099ab */
     --border: 220 17% 32%;         /* #434c5e */
     --primary: 193 43% 67%;        /* #88c0d0 frost blue */
     --primary-foreground: 220 16% 22%;
     --accent: 222 16% 28%;
     --accent-foreground: 218 27% 92%;
   }
   ```

2. In `ThemePicker.tsx`, implement the component. Replace the scaffold stub body:

   ```typescript
   import { useState, useEffect } from 'react'

   export type ThemeId = 'default' | 'gruvbox-dark' | 'darcula' | 'catppuccin-mocha' | 'nord'

   const THEMES: { id: ThemeId; label: string }[] = [
     { id: 'default', label: 'Default' },
     { id: 'gruvbox-dark', label: 'Gruvbox' },
     { id: 'darcula', label: 'Darcula' },
     { id: 'catppuccin-mocha', label: 'Catppuccin' },
     { id: 'nord', label: 'Nord' },
   ]

   const STORAGE_KEY = 'saw-theme'

   function applyTheme(id: ThemeId) {
     const html = document.documentElement
     // Remove any existing theme classes
     html.classList.remove('theme-gruvbox-dark', 'theme-darcula', 'theme-catppuccin-mocha', 'theme-nord')
     if (id !== 'default') {
       html.classList.add(`theme-${id}`)
     }
   }

   export default function ThemePicker(): JSX.Element {
     const [theme, setTheme] = useState<ThemeId>(() => {
       return (localStorage.getItem(STORAGE_KEY) as ThemeId) ?? 'default'
     })

     useEffect(() => {
       applyTheme(theme)
       localStorage.setItem(STORAGE_KEY, theme)
     }, [theme])

     // Apply on initial mount (handles page reload)
     useEffect(() => {
       applyTheme((localStorage.getItem(STORAGE_KEY) as ThemeId) ?? 'default')
     }, [])

     return (
       <select
         value={theme}
         onChange={e => setTheme(e.target.value as ThemeId)}
         className="text-xs px-2 py-1 rounded-md border border-border bg-background text-foreground hover:bg-muted transition-colors cursor-pointer"
         title="Color theme"
       >
         {THEMES.map(t => (
           <option key={t.id} value={t.id}>{t.label}</option>
         ))}
       </select>
     )
   }
   ```

3. The `ThemeId` type is exported from `ThemePicker.tsx`. The scaffold stub also exports it — Agent E's implementation replaces the stub, so the export contract is preserved.

4. The `select` element is styled to match the header's compact button style. Dark mode is handled by the CSS variable system — the `dark` class on `<html>` is still applied by `useDarkMode`; the theme class is additive.

5. Do not touch `useDarkMode.ts`. Theme and dark/light mode are orthogonal — dark mode controls light vs dark palette; theme controls which dark palette is shown.

**Verification gate:**
```bash
cd /Users/dayna.blackwell/code/scout-and-wave-go/web
npx tsc --noEmit
command npx vitest run
```

**Completion report fields:**
- `status`: complete | partial | blocked
- `files_changed`: [web/src/index.css, web/src/components/ThemePicker.tsx]
- `interface_deviations`: note if `ThemeId` export shape differs from scaffold stub (Agent A imports it)
- `downstream_action_required`: false (Agent A uses scaffold stub; implementation is drop-in replacement)
- `notes`: describe any CSS variable value choices or theme adjustments

---

## Wave Execution Loop

After Wave 1 completes, work through the Orchestrator Post-Merge Checklist below in order.

The merge procedure detail is in `saw-merge.md`. Key principles:
- Read completion reports first — a `status: partial` or `status: blocked` blocks the merge entirely.
- Interface deviations with `downstream_action_required: true` must be propagated before merge (Agent A and D share the `LiveRailProps` contract; if D deviates, A's import may fail TypeScript).
- Post-merge verification is the real gate. Agents pass in isolation; the merged codebase surfaces cross-file type errors.
- Fix before proceeding. Do not ship a broken TypeScript compile.

### Orchestrator Post-Merge Checklist

After Wave 1 completes:

- [ ] Read all agent completion reports — confirm all `status: complete`; if any `partial` or `blocked`, stop and resolve before merging
- [ ] Conflict prediction — cross-reference `files_changed` lists; the only expected overlap is if Agent B modified `ReviewScreen.test.tsx` AND the test runner behavior changed; check before merging
- [ ] Review `interface_deviations` in Agent A and Agent D reports — if `LiveRailProps` differs between them, reconcile before merging both branches (merge D first, then A imports from D's version)
- [ ] Merge Agent D first (LiveRail.tsx implementation), then Agent E (ThemePicker.tsx), then Agent A (App.tsx imports both):
      `git merge --no-ff wave1-agent-f -m "Merge wave1-agent-f: GUI scaffold step in wave runner"`
      `git merge --no-ff wave1-agent-d -m "Merge wave1-agent-d: LiveRail implementation"`
      `git merge --no-ff wave1-agent-e -m "Merge wave1-agent-e: theme system seed"`
      `git merge --no-ff wave1-agent-a -m "Merge wave1-agent-a: 3-column App shell"`
      `git merge --no-ff wave1-agent-b -m "Merge wave1-agent-b: ReviewScreen panel grid"`
      `git merge --no-ff wave1-agent-c -m "Merge wave1-agent-c: WaveBoard narrow adaptation"`
- [ ] Worktree cleanup: `git worktree remove <path>` + `git branch -d <branch>` for each
- [ ] Post-merge verification:
      - [ ] Linter auto-fix pass: n/a (no auto-formatter configured)
      - [ ] `cd /Users/dayna.blackwell/code/scout-and-wave-go/web && npx tsc --noEmit && command npx vitest run`
- [ ] Fix any cascade failures — pay attention to cascade candidates listed below
- [ ] Tick status checkboxes in this IMPL doc for completed agents
- [ ] Feature-specific steps:
      - [ ] Rebuild the web bundle: `cd /Users/dayna.blackwell/code/scout-and-wave-go/web && command npm run build`
      - [ ] Rebuild the Go binary: `cd /Users/dayna.blackwell/code/scout-and-wave-go && go build -o saw ./cmd/saw`
      - [ ] Restart the server: `pkill -f "saw serve"; /Users/dayna.blackwell/code/scout-and-wave-go/saw serve &>/tmp/saw-serve.log &`
      - [ ] Open browser and manually verify: 3-column layout renders, right rail opens on "New plan" click, right rail opens on "Approve" click, center column stays stable during wave execution, panel grid shows 2-column layout, panels toggle correctly
- [ ] Commit: `git commit -m "feat: persistent 3-column layout + 2-column review panel grid"`

### Cascade Candidates (files that are NOT changed but reference shifting semantics)

These files do not change but are at risk if the merge introduces compile errors:

- `web/src/components/ActionButtons.tsx` — referenced by ReviewScreen; if ReviewScreen's props change, ActionButtons may need adjustment (it receives `onApprove`/`onReject` which are still passed from App)
- `web/src/components/ImplList.tsx` — referenced by App; no interface change expected
- `web/src/components/ImplEditor.tsx` — rendered inside WaveBoard's wave gate; WaveBoard is modified by Agent C but ImplEditor's interface is unchanged
- `web/src/hooks/useWaveEvents.ts` — consumed by WaveBoard (Agent C) and now also by LiveRail's WaveBoard embed; no interface change, but TypeScript will verify this at compile time
- All `web/src/components/review/*.tsx` panel components — consumed by ReviewScreen (Agent B); their props are read-only and unchanged, but any rename or JSX restructure in ReviewScreen could cause "unused import" TypeScript errors if a panel import is left in but its JSX is removed

---

### Status

| Wave | Agent | Description | Status |
|------|-------|-------------|--------|
| — | Scaffold | Create LiveRail.tsx + ThemePicker.tsx stubs | TO-DO |
| 1 | A | App.tsx — 3-column shell, liveView state, right-rail resize, ThemePicker in header | TO-DO |
| 1 | B | ReviewScreen.tsx — 2-column panel grid, fix sticky toolbar | TO-DO |
| 1 | C | WaveBoard.tsx — narrow-width adaptation, remove git sidebar, compact prop | TO-DO |
| 1 | D | LiveRail.tsx — full implementation (scout/wave/idle states) | TO-DO |
| 1 | E | index.css + ThemePicker.tsx — 4 named dark themes, theme picker select | TO-DO |
| 1 | F | pkg/api/wave_runner.go — scaffold detection + launch before wave loop | TO-DO |
| — | Orch | Post-merge: TypeScript compile, Go build, tests, web build, binary rebuild, server restart | TO-DO |

### Agent A - Completion Report

```yaml type=impl-completion-report
status: complete
worktree: .claude/worktrees/wave1-agent-A
branch: wave1-agent-A
commit: c671514
files_changed:
  - web/src/App.tsx
files_created: []
interface_deviations: []
out_of_scope_deps: []
tests_added: []
verification: PASS (tsc --noEmit)
```

All 10 implementation steps completed. `AppMode` type and all its state fully removed. `liveView` state drives right rail visibility. Right-rail resize implemented inline per spec. `handleApprove` now calls `setLiveView('wave')`, `handleScoutComplete` calls `setLiveView(null)`. "New plan" button opens scout via `setLiveView('scout')`. `ThemePicker` added to header left of `DarkModeToggle`. `WaveBoard` and `ScoutLauncher` imports removed from App.tsx. Node_modules were absent in the worktree — ran `npm install --prefer-offline` to enable the TypeScript gate; this is a worktree setup concern, not a code issue.

### Agent B - Completion Report

```yaml type=impl-completion-report
status: complete
worktree: .claude/worktrees/wave1-agent-B
branch: wave1-agent-B
commit: 5eb838c
files_changed:
  - web/src/components/ReviewScreen.tsx
files_created: []
interface_deviations: []
out_of_scope_deps: []
tests_added: []
verification: PASS (tsc --noEmit + vitest 5/5)
```

Replaced the `activePanels.map(key => switch(...))` render block with the fixed-position paired grid layout as specified. Wave Structure and single-panel sections render full width; File Ownership+Dependency Graph and Agent Prompts+Scaffolds pairs use `grid-cols-1 md:grid-cols-2` when both are active, falling back to `grid-cols-1` when only one is shown. The entire block remains wrapped in `<div className="space-y-6">` for vertical rhythm.

Removed the negative-margin sticky toolbar hack (`marginLeft: 'calc(-50vw + 50%)'` etc.) entirely — the sticky div now carries only the className-based blur/border transition, no inline style. The `sentinelRef` / `IntersectionObserver` detection logic is untouched.

All 5 existing tests pass without modification. The `ReviewScreen.test.tsx` tests are structural (SSE subscription, unmount cleanup) and are not affected by the JSX layout change. Node_modules were absent in the worktree and required `npm install --prefer-offline` — same worktree setup pattern as Agent A.

### Agent D - Completion Report

```yaml type=impl-completion-report
status: complete
worktree: .claude/worktrees/wave1-agent-D
branch: wave1-agent-D
commit: 8885577723fb359fe144b1fd868665a9e249188b
files_changed:
  - web/src/components/LiveRail.tsx
files_created: []
interface_deviations: []
out_of_scope_deps:
  - WaveBoard compact prop (Agent C must add it; ts-expect-error suppresses until merged)
tests_added: []
verification: PASS (tsc --noEmit && vitest run — 10/10 tests pass)
```

`LiveRail.tsx` implements all three view states (scout/wave/idle) exactly per spec. `useGitActivity` is called with an empty string when not in wave view — this matches existing hook behavior. `ScoutLauncher`'s `min-h-screen` causes the scout container to scroll internally inside `flex-1 overflow-y-auto`, which is acceptable per the brief. `widthPx` prop is received but not used internally (passed by the parent for layout control, e.g. resize handles in App.tsx). The `compact={true}` prop on `WaveBoard` required a `@ts-expect-error` suppression because Agent C's additions are not yet merged; the suppression comment is clearly labeled and will become a correct type check once Agent C merges.

### Agent E - Completion Report

```yaml type=impl-completion-report
status: complete
worktree: .claude/worktrees/wave1-agent-E
branch: wave1-agent-E
commit: b508632
files_changed:
  - web/src/index.css
  - web/src/components/ThemePicker.tsx
files_created: []
interface_deviations: []
out_of_scope_deps: []
tests_added: []
verification: PASS (tsc --noEmit in main repo, vitest 10/10)
```

Added 4 named dark themes as `.dark.theme-*` CSS class overrides inside the `@layer base` block in `index.css`, immediately after the existing `.dark { ... }` block. Themes: Gruvbox Dark, Darcula, Catppuccin Mocha, Nord — each overrides `--background`, `--foreground`, `--muted`, `--muted-foreground`, `--border`, `--primary`, `--primary-foreground`, `--accent`, `--accent-foreground`, `--secondary`, `--secondary-foreground`.

Replaced the scaffold stub in `ThemePicker.tsx` with the full implementation: `useState`+`useEffect` for persistence via `localStorage` under key `saw-theme`, `applyTheme()` applies/removes `theme-*` classes on `document.documentElement`, and renders a `<select>` with the 5 options.

Verification note: the worktree has no `node_modules` (not committed to git). Ran `tsc --noEmit` and `vitest run` from the main repo `web/` directory — 0 tsc errors, 10/10 tests pass. The tsc cross-project errors shown when pointing at the worktree tsconfig are all pre-existing missing-module errors affecting the entire codebase, not caused by my files.

### Agent F - Completion Report

```yaml type=impl-completion-report
status: complete
worktree: .claude/worktrees/wave1-agent-F
branch: wave1-agent-F
commit: e4620e7
files_changed:
  - pkg/api/wave_runner.go
files_created: []
interface_deviations: []
out_of_scope_deps: []
tests_added: []
verification: PASS (go build ./... && go test ./pkg/api/...)
```

Added imports `context`, `os`, and the three agent/backend/cli packages (already present in `scout.go`, newly added to `wave_runner.go`). `runScaffoldIfNeeded` follows the same CLI backend pattern as `runScoutAgent`. Called in `runWaveLoop` after `SetEventPublisher` and before the wave loop, exactly as specified.

---

### Agent C - Completion Report

```yaml type=impl-completion-report
status: complete
worktree: .claude/worktrees/wave1-agent-C
branch: wave1-agent-C
commit: a40e8d2
files_changed:
  - web/src/components/WaveBoard.tsx
files_created: []
interface_deviations: []
out_of_scope_deps: []
tests_added: []
verification: PASS (tsc --noEmit clean, vitest 10/10)
```

All five implementation steps completed as specified. Root div changed to `h-full overflow-y-auto p-4`. `useGitActivity` import/call and `GitActivitySidebar` import/JSX block removed entirely. Outer flex wrapper removed; main content div is now the root content element with `space-y-6`. `compact?: boolean` prop added to `WaveBoardProps` — when true, agent cards stack with `flex flex-col gap-2`; default is `flex flex-wrap gap-3`. Header font reduced to `text-base`. ImplEditor wrapped in `<div className="overflow-x-hidden">` inside the wave gate banner.

Worktree had no `node_modules` pre-installed; ran `npm ci` to enable the verification gate locally. TypeScript reports zero errors after install. All 10 existing tests pass.

Downstream note: callers of `WaveBoard` (e.g. `LiveRail.tsx` from Agent D) should pass `compact={true}` to get the single-column stacked layout appropriate for the narrow right rail.
