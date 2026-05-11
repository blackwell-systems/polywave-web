package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/blackwell-systems/polywave-go/pkg/journal"
)

// JournalResponse wraps full journal entries
type JournalResponse struct {
	Entries []journal.ToolEntry `json:"entries"`
}

// SummaryResponse wraps context markdown
type SummaryResponse struct {
	Markdown string `json:"markdown"`
}

// CheckpointsResponse wraps checkpoint metadata list
type CheckpointsResponse struct {
	Checkpoints []journal.CheckpointRecord `json:"checkpoints"`
}

// RestoreRequest specifies which checkpoint to restore
type RestoreRequest struct {
	CheckpointName string `json:"checkpoint_name"`
}

// handleJournalGet returns full journal as JSON array (not JSONL)
func (s *Server) handleJournalGet(w http.ResponseWriter, r *http.Request) {
	wave := r.PathValue("wave")
	agent := r.PathValue("agent")

	if wave == "" || agent == "" {
		respondError(w, "wave and agent path parameters required", http.StatusBadRequest)
		return
	}

	// Construct agent path: wave{N}/agent-{ID}
	agentPath := fmt.Sprintf("%s/%s", wave, agent)

	// Create observer
	obsResult := journal.NewObserver(s.cfg.RepoPath, agentPath)
	if obsResult.IsFatal() {
		respondError(w, fmt.Sprintf("failed to create observer: %v", obsResult.Errors[0].Message), http.StatusInternalServerError)
		return
	}
	obs := obsResult.GetData()

	// Check if journal exists
	if _, err := os.Stat(obs.IndexPath); os.IsNotExist(err) {
		respondError(w, fmt.Sprintf("journal not found for %s", agentPath), http.StatusNotFound)
		return
	}

	// Read all entries from index.jsonl
	entries, err := readJournalEntries(obs.IndexPath)
	if err != nil {
		respondError(w, fmt.Sprintf("failed to read journal: %v", err), http.StatusInternalServerError)
		return
	}

	resp := JournalResponse{
		Entries: entries,
	}

	respondJSON(w, http.StatusOK, resp)
}

// handleJournalSummary returns context.md markdown
func (s *Server) handleJournalSummary(w http.ResponseWriter, r *http.Request) {
	wave := r.PathValue("wave")
	agent := r.PathValue("agent")

	if wave == "" || agent == "" {
		respondError(w, "wave and agent path parameters required", http.StatusBadRequest)
		return
	}

	// Construct agent path: wave{N}/agent-{ID}
	agentPath := fmt.Sprintf("%s/%s", wave, agent)

	// Create observer
	obsResult := journal.NewObserver(s.cfg.RepoPath, agentPath)
	if obsResult.IsFatal() {
		respondError(w, fmt.Sprintf("failed to create observer: %v", obsResult.Errors[0].Message), http.StatusInternalServerError)
		return
	}
	obs := obsResult.GetData()

	// Check if journal exists
	if _, err := os.Stat(obs.JournalDir); os.IsNotExist(err) {
		respondError(w, fmt.Sprintf("journal not found for %s", agentPath), http.StatusNotFound)
		return
	}

	// Read entries to generate context
	entries, err := readJournalEntries(obs.IndexPath)
	if err != nil {
		// If index doesn't exist yet, return empty context
		if os.IsNotExist(err) {
			resp := SummaryResponse{
				Markdown: "## Session Context (Recovered from Tool Journal)\n\n**No tool activity recorded yet.**\n",
			}
			respondJSON(w, http.StatusOK, resp)
			return
		}
		respondError(w, fmt.Sprintf("failed to read journal: %v", err), http.StatusInternalServerError)
		return
	}

	// Generate context markdown
	markdown := journal.GenerateContext(entries, 0) // 0 = all entries

	resp := SummaryResponse{
		Markdown: markdown,
	}

	respondJSON(w, http.StatusOK, resp)
}

