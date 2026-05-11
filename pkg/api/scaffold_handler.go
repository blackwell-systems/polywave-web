package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/blackwell-systems/polywave-go/pkg/config"
	engine "github.com/blackwell-systems/polywave-go/pkg/engine"
)

// ScaffoldRerunResponse is the JSON body returned by POST /api/impl/{slug}/scaffold/rerun.
type ScaffoldRerunResponse struct {
	RunID string `json:"run_id"`
}

// handleScaffoldRerun handles POST /api/impl/{slug}/scaffold/rerun.
// Resolves the IMPL doc path, launches the scaffold agent in a background
// goroutine, and returns 202 with {"run_id": "..."}. Events are published to
// the existing wave SSE broker for the slug so the WaveBoard picks them up
// without a dedicated scaffold SSE endpoint.
func (s *Server) handleScaffoldRerun(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")

	// Resolve IMPL doc path.
	implPath := filepath.Join(s.cfg.IMPLDir, "IMPL-"+slug+".yaml")
	if _, err := os.Stat(implPath); os.IsNotExist(err) {
		http.Error(w, "IMPL doc not found for slug: "+slug, http.StatusNotFound)
		return
	}

	runID := fmt.Sprintf("%d", time.Now().UnixNano())
	ctx, cancel := context.WithCancel(context.Background())
	s.scaffoldRuns.Store(runID, cancel)

	go func() {
		defer s.scaffoldRuns.Delete(runID)
		defer cancel()
		s.runScaffoldAgent(ctx, slug, runID, implPath)
	}()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(ScaffoldRerunResponse{RunID: runID}) //nolint:errcheck
}

// runScaffoldAgent runs engine.RunScaffold and forwards all events to the wave
// SSE broker under the slug. Handles context cancellation by publishing
// scaffold_cancelled. The engine itself publishes scaffold_started,
// scaffold_output, scaffold_failed, and scaffold_complete.
func (s *Server) runScaffoldAgent(ctx context.Context, slug, runID, implPath string) {
	pwRepo := os.Getenv("POLYWAVE_REPO")
	if pwRepo == "" {
		home, _ := os.UserHomeDir()
		pwRepo = filepath.Join(home, "code", "polywave")
	}

	onEvent := func(ev engine.Event) {
		s.broker.Publish(slug, SSEEvent{Event: ev.Event, Data: ev.Data})
	}

	// Read scaffold model from config.
	scaffoldModel := ""
	if pwCfg := config.LoadOrDefault(s.cfg.RepoPath); pwCfg != nil {
		scaffoldModel = pwCfg.Agent.ScaffoldModel
	}

	scaffoldResult := engine.RunScaffold(engine.RunScaffoldOpts{
		Ctx:      ctx,
		ImplPath: implPath,
		RepoPath: s.cfg.RepoPath,
		Model:    scaffoldModel,
		OnEvent:  onEvent,
	})
	if scaffoldResult.IsFatal() {
		if ctx.Err() != nil {
			s.broker.Publish(slug, SSEEvent{
				Event: "scaffold_cancelled",
				Data:  map[string]string{"run_id": runID, "slug": slug},
			})
		}
		// scaffold_failed already published by engine; no double-publish needed.
	} else {
		s.notificationBus.Notify(NotificationEvent{
			Type:     NotifyScaffoldComplete,
			Slug:     slug,
			Title:    "Scaffolds Committed",
			Message:  "Interface contracts materialized and committed to HEAD",
			Severity: "success",
		})
	}
}
