// Package agent provides the runner that orchestrates agent execution in
// worktree contexts and utilities for parsing completion reports.
package agent

import (
	"fmt"

	"github.com/blackwell-systems/scout-and-wave-go/pkg/protocol"
	"github.com/blackwell-systems/scout-and-wave-go/pkg/types"
	"github.com/blackwell-systems/scout-and-wave-go/pkg/worktree"
)

// Sender is the interface Runner uses to call the LLM API.
// It is implemented by *Client (from client.go, owned by Agent D).
// Using an interface here allows Runner to compile and be tested independently
// of Agent D's parallel implementation of client.go.
type Sender interface {
	SendMessage(systemPrompt, userMessage string) (string, error)
}

// Runner orchestrates agent execution in worktree contexts.
type Runner struct {
	client    Sender
	worktrees *worktree.Manager
}

// NewRunner creates a Runner backed by the given Sender and worktree Manager.
func NewRunner(client Sender, worktrees *worktree.Manager) *Runner {
	return &Runner{
		client:    client,
		worktrees: worktrees,
	}
}

// Execute sends agentSpec.Prompt to the LLM API as the system prompt, paired
// with a user message that provides the worktreePath for context. It returns
// the raw API response text. API errors are returned immediately without retry.
func (r *Runner) Execute(agentSpec *types.AgentSpec, worktreePath string) (string, error) {
	systemPrompt := agentSpec.Prompt

	userMessage := fmt.Sprintf(
		"You are operating in worktree: %s\n"+
			"Navigate there first (cd %s) before any file operations.\n\n"+
			"Your task is defined in Field 0 of your prompt above. Begin now.",
		worktreePath,
		worktreePath,
	)

	response, err := r.client.SendMessage(systemPrompt, userMessage)
	if err != nil {
		return "", fmt.Errorf("runner: Execute agent %s: %w", agentSpec.Letter, err)
	}

	return response, nil
}

// ParseCompletionReport reads the IMPL doc at implDocPath and extracts the
// completion report for agentLetter. It delegates to protocol.ParseCompletionReport.
// Returns protocol.ErrReportNotFound if the section does not exist yet.
func (r *Runner) ParseCompletionReport(implDocPath string, agentLetter string) (*types.CompletionReport, error) {
	return protocol.ParseCompletionReport(implDocPath, agentLetter)
}
