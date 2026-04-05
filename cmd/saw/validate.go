package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"

	"github.com/blackwell-systems/scout-and-wave-go/pkg/protocol"
)

// runValidate parses flags and validates a YAML IMPL manifest using the SDK.
// Command: saw validate [--fix] <manifest-path>
// Exits 0 with success message if valid, exits 1 with JSON error array if invalid.
func runValidate(args []string) error {
	fs := flag.NewFlagSet("validate", flag.ContinueOnError)
	autoFix := fs.Bool("fix", false, "auto-correct fixable issues (e.g. invalid gate types → custom)")

	if err := fs.Parse(args); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return nil
		}
		return fmt.Errorf("validate: %w", err)
	}

	if fs.NArg() < 1 {
		return fmt.Errorf("validate: manifest path is required\nUsage: saw validate [--fix] <manifest-path>")
	}

	manifestPath := fs.Arg(0)

	res := protocol.FullValidate(context.Background(), manifestPath, protocol.FullValidateOpts{
		AutoFix: *autoFix,
	})

	if res.Data == nil {
		if len(res.Errors) > 0 {
			return fmt.Errorf("validate: %s", res.Errors[0].Message)
		}
		return fmt.Errorf("validate: failed to load manifest: %s", manifestPath)
	}

	data := res.GetData()

	if data.Valid {
		if data.Fixed > 0 {
			fmt.Printf("✓ Manifest valid (auto-fixed %d issue(s))\n", data.Fixed)
		} else {
			fmt.Println("✓ Manifest valid")
		}
		return nil
	}

	// Invalid manifest: output JSON error array to stderr and exit 1
	errJSON, err := json.MarshalIndent(data.Errors, "", "  ")
	if err != nil {
		return fmt.Errorf("validate: manifest has validation errors but failed to marshal JSON: %w", err)
	}

	fmt.Fprintln(os.Stderr, string(errJSON))
	os.Exit(1)
	return nil // unreachable
}
