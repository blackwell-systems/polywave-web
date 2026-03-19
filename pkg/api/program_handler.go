package api

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"

	engine "github.com/blackwell-systems/scout-and-wave-go/pkg/engine"
	"github.com/blackwell-systems/scout-and-wave-go/pkg/protocol"
)

// ProgramStatusResponse wraps protocol.ProgramStatusResult with web-specific fields.
type ProgramStatusResponse struct {
	ProgramSlug      string                       `json:"program_slug"`
	Title            string                       `json:"title"`
	State            string                       `json:"state"`
	CurrentTier      int                          `json:"current_tier"`
	TierStatuses     []protocol.TierStatusDetail  `json:"tier_statuses"`
	ContractStatuses []protocol.ContractStatus    `json:"contract_statuses"`
	Completion       protocol.ProgramCompletion   `json:"completion"`
	IsExecuting      bool                         `json:"is_executing"`
	ValidationErrors []string                     `json:"validation_errors,omitempty"`
}

// ProgramListResponse is the JSON response for GET /api/programs.
type ProgramListResponse struct {
	Programs []protocol.ProgramDiscovery `json:"programs"`
}

// TierExecuteRequest is the JSON request body for POST /api/program/{slug}/tier/{n}/execute.
type TierExecuteRequest struct {
	Auto bool `json:"auto,omitempty"`
}

// handleListPrograms handles GET /api/programs.
// Scans all configured repos for PROGRAM-*.yaml files and returns discovery summaries.
func (s *Server) handleListPrograms(w http.ResponseWriter, r *http.Request) {
	repos := s.getConfiguredRepos()

	var allPrograms []protocol.ProgramDiscovery

	// Scan each repo's docs/ directory for PROGRAM-*.yaml files
	for _, repo := range repos {
		docsDir := filepath.Join(repo.Path, "docs")
		programs, err := protocol.ListPrograms(docsDir)
		if err != nil {
			// Non-fatal: skip this repo if ListPrograms fails
			continue
		}
		allPrograms = append(allPrograms, programs...)
	}

	if allPrograms == nil {
		allPrograms = []protocol.ProgramDiscovery{}
	}

	resp := ProgramListResponse{Programs: allPrograms}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// handleGetProgramStatus handles GET /api/program/{slug}.
// Returns comprehensive status for a PROGRAM manifest including execution state.
func (s *Server) handleGetProgramStatus(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")

	programPath, repoPath, err := s.resolveProgramPath(slug)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	manifest, err := protocol.ParseProgramManifest(programPath)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to parse program manifest: %v", err), http.StatusInternalServerError)
		return
	}

	status, err := protocol.GetProgramStatus(manifest, repoPath)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to get program status: %v", err), http.StatusInternalServerError)
		return
	}

	// U4 — Pre-flight IMPL validation: check each tier's IMPL docs exist on disk.
	var validationErrors []string
	for _, tier := range manifest.Tiers {
		for _, implSlug := range tier.Impls {
			if _, err := resolveIMPLPathForProgram(implSlug, repoPath); err != nil {
				validationErrors = append(validationErrors, fmt.Sprintf("tier %d: IMPL %q not found", tier.Number, implSlug))
			}
		}
	}

	// Check if any tier execution is currently running for this program
	_, isExecuting := s.activeProgramRuns.Load(slug)

	resp := ProgramStatusResponse{
		ProgramSlug:      status.ProgramSlug,
		Title:            status.Title,
		State:            string(status.State),
		CurrentTier:      status.CurrentTier,
		TierStatuses:     status.TierStatuses,
		ContractStatuses: status.ContractStatuses,
		Completion:       status.Completion,
		IsExecuting:      isExecuting,
		ValidationErrors: validationErrors,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// handleGetTierStatus handles GET /api/program/{slug}/tier/{n}.
// Returns status for a single tier within the program.
func (s *Server) handleGetTierStatus(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	tierStr := r.PathValue("n")

	tierNum, err := strconv.Atoi(tierStr)
	if err != nil || tierNum < 1 {
		http.Error(w, "invalid tier number", http.StatusBadRequest)
		return
	}

	programPath, repoPath, err := s.resolveProgramPath(slug)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	manifest, err := protocol.ParseProgramManifest(programPath)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to parse program manifest: %v", err), http.StatusInternalServerError)
		return
	}

	status, err := protocol.GetProgramStatus(manifest, repoPath)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to get program status: %v", err), http.StatusInternalServerError)
		return
	}

	// Find the requested tier
	var tierStatus *protocol.TierStatusDetail
	for i := range status.TierStatuses {
		if status.TierStatuses[i].Number == tierNum {
			tierStatus = &status.TierStatuses[i]
			break
		}
	}

	if tierStatus == nil {
		http.Error(w, fmt.Sprintf("tier %d not found", tierNum), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tierStatus)
}

