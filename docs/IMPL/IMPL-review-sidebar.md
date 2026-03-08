# IMPL: review-sidebar
<!-- SAW:COMPLETE 2026-03-07 -->

### Suitability Assessment

Verdict: SUITABLE

test_command: `cd /Users/dayna.blackwell/code/scout-and-wave-go && go build ./... && go vet ./... && go test ./... && cd web && npm run build`

lint_command: `go vet ./...`

The work decomposes into 4 independent agents working on disjoint files:
- Agent A: parser extensions for 5 new sections (Known Issues, Scaffolds detail, Interface Contracts, Dependency Graph, Post-Merge Checklist)
- Agent B: Go API layer to expose new parser data via IMPLDocResponse
- Agent C: TypeScript type definitions and API client
- Agent D: ReviewScreen sidebar + content panel components using shadcn/ui

File ownership is clean: Agent A owns `parser.go`, Agent B owns API types/handlers, Agent C owns `types.ts` and `api.ts`, Agent D owns `ReviewScreen.tsx` and creates 9 new panel component files.

**Shadcn/ui context:** The web UI has been migrated to shadcn/ui (commit 4514d4d). Available components: Table, Badge, Button, Card. Agent D will install and use shadcn Tabs for sidebar navigation, reducing custom component code significantly.

Pre-implementation scan results:
- Total items: 9 menu sections
- Already implemented: 3 sections (Overview/suitability, File Ownership table, Wave Structure diagram) — UI displays these but needs layout refactor
- Partially implemented: 1 section (Agent Prompts — data exists in parser but not exposed via API)
- To-do: 5 sections (Interface Contracts, Scaffolds detail, Dependency Graph, Known Issues, Post-Merge Checklist)

Agent adjustments:
- Agent D revised to leverage shadcn Tabs component for sidebar navigation instead of custom sidebar implementation
- Panel components simplified to use shadcn Card for consistent layout
- All other agents proceed as planned

Estimated times:
- Scout phase: ~8 min (parser/API/UI analysis, IMPL doc)
- Agent execution: ~22 min (4 agents × ~5.5 min avg, full parallelism in Wave 1; Agent D faster due to shadcn)
- Merge & verification: ~4 min
Total SAW time: ~34 min

Sequential baseline: ~44 min (4 agents × 11 min sequential)
Time savings: ~10 min (23% faster)

Recommendation: Clear speedup. The parser, API layer, type definitions, and UI can all be developed in parallel with zero dependencies. Shadcn/ui reduces Agent D complexity. Proceed.

---

### Scaffolds

No scaffolds needed — agents have independent type ownership. Agent A creates Go parser types in `pkg/protocol/parser.go`, Agent B creates API types in `pkg/api/types.go`, Agent C creates TypeScript types in `web/src/types.ts`, and Agent D creates React components. No cross-agent type sharing.

---

### Known Issues

None identified. `go test ./...` passes cleanly. The ReviewScreen currently shows content vertically; the refactor to tabbed interface is additive (no removals).

---

### Dependency Graph

```
Wave 1 (4 parallel agents, no dependencies):

    [A] pkg/protocol/parser.go
         (adds 5 parse sections: Known Issues, Scaffolds detail,
          Interface Contracts, Dependency Graph, Post-Merge Checklist)

    [B] pkg/api/types.go + pkg/api/impl.go
         (adds 6 API response fields: known_issues, scaffolds_detail,
          interface_contracts_text, dependency_graph_text,
          post_merge_checklist_text, agent_prompts; last one extracted from
          existing Waves[].Agents[].Prompt)

    [C] web/src/types.ts + web/src/api.ts
         (adds 6 TypeScript types matching API fields)

    [D] web/src/components/ReviewScreen.tsx + 9 new panel component files
         (installs shadcn Tabs, refactors to tabbed interface, creates 9 panels)
```

Roots: All 4 agents are roots (no dependencies on each other).

Leaf nodes: All 4 agents are leaves (no downstream dependencies).

