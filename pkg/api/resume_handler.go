package api

import (
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
	allSessions, err := resume.DetectWithConfig(repoPaths)
	if err != nil {
		// Fallback: per-repo Detect loop for backward compatibility.
		allSessions = nil
		for _, repo := range repos {
			sessions, ferr := resume.Detect(repo.Path)
			if ferr != nil {
				continue
			}
			allSessions = append(allSessions, sessions...)
		}
	}

	if allSessions == nil {
		allSessions = []resume.SessionState{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(allSessions) //nolint:errcheck
}
