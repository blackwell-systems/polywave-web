package api

import (
	"net/http"
	"path/filepath"
	"strings"

	"github.com/blackwell-systems/scout-and-wave-go/pkg/config"
	"github.com/blackwell-systems/scout-and-wave-web/pkg/service"
)

// handleGetConfig serves GET /api/config.
// Reads saw.config.json from the repo root and returns it as SAWConfig JSON.
// If the file does not exist, returns a default SAWConfig{}.
func (s *Server) handleGetConfig(w http.ResponseWriter, r *http.Request) {
	sdkCfg := config.LoadOrDefault(s.cfg.RepoPath)

	// Convert SDK config types to API types for the response.
	apiCfg := sdkConfigToAPI(sdkCfg)

	// Handle legacy migration: if the original file had repo.path but no repos,
	// the SDK Load already migrated it. If no repos at all, add the server's repo.
	if len(apiCfg.Repos) == 0 {
		apiCfg.Repos = []RepoEntry{{
			Name: filepath.Base(s.cfg.RepoPath),
			Path: s.cfg.RepoPath,
		}}
	}

	respondJSON(w, http.StatusOK, apiCfg)
}

// handleSaveConfig serves POST /api/config.
// Decodes SAWConfig JSON body and atomically writes it to saw.config.json.
func (s *Server) handleSaveConfig(w http.ResponseWriter, r *http.Request) {
	var apiCfg SAWConfig
	if err := decodeJSON(r, &apiCfg); err != nil {
		respondError(w, "invalid config JSON", http.StatusBadRequest)
		return
	}

	// Validate model names via the service layer.
	models := map[string]string{
		"scout_model":       apiCfg.Agent.ScoutModel,
		"wave_model":        apiCfg.Agent.WaveModel,
		"chat_model":        apiCfg.Agent.ChatModel,
		"integration_model": apiCfg.Agent.IntegrationModel,
		"review_model":      apiCfg.Agent.ReviewModel,
	}
	for field, model := range models {
		if err := service.ValidateModelName(model); err != nil {
			respondError(w, "invalid "+field+": "+err.Error(), http.StatusBadRequest)
			return
		}
	}

	// Convert API types to SDK config types.
	sdkCfg := apiConfigToSDK(&apiCfg)

	saveResult := config.Save(s.cfg.RepoPath, sdkCfg)
	if !saveResult.IsSuccess() {
		msg := "failed to save config"
		if len(saveResult.Errors) > 0 {
			msg = saveResult.Errors[0].Message
		}
		http.Error(w, msg, http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusOK)
}

// sdkConfigToAPI converts an SDK config.SAWConfig to the API SAWConfig type.
func sdkConfigToAPI(cfg *config.SAWConfig) SAWConfig {
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
		Providers: ProvidersConfig{
			Anthropic: AnthropicProviderConfig{APIKey: cfg.Providers.Anthropic.APIKey},
			OpenAI:    OpenAIProviderConfig{APIKey: cfg.Providers.OpenAI.APIKey},
			Bedrock: BedrockProviderConfig{
				Region:         cfg.Providers.Bedrock.Region,
				AccessKeyID:    cfg.Providers.Bedrock.AccessKeyID,
				SecretAccessKey: cfg.Providers.Bedrock.SecretAccessKey,
				SessionToken:   cfg.Providers.Bedrock.SessionToken,
				Profile:        cfg.Providers.Bedrock.Profile,
			},
		},
	}
	for i, repo := range cfg.Repos {
		apiCfg.Repos[i] = RepoEntry{Name: repo.Name, Path: repo.Path}
	}
	return apiCfg
}