Cascade candidates (files that reference changed interfaces but are NOT in any agent's scope):
- None identified. The API change is additive (new fields), and the UI refactor is isolated to ReviewScreen and its children.

---

### Interface Contracts

#### Parser output (Agent A, internal to `pkg/protocol/parser.go`)

Agent A extends `types.IMPLDoc` struct in `pkg/types/types.go`:

```go
// In pkg/types/types.go (Agent A reads and understands, but does NOT modify)
type IMPLDoc struct {
    // ... existing fields ...
    KnownIssues          []KnownIssue
    ScaffoldsDetail      []ScaffoldFile
    InterfaceContractsText string
    DependencyGraphText    string
    PostMergeChecklistText string
}

type KnownIssue struct {
    Description string
    Status      string // "Pre-existing", "Fixed", etc.
    Workaround  string
}

type ScaffoldFile struct {
    FilePath    string
    Contents    string
    ImportPath  string
}
```

Agent A implements parser functions in `pkg/protocol/parser.go`:

```go
// parseKnownIssuesSection extracts "### Known Issues" section
func parseKnownIssuesSection(scanner *bufio.Scanner) []types.KnownIssue

// parseScaffoldsDetailSection extracts "### Scaffolds" table
func parseScaffoldsDetailSection(scanner *bufio.Scanner) []types.ScaffoldFile

// parseInterfaceContractsSection extracts "### Interface Contracts" markdown
func parseInterfaceContractsSection(scanner *bufio.Scanner) string

// parseDependencyGraphSection extracts "### Dependency Graph" markdown
func parseDependencyGraphSection(scanner *bufio.Scanner) string

// parsePostMergeChecklistSection extracts "### Orchestrator Post-Merge Checklist" markdown
func parsePostMergeChecklistSection(scanner *bufio.Scanner) string
```

These functions are called from `ParseIMPLDoc` when the appropriate `###` header is detected. The text sections (Interface Contracts, Dependency Graph, Post-Merge Checklist) are captured as raw markdown until the next `###` or `##` header.

#### API response (Agent B exposes via `pkg/api/types.go`)

Agent B adds fields to `IMPLDocResponse` in `pkg/api/types.go`:

```go
type IMPLDocResponse struct {
    // ... existing fields ...
    KnownIssues            []KnownIssueEntry       `json:"known_issues"`
    ScaffoldsDetail        []ScaffoldFileEntry     `json:"scaffolds_detail"`
    InterfaceContractsText string                  `json:"interface_contracts_text"`
    DependencyGraphText    string                  `json:"dependency_graph_text"`
    PostMergeChecklistText string                  `json:"post_merge_checklist_text"`
    AgentPrompts           []AgentPromptEntry      `json:"agent_prompts"`
}

type KnownIssueEntry struct {
    Description string `json:"description"`
    Status      string `json:"status"`
    Workaround  string `json:"workaround"`
}

type ScaffoldFileEntry struct {
    FilePath   string `json:"file_path"`
    Contents   string `json:"contents"`
    ImportPath string `json:"import_path"`
}

type AgentPromptEntry struct {
    Wave   int    `json:"wave"`
    Agent  string `json:"agent"`
    Prompt string `json:"prompt"`
}
```

Agent B updates `handleGetImpl` in `pkg/api/impl.go` to populate these fields from the parsed `types.IMPLDoc`.

#### TypeScript types (Agent C defines in `web/src/types.ts`)

Agent C adds to `web/src/types.ts`:

```typescript
export interface IMPLDocResponse {
  // ... existing fields ...
  known_issues: KnownIssueEntry[]
  scaffolds_detail: ScaffoldFileEntry[]
  interface_contracts_text: string
  dependency_graph_text: string
  post_merge_checklist_text: string
  agent_prompts: AgentPromptEntry[]
}

export interface KnownIssueEntry {
  description: string
  status: string
  workaround: string
}

export interface ScaffoldFileEntry {
  file_path: string
  contents: string
  import_path: string
}

export interface AgentPromptEntry {
  wave: number
  agent: string
  prompt: string
}
```

#### UI Components (Agent D creates in `web/src/components/ReviewScreen.tsx` and new files)

Agent D refactors `ReviewScreen` to use shadcn Tabs for navigation:

```tsx
// ReviewScreen.tsx (Agent D refactors)
interface ReviewScreenProps {
  slug: string
  impl: IMPLDocResponse
  onApprove: () => void
  onReject: () => void
}

// New layout using shadcn Tabs component:
// - Tabs with 9 items (Overview, File Ownership, Wave Structure, etc.)
// - Each tab shows corresponding panel component
// - Approve/Reject buttons fixed at bottom
```

Agent D creates 9 new panel component files (all use shadcn Card for consistent styling):

- `web/src/components/review/OverviewPanel.tsx` — verdict badge, stats, time estimates
- `web/src/components/review/FileOwnershipPanel.tsx` — wraps existing FileOwnershipTable
- `web/src/components/review/WaveStructurePanel.tsx` — wraps existing WaveStructureDiagram
- `web/src/components/review/AgentPromptsPanel.tsx` — expandable list per agent
- `web/src/components/review/InterfaceContractsPanel.tsx` — markdown code blocks
- `web/src/components/review/ScaffoldsPanel.tsx` — scaffold table (uses shadcn Table)
- `web/src/components/review/DependencyGraphPanel.tsx` — markdown text
- `web/src/components/review/KnownIssuesPanel.tsx` — list of issues (uses shadcn Badge)
- `web/src/components/review/PostMergeChecklistPanel.tsx` — markdown checklist

---

### File Ownership

| File | Agent | Wave | Action |
|------|-------|------|--------|
| `pkg/types/types.go` | A | 1 | modify |
| `pkg/protocol/parser.go` | A | 1 | modify |
| `pkg/protocol/parser_test.go` | A | 1 | modify |
| `pkg/api/types.go` | B | 1 | modify |
| `pkg/api/impl.go` | B | 1 | modify |
| `web/src/types.ts` | C | 1 | modify |
| `web/src/api.ts` | C | 1 | modify |
| `web/src/components/ReviewScreen.tsx` | D | 1 | modify |
| `web/src/components/review/OverviewPanel.tsx` | D | 1 | new |
| `web/src/components/review/FileOwnershipPanel.tsx` | D | 1 | new |
| `web/src/components/review/WaveStructurePanel.tsx` | D | 1 | new |
| `web/src/components/review/AgentPromptsPanel.tsx` | D | 1 | new |
| `web/src/components/review/InterfaceContractsPanel.tsx` | D | 1 | new |
| `web/src/components/review/ScaffoldsPanel.tsx` | D | 1 | new |
| `web/src/components/review/DependencyGraphPanel.tsx` | D | 1 | new |
| `web/src/components/review/KnownIssuesPanel.tsx` | D | 1 | new |
| `web/src/components/review/PostMergeChecklistPanel.tsx` | D | 1 | new |

---

### Wave Structure

```
Wave 1:  [A] [B] [C] [D]    <- 4 parallel agents (no dependencies)
         |   |   |   |
      parser API TS  UI (shadcn Tabs)
             types

(All agents complete, merge all 4, verify go build + npm build)
```

---

### Agent Prompts

#### Agent A — Parser Extensions

**Role & mission:**
You are Wave 1 Agent A. Your mission is to extend the IMPL doc parser in `pkg/protocol/parser.go` to extract 5 new sections: Known Issues, Scaffolds (detailed table), Interface Contracts, Dependency Graph, and Post-Merge Checklist. You also extend the `types.IMPLDoc` struct in `pkg/types/types.go` with fields to hold the parsed data.

**Owned files:**
- `pkg/types/types.go` (modify — add 5 new fields to IMPLDoc + 2 new types: KnownIssue, ScaffoldFile)
- `pkg/protocol/parser.go` (modify — add 5 parse functions + call them from ParseIMPLDoc state machine)
- `pkg/protocol/parser_test.go` (modify — add test cases for new sections)

Do NOT touch: `pkg/api/`, `web/`, `cmd/saw/`, `pkg/orchestrator/`, `pkg/agent/`.

**Interface contracts (binding):**

Add to `pkg/types/types.go`:

```go
type IMPLDoc struct {
    // ... existing fields ...
    KnownIssues            []KnownIssue
    ScaffoldsDetail        []ScaffoldFile
    InterfaceContractsText string
    DependencyGraphText    string
    PostMergeChecklistText string
}

type KnownIssue struct {
    Description string
    Status      string
    Workaround  string
}

type ScaffoldFile struct {
    FilePath   string
    Contents   string
    ImportPath string
}
```

In `pkg/protocol/parser.go`, add 5 parse functions:

```go
// parseKnownIssuesSection extracts "### Known Issues" as []types.KnownIssue.
// Format: bullet list or paragraphs. Parse heuristically.
func parseKnownIssuesSection(scanner *bufio.Scanner) []types.KnownIssue

// parseScaffoldsDetailSection extracts "### Scaffolds" table.
// Format: markdown table with columns: File | Contents | Import path | Status
func parseScaffoldsDetailSection(scanner *bufio.Scanner) []types.ScaffoldFile

// parseInterfaceContractsSection extracts "### Interface Contracts" as raw markdown.
// Capture everything until next ### or ## header.
func parseInterfaceContractsSection(scanner *bufio.Scanner) string

// parseDependencyGraphSection extracts "### Dependency Graph" as raw markdown.
func parseDependencyGraphSection(scanner *bufio.Scanner) string

// parsePostMergeChecklistSection extracts "### Orchestrator Post-Merge Checklist" as raw markdown.
func parsePostMergeChecklistSection(scanner *bufio.Scanner) string
```

Call these from `ParseIMPLDoc`'s state machine when the respective `###` headers are detected. For Known Issues and Scaffolds, parse structured data. For the other 3 sections, capture as raw markdown (preserve code fences, bullets, everything).

**Input/Output:**
- Input: Existing `ParseIMPLDoc` function in `pkg/protocol/parser.go`
- Output: Extended `ParseIMPLDoc` that populates 5 new fields in `types.IMPLDoc`

**Test requirements:**
- Add test cases in `parser_test.go` for each new section
- Use sample IMPL doc at `/Users/dayna.blackwell/code/scout-and-wave-go/docs/IMPL/IMPL-backend-interface.md` as reference for format

**Verification gate:**
```bash
cd /Users/dayna.blackwell/code/scout-and-wave-go
go build ./pkg/protocol/...
go vet ./pkg/protocol/...
go test ./pkg/protocol/... -v
```

**Out of scope:**
- API layer (Agent B)
- UI (Agent D)
- TypeScript types (Agent C)

**Success criteria:**
- `types.IMPLDoc` has 5 new fields
- `ParseIMPLDoc` populates all 5 fields when parsing IMPL-backend-interface.md
- Tests pass

---

#### Agent B — API Layer Extensions

**Role & mission:**
You are Wave 1 Agent B. Your mission is to extend the API response type `IMPLDocResponse` in `pkg/api/types.go` with 6 new fields (5 parser sections + agent_prompts extracted from existing data), and update `handleGetImpl` in `pkg/api/impl.go` to populate them from the parsed `types.IMPLDoc`.

**Owned files:**
- `pkg/api/types.go` (modify — add 6 fields to IMPLDocResponse + 3 new types: KnownIssueEntry, ScaffoldFileEntry, AgentPromptEntry)
- `pkg/api/impl.go` (modify — update handleGetImpl to map new parser fields + extract agent_prompts from doc.Waves)

Do NOT touch: `pkg/protocol/`, `web/`, `cmd/saw/`, `pkg/orchestrator/`, `pkg/agent/`.

**Interface contracts (binding):**

Add to `pkg/api/types.go`:

```go
type IMPLDocResponse struct {
    // ... existing fields ...
    KnownIssues            []KnownIssueEntry      `json:"known_issues"`
    ScaffoldsDetail        []ScaffoldFileEntry    `json:"scaffolds_detail"`
    InterfaceContractsText string                 `json:"interface_contracts_text"`
    DependencyGraphText    string                 `json:"dependency_graph_text"`
    PostMergeChecklistText string                 `json:"post_merge_checklist_text"`
    AgentPrompts           []AgentPromptEntry     `json:"agent_prompts"`
}

type KnownIssueEntry struct {
    Description string `json:"description"`
    Status      string `json:"status"`
    Workaround  string `json:"workaround"`
}

type ScaffoldFileEntry struct {
    FilePath   string `json:"file_path"`
    Contents   string `json:"contents"`
    ImportPath string `json:"import_path"`
}

type AgentPromptEntry struct {
    Wave   int    `json:"wave"`
    Agent  string `json:"agent"`
    Prompt string `json:"prompt"`
}
```

In `pkg/api/impl.go`, update `handleGetImpl` to:
- Map `doc.KnownIssues` → `resp.KnownIssues` (types.KnownIssue → KnownIssueEntry)
- Map `doc.ScaffoldsDetail` → `resp.ScaffoldsDetail` (types.ScaffoldFile → ScaffoldFileEntry)
- Copy `doc.InterfaceContractsText`, `doc.DependencyGraphText`, `doc.PostMergeChecklistText` as-is
- Extract `resp.AgentPrompts` from `doc.Waves[].Agents[]` (flatten to list of {wave, agent, prompt})

**Input/Output:**
- Input: Existing `handleGetImpl` function in `pkg/api/impl.go`, extended `types.IMPLDoc` from Agent A
- Output: Extended `IMPLDocResponse` with 6 new fields

**Dependencies:**
- Reads `types.IMPLDoc` fields added by Agent A (KnownIssues, ScaffoldsDetail, InterfaceContractsText, etc.)
- Agent B does NOT depend on Agent A completing — the fields exist in `types.IMPLDoc` (Agent A adds them), and Agent B writes mapping code that compiles independently

**Test requirements:**
- No new test file needed — manual verification via `curl http://localhost:8080/api/impl/backend-interface` after server start

**Verification gate:**
```bash
cd /Users/dayna.blackwell/code/scout-and-wave-go
go build ./pkg/api/...
go vet ./pkg/api/...
go test ./pkg/api/... -v
```

**Out of scope:**
- Parser logic (Agent A)
- TypeScript types (Agent C)
- UI (Agent D)

**Success criteria:**
- `IMPLDocResponse` has 6 new fields
- `handleGetImpl` populates all 6 fields from parsed `types.IMPLDoc`
- Go build passes

### Agent B - Completion Report

**Status:** partial

**Files changed:**
- pkg/api/types.go (modified, +29/-2 lines)
- pkg/api/impl.go (modified, +62/-8 lines)

**Interface deviations:**
None. All interface contracts implemented exactly as specified.

**Out of scope dependencies:**
None identified. All work was within the assigned file ownership scope.

**Verification:**
- [ ] Build passed: `go build ./pkg/api/...` — EXPECTED FAIL (types.KnownIssue, types.ScaffoldFile not yet defined by Agent A)
- [ ] Tests passed: `go test ./pkg/api/... -v` — Not applicable (no API tests exist)
- [x] Manual verification: Code review confirms all 6 fields added to IMPLDocResponse
- [x] Manual verification: All 3 new types (KnownIssueEntry, ScaffoldFileEntry, AgentPromptEntry) defined correctly
- [x] Manual verification: All mapper functions (mapKnownIssues, mapScaffoldsDetail, extractAgentPrompts) implemented
- [x] Manual verification: handleGetImpl updated to populate all 6 new fields

**Commits:**
- 9cfb54c: feat(api): extend IMPLDocResponse with 6 new parser fields

**Notes:**
Build failures are expected for parallel wave development. The code references `types.KnownIssue`, `types.ScaffoldFile`, and 5 new fields on `types.IMPLDoc` (KnownIssues, ScaffoldsDetail, InterfaceContractsText, DependencyGraphText, PostMergeChecklistText) which Agent A is adding in parallel. All mapping logic is correct and will compile successfully after Wave 1 merge when Agent A's types are available in pkg/types/types.go.

The implementation is complete and follows all interface contracts. Status is marked "partial" only because verification gate cannot pass until Agent A's work is merged.

---

#### Agent C — TypeScript Types and API Client

**Role & mission:**
You are Wave 1 Agent C. Your mission is to extend the TypeScript type definitions in `web/src/types.ts` to match the new API response fields added by Agent B, and ensure the `fetchImpl` function in `web/src/api.ts` correctly types the response.

**Owned files:**
- `web/src/types.ts` (modify — add 6 fields to IMPLDocResponse + 3 new interfaces: KnownIssueEntry, ScaffoldFileEntry, AgentPromptEntry)
- `web/src/api.ts` (read only — verify fetchImpl return type is IMPLDocResponse; no changes needed)

Do NOT touch: `pkg/`, `web/src/components/`, `web/src/App.tsx`.

**Interface contracts (binding):**

Add to `web/src/types.ts`:

```typescript
export interface IMPLDocResponse {
  // ... existing fields ...
  known_issues: KnownIssueEntry[]
  scaffolds_detail: ScaffoldFileEntry[]
  interface_contracts_text: string
  dependency_graph_text: string
  post_merge_checklist_text: string
  agent_prompts: AgentPromptEntry[]
}

export interface KnownIssueEntry {
  description: string
  status: string
  workaround: string
}

export interface ScaffoldFileEntry {
  file_path: string
  contents: string
  import_path: string
}

export interface AgentPromptEntry {
  wave: number
  agent: string
  prompt: string
}
```

**Input/Output:**
- Input: Existing `types.ts` with `IMPLDocResponse` interface
- Output: Extended `IMPLDocResponse` interface with 6 new fields matching Agent B's Go types

**Dependencies:**
- Mirrors Agent B's API types (Go → TypeScript field name conversion: snake_case)
- Agent C does NOT depend on Agent B completing — Agent C writes TypeScript types that will match the API once Agent B's code is merged

**Test requirements:**
- TypeScript compilation via `npm run build` is sufficient

**Verification gate:**
```bash
cd /Users/dayna.blackwell/code/scout-and-wave-go/web
npm run build
```

**Out of scope:**
- Go code (Agents A, B)
- React components (Agent D)

**Success criteria:**
- `IMPLDocResponse` has 6 new fields
- `npm run build` passes with no TypeScript errors

---

#### Agent D — ReviewScreen Tabbed Interface with shadcn/ui

**Role & mission:**
You are Wave 1 Agent D. Your mission is to refactor `ReviewScreen.tsx` to use shadcn Tabs for a tabbed navigation interface, and create 9 section panel components that display the data from the extended `IMPLDocResponse` type. Leverage shadcn/ui components (Card, Badge, Table, Button) for consistent styling.

**Owned files:**
- `web/src/components/ReviewScreen.tsx` (modify — refactor to use shadcn Tabs)
- `web/src/components/review/OverviewPanel.tsx` (create)
- `web/src/components/review/FileOwnershipPanel.tsx` (create)
- `web/src/components/review/WaveStructurePanel.tsx` (create)
- `web/src/components/review/AgentPromptsPanel.tsx` (create)
- `web/src/components/review/InterfaceContractsPanel.tsx` (create)
- `web/src/components/review/ScaffoldsPanel.tsx` (create)
- `web/src/components/review/DependencyGraphPanel.tsx` (create)
- `web/src/components/review/KnownIssuesPanel.tsx` (create)
- `web/src/components/review/PostMergeChecklistPanel.tsx` (create)

Do NOT touch: `web/src/types.ts`, `web/src/api.ts`, `pkg/`, other components outside `web/src/components/review/`.

**Shadcn/ui context:**
The web UI uses shadcn/ui. Available components: Table, Badge, Button, Card (already installed in `web/src/components/ui/`). You need to install the Tabs component first:

```bash
cd /Users/dayna.blackwell/code/scout-and-wave-go/web
npx shadcn@latest add tabs
```

This will create `web/src/components/ui/tabs.tsx` with Tabs, TabsList, TabsTrigger, TabsContent components.

**Interface contracts (binding):**

`ReviewScreen` layout using shadcn Tabs:
- Use shadcn `Tabs` component with 9 tabs (Overview, File Ownership, Wave Structure, Agent Prompts, Interface Contracts, Scaffolds, Dependency Graph, Known Issues, Post-Merge Checklist)
- Each `TabsContent` wraps the corresponding panel component
- Approve/Reject buttons remain fixed at bottom (outside Tabs, always visible)

Tab labels:
1. Overview
2. File Ownership
3. Wave Structure
4. Agent Prompts
5. Interface Contracts
6. Scaffolds
7. Dependency Graph
8. Known Issues
9. Post-Merge Checklist

Panel components (all wrapped in shadcn Card for consistent styling):

**OverviewPanel.tsx:**
- Shows `SuitabilityBadge` (existing component)
- Shows stats: X files, Y agents, Z waves
- Shows time estimates if available in suitability.rationale (parse heuristically or show full rationale)
- Use shadcn Card for container

**FileOwnershipPanel.tsx:**
- Wraps existing `FileOwnershipTable` component (import from `../FileOwnershipTable`)
- Pass `impl.file_ownership` and `impl.file_ownership_col4_name`
- Use shadcn Card for container

**WaveStructurePanel.tsx:**
- Wraps existing `WaveStructureDiagram` component (import from `../WaveStructureDiagram`)
- Pass `impl.waves` and `impl.scaffold`
- Use shadcn Card for container

**AgentPromptsPanel.tsx:**
- Renders `impl.agent_prompts` as expandable list
- Each agent prompt: agent letter + wave number as header, prompt text as collapsible body
- Use `<details>` / `<summary>` HTML elements or shadcn Collapsible if available
- Use shadcn Card for each prompt entry

**InterfaceContractsPanel.tsx:**
- Renders `impl.interface_contracts_text` as markdown
- Parse code fences (```go, ```typescript, etc.) and render with syntax highlighting or `<pre>` with mono font
- If empty, show "No interface contracts defined"
- Use shadcn Card for container

**ScaffoldsPanel.tsx:**
- Renders `impl.scaffolds_detail` as table using shadcn Table component
- Columns: File Path | Contents | Import Path
- If empty, show "No scaffolds needed"
- Use shadcn Card for container

**DependencyGraphPanel.tsx:**
- Renders `impl.dependency_graph_text` as markdown
- Preserve formatting (bullets, code fences, indentation)
- If empty, show "No dependency graph"
- Use shadcn Card for container

**KnownIssuesPanel.tsx:**
- Renders `impl.known_issues` as list
- Each issue: description, status badge (use shadcn Badge), workaround (if present)
- If empty, show "No known issues"
- Use shadcn Card for container

**PostMergeChecklistPanel.tsx:**
- Renders `impl.post_merge_checklist_text` as markdown
- Preserve checklist formatting (`- [ ]` bullets)
- If empty, show "No post-merge checklist"
- Use shadcn Card for container

**Input/Output:**
- Input: Existing `ReviewScreen.tsx`, extended `IMPLDocResponse` from Agent C
- Output: Refactored `ReviewScreen` with shadcn Tabs + 9 panel components

**Dependencies:**
- Reads `IMPLDocResponse` type extended by Agent C (known_issues, agent_prompts, etc.)
- Agent D does NOT depend on Agent C completing — Agent D writes components that access fields that will exist once Agent C's types are merged

**Test requirements:**
- Manual verification via browser after `npm run build` and `saw serve`

**Verification gate:**
```bash
cd /Users/dayna.blackwell/code/scout-and-wave-go/web
npx shadcn@latest add tabs  # Install Tabs component first
npm run build
```

**Out of scope:**
- Parser (Agent A)
- API layer (Agent B)
- TypeScript core types (Agent C)

**Success criteria:**
- shadcn Tabs installed and used in `ReviewScreen`
- 9 section panels created, all wrapped in shadcn Card
- All panels use shadcn components where appropriate (Table for ScaffoldsPanel, Badge for KnownIssuesPanel)
- `npm run build` passes
- UI renders correctly in browser (manual check)

---

### Wave Execution Loop

All agents complete, merge all 4 worktrees, verify `go build ./... && go vet ./... && go test ./...` and `cd web && npm run build` both pass. No inter-agent dependencies — this is a single-wave execution.

---

### Orchestrator Post-Merge Checklist

**After Wave 1 completes (A + B + C + D):**

- [ ] Read all 4 agent completion reports — confirm all `status: complete`
- [ ] Conflict prediction — cross-reference `files_changed` lists; expect no overlap (A: pkg/protocol/, B: pkg/api/, C: web/src/types.ts + api.ts, D: web/src/components/)
- [ ] Review `interface_deviations` — none expected (all interfaces are additive)
- [ ] Merge Agent A: `git merge --no-ff <branch> -m "Merge wave1-agent-A: parser extensions for 5 IMPL sections"`
- [ ] Merge Agent B: `git merge --no-ff <branch> -m "Merge wave1-agent-B: API layer extensions for IMPL sections"`
- [ ] Merge Agent C: `git merge --no-ff <branch> -m "Merge wave1-agent-C: TypeScript types for IMPL sections"`
- [ ] Merge Agent D: `git merge --no-ff <branch> -m "Merge wave1-agent-D: ReviewScreen tabbed interface with shadcn Tabs"`
- [ ] Worktree cleanup: `git worktree remove <path>` + `git branch -d <branch>` for each agent
- [ ] Post-merge verification:
      - [ ] Linter: `cd /Users/dayna.blackwell/code/scout-and-wave-go && go vet ./...`
      - [ ] Build + test: `cd /Users/dayna.blackwell/code/scout-and-wave-go && go build ./... && go test ./...`
      - [ ] Web build: `cd /Users/dayna.blackwell/code/scout-and-wave-go/web && npm run build`
- [ ] Fix any cascade failures — watch for import path issues in `web/src/components/` if Agent D's refactor broke any imports
- [ ] Tick A, B, C, D in Status table
- [ ] Feature-specific steps:
      - [ ] Manual UI test: `cd /Users/dayna.blackwell/code/scout-and-wave-go && ./saw serve`, open http://localhost:8080, load backend-interface IMPL doc, verify all 9 tabs render correctly and switch properly
      - [ ] Verify Agent Prompts tab shows prompts from IMPL-backend-interface.md (4 agents)
      - [ ] Verify Interface Contracts tab shows code blocks
      - [ ] Verify Known Issues tab shows "None identified" for backend-interface doc
      - [ ] Verify shadcn components render consistently (Card borders, Badge colors, Table styling)
- [ ] Commit: `git commit -m "feat: add tabbed interface to IMPL review screen with 9 content panels"`

---

### Status

| Wave | Agent | Description | Status |
|------|-------|-------------|--------|
| 1 | A | Parser extensions (5 sections) | TO-DO |
| 1 | B | API layer extensions (6 fields) | PARTIAL (awaiting Agent A types) |
| 1 | C | TypeScript types (6 fields) | TO-DO |
| 1 | D | ReviewScreen tabbed interface + 9 panels (shadcn) | TO-DO |
| — | Orch | Post-merge verification + manual UI test | TO-DO |
