package api

import (
	"context"
	"fmt"
	"net/http"
	"strconv"

	"github.com/blackwell-systems/polywave-go/pkg/protocol"
	"github.com/blackwell-systems/polywave-go/pkg/result"
	"github.com/blackwell-systems/polywave-web/pkg/service"
)

// ValidateIntegrationResponse is the JSON response for
// GET /api/impl/{slug}/validate-integration?wave=N.
type ValidateIntegrationResponse struct {
	Valid bool                      `json:"valid"`
	Wave  int                       `json:"wave"`
	Gaps  []protocol.IntegrationGap `json:"gaps"`
}

// ValidateWiringResponse is the JSON response for
// GET /api/impl/{slug}/validate-wiring.
type ValidateWiringResponse struct {
	Valid bool                 `json:"valid"`
	Gaps  []protocol.WiringGap `json:"gaps"`
}

// toIntegrationResult wraps a protocol.ValidateIntegration return into Result[T].
func toIntegrationResult(report *protocol.IntegrationReport, err error) result.Result[protocol.IntegrationReport] {
	if err != nil {
		return result.NewFailure[protocol.IntegrationReport]([]result.PolywaveError{
			{Code: "E_INTEGRATION_VALIDATE", Message: err.Error(), Severity: "fatal"},
		})
	}
	return result.NewSuccess(*report)
}

// toWiringResult wraps a protocol.ValidateWiringDeclarations result.Result into Result[WiringValidationData].
// Handles SUCCESS (all wiring satisfied) and PARTIAL (gaps found but data present).
func toWiringResult(res result.Result[*protocol.WiringValidationData]) result.Result[protocol.WiringValidationData] {
	if res.IsSuccess() || res.IsPartial() {
		data := *res.GetData()
		if res.IsPartial() {
			return result.NewPartial(data, res.Errors)
		}
		return result.NewSuccess(data)
	}
	return result.NewFailure[protocol.WiringValidationData](res.Errors)
}

// handleValidateIntegration serves GET /api/impl/{slug}/validate-integration?wave=N.
// Runs E25 integration validation for the given wave and returns a report.
func (s *Server) handleValidateIntegration(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	if slug == "" {
		respondError(w, "missing slug", http.StatusBadRequest)
		return
	}

	waveStr := r.URL.Query().Get("wave")
	if waveStr == "" {
		respondError(w, "missing wave query parameter", http.StatusBadRequest)
		return
	}

	waveNum, err := strconv.Atoi(waveStr)
	if err != nil || waveNum < 1 {
		respondError(w, "invalid wave parameter: must be a positive integer", http.StatusBadRequest)
		return
	}

	implPath, repoPath, err := service.ResolveIMPLPath(s.svcDeps, slug)
	if err != nil {
		respondError(w, fmt.Sprintf("IMPL doc not found for slug %q", slug), http.StatusNotFound)
		return
	}

	manifest, err := protocol.Load(context.Background(), implPath)
	if err != nil {
		respondError(w, fmt.Sprintf("failed to load manifest: %v", err), http.StatusInternalServerError)
		return
	}

	integrationResult := toIntegrationResult(protocol.ValidateIntegration(manifest, waveNum, repoPath))
	if !integrationResult.IsSuccess() {
		msg := integrationResult.Errors[0].Message
		respondError(w, fmt.Sprintf("integration validation failed: %s", msg), http.StatusInternalServerError)
		return
	}

	data := integrationResult.GetData()
	gaps := data.Gaps
	if gaps == nil {
		gaps = []protocol.IntegrationGap{}
	}

	respondJSON(w, http.StatusOK, ValidateIntegrationResponse{
		Valid: data.Valid,
		Wave:  data.Wave,
		Gaps:  gaps,
	})
}

// handleValidateWiring serves GET /api/impl/{slug}/validate-wiring.
// Runs E35 wiring declaration validation and returns a report.
func (s *Server) handleValidateWiring(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	if slug == "" {
		respondError(w, "missing slug", http.StatusBadRequest)
		return
	}

	implPath, repoPath, err := service.ResolveIMPLPath(s.svcDeps, slug)
	if err != nil {
		respondError(w, fmt.Sprintf("IMPL doc not found for slug %q", slug), http.StatusNotFound)
		return
	}

	manifest, err := protocol.Load(context.Background(), implPath)
	if err != nil {
		respondError(w, fmt.Sprintf("failed to load manifest: %v", err), http.StatusInternalServerError)
		return
	}

	wiringResult := toWiringResult(protocol.ValidateWiringDeclarations(manifest, repoPath))
	if !wiringResult.IsSuccess() && !wiringResult.IsPartial() {
		msg := wiringResult.Errors[0].Message
		respondError(w, fmt.Sprintf("wiring validation failed: %s", msg), http.StatusInternalServerError)
		return
	}

	data := wiringResult.GetData()
	gaps := data.Gaps
	if gaps == nil {
		gaps = []protocol.WiringGap{}
	}

	respondJSON(w, http.StatusOK, ValidateWiringResponse{
		Valid: data.Valid,
		Gaps:  gaps,
	})
}

// RegisterValidationRoutes registers the E25/E26/E35 validation endpoints.
// Called from server.go New() alongside other route groups.
func (s *Server) RegisterValidationRoutes() {
	s.mux.HandleFunc("GET /api/impl/{slug}/validate-integration", s.handleValidateIntegration)
	s.mux.HandleFunc("GET /api/impl/{slug}/validate-wiring", s.handleValidateWiring)
}
