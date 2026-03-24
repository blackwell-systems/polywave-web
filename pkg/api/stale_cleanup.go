package api

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/blackwell-systems/scout-and-wave-go/pkg/protocol"
)

// StartStaleCleanupLoop runs an initial cleanup on startup, then periodically
// every 30 minutes. Respects context cancellation.
func (s *Server) StartStaleCleanupLoop(ctx context.Context) {
	s.runStaleCleanup()

	ticker := time.NewTicker(30 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.runStaleCleanup()
		}
	}
}

// runStaleCleanup detects and removes stale worktrees across all configured repos.
func (s *Server) runStaleCleanup() {
	repos := s.getConfiguredRepos()

	var allStale []protocol.StaleWorktree
	var cleanedRepos []string

	for _, repo := range repos {
		stale, err := protocol.DetectStaleWorktrees(repo.Path)
		if err != nil {
			log.Printf("[stale-cleanup] error scanning %s: %v", repo.Path, err)
			continue
		}
		if len(stale) == 0 {
			continue
		}

		// Auto-clean all three reasons: completed_impl, orphaned, merged_but_not_cleaned.
		// SAW worktrees use a known branch format so orphaned SAW worktrees are
		// definitively stale debris.
		res := protocol.CleanStaleWorktrees(stale, false)
		if res.IsFatal() {
			log.Printf("[stale-cleanup] error cleaning %s: %v", repo.Path, res.Errors)
			continue
		}
		cleanData := res.GetData()

		if len(cleanData.Cleaned) > 0 {
			allStale = append(allStale, cleanData.Cleaned...)
			cleanedRepos = append(cleanedRepos, repo.Name)
		}

		if len(cleanData.Skipped) > 0 {
			log.Printf("[stale-cleanup] skipped %d worktrees in %s (uncommitted changes)",
				len(cleanData.Skipped), repo.Name)
		}
		for _, e := range cleanData.Errors {
			log.Printf("[stale-cleanup] error removing %s: %s", e.Worktree.WorktreePath, e.Error)
		}
	}

	if len(allStale) > 0 {
		log.Printf("[stale-cleanup] cleaned %d stale worktrees from %v", len(allStale), cleanedRepos)
		s.globalBroker.broadcastJSON("stale_worktrees_cleaned", map[string]interface{}{
			"count": len(allStale),
			"repos": cleanedRepos,
		})
	}
}

// handleGlobalStaleCleanup is POST /api/worktrees/cleanup-stale — manual trigger
// for stale worktree cleanup across all configured repos.
func (s *Server) handleGlobalStaleCleanup(w http.ResponseWriter, r *http.Request) {
	repos := s.getConfiguredRepos()

	type repoResult struct {
		Repo    string                      `json:"repo"`
		Cleaned []protocol.StaleWorktree    `json:"cleaned,omitempty"`
		Skipped []protocol.StaleWorktree    `json:"skipped,omitempty"`
		Errors  []struct {
			Worktree protocol.StaleWorktree `json:"worktree"`
			Error    string                 `json:"error"`
		} `json:"errors,omitempty"`
	}

	var results []repoResult
	totalCleaned := 0

	for _, repo := range repos {
		stale, err := protocol.DetectStaleWorktrees(repo.Path)
		if err != nil {
			results = append(results, repoResult{
				Repo: repo.Name,
				Errors: []struct {
					Worktree protocol.StaleWorktree `json:"worktree"`
					Error    string                 `json:"error"`
				}{{Error: fmt.Sprintf("detect: %v", err)}},
			})
			continue
		}
		if len(stale) == 0 {
			continue
		}

		res := protocol.CleanStaleWorktrees(stale, false)
		if res.IsFatal() {
			results = append(results, repoResult{
				Repo: repo.Name,
				Errors: []struct {
					Worktree protocol.StaleWorktree `json:"worktree"`
					Error    string                 `json:"error"`
				}{{Error: fmt.Sprintf("clean: %v", res.Errors)}},
			})
			continue
		}
		cleanData := res.GetData()

		rr := repoResult{
			Repo:    repo.Name,
			Cleaned: cleanData.Cleaned,
			Skipped: cleanData.Skipped,
		}
		// Copy errors with matching struct type
		for _, e := range cleanData.Errors {
			rr.Errors = append(rr.Errors, struct {
				Worktree protocol.StaleWorktree `json:"worktree"`
				Error    string                 `json:"error"`
			}{Worktree: e.Worktree, Error: e.Error})
		}
		totalCleaned += len(cleanData.Cleaned)
		results = append(results, rr)
	}

	if totalCleaned > 0 {
		var repoNames []string
		for _, rr := range results {
			if len(rr.Cleaned) > 0 {
				repoNames = append(repoNames, rr.Repo)
			}
		}
		s.globalBroker.broadcastJSON("stale_worktrees_cleaned", map[string]interface{}{
			"count": totalCleaned,
			"repos": repoNames,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"total_cleaned": totalCleaned,
		"repos":         results,
	})
}
