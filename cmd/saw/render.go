package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"os"
	"strings"

	"github.com/blackwell-systems/scout-and-wave-go/pkg/protocol"
)

// runRender loads a manifest and renders it as markdown to stdout.
// Command: saw render <manifest-path>
// Exit 0 on success, exit 1 on error.
func runRender(args []string) error {
	fs := flag.NewFlagSet("render", flag.ContinueOnError)

	if err := fs.Parse(args); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return nil
		}
		return fmt.Errorf("render: %w", err)
	}

	if fs.NArg() < 1 {
		return fmt.Errorf("render: manifest path is required\nUsage: saw render <manifest-path>")
	}

	manifestPath := fs.Arg(0)

	// Load the manifest
	manifest, err := protocol.Load(context.Background(), manifestPath)
	if err != nil {
		if os.IsNotExist(err) {
			return fmt.Errorf("render: manifest file not found: %s", manifestPath)
		}
		return fmt.Errorf("render: %w", err)
	}

	// Render markdown
	renderMarkdown(manifest)
	return nil
}

// renderMarkdown generates markdown output from a manifest and writes to stdout.
func renderMarkdown(m *protocol.IMPLManifest) {
	// Title
	fmt.Printf("# IMPL: %s\n\n", m.Title)

	// Verdict section
	if m.Verdict != "" {
		fmt.Printf("## Scout Verdict\n\n")
		fmt.Printf("**Verdict:** %s\n\n", m.Verdict)
	}

	// File ownership table
	if len(m.FileOwnership) > 0 {
		fmt.Printf("## File Ownership\n\n")
		fmt.Printf("| File | Agent | Wave | Action |\n")
		fmt.Printf("|------|-------|------|--------|\n")
		for _, fo := range m.FileOwnership {
			action := fo.Action
			if action == "" {
				action = "modify"
			}
			fmt.Printf("| %s | %s | %d | %s |\n", fo.File, fo.Agent, fo.Wave, action)
		}
		fmt.Printf("\n")
	}

	// Waves
	if len(m.Waves) > 0 {
		for _, wave := range m.Waves {
			fmt.Printf("## Wave %d\n\n", wave.Number)
			for _, agent := range wave.Agents {
				fmt.Printf("### Agent %s\n\n", agent.ID)
				fmt.Printf("**Task:** %s\n\n", agent.Task)

				if len(agent.Files) > 0 {
					fmt.Printf("**Files:**\n")
					for _, f := range agent.Files {
						fmt.Printf("- %s\n", f)
					}
					fmt.Printf("\n")
				}

				if len(agent.Dependencies) > 0 {
					fmt.Printf("**Dependencies:** %s\n\n", strings.Join(agent.Dependencies, ", "))
				}

				// Completion report if present
				if report, exists := m.CompletionReports[agent.ID]; exists {
					fmt.Printf("**Completion Report:**\n\n")
					fmt.Printf("```yaml\n")
					fmt.Printf("status: %s\n", report.Status)
					if report.Branch != "" {
						fmt.Printf("branch: %s\n", report.Branch)
					}
					if report.Commit != "" {
						fmt.Printf("commit: %s\n", report.Commit)
					}
					if len(report.FilesChanged) > 0 {
						fmt.Printf("files_changed:\n")
						for _, f := range report.FilesChanged {
							fmt.Printf("  - %s\n", f)
						}
					}
					if len(report.FilesCreated) > 0 {
						fmt.Printf("files_created:\n")
						for _, f := range report.FilesCreated {
							fmt.Printf("  - %s\n", f)
						}
					}
					if len(report.TestsAdded) > 0 {
						fmt.Printf("tests_added:\n")
						for _, t := range report.TestsAdded {
							fmt.Printf("  - %s\n", t)
						}
					}
					if report.Verification != "" {
						fmt.Printf("verification: %s\n", report.Verification)
					}
					if len(report.InterfaceDeviations) > 0 {
						fmt.Printf("interface_deviations:\n")
						for _, dev := range report.InterfaceDeviations {
							fmt.Printf("  - description: %s\n", dev.Description)
							fmt.Printf("    downstream_action_required: %t\n", dev.DownstreamActionRequired)
							if len(dev.Affects) > 0 {
								fmt.Printf("    affects: [%s]\n", strings.Join(dev.Affects, ", "))
							}
						}
					}
					if len(report.OutOfScopeDeps) > 0 {
						fmt.Printf("out_of_scope_deps:\n")
						for _, dep := range report.OutOfScopeDeps {
							fmt.Printf("  - %s\n", dep)
						}
					}
					if report.FailureType != "" {
						fmt.Printf("failure_type: %s\n", report.FailureType)
					}
					fmt.Printf("```\n\n")
				}
			}
		}
	}

	// Interface contracts
	if len(m.InterfaceContracts) > 0 {
		fmt.Printf("## Interface Contracts\n\n")
		for _, contract := range m.InterfaceContracts {
			fmt.Printf("### %s\n\n", contract.Name)
			if contract.Description != "" {
				fmt.Printf("%s\n\n", contract.Description)
			}
			fmt.Printf("**Location:** %s\n\n", contract.Location)
			fmt.Printf("```\n%s\n```\n\n", contract.Definition)
		}
	}

	// Quality gates
	if m.QualityGates != nil && len(m.QualityGates.Gates) > 0 {
		fmt.Printf("## Quality Gates\n\n")
		fmt.Printf("**Level:** %s\n\n", m.QualityGates.Level)
		for _, gate := range m.QualityGates.Gates {
			required := "optional"
			if gate.Required {
				required = "required"
			}
			fmt.Printf("- **%s** (%s): `%s`\n", gate.Type, required, gate.Command)
			if gate.Description != "" {
				fmt.Printf("  - %s\n", gate.Description)
			}
		}
		fmt.Printf("\n")
	}

	// Scaffolds
	if len(m.Scaffolds) > 0 {
		fmt.Printf("## Scaffolds\n\n")
		for _, scaffold := range m.Scaffolds {
			fmt.Printf("### %s\n\n", scaffold.FilePath)
			if scaffold.ImportPath != "" {
				fmt.Printf("**Import Path:** %s\n\n", scaffold.ImportPath)
			}
			if scaffold.Status != "" {
				fmt.Printf("**Status:** %s\n\n", scaffold.Status)
			}
			if scaffold.Contents != "" {
				fmt.Printf("```\n%s\n```\n\n", scaffold.Contents)
			}
		}
	}
}
