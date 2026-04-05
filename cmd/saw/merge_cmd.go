package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"os"
	"path/filepath"

	engine "github.com/blackwell-systems/scout-and-wave-go/pkg/engine"
)

// runMerge parses --impl and --wave flags and merges the given wave number
// using the engine package. It does NOT run verification (that is runWave's
// responsibility).
// Flags: --impl <path> (required), --wave <n> (default: 1)
func runMerge(args []string) error {
	fs := flag.NewFlagSet("merge", flag.ContinueOnError)
	implPath := fs.String("impl", "", "Path to IMPL doc (required)")
	waveNum := fs.Int("wave", 1, "Wave number to merge (default: 1)")

	if err := fs.Parse(args); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return nil
		}
		return fmt.Errorf("merge: %w", err)
	}

	if *implPath == "" {
		return fmt.Errorf("merge: --impl flag is required\nRun 'saw merge --help' for usage.")
	}

	// Validate the IMPL path exists before calling the engine.
	if _, statErr := os.Stat(*implPath); statErr != nil {
		return fmt.Errorf("merge: IMPL doc not found: %s", *implPath)
	}

	repoPath, err := findRepoRoot(filepath.Dir(*implPath))
	if err != nil {
		// Fall back to the directory containing the IMPL doc.
		repoPath = filepath.Dir(*implPath)
	}

	if mergeResult := engine.MergeWave(context.Background(), engine.RunMergeOpts{
		IMPLPath: *implPath,
		RepoPath: repoPath,
		WaveNum:  *waveNum,
	}); mergeResult.IsFatal() {
		return fmt.Errorf("merge: %s", mergeResult.Errors[0].Error())
	}

	fmt.Printf("Wave %d merged successfully.\n", *waveNum)
	return nil
}
