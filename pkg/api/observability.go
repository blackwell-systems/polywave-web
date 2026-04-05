package api

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/blackwell-systems/scout-and-wave-go/pkg/observability"
)

// RegisterObservabilityRoutes registers all observability API endpoints on the server mux.
func (s *Server) RegisterObservabilityRoutes() {
	s.mux.HandleFunc("GET /api/observability/metrics/{impl_slug}", s.handleObsIMPLMetrics)
	s.mux.HandleFunc("GET /api/observability/metrics/program/{program_slug}", s.handleObsProgramSummary)
	s.mux.HandleFunc("GET /api/observability/events", s.handleObsQueryEvents)
	s.mux.HandleFunc("GET /api/observability/rollup", s.handleObsRollup)
	s.mux.HandleFunc("GET /api/observability/cost-breakdown/{impl_slug}", s.handleObsCostBreakdown)
}

// obsStore returns the observability store, or nil if not configured.
func (s *Server) obsStore() observability.Store {
	s.obsMu.RLock()
	defer s.obsMu.RUnlock()
	return s.obsStoreInstance
}

// SetObservabilityStore sets the observability store for API handlers.
// This is called during server initialization.
func (s *Server) SetObservabilityStore(store observability.Store) {
	s.obsMu.Lock()
	defer s.obsMu.Unlock()
	s.obsStoreInstance = store
}

func (s *Server) handleObsIMPLMetrics(w http.ResponseWriter, r *http.Request) {
	store := s.obsStore()
	if store == nil {
		respondError(w, "observability store not configured", http.StatusInternalServerError)
		return
	}

	implSlug := r.PathValue("impl_slug")
	if implSlug == "" {
		respondError(w, "impl_slug is required", http.StatusBadRequest)
		return
	}

	metricsResult := observability.GetIMPLMetrics(r.Context(), store, implSlug)
	if metricsResult.IsFatal() {
		respondError(w, metricsResult.Errors[0].Error(), http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, metricsResult.GetData())
}

func (s *Server) handleObsProgramSummary(w http.ResponseWriter, r *http.Request) {
	store := s.obsStore()
	if store == nil {
		respondError(w, "observability store not configured", http.StatusInternalServerError)
		return
	}

	programSlug := r.PathValue("program_slug")
	if programSlug == "" {
		respondError(w, "program_slug is required", http.StatusBadRequest)
		return
	}

	summaryResult := observability.GetProgramSummary(r.Context(), store, programSlug)
	if summaryResult.IsFatal() {
		respondError(w, summaryResult.Errors[0].Error(), http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, summaryResult.GetData())
}

func (s *Server) handleObsQueryEvents(w http.ResponseWriter, r *http.Request) {
	store := s.obsStore()
	if store == nil {
		respondError(w, "observability store not configured", http.StatusInternalServerError)
		return
	}

	filters, err := parseQueryFilters(r)
	if err != nil {
		respondError(w, err.Error(), http.StatusBadRequest)
		return
	}

	events, err := store.QueryEvents(r.Context(), filters)
	if err != nil {
		respondError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, events)
}

func (s *Server) handleObsRollup(w http.ResponseWriter, r *http.Request) {
	store := s.obsStore()
	if store == nil {
		respondError(w, "observability store not configured", http.StatusInternalServerError)
		return
	}

	req, err := parseRollupRequest(r)
	if err != nil {
		respondError(w, err.Error(), http.StatusBadRequest)
		return
	}

	var rollupResult observability.RollupResult
	var rollupErr error
	ctx := r.Context()
	switch req.Type {
	case "cost":
		cr := observability.ComputeCostRollup(ctx, store, req)
		if cr.IsFatal() {
			rollupErr = fmt.Errorf("%s", cr.Errors[0].Error())
		} else {
			rollupResult = cr.GetData()
		}
	case "success_rate":
		sr := observability.ComputeSuccessRateRollup(ctx, store, req)
		if sr.IsFatal() {
			rollupErr = fmt.Errorf("%s", sr.Errors[0].Error())
		} else {
			rollupResult = sr.GetData()
		}
	case "retry":
		// Map "retry" param to "retry_count" rollup type.
		req.Type = "retry_count"
		rr := observability.ComputeRetryRollup(ctx, store, req)
		if rr.IsFatal() {
			rollupErr = fmt.Errorf("%s", rr.Errors[0].Error())
		} else {
			rollupResult = rr.GetData()
		}
	default:
		respondError(w, "type must be cost, success_rate, or retry", http.StatusBadRequest)
		return
	}
	if rollupErr != nil {
		respondError(w, rollupErr.Error(), http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, rollupResult)
}

func (s *Server) handleObsCostBreakdown(w http.ResponseWriter, r *http.Request) {
	store := s.obsStore()
	if store == nil {
		respondError(w, "observability store not configured", http.StatusInternalServerError)
		return
	}

	implSlug := r.PathValue("impl_slug")
	if implSlug == "" {
		respondError(w, "impl_slug is required", http.StatusBadRequest)
		return
	}

	breakdownResult := observability.GetCostBreakdown(r.Context(), store, implSlug)
	if breakdownResult.IsFatal() {
		respondError(w, breakdownResult.Errors[0].Error(), http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, breakdownResult.GetData())
}

// parseQueryFilters extracts QueryFilters from HTTP query parameters.
func parseQueryFilters(r *http.Request) (observability.QueryFilters, error) {
	q := r.URL.Query()
	var f observability.QueryFilters

	if v := q.Get("type"); v != "" {
		f.EventTypes = strings.Split(v, ",")
	}
	if v := q.Get("impl"); v != "" {
		f.IMPLSlugs = strings.Split(v, ",")
	}
	if v := q.Get("program"); v != "" {
		f.ProgramSlugs = strings.Split(v, ",")
	}
	if v := q.Get("agent"); v != "" {
		f.AgentIDs = strings.Split(v, ",")
	}
	if v := q.Get("start_time"); v != "" {
		t, err := time.Parse(time.RFC3339, v)
		if err != nil {
			return f, err
		}
		f.StartTime = &t
	}
	if v := q.Get("end_time"); v != "" {
		t, err := time.Parse(time.RFC3339, v)
		if err != nil {
			return f, err
		}
		f.EndTime = &t
	}
	if v := q.Get("limit"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil {
			return f, err
		}
		f.Limit = n
	}
	if v := q.Get("offset"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil {
			return f, err
		}
		f.Offset = n
	}

	// Default limit to prevent unbounded queries.
	if f.Limit == 0 {
		f.Limit = 100
	}

	return f, nil
}

// parseRollupRequest extracts a RollupRequest from HTTP query parameters.
func parseRollupRequest(r *http.Request) (observability.RollupRequest, error) {
	q := r.URL.Query()
	var req observability.RollupRequest

	req.Type = q.Get("type")
	if req.Type == "" {
		return req, &rollupParamError{"type is required"}
	}

	if v := q.Get("group_by"); v != "" {
		req.GroupBy = strings.Split(v, ",")
	}
	req.IMPLSlug = q.Get("impl")
	req.ProgramSlug = q.Get("program")

	if v := q.Get("start_time"); v != "" {
		t, err := time.Parse(time.RFC3339, v)
		if err != nil {
			return req, err
		}
		req.StartTime = &t
	}
	if v := q.Get("end_time"); v != "" {
		t, err := time.Parse(time.RFC3339, v)
		if err != nil {
			return req, err
		}
		req.EndTime = &t
	}

	return req, nil
}

type rollupParamError struct {
	msg string
}

func (e *rollupParamError) Error() string { return e.msg }
