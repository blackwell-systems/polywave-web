package api

import (
	"encoding/json"
	"net/http"

	"github.com/blackwell-systems/scout-and-wave-go/pkg/autonomy"
)

// handleGetAutonomy serves GET /api/autonomy.
// Returns the current autonomy config from saw.config.json,
// or the default config (gated) if none exists.
func (s *Server) handleGetAutonomy(w http.ResponseWriter, r *http.Request) {
	cfg, err := autonomy.LoadConfig(s.cfg.RepoPath)
	if err != nil {
		// LoadConfig returns default on missing file; a real error means
		// the file exists but is unparseable.
		http.Error(w, "failed to load autonomy config: "+err.Error(), http.StatusInternalServerError)
		return
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

	if err := autonomy.SaveConfig(s.cfg.RepoPath, cfg); err != nil {
		http.Error(w, "failed to save autonomy config: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Broadcast so any connected client refreshes pipeline views.
	s.globalBroker.broadcast("impl_list_updated")

	w.WriteHeader(http.StatusOK)
}
