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

// runExtractContext parses --impl and --agent flags and extracts the agent-specific
// context payload as JSON to stdout.
// Flags: --impl <path> (required), --agent <id> (required)
// Exit codes: 0 on success, 1 if agent not found or on error.
func runExtractContext(args []string) error {
	fs := flag.NewFlagSet("extract-context", flag.ContinueOnError)
	implPath := fs.String("impl", "", "Path to IMPL manifest (required)")
	agentID := fs.String("agent", "", "Agent ID to extract context for (required)")

	if err := fs.Parse(args); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return nil
		}
		return fmt.Errorf("extract-context: %w", err)
	}

	if *implPath == "" {
		return errors.New("extract-context: --impl flag is required\nRun 'saw extract-context --help' for usage.")
	}

	if *agentID == "" {
		return errors.New("extract-context: --agent flag is required\nRun 'saw extract-context --help' for usage.")
	}

	// Validate the IMPL path exists
	if _, statErr := os.Stat(*implPath); statErr != nil {
		return fmt.Errorf("extract-context: IMPL doc not found: %s", *implPath)
	}

	// Load the manifest
	manifest, err := protocol.Load(context.Background(), *implPath)
	if err != nil {
		return fmt.Errorf("extract-context: %w", err)
	}

	// Find the agent across all waves
	var agent *protocol.Agent
	var waveNum int
	for _, wave := range manifest.Waves {
		for _, ag := range wave.Agents {
			if ag.ID == *agentID {
				agent = &ag
				waveNum = wave.Number
				break
			}
		}
		if agent != nil {
			break
		}
	}

	if agent == nil {
		return fmt.Errorf("extract-context: agent %q not found", *agentID)
	}

	// Build the context payload JSON
	type jsonOutput struct {
		AgentID            string                     `json:"agent_id"`
		Wave               int                        `json:"wave"`
		Task               string                     `json:"task"`
		Files              []string                   `json:"files"`
		Dependencies       []string                   `json:"dependencies"`
		Model              string                     `json:"model,omitempty"`
		InterfaceContracts []protocol.InterfaceContract `json:"interface_contracts"`
		QualityGates       *protocol.QualityGates     `json:"quality_gates,omitempty"`
		IMPLDocPath        string                     `json:"impl_doc_path"`
	}

	output := jsonOutput{
		AgentID:            agent.ID,
		Wave:               waveNum,
		Task:               agent.Task,
		Files:              agent.Files,
		Dependencies:       agent.Dependencies,
		Model:              agent.Model,
		InterfaceContracts: manifest.InterfaceContracts,
		QualityGates:       manifest.QualityGates,
		IMPLDocPath:        *implPath,
	}

	// Marshal to JSON and write to stdout
	data, err := json.MarshalIndent(output, "", "  ")
	if err != nil {
		return fmt.Errorf("extract-context: failed to marshal JSON: %w", err)
	}

	fmt.Println(string(data))
	return nil
}
