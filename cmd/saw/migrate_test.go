package main

import (
	"testing"

	"github.com/blackwell-systems/scout-and-wave-go/pkg/types"
)

func TestSlugify(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"My Feature Name", "my-feature-name"},
		{"API Gateway Integration", "api-gateway-integration"},
		{"Feature123", "feature123"},
		{"Multi   Space   Name", "multi-space-name"},
		{"Name-With-Dashes", "name-with-dashes"},
		{"Name_With_Underscores", "name-with-underscores"},
		{"Special!@#$%Characters", "special-characters"},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := slugify(tt.input)
			if result != tt.expected {
				t.Errorf("slugify(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}

func TestNormalizeVerdict(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"SUITABLE", "suitable"},
		{"suitable", "suitable"},
		{"NOT SUITABLE", "not_suitable"},
		{"not suitable", "not_suitable"},
		{"SUITABLE WITH CAVEATS", "suitable_with_caveats"},
		{"suitable with caveats", "suitable_with_caveats"},
		{"  SUITABLE  ", "suitable"},
		{"unknown", "suitable"}, // default
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := normalizeVerdict(tt.input)
			if result != tt.expected {
				t.Errorf("normalizeVerdict(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}

func TestConvertToManifest(t *testing.T) {
	oldDoc := &types.IMPLDoc{
		FeatureName: "Test Feature",
		Status:      "SUITABLE",
		TestCommand: "go test ./...",
		LintCommand: "go vet ./...",
		FileOwnership: map[string]types.FileOwnershipInfo{
			"pkg/test.go": {
				Agent:  "A",
				Wave:   1,
				Action: "new",
			},
			"pkg/test2.go": {
				Agent:  "B",
				Wave:   1,
				Action: "modify",
			},
		},
		Waves: []types.Wave{
			{
				Number: 1,
				Agents: []types.AgentSpec{
					{
						Letter:     "A",
						Prompt:     "Implement test feature",
						FilesOwned: []string{"pkg/test.go"},
					},
					{
						Letter:     "B",
						Prompt:     "Update test2",
						FilesOwned: []string{"pkg/test2.go"},
						Model:      "claude-opus-4",
					},
				},
			},
		},
	}

	manifest := convertToManifest(oldDoc)

	// Test basic fields
	if manifest.Title != "Test Feature" {
		t.Errorf("Title = %q, want %q", manifest.Title, "Test Feature")
	}
	if manifest.FeatureSlug != "test-feature" {
		t.Errorf("FeatureSlug = %q, want %q", manifest.FeatureSlug, "test-feature")
	}
	if manifest.Verdict != "suitable" {
		t.Errorf("Verdict = %q, want %q", manifest.Verdict, "suitable")
	}
	if manifest.TestCommand != "go test ./..." {
		t.Errorf("TestCommand = %q, want %q", manifest.TestCommand, "go test ./...")
	}
	if manifest.LintCommand != "go vet ./..." {
		t.Errorf("LintCommand = %q, want %q", manifest.LintCommand, "go vet ./...")
	}

	// Test file ownership conversion
	if len(manifest.FileOwnership) != 2 {
		t.Fatalf("FileOwnership length = %d, want 2", len(manifest.FileOwnership))
	}

	// Test wave conversion
	if len(manifest.Waves) != 1 {
		t.Fatalf("Waves length = %d, want 1", len(manifest.Waves))
	}
	if manifest.Waves[0].Number != 1 {
		t.Errorf("Wave[0].Number = %d, want 1", manifest.Waves[0].Number)
	}
	if len(manifest.Waves[0].Agents) != 2 {
		t.Fatalf("Wave[0].Agents length = %d, want 2", len(manifest.Waves[0].Agents))
	}

	// Test agent conversion
	agent1 := manifest.Waves[0].Agents[0]
	if agent1.ID != "A" {
		t.Errorf("Agent[0].ID = %q, want %q", agent1.ID, "A")
	}
	if agent1.Task != "Implement test feature" {
		t.Errorf("Agent[0].Task = %q, want %q", agent1.Task, "Implement test feature")
	}
	if len(agent1.Files) != 1 || agent1.Files[0] != "pkg/test.go" {
		t.Errorf("Agent[0].Files = %v, want [pkg/test.go]", agent1.Files)
	}

	// Test model field
	agent2 := manifest.Waves[0].Agents[1]
	if agent2.Model != "claude-opus-4" {
		t.Errorf("Agent[1].Model = %q, want %q", agent2.Model, "claude-opus-4")
	}
}

func TestConvertFileOwnershipWithDependsOn(t *testing.T) {
	oldDoc := &types.IMPLDoc{
		FeatureName: "Test Feature",
		Status:      "SUITABLE",
		FileOwnership: map[string]types.FileOwnershipInfo{
			"pkg/test.go": {
				Agent:     "A",
				Wave:      1,
				DependsOn: "agent-B, agent-C",
			},
		},
		Waves: []types.Wave{},
	}

	manifest := convertToManifest(oldDoc)

	if len(manifest.FileOwnership) != 1 {
		t.Fatalf("FileOwnership length = %d, want 1", len(manifest.FileOwnership))
	}

	fo := manifest.FileOwnership[0]
	if len(fo.DependsOn) != 2 {
		t.Fatalf("DependsOn length = %d, want 2", len(fo.DependsOn))
	}
	if fo.DependsOn[0] != "agent-B" || fo.DependsOn[1] != "agent-C" {
		t.Errorf("DependsOn = %v, want [agent-B agent-C]", fo.DependsOn)
	}
}
