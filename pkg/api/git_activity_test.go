package api

import (
	"bufio"
	"context"
	"net/http"
	"net/http/httptest"
	"os/exec"
	"strings"
	"testing"
)

// initGitRepo creates a temporary git repository with main as default branch
// and an initial commit, returning the repo path.
func initGitRepo(t *testing.T) string {
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

// TestHandleGitActivity_ContentType verifies that the handler sets the correct
// SSE Content-Type header. Uses a pre-cancelled context so the handler exits
// immediately after setting headers and completing the first poll.
func TestHandleGitActivity_ContentType(t *testing.T) {
	s, _ := makeTestServer(t)

	ctx, cancel := newCancelledCtx()
	defer cancel()

	req := httptest.NewRequest(http.MethodGet, "/api/git/test-slug/activity", nil)
	req = req.WithContext(ctx)
	req.SetPathValue("slug", "test-slug")
	rr := httptest.NewRecorder()

	s.handleGitActivity(rr, req)

	ct := rr.Header().Get("Content-Type")
	if !strings.HasPrefix(ct, "text/event-stream") {
		t.Errorf("expected Content-Type text/event-stream, got %q", ct)
	}
}

// TestHandleGitActivity_EmitsEvent uses a real httptest.Server (needed for a
// real http.Flusher) and verifies that the handler emits an "event: git_activity"
// SSE frame.
func TestHandleGitActivity_EmitsEvent(t *testing.T) {
	repoDir := initGitRepo(t)

	s := New(Config{
		Addr:     "localhost:0",
		IMPLDir:  repoDir,
		RepoPath: repoDir,
	})

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.SetPathValue("slug", "test-slug")
		s.handleGitActivity(w, r)
	}))
	defer ts.Close()

	// Use a short timeout so the test completes quickly.
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, ts.URL, nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	defer resp.Body.Close()

	// Read lines until we find the event line or give up after a few lines.
	sc := bufio.NewScanner(resp.Body)
	found := false
	for i := 0; i < 20 && sc.Scan(); i++ {
		line := sc.Text()
		if strings.HasPrefix(line, "event: git_activity") {
			found = true
			break
		}
	}

	// Cancel to unblock the handler goroutine.
	cancel()
	ts.CloseClientConnections()

	if !found {
		t.Error("expected 'event: git_activity' line in SSE response")
	}
}
