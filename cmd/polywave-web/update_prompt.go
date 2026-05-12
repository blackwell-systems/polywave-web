package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"

	"github.com/blackwell-systems/polywave-go/pkg/protocol"
)

// runUpdateAgentPrompt updates an agent's prompt field in the manifest.
// Command: saw update-agent-prompt <manifest-path> --agent <id>
// Reads the new prompt text from stdin.
func runUpdateAgentPrompt(args []string) error {
	fs := flag.NewFlagSet("update-agent-prompt", flag.ContinueOnError)
	agentID := fs.String("agent", "", "Agent ID (required)")

	if err := fs.Parse(args); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return nil
		}
		return fmt.Errorf("update-agent-prompt: %w", err)
	}

	if fs.NArg() < 1 {
		return fmt.Errorf("update-agent-prompt: manifest path is required\nUsage: saw update-agent-prompt <manifest-path> --agent <id>")
	}

	if *agentID == "" {
		return fmt.Errorf("update-agent-prompt: --agent flag is required\nUsage: saw update-agent-prompt <manifest-path> --agent <id>")
	}

	manifestPath := fs.Arg(0)

	// Read new prompt text from stdin
	promptBytes, err := io.ReadAll(os.Stdin)
	if err != nil {
		return fmt.Errorf("update-agent-prompt: failed to read stdin: %w", err)
	}

	newPrompt := string(promptBytes)

	// Load manifest
	ctx := context.Background()
	manifest, err := protocol.Load(ctx, manifestPath)
	if err != nil {
		if os.IsNotExist(err) {
			return fmt.Errorf("update-agent-prompt: manifest file not found: %s", manifestPath)
		}
		return fmt.Errorf("update-agent-prompt: %w", err)
	}

	// Update agent prompt
	if updateResult := protocol.UpdateAgentPrompt(manifest, *agentID, newPrompt); updateResult.IsFatal() {
		return fmt.Errorf("update-agent-prompt: %s", updateResult.Errors[0].Message)
	}

	// Save manifest back
	if saveResult := protocol.Save(ctx, manifest, manifestPath); saveResult.IsFatal() {
		return fmt.Errorf("update-agent-prompt: failed to save manifest: %s", saveResult.Errors[0].Message)
	}

	fmt.Printf("✓ Agent %s prompt updated\n", *agentID)
	return nil
}
