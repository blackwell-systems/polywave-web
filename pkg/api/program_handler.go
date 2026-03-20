package api

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"

	"github.com/blackwell-systems/scout-and-wave-go/pkg/protocol"
	"github.com/blackwell-systems/scout-and-wave-web/pkg/service"
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
	deps := s.makeDeps()
	programs, err := service.ListPrograms(deps)
	if err != nil {
		http.Error(w, "failed to list programs", http.StatusInternalServerError)
		return
	}

	resp := ProgramListResponse{Programs: programs}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// handleGetProgramStatus handles GET /api/program/{slug}.
// Returns comprehensive status for a PROGRAM manifest including execution state.
func (s *Server) handleGetProgramStatus(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")

	deps := s.makeDeps()
	status, err := service.GetProgramStatus(deps, slug)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	// U4 — Pre-flight IMPL validation: check each tier's IMPL docs exist on disk.
	programPath, repoPath, _ := service.ResolveProgramPath(deps, slug)
	manifest, _ := protocol.ParseProgramManifest(programPath)
	var validationErrors []string
	if manifest != nil {
		for _, tier := range manifest.Tiers {
			for _, implSlug := range tier.Impls {
				if _, err := service.ResolveIMPLPathForProgram(implSlug, repoPath); err != nil {
					validationErrors = append(validationErrors, fmt.Sprintf("tier %d: IMPL %q not found", tier.Number, implSlug))
				}
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

	deps := s.makeDeps()
	status, err := service.GetProgramStatus(deps, slug)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
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

	// Decode request body (optional auto flag)
	var body TierExecuteRequest
	_ = json.NewDecoder(r.Body).Decode(&body)

	deps := s.makeDeps()
	if err := service.ExecuteTier(deps, slug, tierNum, body.Auto); err != nil {
		if err.Error() == "program tier already executing" {
			http.Error(w, err.Error(), http.StatusConflict)
		} else {
			http.Error(w, err.Error(), http.StatusNotFound)
		}
		return
	}

	// Notify that execution started
	s.globalBroker.broadcast("program_list_updated")

	w.WriteHeader(http.StatusAccepted)
}

// handleGetProgramContracts handles GET /api/program/{slug}/contracts.
// Returns the list of program contracts with their freeze status.
func (s *Server) handleGetProgramContracts(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")

	deps := s.makeDeps()
	status, err := service.GetProgramStatus(deps, slug)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(status.ContractStatuses)
}

// handleReplanProgram handles POST /api/program/{slug}/replan.
// Launches the Planner agent to revise the PROGRAM manifest and returns 202 Accepted.
func (s *Server) handleReplanProgram(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")

	var body struct {
		Reason     string `json:"reason"`
		FailedTier int    `json:"failed_tier"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil && err != io.EOF {
		http.Error(w, "invalid request body: "+err.Error(), http.StatusBadRequest)
		return
	}

	deps := s.makeDeps()
	if err := service.ReplanProgram(deps, slug, body.Reason, body.FailedTier); err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusAccepted)
}

