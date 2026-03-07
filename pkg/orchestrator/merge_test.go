package orchestrator

import (
	"os"
	"strings"
	"testing"

	"github.com/blackwell-systems/scout-and-wave-go/pkg/types"
)

// ── predictConflicts tests ────────────────────────────────────────────────────

func TestPredictConflicts_NoConflict(t *testing.T) {
	reports := map[string]*types.CompletionReport{
		"A": {
			Status:       types.StatusComplete,
			FilesChanged: []string{"pkg/foo/foo.go"},
			FilesCreated: []string{"pkg/foo/foo_test.go"},
		},
		"B": {
			Status:       types.StatusComplete,
			FilesChanged: []string{"pkg/bar/bar.go"},
			FilesCreated: []string{"pkg/bar/bar_test.go"},
		},
	}

	if err := predictConflicts(reports); err != nil {
		t.Errorf("expected nil, got: %v", err)
	}
}

func TestPredictConflicts_Conflict(t *testing.T) {
	reports := map[string]*types.CompletionReport{
		"A": {
			Status:       types.StatusComplete,
			FilesChanged: []string{"pkg/shared/shared.go"},
		},
		"B": {
			Status:       types.StatusComplete,
			FilesCreated: []string{"pkg/shared/shared.go"},
		},
	}

	err := predictConflicts(reports)
	if err == nil {
		t.Fatal("expected conflict error, got nil")
	}
	if !strings.Contains(err.Error(), "pkg/shared/shared.go") {
		t.Errorf("error should mention conflicting file, got: %v", err)
	}
}

func TestPredictConflicts_IMPLDocIgnored(t *testing.T) {
	reports := map[string]*types.CompletionReport{
		"A": {
			Status:       types.StatusComplete,
			FilesChanged: []string{"docs/IMPL/IMPL-bootstrap.md"},
		},
		"B": {
			Status:       types.StatusComplete,
			FilesCreated: []string{"docs/IMPL/IMPL-bootstrap.md"},
		},
	}

	// docs/IMPL/ files must not be flagged as conflicts.
	if err := predictConflicts(reports); err != nil {
		t.Errorf("expected nil for docs/IMPL/ files, got: %v", err)
	}
}

// ── executeMergeWave tests ────────────────────────────────────────────────────

func TestExecuteMergeWave_BlockedAgent(t *testing.T) {
	doc := &types.IMPLDoc{
		FeatureName: "test",
		Waves: []types.Wave{
			{
				Number: 1,
				Agents: []types.AgentSpec{
					{Letter: "A"},
				},
			},
		},
	}

	dir := t.TempDir()
	implPath := dir + "/IMPL.md"
	implContent := "# IMPL: test\n\n## Wave 1\n\n### Agent A: Some task\n\nDo stuff.\n\n### Agent A - Completion Report\n\n" +
		"```yaml\n" +
		"status: blocked\n" +
		"worktree: .claude/worktrees/wave1-agent-A\n" +
		"branch: wave1-agent-A\n" +
		"commit: \"\"\n" +
		"files_changed: []\n" +
		"files_created: []\n" +
		"interface_deviations: []\n" +
		"out_of_scope_deps: []\n" +
		"tests_added: []\n" +
		"verification: FAIL\n" +
		"```\n"

	if err := os.WriteFile(implPath, []byte(implContent), 0o644); err != nil {
		t.Fatal(err)
	}

	o := newFromDoc(doc, dir, implPath)

	err := executeMergeWave(o, 1)
	if err == nil {
		t.Fatal("expected error for blocked agent, got nil")
	}
	if !strings.Contains(err.Error(), "blocked") {
		t.Errorf("error should mention 'blocked', got: %v", err)
	}
}

// ── verifyAgentCommits tests ──────────────────────────────────────────────────

func TestVerifyAgentCommits_EmptyBranch(t *testing.T) {
	reports := map[string]*types.CompletionReport{
		"A": {Status: types.StatusComplete, Branch: ""},
	}
	err := verifyAgentCommits("/repo", "abc123", reports)
	if err == nil {
		t.Fatal("expected error for empty branch field, got nil")
	}
}

func TestVerifyAgentCommits_SkipsNonComplete(t *testing.T) {
	// Agents with non-complete status are skipped — no git calls needed.
	reports := map[string]*types.CompletionReport{
		"A": {Status: types.StatusPartial, Branch: "wave1-agent-A"},
		"B": {Status: types.StatusBlocked, Branch: "wave1-agent-B"},
	}
	// Should return nil without touching git (branches don't exist).
	if err := verifyAgentCommits(t.TempDir(), "abc123", reports); err != nil {
		t.Errorf("expected nil for non-complete agents, got: %v", err)
	}
}

// ── runVerification tests ─────────────────────────────────────────────────────

func TestRunVerification_EmptyCommand(t *testing.T) {
	o := newFromDoc(&types.IMPLDoc{}, t.TempDir(), "")
	err := runVerification(o, "")
	if err == nil {
		t.Fatal("expected error for empty test command, got nil")
	}
}

func TestRunVerification_Success(t *testing.T) {
	o := newFromDoc(&types.IMPLDoc{}, t.TempDir(), "")
	if err := runVerification(o, "echo ok"); err != nil {
		t.Errorf("expected nil for 'echo ok', got: %v", err)
	}
}

func TestRunVerification_Failure(t *testing.T) {
	o := newFromDoc(&types.IMPLDoc{}, t.TempDir(), "")
	err := runVerification(o, "false")
	if err == nil {
		t.Fatal("expected error for 'false', got nil")
	}
}
