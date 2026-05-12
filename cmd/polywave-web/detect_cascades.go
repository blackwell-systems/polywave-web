package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"os"

	"github.com/blackwell-systems/polywave-go/pkg/analyzer"
	"gopkg.in/yaml.v3"
)

// runDetectCascades detects cascade candidates from type renames via AST analysis.
// Command: saw detect-cascades --renames <yaml-file> <repo-root>
// Outputs YAML cascade detection results.
func runDetectCascades(args []string) error {
	fs := flag.NewFlagSet("detect-cascades", flag.ContinueOnError)
	renamesFile := fs.String("renames", "", "Path to YAML file containing rename info (required)")

	if err := fs.Parse(args); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return nil
		}
		return fmt.Errorf("detect-cascades: %w", err)
	}

	if *renamesFile == "" {
		return fmt.Errorf("detect-cascades: --renames flag is required\nUsage: saw detect-cascades --renames <yaml-file> <repo-root>")
	}

	if fs.NArg() < 1 {
		return fmt.Errorf("detect-cascades: repo root is required\nUsage: saw detect-cascades --renames <yaml-file> <repo-root>")
	}

	repoRoot := fs.Arg(0)

	// Validate inputs exist
	if _, statErr := os.Stat(*renamesFile); statErr != nil {
		return fmt.Errorf("detect-cascades: renames file not found: %s", *renamesFile)
	}
	if _, statErr := os.Stat(repoRoot); statErr != nil {
		return fmt.Errorf("detect-cascades: repo root not found: %s", repoRoot)
	}

	// Load renames from YAML
	renamesData, err := os.ReadFile(*renamesFile)
	if err != nil {
		return fmt.Errorf("detect-cascades: failed to read renames file: %w", err)
	}

	var renames []analyzer.RenameInfo
	if err := yaml.Unmarshal(renamesData, &renames); err != nil {
		return fmt.Errorf("detect-cascades: failed to parse renames YAML: %w", err)
	}

	// Call SDK analyzer
	cascadeResult := analyzer.DetectCascades(context.Background(), repoRoot, renames)
	if cascadeResult.IsFatal() {
		return fmt.Errorf("detect-cascades: %s", cascadeResult.Errors[0].Error())
	}

	// Output YAML
	data, err := yaml.Marshal(cascadeResult.GetData())
	if err != nil {
		return fmt.Errorf("detect-cascades: failed to marshal YAML: %w", err)
	}

	fmt.Print(string(data))
	return nil
}
