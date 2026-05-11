package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// TestExtractContextSuccess verifies that extract-context outputs valid JSON
// for a known agent in a test manifest.
func TestExtractContextSuccess(t *testing.T) {
	// Create a temporary YAML manifest
	tmpDir := t.TempDir()
	manifestPath := filepath.Join(tmpDir, "test-manifest.yaml")

	manifestYAML := `title: Test Feature
feature_slug: test-feature
verdict: SUITABLE
test_command: go test ./...
lint_command: golangci-lint run
file_ownership:
  - file: cmd/test/main.go
    agent: A
    wave: 1
interface_contracts:
  - name: TestInterface
    description: Test interface for agent A
    definition: type TestInterface interface { Test() error }
    location: pkg/test/interface.go
waves:
  - number: 1
    agents:
      - id: A
        task: Implement test feature
        files:
          - cmd/test/main.go
        dependencies: []
        model: claude-3-opus
  - number: 2
    agents:
      - id: B
        task: Add tests
        files:
          - cmd/test/main_test.go
        dependencies:
          - A
quality_gates:
  level: standard
  gates:
    - type: build
      command: go build ./...
      required: true
`

	if err := os.WriteFile(manifestPath, []byte(manifestYAML), 0644); err != nil {
		t.Fatalf("failed to create test manifest: %v", err)
	}

	// Capture stdout by redirecting it to a temp file
	oldStdout := os.Stdout
	r, w, err := os.Pipe()
	if err != nil {
		t.Fatalf("failed to create pipe: %v", err)
	}
	os.Stdout = w

	// Run extract-context for agent A
	err = runExtractContext([]string{"--impl", manifestPath, "--agent", "A"})
	w.Close()
	os.Stdout = oldStdout

	if err != nil {
		t.Fatalf("runExtractContext failed: %v", err)
	}

	// Read captured output
	var outputBuf strings.Builder
	buf := make([]byte, 1024)
	for {
		n, err := r.Read(buf)
		if n > 0 {
			outputBuf.Write(buf[:n])
		}
		if err != nil {
			break
		}
	}
	output := outputBuf.String()

	// Parse the JSON output
	var result map[string]interface{}
	if err := json.Unmarshal([]byte(output), &result); err != nil {
		t.Fatalf("failed to parse JSON output: %v\nOutput:\n%s", err, output)
	}

	// Verify key fields
	if result["agent_id"] != "A" {
		t.Errorf("expected agent_id=A, got %v", result["agent_id"])
	}

	if waveNum, ok := result["wave"].(float64); !ok || int(waveNum) != 1 {
		t.Errorf("expected wave=1, got %v", result["wave"])
	}

	if result["task"] != "Implement test feature" {
		t.Errorf("expected task='Implement test feature', got %v", result["task"])
	}

	files, ok := result["files"].([]interface{})
	if !ok || len(files) != 1 || files[0] != "cmd/test/main.go" {
		t.Errorf("expected files=[cmd/test/main.go], got %v", result["files"])
	}

	if result["impl_doc_path"] != manifestPath {
		t.Errorf("expected impl_doc_path=%s, got %v", manifestPath, result["impl_doc_path"])
	}
}

// TestExtractContextAgentNotFound verifies that extract-context returns an error
// when the agent ID is not found in the manifest.
func TestExtractContextAgentNotFound(t *testing.T) {
	tmpDir := t.TempDir()
	manifestPath := filepath.Join(tmpDir, "test-manifest.yaml")

	manifestYAML := `title: Test Feature
feature_slug: test-feature
verdict: SUITABLE
test_command: go test ./...
waves:
  - number: 1
    agents:
      - id: A
        task: Implement test feature
        files:
          - cmd/test/main.go
`

	if err := os.WriteFile(manifestPath, []byte(manifestYAML), 0644); err != nil {
		t.Fatalf("failed to create test manifest: %v", err)
	}

	// Run extract-context for non-existent agent Z
	err := runExtractContext([]string{"--impl", manifestPath, "--agent", "Z"})
	if err == nil {
		t.Fatal("expected error for non-existent agent, got nil")
	}

	if !strings.Contains(err.Error(), "agent \"Z\" not found") {
		t.Errorf("expected 'agent \"Z\" not found' error, got: %v", err)
	}
}

// TestExtractContextMissingFlags verifies that extract-context returns an error
// when required flags are missing.
func TestExtractContextMissingFlags(t *testing.T) {
	tests := []struct {
		name     string
		args     []string
		wantErr  string
	}{
		{
			name:    "missing --impl",
			args:    []string{"--agent", "A"},
			wantErr: "--impl flag is required",
		},
		{
			name:    "missing --agent",
			args:    []string{"--impl", "/tmp/test.yaml"},
			wantErr: "--agent flag is required",
		},
		{
			name:    "missing both",
			args:    []string{},
			wantErr: "--impl flag is required",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := runExtractContext(tt.args)
			if err == nil {
				t.Fatal("expected error, got nil")
			}
			if !strings.Contains(err.Error(), tt.wantErr) {
				t.Errorf("expected error containing %q, got: %v", tt.wantErr, err)
			}
		})
	}
}

// TestExtractContextWave2Agent verifies extraction of an agent from wave 2.
func TestExtractContextWave2Agent(t *testing.T) {
	tmpDir := t.TempDir()
	manifestPath := filepath.Join(tmpDir, "test-manifest.yaml")

	manifestYAML := `title: Test Feature
feature_slug: test-feature
verdict: SUITABLE
test_command: go test ./...
waves:
  - number: 1
    agents:
      - id: A
        task: Implement core
        files:
          - pkg/core.go
  - number: 2
    agents:
      - id: B
        task: Add CLI
        files:
          - cmd/cli.go
        dependencies:
          - A
        model: claude-3-5-sonnet
`

	if err := os.WriteFile(manifestPath, []byte(manifestYAML), 0644); err != nil {
		t.Fatalf("failed to create test manifest: %v", err)
	}

	// Capture stdout
	oldStdout := os.Stdout
	r, w, err := os.Pipe()
	if err != nil {
		t.Fatalf("failed to create pipe: %v", err)
	}
	os.Stdout = w

	err = runExtractContext([]string{"--impl", manifestPath, "--agent", "B"})
	w.Close()
	os.Stdout = oldStdout

	if err != nil {
		t.Fatalf("runExtractContext failed: %v", err)
	}

	var outputBuf strings.Builder
	buf := make([]byte, 1024)
	for {
		n, err := r.Read(buf)
		if n > 0 {
			outputBuf.Write(buf[:n])
		}
		if err != nil {
			break
		}
	}
	output := outputBuf.String()

	var result map[string]interface{}
	if err := json.Unmarshal([]byte(output), &result); err != nil {
		t.Fatalf("failed to parse JSON output: %v", err)
	}

	if result["agent_id"] != "B" {
		t.Errorf("expected agent_id=B, got %v", result["agent_id"])
	}

	if waveNum, ok := result["wave"].(float64); !ok || int(waveNum) != 2 {
		t.Errorf("expected wave=2, got %v", result["wave"])
	}

	deps, ok := result["dependencies"].([]interface{})
	if !ok || len(deps) != 1 || deps[0] != "A" {
		t.Errorf("expected dependencies=[A], got %v", result["dependencies"])
	}

	if result["model"] != "claude-3-5-sonnet" {
		t.Errorf("expected model='claude-3-5-sonnet', got %v", result["model"])
	}
}
