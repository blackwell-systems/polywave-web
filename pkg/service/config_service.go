package service

import (
	"context"
	"fmt"
	"net/http"
	"path/filepath"
	"regexp"
	"time"

	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/sts"
	"github.com/blackwell-systems/polywave-go/pkg/config"
	"github.com/blackwell-systems/polywave-go/pkg/result"
)

// ValidateModelName ensures a model name contains only safe characters.
// Returns nil for empty strings (falls back to defaults).
func ValidateModelName(model string) error {
	if model == "" {
		return nil
	}
	if len(model) > 200 {
		return fmt.Errorf("model name too long (max 200 chars)")
	}
	matched, _ := regexp.MatchString(`^[a-zA-Z0-9:._/-]+$`, model)
	if !matched {
		return fmt.Errorf("model name contains invalid characters")
	}
	return nil
}

// GetConfig reads polywave.config.json from the repo and returns a config.PolywaveConfig.
// If the config file does not exist, returns a default config with the
// repo from deps.RepoPath as the single entry.
func GetConfig(deps Deps) (*config.PolywaveConfig, error) {
	res := config.Load(deps.RepoPath)
	if res.IsSuccess() {
		return res.GetData(), nil
	}
	// If not found, return default with repo from deps
	if len(res.Errors) > 0 && res.Errors[0].Code == result.CodeConfigNotFound {
		repoName := filepath.Base(deps.RepoPath)
		return &config.PolywaveConfig{
			Repos: []config.RepoEntry{{Name: repoName, Path: deps.RepoPath}},
		}, nil
	}
	return nil, fmt.Errorf("config load failed: %s", res.Errors[0].Message)
}

// SaveConfig validates model names and atomically writes the config to
// polywave.config.json using the SDK's config.Save (temp file + rename).
func SaveConfig(deps Deps, cfg *config.PolywaveConfig) error {
	// Validate all model name fields
	models := map[string]string{
		"scout_model":       cfg.Agent.ScoutModel,
		"wave_model":        cfg.Agent.WaveModel,
		"chat_model":        cfg.Agent.ChatModel,
		"integration_model": cfg.Agent.IntegrationModel,
		"review_model":      cfg.Agent.ReviewModel,
	}
	for field, model := range models {
		if err := ValidateModelName(model); err != nil {
			return fmt.Errorf("invalid %s: %w", field, err)
		}
	}

	res := config.Save(deps.RepoPath, cfg)
	if !res.IsSuccess() {
		return fmt.Errorf("config save failed: %s", res.Errors[0].Message)
	}
	return nil
}

// validationTimeout is the maximum time allowed for credential validation calls.
const validationTimeout = 5 * time.Second

// ValidateAnthropicCredentials validates an Anthropic API key by calling
// GET /v1/models. Returns nil if the key is valid.
func ValidateAnthropicCredentials(apiKey string) error {
	if apiKey == "" {
		return fmt.Errorf("API key is required")
	}

	ctx, cancel := context.WithTimeout(context.Background(), validationTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://api.anthropic.com/v1/models", nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("x-api-key", apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return fmt.Errorf("invalid API key")
	}
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status: %d", resp.StatusCode)
	}
	return nil
}

// ValidateOpenAICredentials validates an OpenAI API key by calling
// GET /v1/models. Returns nil if the key is valid.
func ValidateOpenAICredentials(apiKey string) error {
	if apiKey == "" {
		return fmt.Errorf("API key is required")
	}

	ctx, cancel := context.WithTimeout(context.Background(), validationTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://api.openai.com/v1/models", nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return fmt.Errorf("invalid API key")
	}
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status: %d", resp.StatusCode)
	}
	return nil
}

// ValidateBedrockCredentials validates AWS credentials by calling STS
// GetCallerIdentity. Returns the caller identity ARN on success.
func ValidateBedrockCredentials(region, accessKeyID, secretKey, sessionToken, profile string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), validationTimeout)
	defer cancel()

	var stsClient *sts.Client

	if profile != "" {
		// Use named profile (SSO, assume-role, etc.)
		var opts []func(*awsconfig.LoadOptions) error
		opts = append(opts, awsconfig.WithSharedConfigProfile(profile))
		if region != "" {
			opts = append(opts, awsconfig.WithRegion(region))
		}
		awsCfg, err := awsconfig.LoadDefaultConfig(ctx, opts...)
		if err != nil {
			return "", fmt.Errorf("failed to load profile %q: %w", profile, err)
		}
		stsClient = sts.NewFromConfig(awsCfg)
	} else {
		// Static credentials path
		if region == "" {
			return "", fmt.Errorf("region is required")
		}
		if accessKeyID == "" || secretKey == "" {
			return "", fmt.Errorf("access key ID and secret key are required")
		}
		creds := credentials.NewStaticCredentialsProvider(accessKeyID, secretKey, sessionToken)
		stsClient = sts.New(sts.Options{
			Region:           region,
			Credentials:      creds,
			RetryMaxAttempts: 1,
		})
	}

	stsResult, err := stsClient.GetCallerIdentity(ctx, &sts.GetCallerIdentityInput{})
	if err != nil {
		return "", fmt.Errorf("invalid credentials: %w", err)
	}

	arn := ""
	if stsResult.Arn != nil {
		arn = *stsResult.Arn
	}
	return arn, nil
}

// GetConfiguredRepos reads the config and returns the repo list.
// Falls back to a single entry using deps.RepoPath if no config exists.
func GetConfiguredRepos(deps Deps) []config.RepoEntry {
	cfg, err := GetConfig(deps)
	if err != nil || len(cfg.Repos) == 0 {
		repoName := filepath.Base(deps.RepoPath)
		return []config.RepoEntry{{Name: repoName, Path: deps.RepoPath}}
	}
	return cfg.Repos
}
