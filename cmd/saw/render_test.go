package main

import (
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/blackwell-systems/scout-and-wave-go/pkg/protocol"
)

func TestRender(t *testing.T) {
	// Create a temporary directory for test manifests
	tmpDir, err := os.MkdirTemp("", "render-test-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	tests := []struct {
		name             string
		manifest         *protocol.IMPLManifest
		expectInOutput   []string
		notExpectInOutput []string
	}{
		{
			name: "basic manifest",
			manifest: &protocol.IMPLManifest{
				Title:       "Test Feature",
				FeatureSlug: "test-feature",
				Verdict:     "SUITABLE",
				Waves: []protocol.Wave{
					{
						Number: 1,
						Agents: []protocol.Agent{
							{
								ID:   "A",
								Task: "Implement feature A",
								Files: []string{
									"src/feature_a.go",
									"src/feature_a_test.go",
								},
							},
						},
					},
				},
			},
			expectInOutput: []string{
				"# IMPL: Test Feature",
				"## Scout Verdict",
				"**Verdict:** SUITABLE",
				"## Wave 1",
				"### Agent A",
				"**Task:** Implement feature A",
				"- src/feature_a.go",
				"- src/feature_a_test.go",
			},
		},
		{
			name: "manifest with file ownership",
			manifest: &protocol.IMPLManifest{
				Title: "Test with File Ownership",
				FileOwnership: []protocol.FileOwnership{
					{File: "src/foo.go", Agent: "A", Wave: 1, Action: "new"},
					{File: "src/bar.go", Agent: "B", Wave: 1, Action: "modify"},
				},
				Waves: []protocol.Wave{
					{
						Number: 1,
						Agents: []protocol.Agent{
							{ID: "A", Task: "Create foo"},
							{ID: "B", Task: "Update bar"},
						},
					},
				},
			},
			expectInOutput: []string{
				"## File Ownership",
				"| File | Agent | Wave | Action |",
				"| src/foo.go | A | 1 | new |",
				"| src/bar.go | B | 1 | modify |",
			},
		},
		{
			name: "manifest with interface contracts",
			manifest: &protocol.IMPLManifest{
				Title: "Test with Contracts",
				Waves: []protocol.Wave{
					{
						Number: 1,
						Agents: []protocol.Agent{
							{ID: "A", Task: "Implement API"},
						},
					},
				},
				InterfaceContracts: []protocol.InterfaceContract{
					{
						Name:        "UserAPI",
						Description: "User management API",
						Location:    "pkg/api/user.go",
						Definition:  "type UserAPI interface {\n  GetUser(id string) (*User, error)\n}",
					},
				},
			},
			expectInOutput: []string{
				"## Interface Contracts",
				"### UserAPI",
				"User management API",
				"**Location:** pkg/api/user.go",
				"type UserAPI interface",
			},
		},
		{
			name: "manifest with completion reports",
			manifest: &protocol.IMPLManifest{
				Title: "Test with Reports",
				Waves: []protocol.Wave{
					{
						Number: 1,
						Agents: []protocol.Agent{
							{ID: "A", Task: "Task A"},
						},
					},
				},
				CompletionReports: map[string]protocol.CompletionReport{
					"A": {
						Status:       "complete",
						Branch:       "wave1-agent-A",
						Commit:       "abc123",
						FilesChanged: []string{"src/foo.go"},
						FilesCreated: []string{"src/foo_test.go"},
						Verification: "PASS",
					},
				},
			},
			expectInOutput: []string{
				"**Completion Report:**",
				"status: complete",
				"branch: wave1-agent-A",
				"commit: abc123",
				"files_changed:",
				"  - src/foo.go",
				"files_created:",
				"  - src/foo_test.go",
				"verification: PASS",
			},
		},
		{
			name: "manifest with quality gates",
			manifest: &protocol.IMPLManifest{
				Title: "Test with Quality Gates",
				Waves: []protocol.Wave{
					{
						Number: 1,
						Agents: []protocol.Agent{
							{ID: "A", Task: "Task A"},
						},
					},
				},
				QualityGates: &protocol.QualityGates{
					Level: "standard",
					Gates: []protocol.QualityGate{
						{
							Type:        "build",
							Command:     "go build ./...",
							Required:    true,
							Description: "Build all packages",
						},
						{
							Type:     "test",
							Command:  "go test ./...",
							Required: true,
						},
					},
				},
			},
			expectInOutput: []string{
				"## Quality Gates",
				"**Level:** standard",
				"**build** (required): `go build ./...`",
				"Build all packages",
				"**test** (required): `go test ./...`",
			},
		},
		{
			name: "manifest with scaffolds",
			manifest: &protocol.IMPLManifest{
				Title: "Test with Scaffolds",
				Waves: []protocol.Wave{
					{
						Number: 1,
						Agents: []protocol.Agent{
							{ID: "A", Task: "Task A"},
						},
					},
				},
				Scaffolds: []protocol.ScaffoldFile{
					{
						FilePath:   "pkg/types/user.go",
						ImportPath: "github.com/example/pkg/types",
						Status:     "committed",
						Contents:   "package types\n\ntype User struct {\n  ID string\n}",
					},
				},
			},
			expectInOutput: []string{
				"## Scaffolds",
				"### pkg/types/user.go",
				"**Import Path:** github.com/example/pkg/types",
				"**Status:** committed",
				"package types",
				"type User struct",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Write manifest to file
			manifestPath := filepath.Join(tmpDir, tt.name+".yaml")
			if err := protocol.Save(tt.manifest, manifestPath); err != nil {
				t.Fatalf("Failed to save manifest: %v", err)
			}

			// Capture stdout
			oldStdout := os.Stdout
			r, w, _ := os.Pipe()
			os.Stdout = w

			// Run render command
			args := []string{manifestPath}
			err := runRender(args)
			if err != nil {
				t.Fatalf("runRender failed: %v", err)
			}

			// Restore stdout
			w.Close()
			os.Stdout = oldStdout

			// Read captured output
			var buf strings.Builder
			_, _ = io.Copy(&buf, r)
			output := buf.String()

			// Check expected strings
			for _, expected := range tt.expectInOutput {
				if !strings.Contains(output, expected) {
					t.Errorf("Expected output to contain %q, but it didn't.\nOutput:\n%s", expected, output)
				}
			}

			// Check strings that should NOT be present
			for _, notExpected := range tt.notExpectInOutput {
				if strings.Contains(output, notExpected) {
					t.Errorf("Expected output NOT to contain %q, but it did.\nOutput:\n%s", notExpected, output)
				}
			}
		})
	}
}

