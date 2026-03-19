package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

// TestHandleGetNotificationPrefs_Default verifies that when no config exists,
// default notification preferences are returned.
func TestHandleGetNotificationPrefs_Default(t *testing.T) {
	tmpDir := t.TempDir()

	cfg := Config{
		RepoPath: tmpDir,
	}
	server := &Server{cfg: cfg}

	req := httptest.NewRequest(http.MethodGet, "/api/notifications/preferences", nil)
	rec := httptest.NewRecorder()

	server.handleGetNotificationPrefs(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}

	var prefs NotificationPreferences
	if err := json.Unmarshal(rec.Body.Bytes(), &prefs); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	// Verify defaults
	if !prefs.Enabled {
		t.Errorf("expected Enabled=true, got false")
	}
	if !prefs.BrowserNotify {
		t.Errorf("expected BrowserNotify=true, got false")
	}
	if !prefs.ToastNotify {
		t.Errorf("expected ToastNotify=true, got false")
	}
	if len(prefs.MutedTypes) != 0 {
		t.Errorf("expected MutedTypes to be empty, got %v", prefs.MutedTypes)
	}
}

// TestHandleGetNotificationPrefs_Configured verifies that saved preferences
// are correctly returned from saw.config.json.
func TestHandleGetNotificationPrefs_Configured(t *testing.T) {
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "saw.config.json")

	// Create a config with custom notification preferences
	cfg := configWithNotifications{
		SAWConfig: SAWConfig{
			Agent: AgentConfig{
				ScoutModel: "bedrock:claude-opus-4-6",
			},
		},
		Notifications: NotificationPreferences{
			Enabled:       true,
			MutedTypes:    []NotificationEventType{NotifyWaveComplete, NotifyMergeComplete},
			BrowserNotify: false,
			ToastNotify:   true,
		},
	}

	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		t.Fatalf("failed to marshal config: %v", err)
	}
	if err := os.WriteFile(configPath, data, 0644); err != nil {
		t.Fatalf("failed to write config: %v", err)
	}

	server := &Server{cfg: Config{RepoPath: tmpDir}}

	req := httptest.NewRequest(http.MethodGet, "/api/notifications/preferences", nil)
	rec := httptest.NewRecorder()

	server.handleGetNotificationPrefs(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}

	var prefs NotificationPreferences
	if err := json.Unmarshal(rec.Body.Bytes(), &prefs); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	// Verify saved preferences
	if !prefs.Enabled {
		t.Errorf("expected Enabled=true, got false")
	}
	if prefs.BrowserNotify {
		t.Errorf("expected BrowserNotify=false, got true")
	}
	if !prefs.ToastNotify {
		t.Errorf("expected ToastNotify=true, got false")
	}
	if len(prefs.MutedTypes) != 2 {
		t.Errorf("expected 2 muted types, got %d", len(prefs.MutedTypes))
	}
	if len(prefs.MutedTypes) >= 2 {
		if prefs.MutedTypes[0] != NotifyWaveComplete || prefs.MutedTypes[1] != NotifyMergeComplete {
			t.Errorf("unexpected muted types: %v", prefs.MutedTypes)
		}
	}
}

