package api

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/blackwell-systems/scout-and-wave-go/pkg/resume"
)

// handleInterruptedSessions serves GET /api/sessions/interrupted.
// Scans all configured repos for interrupted SAW sessions and returns
// a JSON array of session state objects.
//
// Uses resume.DetectWithConfig to scan all repos in a single call,
// which correctly handles cross-repo worktrees (Issue 1). Falls back
// to the legacy per-repo Detect loop if DetectWithConfig returns an error.
func (s *Server) handleInterruptedSessions(w http.ResponseWriter, r *http.Request) {
	repos := s.getConfiguredRepos()

	// Build the list of repo paths from the configured repo entries.
	repoPaths := make([]string, 0, len(repos))
	for _, repo := range repos {
		repoPaths = append(repoPaths, repo.Path)
	}

	// Prefer DetectWithConfig for cross-repo worktree awareness.
	ctx := context.Background()
	var allSessions []resume.SessionState
	detectResult := resume.DetectWithConfig(ctx, repoPaths)
	if detectResult.IsFatal() {
		// Fallback: per-repo Detect loop for backward compatibility.
		for _, repo := range repos {
			if perRepoResult := resume.Detect(ctx, repo.Path); perRepoResult.IsSuccess() {
				allSessions = append(allSessions, perRepoResult.GetData()...)
			}
		}
	} else {
		allSessions = detectResult.GetData()
	}

	if allSessions == nil {
		allSessions = []resume.SessionState{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(allSessions) //nolint:errcheck
}
