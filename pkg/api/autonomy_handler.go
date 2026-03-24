package api

import (
	"encoding/json"
	"net/http"

	"github.com/blackwell-systems/scout-and-wave-go/pkg/autonomy"
	"github.com/blackwell-systems/scout-and-wave-go/pkg/config"
)

// handleGetAutonomy serves GET /api/autonomy.
// Returns the current autonomy config from saw.config.json,
// or the default config (gated) if none exists.
func (s *Server) handleGetAutonomy(w http.ResponseWriter, r *http.Request) {
	sawCfg := config.LoadOrDefault(s.cfg.RepoPath)
	cfg := autonomy.Config{
		Level:          autonomy.Level(sawCfg.Autonomy.Level),
		MaxAutoRetries: sawCfg.Autonomy.MaxAutoRetries,
		MaxQueueDepth:  sawCfg.Autonomy.MaxQueueDepth,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(cfg) //nolint:errcheck
}

// handleSaveAutonomy serves PUT /api/autonomy.
// Accepts an autonomy.Config JSON body, validates the level, and persists it.
func (s *Server) handleSaveAutonomy(w http.ResponseWriter, r *http.Request) {
	var cfg autonomy.Config
	if err := json.NewDecoder(r.Body).Decode(&cfg); err != nil {
		http.Error(w, "invalid JSON body", http.StatusBadRequest)
		return
	}

	// Validate level using the canonical parser.
	if _, err := autonomy.ParseLevel(string(cfg.Level)); err != nil {
		http.Error(w, "invalid autonomy level: "+err.Error(), http.StatusBadRequest)
		return
	}

	// Load existing config, update autonomy section, save back
	sawCfg := config.LoadOrDefault(s.cfg.RepoPath)
	sawCfg.Autonomy.Level = string(cfg.Level)
	sawCfg.Autonomy.MaxAutoRetries = cfg.MaxAutoRetries
	sawCfg.Autonomy.MaxQueueDepth = cfg.MaxQueueDepth

	res := config.Save(s.cfg.RepoPath, sawCfg)
	if !res.IsSuccess() {
		http.Error(w, "failed to save autonomy config: "+res.Errors[0].Message, http.StatusInternalServerError)
		return
	}

	// Broadcast so any connected client refreshes pipeline views.
	s.globalBroker.broadcast("impl_list_updated")

	w.WriteHeader(http.StatusOK)
}
