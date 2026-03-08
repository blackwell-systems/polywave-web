package orchestrator

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/blackwell-systems/scout-and-wave-web/pkg/types"
)

// implDocWithStatus is a minimal IMPL doc containing a ### Status table
// with two agents — one TO-DO for each of waves 1 and 2.
const implDocWithStatus = `# IMPL: Test Feature

## Wave 1

### Agent A: First agent
Implements pkg/a/a.go.

### Agent B: Second agent
Implements pkg/b/b.go.

### Status

| Wave | Agent | Description                | Status |
|------|-------|----------------------------|--------|
| 1    | A     | First agent work           | TO-DO |
| 1    | B     | Second agent work          | TO-DO |
`

// completionReportForAgent formats a minimal completion report block that
// ParseCompletionReport will accept for the given agent letter with status complete.
func completionReportForAgent(letter string) string {
	return "\n### Agent " + letter + " - Completion Report\n\n```yaml\nstatus: complete\n```\n"
}

// TestUpdateIMPLStatus_CollectsCompleteAgents verifies that only agents
// reporting StatusComplete get their letters passed to UpdateIMPLStatus
// (i.e., their TO-DO rows are ticked to DONE).
func TestUpdateIMPLStatus_CollectsCompleteAgents(t *testing.T) {
	dir := t.TempDir()
	implPath := filepath.Join(dir, "IMPL-test.md")

	// Write the IMPL doc with a Status table; include completion reports for
	// agent A (complete) but not agent B (no report => pending).
	content := implDocWithStatus + completionReportForAgent("A")
	if err := os.WriteFile(implPath, []byte(content), 0o644); err != nil {
		t.Fatalf("failed to write IMPL doc: %v", err)
	}

	// Build an orchestrator that references this file and has one wave with
	// agents A and B.
	doc := &types.IMPLDoc{
		FeatureName: "Test Feature",
		Waves: []types.Wave{
			{
				Number: 1,
				Agents: []types.AgentSpec{
					{Letter: "A", Prompt: "do A work"},
					{Letter: "B", Prompt: "do B work"},
				},
			},
		},
	}
	o := newFromDoc(doc, dir, implPath)

	if err := o.UpdateIMPLStatus(1); err != nil {
		t.Fatalf("UpdateIMPLStatus returned unexpected error: %v", err)
	}

	// Read the updated file and verify results.
	updated, err := os.ReadFile(implPath)
	if err != nil {
		t.Fatalf("failed to read updated IMPL doc: %v", err)
	}
	updatedStr := string(updated)

	// Agent A completed — its row should now read DONE.
	if !containsSubstring(updatedStr, "| A") {
		t.Error("expected agent A row to be present in updated IMPL doc")
	}
	// The TO-DO for A should have been replaced with DONE.
	// Check that at least one DONE appears (the A row).
	if !containsSubstring(updatedStr, "DONE") {
		t.Errorf("expected at least one DONE in updated IMPL doc; got:\n%s", updatedStr)
	}

	// Agent B had no completion report — its TO-DO row must remain unchanged.
	if !containsSubstring(updatedStr, "| B") {
		t.Error("expected agent B row to be present in updated IMPL doc")
	}
}

// TestUpdateIMPLStatus_WaveNotFound verifies that UpdateIMPLStatus returns nil
// (not an error) when the requested wave number does not exist in the IMPL doc.
func TestUpdateIMPLStatus_WaveNotFound(t *testing.T) {
	dir := t.TempDir()
	implPath := filepath.Join(dir, "IMPL-test.md")
	if err := os.WriteFile(implPath, []byte(implDocWithStatus), 0o644); err != nil {
		t.Fatalf("failed to write IMPL doc: %v", err)
	}

	doc := &types.IMPLDoc{
		FeatureName: "Test Feature",
		Waves: []types.Wave{
			{Number: 1, Agents: []types.AgentSpec{{Letter: "A", Prompt: "do work"}}},
		},
	}
	o := newFromDoc(doc, dir, implPath)

	// Wave 99 does not exist — should return nil, not an error.
	if err := o.UpdateIMPLStatus(99); err != nil {
		t.Errorf("expected nil for non-existent wave, got: %v", err)
	}
}

// TestUpdateIMPLStatus_NoCompleteAgents verifies that when no agents have a
// complete status, UpdateIMPLStatus returns nil and the file is unchanged.
func TestUpdateIMPLStatus_NoCompleteAgents(t *testing.T) {
	dir := t.TempDir()
	implPath := filepath.Join(dir, "IMPL-test.md")
	original := implDocWithStatus // no completion reports appended
	if err := os.WriteFile(implPath, []byte(original), 0o644); err != nil {
		t.Fatalf("failed to write IMPL doc: %v", err)
	}

	// Record mtime before call.
	info, err := os.Stat(implPath)
	if err != nil {
		t.Fatalf("stat failed: %v", err)
	}
	mtimeBefore := info.ModTime()

	doc := &types.IMPLDoc{
		FeatureName: "Test Feature",
		Waves: []types.Wave{
			{Number: 1, Agents: []types.AgentSpec{{Letter: "A", Prompt: "do work"}}},
		},
	}
	o := newFromDoc(doc, dir, implPath)

	// Sleep briefly so mtime would differ if the file were written.
	time.Sleep(10 * time.Millisecond)

	if err := o.UpdateIMPLStatus(1); err != nil {
		t.Errorf("expected nil when no complete agents, got: %v", err)
	}

	// File should be unchanged (not rewritten) since no completed agents.
	info2, err := os.Stat(implPath)
	if err != nil {
		t.Fatalf("stat after call failed: %v", err)
	}
	if info2.ModTime() != mtimeBefore {
		t.Errorf("file was unexpectedly modified (mtime changed from %v to %v)",
			mtimeBefore, info2.ModTime())
	}
}

// TestUpdateIMPLStatus_AllComplete verifies that all agents in a wave with
// complete reports have their Status rows ticked to DONE.
func TestUpdateIMPLStatus_AllComplete(t *testing.T) {
	dir := t.TempDir()
	implPath := filepath.Join(dir, "IMPL-test.md")

	content := implDocWithStatus +
		completionReportForAgent("A") +
		completionReportForAgent("B")
	if err := os.WriteFile(implPath, []byte(content), 0o644); err != nil {
		t.Fatalf("failed to write IMPL doc: %v", err)
	}

	doc := &types.IMPLDoc{
		FeatureName: "Test Feature",
		Waves: []types.Wave{
			{
				Number: 1,
				Agents: []types.AgentSpec{
					{Letter: "A", Prompt: "do A work"},
					{Letter: "B", Prompt: "do B work"},
				},
			},
		},
	}
	o := newFromDoc(doc, dir, implPath)

	if err := o.UpdateIMPLStatus(1); err != nil {
		t.Fatalf("UpdateIMPLStatus returned unexpected error: %v", err)
	}

	updated, err := os.ReadFile(implPath)
	if err != nil {
		t.Fatalf("failed to read updated IMPL doc: %v", err)
	}
	updatedStr := string(updated)

	// No TO-DO rows should remain in the Status section.
	if containsSubstring(updatedStr, "| TO-DO |") {
		t.Errorf("expected no TO-DO rows after all-complete update; got:\n%s", updatedStr)
	}
}

// containsSubstring is a helper to keep test assertions readable.
func containsSubstring(s, sub string) bool {
	return len(s) >= len(sub) && (s == sub || len(sub) == 0 ||
		func() bool {
			for i := 0; i <= len(s)-len(sub); i++ {
				if s[i:i+len(sub)] == sub {
					return true
				}
			}
			return false
		}())
}
