package git

import (
	"os/exec"
	"testing"
)

// initRepo creates a temporary git repository with main as the default branch
// and an initial empty commit, returning the repo path.
func initRepo(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	cmds := [][]string{
		{"init", "-b", "main"},
		{"config", "user.email", "test@test.com"},
		{"config", "user.name", "Test"},
		{"commit", "--allow-empty", "-m", "initial"},
	}
	for _, args := range cmds {
		cmd := exec.Command("git", append([]string{"-C", dir}, args...)...)
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("git %v: %v\n%s", args, err, out)
		}
	}
	return dir
}

// mustGit runs a git command in dir and fails the test on error.
func mustGit(t *testing.T, dir string, args ...string) {
	t.Helper()
	cmd := exec.Command("git", append([]string{"-C", dir}, args...)...)
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("git %v: %v\n%s", args, err, out)
	}
}

// TestPoller_EmptySnapshot verifies that a repo with no agent worktrees
// returns an empty snapshot with no error.
func TestPoller_EmptySnapshot(t *testing.T) {
	dir := initRepo(t)

	p := NewPoller(dir, "test-slug")
	snap, err := p.Snapshot()
	if err != nil {
		t.Fatalf("Snapshot() returned unexpected error: %v", err)
	}
	if len(snap.Branches) != 0 {
		t.Errorf("expected 0 branches, got %d: %v", len(snap.Branches), snap.Branches)
	}
	if len(snap.MainCommits) != 0 {
		t.Errorf("expected 0 main commits, got %d", len(snap.MainCommits))
	}
	if snap.Slug != "test-slug" {
		t.Errorf("expected slug %q, got %q", "test-slug", snap.Slug)
	}
}

// TestPoller_ParsesBranchName verifies that an agent worktree is parsed
// correctly: wave number, agent letter (uppercased), and commits.
func TestPoller_ParsesBranchName(t *testing.T) {
	dir := initRepo(t)

	// Create a worktree for wave1-agent-a.
	wtDir := t.TempDir()
	mustGit(t, dir, "worktree", "add", "-b", "wave1-agent-a", wtDir, "HEAD")

	// Add one commit to the agent branch.
	mustGit(t, wtDir, "config", "user.email", "agent@test.com")
	mustGit(t, wtDir, "config", "user.name", "Agent A")
	mustGit(t, wtDir, "commit", "--allow-empty", "-m", "agent work")

	p := NewPoller(dir, "my-slug")
	snap, err := p.Snapshot()
	if err != nil {
		t.Fatalf("Snapshot() returned unexpected error: %v", err)
	}

	if len(snap.Branches) != 1 {
		t.Fatalf("expected 1 branch, got %d", len(snap.Branches))
	}

	b := snap.Branches[0]
	if b.Agent != "A" {
		t.Errorf("expected Agent %q, got %q", "A", b.Agent)
	}
	if b.Wave != 1 {
		t.Errorf("expected Wave 1, got %d", b.Wave)
	}
	if len(b.Commits) != 1 {
		t.Errorf("expected 1 commit, got %d: %v", len(b.Commits), b.Commits)
	}
	if b.Status != "running" {
		t.Errorf("expected Status %q, got %q", "running", b.Status)
	}
}

// TestPoller_SnapshotNoBranches verifies graceful handling when the only
// worktree is the main one (no agent branches).
func TestPoller_SnapshotNoBranches(t *testing.T) {
	dir := initRepo(t)

	// Create a worktree with a non-agent branch name.
	wtDir := t.TempDir()
	mustGit(t, dir, "worktree", "add", "-b", "feature-xyz", wtDir, "HEAD")

	p := NewPoller(dir, "slug")
	snap, err := p.Snapshot()
	if err != nil {
		t.Fatalf("Snapshot() returned unexpected error: %v", err)
	}
	if len(snap.Branches) != 0 {
		t.Errorf("expected 0 agent branches (non-agent worktree should be skipped), got %d", len(snap.Branches))
	}
}