// TestHandleSaveNotificationPrefs_Valid verifies that valid preferences
// are saved to saw.config.json and can be read back.
func TestHandleSaveNotificationPrefs_Valid(t *testing.T) {
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "saw.config.json")

	// Create initial config with some existing fields
	initialCfg := configWithNotifications{
		SAWConfig: SAWConfig{
			Agent: AgentConfig{
				ScoutModel: "bedrock:claude-opus-4-6",
				WaveModel:  "bedrock:claude-sonnet-4-5",
			},
			Quality: QualityConfig{
				RequireTests: true,
			},
		},
	}
	initialData, _ := json.MarshalIndent(initialCfg, "", "  ")
	if err := os.WriteFile(configPath, initialData, 0644); err != nil {
		t.Fatalf("failed to write initial config: %v", err)
	}

	server := &Server{cfg: Config{RepoPath: tmpDir}}

	// Save new notification preferences
	newPrefs := NotificationPreferences{
		Enabled:       false,
		MutedTypes:    []NotificationEventType{NotifyAgentFailed},
		BrowserNotify: true,
		ToastNotify:   false,
	}

	body, _ := json.Marshal(newPrefs)
	req := httptest.NewRequest(http.MethodPost, "/api/notifications/preferences", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	server.handleSaveNotificationPrefs(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	// Read back the config and verify
	savedData, err := os.ReadFile(configPath)
	if err != nil {
		t.Fatalf("failed to read saved config: %v", err)
	}

	var savedCfg configWithNotifications
	if err := json.Unmarshal(savedData, &savedCfg); err != nil {
		t.Fatalf("failed to unmarshal saved config: %v", err)
	}

	// Verify notification preferences were saved
	if savedCfg.Notifications.Enabled {
		t.Errorf("expected Enabled=false, got true")
	}
	if !savedCfg.Notifications.BrowserNotify {
		t.Errorf("expected BrowserNotify=true, got false")
	}
	if savedCfg.Notifications.ToastNotify {
		t.Errorf("expected ToastNotify=false, got true")
	}
	if len(savedCfg.Notifications.MutedTypes) != 1 || savedCfg.Notifications.MutedTypes[0] != NotifyAgentFailed {
		t.Errorf("unexpected muted types: %v", savedCfg.Notifications.MutedTypes)
	}

	// Verify other config fields were preserved
	if savedCfg.Agent.ScoutModel != "bedrock:claude-opus-4-6" {
		t.Errorf("ScoutModel was not preserved: %s", savedCfg.Agent.ScoutModel)
	}
	if savedCfg.Agent.WaveModel != "bedrock:claude-sonnet-4-5" {
		t.Errorf("WaveModel was not preserved: %s", savedCfg.Agent.WaveModel)
	}
	if !savedCfg.Quality.RequireTests {
		t.Errorf("RequireTests was not preserved")
	}
}

// TestHandleSaveNotificationPrefs_Invalid verifies that malformed JSON
// is rejected with a 400 error.
func TestHandleSaveNotificationPrefs_Invalid(t *testing.T) {
	tmpDir := t.TempDir()
	server := &Server{cfg: Config{RepoPath: tmpDir}}

	// Send invalid JSON
	invalidJSON := []byte(`{"enabled": "not-a-bool"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/notifications/preferences", bytes.NewReader(invalidJSON))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	server.handleSaveNotificationPrefs(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected status 400 for invalid JSON, got %d", rec.Code)
	}
}

// TestHandleSaveNotificationPrefs_NewConfig verifies that preferences can be
// saved even when no config file exists yet.
func TestHandleSaveNotificationPrefs_NewConfig(t *testing.T) {
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "saw.config.json")

	server := &Server{cfg: Config{RepoPath: tmpDir}}

	// Save preferences when no config exists
	newPrefs := NotificationPreferences{
		Enabled:       true,
		MutedTypes:    []NotificationEventType{},
		BrowserNotify: true,
		ToastNotify:   true,
	}

	body, _ := json.Marshal(newPrefs)
	req := httptest.NewRequest(http.MethodPost, "/api/notifications/preferences", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	server.handleSaveNotificationPrefs(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	// Verify config was created with preferences
	savedData, err := os.ReadFile(configPath)
	if err != nil {
		t.Fatalf("failed to read saved config: %v", err)
	}

	var savedCfg configWithNotifications
	if err := json.Unmarshal(savedData, &savedCfg); err != nil {
		t.Fatalf("failed to unmarshal saved config: %v", err)
	}

	if !savedCfg.Notifications.Enabled {
		t.Errorf("expected Enabled=true, got false")
	}
	if !savedCfg.Notifications.BrowserNotify {
		t.Errorf("expected BrowserNotify=true, got false")
	}
	if !savedCfg.Notifications.ToastNotify {
		t.Errorf("expected ToastNotify=true, got false")
	}
}
