package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/blackwell-systems/polywave-go/pkg/engine"
)

// TestHandleDaemonStatus_NotRunning verifies that when no daemon has been
// started, the status endpoint returns {running: false}.
func TestHandleDaemonStatus_NotRunning(t *testing.T) {
	// Reset global state for test isolation.
	globalDaemon.mu.Lock()
	globalDaemon.state = nil
	globalDaemon.cancel = nil
	globalDaemon.events = nil
	globalDaemon.mu.Unlock()

	dir := t.TempDir()
	s := New(Config{
		Addr:     "localhost:0",
		IMPLDir:  dir,
		RepoPath: dir,
	})

	req := httptest.NewRequest(http.MethodGet, "/api/daemon/status", nil)
	rr := httptest.NewRecorder()
	s.handleDaemonStatus(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d; body: %s", rr.Code, rr.Body.String())
	}

	var state engine.DaemonState
	if err := json.NewDecoder(rr.Body).Decode(&state); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if state.Running {
		t.Error("expected running=false, got true")
	}
}

// TestHandleDaemonStart_AlreadyRunning verifies that starting the daemon
// when it is already running returns 409 Conflict.
func TestHandleDaemonStart_AlreadyRunning(t *testing.T) {
	// Simulate a running daemon.
	globalDaemon.mu.Lock()
	globalDaemon.state = &engine.DaemonState{Running: true}
	globalDaemon.mu.Unlock()

	defer func() {
		globalDaemon.mu.Lock()
		globalDaemon.state = nil
		globalDaemon.cancel = nil
		globalDaemon.events = nil
		globalDaemon.mu.Unlock()
	}()

	dir := t.TempDir()
	s := New(Config{
		Addr:     "localhost:0",
		IMPLDir:  dir,
		RepoPath: dir,
	})

	req := httptest.NewRequest(http.MethodPost, "/api/daemon/start", nil)
	rr := httptest.NewRecorder()
	s.handleDaemonStart(rr, req)

	if rr.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d; body: %s", rr.Code, rr.Body.String())
	}
}
