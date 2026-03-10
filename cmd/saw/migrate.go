package main

import (
	"errors"
	"flag"
	"fmt"
	"os"
	"strings"

	"github.com/blackwell-systems/scout-and-wave-go/pkg/engine"
	"github.com/blackwell-systems/scout-and-wave-go/pkg/protocol"
	"github.com/blackwell-systems/scout-and-wave-go/pkg/types"
	"gopkg.in/yaml.v3"
)

// runMigrate parses flags and converts a markdown IMPL doc to YAML manifest format.
// Command: saw migrate <old-impl.md>
// Outputs YAML to stdout on success, exits 1 on error.
func runMigrate(args []string) error {
	fs := flag.NewFlagSet("migrate", flag.ContinueOnError)

	if err := fs.Parse(args); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return nil
		}
		return fmt.Errorf("migrate: %w", err)
	}

	if fs.NArg() < 1 {
		return fmt.Errorf("migrate: IMPL doc path is required\nUsage: saw migrate <old-impl.md>")
	}

	implPath := fs.Arg(0)

	// Check if file exists
	if _, err := os.Stat(implPath); err != nil {
		if os.IsNotExist(err) {
			return fmt.Errorf("migrate: IMPL doc not found: %s", implPath)
		}
		return fmt.Errorf("migrate: %w", err)
	}

	// Parse the markdown IMPL doc using the existing parser
	oldDoc, err := engine.ParseIMPLDoc(implPath)
	if err != nil {
		return fmt.Errorf("migrate: failed to parse IMPL doc: %w", err)
	}

	// Convert to new YAML manifest format
	manifest := convertToManifest(oldDoc)

	// Marshal to YAML
	yamlData, err := yaml.Marshal(manifest)
	if err != nil {
		return fmt.Errorf("migrate: failed to marshal YAML: %w", err)
	}

	// Output to stdout
	fmt.Print(string(yamlData))
	return nil
}

// convertToManifest transforms a types.IMPLDoc to a protocol.IMPLManifest.
func convertToManifest(oldDoc *types.IMPLDoc) *protocol.IMPLManifest {
	manifest := &protocol.IMPLManifest{
		Title:       oldDoc.FeatureName,
		FeatureSlug: slugifyFeatureName(oldDoc.FeatureName),
		Verdict:     normalizeVerdict(oldDoc.Status),
		TestCommand: oldDoc.TestCommand,
		LintCommand: oldDoc.LintCommand,
	}

	// Convert file ownership map to slice
	fileOwnership := make([]protocol.FileOwnership, 0, len(oldDoc.FileOwnership))
	for filePath, info := range oldDoc.FileOwnership {
		fo := protocol.FileOwnership{
			File:   filePath,
			Agent:  info.Agent,
			Wave:   info.Wave,
			Action: info.Action,
			Repo:   info.Repo,
		}
		// Convert DependsOn string to slice if present
		if info.DependsOn != "" {
			fo.DependsOn = strings.Split(info.DependsOn, ",")
			for i := range fo.DependsOn {
				fo.DependsOn[i] = strings.TrimSpace(fo.DependsOn[i])
			}
		}
		fileOwnership = append(fileOwnership, fo)
	}
	manifest.FileOwnership = fileOwnership

	// Convert waves
	waves := make([]protocol.Wave, 0, len(oldDoc.Waves))
	for _, oldWave := range oldDoc.Waves {
		wave := protocol.Wave{
			Number: oldWave.Number,
			Agents: make([]protocol.Agent, 0, len(oldWave.Agents)),
		}
		for _, oldAgent := range oldWave.Agents {
			agent := protocol.Agent{
				ID:    oldAgent.Letter,
				Task:  oldAgent.Prompt,
				Files: oldAgent.FilesOwned,
				Model: oldAgent.Model,
			}
			// Dependencies are not in the old format, leave empty
			wave.Agents = append(wave.Agents, agent)
		}
		waves = append(waves, wave)
	}
	manifest.Waves = waves

	// Convert QualityGates if present
	if oldDoc.QualityGates != nil {
		// Convert types.QualityGates to protocol.QualityGates
		gates := make([]protocol.QualityGate, len(oldDoc.QualityGates.Gates))
		for i, g := range oldDoc.QualityGates.Gates {
			gates[i] = protocol.QualityGate{
				Type:     g.Type,
				Command:  g.Command,
				Required: g.Required,
			}
		}
		manifest.QualityGates = &protocol.QualityGates{
			Level: oldDoc.QualityGates.Level,
			Gates: gates,
		}
	}

	// Convert Scaffolds if present
	if len(oldDoc.ScaffoldsDetail) > 0 {
		scaffolds := make([]protocol.ScaffoldFile, len(oldDoc.ScaffoldsDetail))
		for i, s := range oldDoc.ScaffoldsDetail {
			scaffolds[i] = protocol.ScaffoldFile{
				FilePath:   s.FilePath,
				Contents:   s.Contents,
				ImportPath: s.ImportPath,
			}
		}
		manifest.Scaffolds = scaffolds
	}

	// Convert PreMortem if present
	if oldDoc.PreMortem != nil {
		rows := make([]protocol.PreMortemRow, len(oldDoc.PreMortem.Rows))
		for i, row := range oldDoc.PreMortem.Rows {
			rows[i] = protocol.PreMortemRow{
				Scenario:   row.Scenario,
				Likelihood: row.Likelihood,
				Impact:     row.Impact,
				Mitigation: row.Mitigation,
			}
		}
		manifest.PreMortem = &protocol.PreMortem{
			OverallRisk: oldDoc.PreMortem.OverallRisk,
			Rows:        rows,
		}
	}

	// Convert KnownIssues if present
	if len(oldDoc.KnownIssues) > 0 {
		issues := make([]protocol.KnownIssue, len(oldDoc.KnownIssues))
		for i, issue := range oldDoc.KnownIssues {
			issues[i] = protocol.KnownIssue{
				Description: issue.Description,
				Status:      issue.Status,
				Workaround:  issue.Workaround,
			}
		}
		manifest.KnownIssues = issues
	}

	// Interface contracts would need to be parsed from InterfaceContractsText
	// but that's complex markdown parsing; for now leave empty
	manifest.InterfaceContracts = []protocol.InterfaceContract{}

	return manifest
}

// slugifyFeatureName converts a feature name to a URL-safe slug.
// Example: "My Feature Name" -> "my-feature-name"
// This is specific to migrate command to avoid conflicts with slugify in commands.go.
func slugifyFeatureName(s string) string {
	return slugify(s)
}

// normalizeVerdict maps old status values to new verdict enum.
// Old: "SUITABLE", "NOT SUITABLE", "SUITABLE WITH CAVEATS"
// New: "suitable", "not_suitable", "suitable_with_caveats"
func normalizeVerdict(status string) string {
	status = strings.ToUpper(strings.TrimSpace(status))
	switch status {
	case "SUITABLE":
		return "suitable"
	case "NOT SUITABLE":
		return "not_suitable"
	case "SUITABLE WITH CAVEATS":
		return "suitable_with_caveats"
	default:
		// Default to suitable if unknown
		return "suitable"
	}
}