// handleExecuteTier handles POST /api/program/{slug}/tier/{n}/execute.
// Launches tier execution in a background goroutine and returns 202 Accepted.
func (s *Server) handleExecuteTier(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	tierStr := r.PathValue("n")

	tierNum, err := strconv.Atoi(tierStr)
	if err != nil || tierNum < 1 {
		http.Error(w, "invalid tier number", http.StatusBadRequest)
		return
	}

	// Check for concurrent execution
	if _, loaded := s.activeProgramRuns.LoadOrStore(slug, struct{}{}); loaded {
		http.Error(w, "program tier already executing", http.StatusConflict)
		return
	}
	// B3 — cleanup guard: delete the slug if we return before launching the goroutine.
	launched := false
	defer func() {
		if !launched {
			s.activeProgramRuns.Delete(slug)
		}
	}()

	programPath, repoPath, err := s.resolveProgramPath(slug)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	// Decode request body (optional auto flag)
	var body TierExecuteRequest
	_ = json.NewDecoder(r.Body).Decode(&body)

	publish := s.makeProgramPublisher(slug)

	// Notify that execution started
	s.globalBroker.broadcast("program_list_updated")

	// B4 — pass server shutdown context so goroutine can observe SIGTERM.
	serverCtx := s.serverCtx

	go func() {
		defer s.activeProgramRuns.Delete(slug)
		defer s.globalBroker.broadcast("program_list_updated")

		globalBroadcastPipeline := func() { s.globalBroker.broadcast("pipeline_updated") }
		if err := runProgramTier(programPath, slug, tierNum, repoPath, publish, globalBroadcastPipeline); err != nil {
			// Check if shutdown caused the failure.
			if serverCtx.Err() != nil {
				publish("program_blocked", map[string]interface{}{
					"program_slug": slug,
					"tier":         tierNum,
					"reason":       "server shutdown",
				})
				return
			}
			log.Printf("runProgramTier(%s, tier=%d) error: %v", slug, tierNum, err)
			publish("program_tier_failed", map[string]interface{}{
				"program_slug": slug,
				"tier":         tierNum,
				"error":        err.Error(),
			})
		}
	}()
	launched = true

	w.WriteHeader(http.StatusAccepted)
}

// handleGetProgramContracts handles GET /api/program/{slug}/contracts.
// Returns the list of program contracts with their freeze status.
func (s *Server) handleGetProgramContracts(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")

	programPath, repoPath, err := s.resolveProgramPath(slug)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	manifest, err := protocol.ParseProgramManifest(programPath)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to parse program manifest: %v", err), http.StatusInternalServerError)
		return
	}

	status, err := protocol.GetProgramStatus(manifest, repoPath)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to get program status: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(status.ContractStatuses)
}

// handleReplanProgram handles POST /api/program/{slug}/replan.
// Launches the Planner agent to revise the PROGRAM manifest and returns 202 Accepted.
func (s *Server) handleReplanProgram(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")

	programPath, repoPath, err := s.resolveProgramPath(slug)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	_ = repoPath

	var body struct {
		Reason     string `json:"reason"`
		FailedTier int    `json:"failed_tier"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil && err != io.EOF {
		http.Error(w, "invalid request body: "+err.Error(), http.StatusBadRequest)
		return
	}
	if body.Reason == "" {
		body.Reason = "user-initiated replan"
	}

	plannerModel := ""
	if cfgData, err := os.ReadFile(filepath.Join(repoPath, "saw.config.json")); err == nil {
		var sawCfg SAWConfig
		if json.Unmarshal(cfgData, &sawCfg) == nil {
			plannerModel = sawCfg.Agent.PlannerModel
		}
	}

	publish := s.makeProgramPublisher(slug)

	go func() {
		result, err := engine.ReplanProgram(engine.ReplanProgramOpts{
			ProgramManifestPath: programPath,
			Reason:              body.Reason,
			FailedTier:          body.FailedTier,
			PlannerModel:        plannerModel,
		})
		if err != nil {
			log.Printf("ReplanProgram(%s) error: %v", slug, err)
			publish("program_replan_failed", map[string]string{
				"program_slug": slug,
				"error":        err.Error(),
			})
			return
		}
		publish("program_replan_complete", map[string]interface{}{
			"program_slug":      slug,
			"validation_passed": result.ValidationPassed,
			"changes_summary":   result.ChangesSummary,
		})
		s.globalBroker.broadcast("program_list_updated")
	}()

	w.WriteHeader(http.StatusAccepted)
}

// resolveProgramPath searches all configured repos for PROGRAM-{slug}.yaml.
// Returns (programPath, repoPath, nil) on success, or error if not found.
func (s *Server) resolveProgramPath(slug string) (string, string, error) {
	repos := s.getConfiguredRepos()

	for _, repo := range repos {
		docsDir := filepath.Join(repo.Path, "docs")
		programPath := filepath.Join(docsDir, fmt.Sprintf("PROGRAM-%s.yaml", slug))

		if _, err := os.Stat(programPath); err == nil {
			return programPath, repo.Path, nil
		}
	}

	return "", "", fmt.Errorf("PROGRAM doc not found for slug: %s", slug)
}

// makeProgramPublisher creates an SSE publisher function for program events.
// This mirrors makePublisher but uses a program-specific broker pattern.
func (s *Server) makeProgramPublisher(slug string) func(event string, data interface{}) {
	return func(event string, data interface{}) {
		ev := SSEEvent{Event: event, Data: data}
		// Use the same broker as wave events for now — this allows frontend
		// to connect to /api/wave/{slug}/events and receive program events
		s.broker.Publish(slug, ev)
	}
}