func TestRenderErrors(t *testing.T) {
	tests := []struct {
		name      string
		args      []string
		expectErr bool
	}{
		{
			name:      "missing arguments",
			args:      []string{},
			expectErr: true,
		},
		{
			name:      "manifest not found",
			args:      []string{"/nonexistent/manifest.yaml"},
			expectErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := runRender(tt.args)
			if tt.expectErr && err == nil {
				t.Error("Expected error but got nil")
			}
			if !tt.expectErr && err != nil {
				t.Errorf("Expected no error but got: %v", err)
			}
		})
	}
}

func TestRenderMarkdownOutput(t *testing.T) {
	manifest := &protocol.IMPLManifest{
		Title:       "Multi-Wave Feature",
		FeatureSlug: "multi-wave",
		Verdict:     "SUITABLE",
		FileOwnership: []protocol.FileOwnership{
			{File: "src/a.go", Agent: "A", Wave: 1},
			{File: "src/b.go", Agent: "B", Wave: 2},
		},
		Waves: []protocol.Wave{
			{
				Number: 1,
				Agents: []protocol.Agent{
					{ID: "A", Task: "Wave 1 work", Files: []string{"src/a.go"}},
				},
			},
			{
				Number: 2,
				Agents: []protocol.Agent{
					{ID: "B", Task: "Wave 2 work", Files: []string{"src/b.go"}, Dependencies: []string{"A"}},
				},
			},
		},
	}

	// Capture output
	oldStdout := os.Stdout
	r, w, _ := os.Pipe()
	os.Stdout = w

	renderMarkdown(manifest)

	w.Close()
	os.Stdout = oldStdout

	var buf strings.Builder
	_, _ = io.Copy(&buf, r)
	output := buf.String()

	// Verify structure
	expectedSections := []string{
		"# IMPL: Multi-Wave Feature",
		"## Scout Verdict",
		"## File Ownership",
		"## Wave 1",
		"### Agent A",
		"## Wave 2",
		"### Agent B",
		"**Dependencies:** A",
	}

	for _, section := range expectedSections {
		if !strings.Contains(output, section) {
			t.Errorf("Expected section %q not found in output:\n%s", section, output)
		}
	}
}