// handleJournalCheckpoints returns list of checkpoint metadata
func (s *Server) handleJournalCheckpoints(w http.ResponseWriter, r *http.Request) {
	wave := r.PathValue("wave")
	agent := r.PathValue("agent")

	if wave == "" || agent == "" {
		respondError(w, "wave and agent path parameters required", http.StatusBadRequest)
		return
	}

	// Construct agent path: wave{N}/agent-{ID}
	agentPath := fmt.Sprintf("%s/%s", wave, agent)

	// Create observer
	obsResult := journal.NewObserver(s.cfg.RepoPath, agentPath)
	if obsResult.IsFatal() {
		respondError(w, fmt.Sprintf("failed to create observer: %v", obsResult.Errors[0].Message), http.StatusInternalServerError)
		return
	}
	obs := obsResult.GetData()

	// Check if journal exists
	if _, err := os.Stat(obs.JournalDir); os.IsNotExist(err) {
		respondError(w, fmt.Sprintf("journal not found for %s", agentPath), http.StatusNotFound)
		return
	}

	// List checkpoints
	listResult := obs.ListCheckpoints()
	if listResult.IsFatal() {
		respondError(w, fmt.Sprintf("failed to list checkpoints: %v", listResult.Errors[0].Message), http.StatusInternalServerError)
		return
	}

	resp := CheckpointsResponse{
		Checkpoints: listResult.GetData(),
	}

	respondJSON(w, http.StatusOK, resp)
}

// handleJournalRestore restores journal to checkpoint state
func (s *Server) handleJournalRestore(w http.ResponseWriter, r *http.Request) {
	wave := r.PathValue("wave")
	agent := r.PathValue("agent")

	if wave == "" || agent == "" {
		respondError(w, "wave and agent path parameters required", http.StatusBadRequest)
		return
	}

	// Parse request body
	var req RestoreRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, fmt.Sprintf("invalid request body: %v", err), http.StatusBadRequest)
		return
	}

	if req.CheckpointName == "" {
		respondError(w, "checkpoint_name is required", http.StatusBadRequest)
		return
	}

	// Validate checkpoint name (filesystem-safe)
	if strings.ContainsAny(req.CheckpointName, "/\\ ") {
		respondError(w, "invalid checkpoint_name: must be filesystem-safe (no slashes or spaces)", http.StatusBadRequest)
		return
	}

	// Construct agent path: wave{N}/agent-{ID}
	agentPath := fmt.Sprintf("%s/%s", wave, agent)

	// Create observer
	obsResult := journal.NewObserver(s.cfg.RepoPath, agentPath)
	if obsResult.IsFatal() {
		respondError(w, fmt.Sprintf("failed to create observer: %v", obsResult.Errors[0].Message), http.StatusInternalServerError)
		return
	}
	obs := obsResult.GetData()

	// Check if journal exists
	if _, err := os.Stat(obs.JournalDir); os.IsNotExist(err) {
		respondError(w, fmt.Sprintf("journal not found for %s", agentPath), http.StatusNotFound)
		return
	}

	// Restore checkpoint
	restoreResult := obs.RestoreCheckpoint(req.CheckpointName)
	if restoreResult.IsFatal() {
		errMsg := restoreResult.Errors[0].Message
		if strings.Contains(errMsg, "not found") {
			respondError(w, fmt.Sprintf("checkpoint not found: %s", errMsg), http.StatusBadRequest)
			return
		}
		respondError(w, fmt.Sprintf("failed to restore checkpoint: %s", errMsg), http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{
		"status":  "success",
		"message": fmt.Sprintf("restored to checkpoint %q", req.CheckpointName),
	})
}

// readJournalEntries reads all tool entries from index.jsonl
func readJournalEntries(indexPath string) ([]journal.ToolEntry, error) {
	data, err := os.ReadFile(indexPath)
	if err != nil {
		return nil, err
	}

	var entries []journal.ToolEntry
	lines := strings.Split(string(data), "\n")

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		var entry journal.ToolEntry
		if err := json.Unmarshal([]byte(line), &entry); err != nil {
			// Skip malformed lines
			continue
		}

		entries = append(entries, entry)
	}

	return entries, nil
}

// Helper to construct journal path (for directory checks)
func (s *Server) getJournalPath(wave, agent string) string {
	return filepath.Join(s.cfg.RepoPath, ".polywave-state", wave, agent)
}
