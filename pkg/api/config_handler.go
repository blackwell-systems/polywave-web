package api

import (
	"encoding/json"
	"net/http"
	"path/filepath"

	"github.com/blackwell-systems/scout-and-wave-web/pkg/service"
)

// handleGetConfig serves GET /api/config.
// Reads saw.config.json from the repo root and returns it as SAWConfig JSON.
// If the file does not exist, returns a default SAWConfig{}.
func (s *Server) handleGetConfig(w http.ResponseWriter, r *http.Request) {
	deps := service.Deps{
		RepoPath: s.cfg.RepoPath,
		ConfigPath: func(repoPath string) string {
			return filepath.Join(repoPath, "saw.config.json")
		},
	}

	cfg, err := service.GetConfig(deps)
	if err != nil {
		http.Error(w, "failed to read config", http.StatusInternalServerError)
		return
	}

	// Convert service types to API types for response
	apiCfg := SAWConfig{
		Repos: make([]RepoEntry, len(cfg.Repos)),
		Agent: AgentConfig{
			ScoutModel:       cfg.Agent.ScoutModel,
			WaveModel:        cfg.Agent.WaveModel,
			ChatModel:        cfg.Agent.ChatModel,
			ScaffoldModel:    cfg.Agent.ScaffoldModel,
			IntegrationModel: cfg.Agent.IntegrationModel,
			PlannerModel:     cfg.Agent.PlannerModel,
			ReviewModel:      cfg.Agent.ReviewModel,
		},
		Quality: QualityConfig{
			RequireTests:   cfg.Quality.RequireTests,
			RequireLint:    cfg.Quality.RequireLint,
			BlockOnFailure: cfg.Quality.BlockOnFailure,
			CodeReview: CodeReviewCfg{
				Enabled:   cfg.Quality.CodeReview.Enabled,
				Blocking:  cfg.Quality.CodeReview.Blocking,
				Model:     cfg.Quality.CodeReview.Model,
				Threshold: cfg.Quality.CodeReview.Threshold,
			},
		},
		Appear: AppearConfig{
			Theme:               cfg.Appear.Theme,
			ColorTheme:          cfg.Appear.ColorTheme,
			ColorThemeDark:      cfg.Appear.ColorThemeDark,
			ColorThemeLight:     cfg.Appear.ColorThemeLight,
			FavoriteThemesDark:  cfg.Appear.FavoriteThemesDark,
			FavoriteThemesLight: cfg.Appear.FavoriteThemesLight,
		},
	}
	for i, repo := range cfg.Repos {
		apiCfg.Repos[i] = RepoEntry{Name: repo.Name, Path: repo.Path}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(apiCfg) //nolint:errcheck
}

// handleSaveConfig serves POST /api/config.
// Decodes SAWConfig JSON body and atomically writes it to saw.config.json.
func (s *Server) handleSaveConfig(w http.ResponseWriter, r *http.Request) {
	var apiCfg SAWConfig
	if err := json.NewDecoder(r.Body).Decode(&apiCfg); err != nil {
		http.Error(w, "invalid config JSON", http.StatusBadRequest)
		return
	}

	// Convert API types to service types
	svcCfg := &service.SAWConfig{
		Repos: make([]service.RepoEntry, len(apiCfg.Repos)),
		Agent: service.AgentConfig{
			ScoutModel:       apiCfg.Agent.ScoutModel,
			WaveModel:        apiCfg.Agent.WaveModel,
			ChatModel:        apiCfg.Agent.ChatModel,
			ScaffoldModel:    apiCfg.Agent.ScaffoldModel,
			IntegrationModel: apiCfg.Agent.IntegrationModel,
			PlannerModel:     apiCfg.Agent.PlannerModel,
			ReviewModel:      apiCfg.Agent.ReviewModel,
		},
		Quality: service.QualityConfig{
			RequireTests:   apiCfg.Quality.RequireTests,
			RequireLint:    apiCfg.Quality.RequireLint,
			BlockOnFailure: apiCfg.Quality.BlockOnFailure,
			CodeReview: service.CodeReviewCfg{
				Enabled:   apiCfg.Quality.CodeReview.Enabled,
				Blocking:  apiCfg.Quality.CodeReview.Blocking,
				Model:     apiCfg.Quality.CodeReview.Model,
				Threshold: apiCfg.Quality.CodeReview.Threshold,
			},
		},
		Appear: service.AppearConfig{
			Theme:               apiCfg.Appear.Theme,
			ColorTheme:          apiCfg.Appear.ColorTheme,
			ColorThemeDark:      apiCfg.Appear.ColorThemeDark,
			ColorThemeLight:     apiCfg.Appear.ColorThemeLight,
			FavoriteThemesDark:  apiCfg.Appear.FavoriteThemesDark,
			FavoriteThemesLight: apiCfg.Appear.FavoriteThemesLight,
		},
	}
	for i, repo := range apiCfg.Repos {
		svcCfg.Repos[i] = service.RepoEntry{Name: repo.Name, Path: repo.Path}
	}

	deps := service.Deps{
		RepoPath: s.cfg.RepoPath,
		ConfigPath: func(repoPath string) string {
			return filepath.Join(repoPath, "saw.config.json")
		},
	}

	if err := service.SaveConfig(deps, svcCfg); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusOK)
}
