package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/blackwell-systems/polywave-go/pkg/autonomy"
)

// TestHandleGetAutonomy_Default verifies that when no config file exists,
// the handler returns the default autonomy config (level: gated).
func TestHandleGetAutonomy_Default(t *testing.T) {
	dir := t.TempDir()
	s := New(Config{
		Addr:     "localhost:0",
		IMPLDir:  dir,
		RepoPath: dir,
	})

	req := httptest.NewRequest(http.MethodGet, "/api/autonomy", nil)
	rr := httptest.NewRecorder()
	s.handleGetAutonomy(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d; body: %s", rr.Code, rr.Body.String())
	}

	var cfg autonomy.Config
	if err := json.NewDecoder(rr.Body).Decode(&cfg); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if cfg.Level != autonomy.LevelGated {
		t.Errorf("expected level %q, got %q", autonomy.LevelGated, cfg.Level)
	}
}

// TestHandleSaveAutonomy saves a supervised config and reads it back.
func TestHandleSaveAutonomy(t *testing.T) {
	dir := t.TempDir()
	s := New(Config{
		Addr:     "localhost:0",
		IMPLDir:  dir,
		RepoPath: dir,
	})

	body := `{"level":"supervised","max_auto_retries":3,"max_queue_depth":10}`
	req := httptest.NewRequest(http.MethodPut, "/api/autonomy", strings.NewReader(body))
	rr := httptest.NewRecorder()
	s.handleSaveAutonomy(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 on save, got %d; body: %s", rr.Code, rr.Body.String())
	}

	// Read back.
	req2 := httptest.NewRequest(http.MethodGet, "/api/autonomy", nil)
	rr2 := httptest.NewRecorder()
	s.handleGetAutonomy(rr2, req2)

	if rr2.Code != http.StatusOK {
		t.Fatalf("expected 200 on get, got %d", rr2.Code)
	}

	var cfg autonomy.Config
	if err := json.NewDecoder(rr2.Body).Decode(&cfg); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if cfg.Level != "supervised" {
		t.Errorf("expected level %q, got %q", "supervised", cfg.Level)
	}
	if cfg.MaxAutoRetries != 3 {
		t.Errorf("expected max_auto_retries 3, got %d", cfg.MaxAutoRetries)
	}
	if cfg.MaxQueueDepth != 10 {
		t.Errorf("expected max_queue_depth 10, got %d", cfg.MaxQueueDepth)
	}
}

// TestHandleSaveAutonomy_InvalidLevel verifies that an invalid autonomy level
// returns 400 Bad Request.
func TestHandleSaveAutonomy_InvalidLevel(t *testing.T) {
	dir := t.TempDir()
	s := New(Config{
		Addr:     "localhost:0",
		IMPLDir:  dir,
		RepoPath: dir,
	})

	body := `{"level":"yolo","max_auto_retries":1,"max_queue_depth":5}`
	req := httptest.NewRequest(http.MethodPut, "/api/autonomy", strings.NewReader(body))
	rr := httptest.NewRecorder()
	s.handleSaveAutonomy(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d; body: %s", rr.Code, rr.Body.String())
	}
}