// apiConfigToSDK converts an API SAWConfig to the SDK config.SAWConfig type.
func apiConfigToSDK(apiCfg *SAWConfig) *config.SAWConfig {
	sdkCfg := &config.SAWConfig{
		Repos: make([]config.RepoEntry, len(apiCfg.Repos)),
		Agent: config.AgentConfig{
			ScoutModel:       apiCfg.Agent.ScoutModel,
			WaveModel:        apiCfg.Agent.WaveModel,
			ChatModel:        apiCfg.Agent.ChatModel,
			ScaffoldModel:    apiCfg.Agent.ScaffoldModel,
			IntegrationModel: apiCfg.Agent.IntegrationModel,
			PlannerModel:     apiCfg.Agent.PlannerModel,
			ReviewModel:      apiCfg.Agent.ReviewModel,
		},
		Quality: config.QualityConfig{
			RequireTests:   apiCfg.Quality.RequireTests,
			RequireLint:    apiCfg.Quality.RequireLint,
			BlockOnFailure: apiCfg.Quality.BlockOnFailure,
			CodeReview: config.CodeReviewCfg{
				Enabled:   apiCfg.Quality.CodeReview.Enabled,
				Blocking:  apiCfg.Quality.CodeReview.Blocking,
				Model:     apiCfg.Quality.CodeReview.Model,
				Threshold: apiCfg.Quality.CodeReview.Threshold,
			},
		},
		Appear: config.AppearConfig{
			Theme:               apiCfg.Appear.Theme,
			ColorTheme:          apiCfg.Appear.ColorTheme,
			ColorThemeDark:      apiCfg.Appear.ColorThemeDark,
			ColorThemeLight:     apiCfg.Appear.ColorThemeLight,
			FavoriteThemesDark:  apiCfg.Appear.FavoriteThemesDark,
			FavoriteThemesLight: apiCfg.Appear.FavoriteThemesLight,
		},
		Providers: config.ProvidersConfig{
			Anthropic: config.AnthropicProvider{APIKey: apiCfg.Providers.Anthropic.APIKey},
			OpenAI:    config.OpenAIProvider{APIKey: apiCfg.Providers.OpenAI.APIKey},
			Bedrock: config.BedrockProvider{
				Region:         apiCfg.Providers.Bedrock.Region,
				AccessKeyID:    apiCfg.Providers.Bedrock.AccessKeyID,
				SecretAccessKey: apiCfg.Providers.Bedrock.SecretAccessKey,
				SessionToken:   apiCfg.Providers.Bedrock.SessionToken,
				Profile:        apiCfg.Providers.Bedrock.Profile,
			},
		},
	}
	for i, repo := range apiCfg.Repos {
		sdkCfg.Repos[i] = config.RepoEntry{Name: repo.Name, Path: repo.Path}
	}
	return sdkCfg
}

// handleValidateProvider serves POST /api/config/providers/{provider}/validate.
// It validates provider-specific credentials and returns a ProviderValidationResponse.
func (s *Server) handleValidateProvider(w http.ResponseWriter, r *http.Request) {
	provider := r.PathValue("provider")

	switch strings.ToLower(provider) {
	case "anthropic":
		var body struct {
			APIKey string `json:"api_key"`
		}
		if err := decodeJSON(r, &body); err != nil {
			respondError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		err := service.ValidateAnthropicCredentials(body.APIKey)
		if err != nil {
			respondJSON(w, http.StatusOK, ProviderValidationResponse{
				Valid: false,
				Error: err.Error(),
			})
			return
		}
		respondJSON(w, http.StatusOK, ProviderValidationResponse{Valid: true})

	case "openai":
		var body struct {
			APIKey string `json:"api_key"`
		}
		if err := decodeJSON(r, &body); err != nil {
			respondError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		err := service.ValidateOpenAICredentials(body.APIKey)
		if err != nil {
			respondJSON(w, http.StatusOK, ProviderValidationResponse{
				Valid: false,
				Error: err.Error(),
			})
			return
		}
		respondJSON(w, http.StatusOK, ProviderValidationResponse{Valid: true})

	case "bedrock":
		var body struct {
			Region         string `json:"region"`
			AccessKeyID    string `json:"access_key_id"`
			SecretAccessKey string `json:"secret_access_key"`
			SessionToken   string `json:"session_token"`
			Profile        string `json:"profile"`
		}
		if err := decodeJSON(r, &body); err != nil {
			respondError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		identity, err := service.ValidateBedrockCredentials(
			body.Region, body.AccessKeyID, body.SecretAccessKey, body.SessionToken, body.Profile,
		)
		if err != nil {
			respondJSON(w, http.StatusOK, ProviderValidationResponse{
				Valid: false,
				Error: err.Error(),
			})
			return
		}
		respondJSON(w, http.StatusOK, ProviderValidationResponse{
			Valid:    true,
			Identity: identity,
		})

	default:
		respondError(w, "unknown provider: "+provider, http.StatusBadRequest)
	}
}
