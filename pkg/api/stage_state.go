package api

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// ExecutionStage identifies a named phase in the Polywave execution pipeline.
type ExecutionStage string

const (
	StageScaffold    ExecutionStage = "scaffold"
	StageWaveExecute ExecutionStage = "wave_execute"
	StageWaveMerge   ExecutionStage = "wave_merge"
	StageWaveVerify  ExecutionStage = "wave_verify"
	StageWaveGate    ExecutionStage = "wave_gate"
	StageComplete    ExecutionStage = "complete"
	StageFailed      ExecutionStage = "failed"
)

// StageStatus is the lifecycle status of a single stage entry.
type StageStatus string

const (
	StageStatusRunning  StageStatus = "running"
	StageStatusComplete StageStatus = "complete"
	StageStatusFailed   StageStatus = "failed"
	StageStatusSkipped  StageStatus = "skipped"
)

// StageEntry records one transition within the execution pipeline.
type StageEntry struct {
	Stage       ExecutionStage `json:"stage"`
	Status      StageStatus    `json:"status"`
	WaveNum     int            `json:"wave_num,omitempty"`
	Message     string         `json:"message,omitempty"`
	StartedAt   *time.Time     `json:"started_at,omitempty"`
	CompletedAt *time.Time     `json:"completed_at,omitempty"`
}

// StageStateFile is the JSON structure persisted to disk per slug.
type StageStateFile struct {
	Slug         string         `json:"slug"`
	CurrentStage ExecutionStage `json:"current_stage"`
	Entries      []StageEntry   `json:"entries"`
	UpdatedAt    time.Time      `json:"updated_at"`
}

// stageManager persists stage transitions per slug to .polywave-state/<slug>.json
// inside the IMPL directory. Safe for concurrent use.
type stageManager struct {
	mu      sync.Mutex
	implDir string
}

func newStageManager(implDir string) *stageManager {
	return &stageManager{implDir: implDir}
}

func (m *stageManager) stateDir() string {
	return filepath.Join(m.implDir, ".polywave-state")
}

func (m *stageManager) statePath(slug string) string {
	return filepath.Join(m.stateDir(), slug+".json")
}

// transition records a stage running/completion. For StageStatusRunning it
// appends a new entry; for terminal statuses it updates the matching running
// entry in place (so we don't duplicate).
func (m *stageManager) transition(slug string, stage ExecutionStage, status StageStatus, waveNum int, msg string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if err := os.MkdirAll(m.stateDir(), 0o755); err != nil {
		return err
	}

	state := m.loadLocked(slug)
	now := time.Now()

	if status != StageStatusRunning {
		// Try to update matching running entry in place.
		for i := range state.Entries {
			e := &state.Entries[i]
			if e.Stage == stage && e.WaveNum == waveNum && e.Status == StageStatusRunning {
				e.Status = status
				e.CompletedAt = &now
				if msg != "" {
					e.Message = msg
				}
				state.CurrentStage = stage
				state.UpdatedAt = now
				return m.saveLocked(slug, state)
			}
		}
	}

	// Append fresh entry.
	entry := StageEntry{
		Stage:   stage,
		Status:  status,
		WaveNum: waveNum,
		Message: msg,
	}
	if status == StageStatusRunning {
		entry.StartedAt = &now
	} else {
		entry.CompletedAt = &now
	}
	state.Entries = append(state.Entries, entry)
	state.CurrentStage = stage
	state.UpdatedAt = now

	return m.saveLocked(slug, state)
}

func (m *stageManager) loadLocked(slug string) *StageStateFile {
	data, err := os.ReadFile(m.statePath(slug))
	if err != nil {
		return &StageStateFile{Slug: slug}
	}
	var s StageStateFile
	if err := json.Unmarshal(data, &s); err != nil {
		return &StageStateFile{Slug: slug}
	}
	return &s
}

func (m *stageManager) saveLocked(slug string, state *StageStateFile) error {
	data, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(m.statePath(slug), data, 0o644)
}

// Read returns the current stage state for a slug. Returns nil if no state exists yet.
func (m *stageManager) Read(slug string) *StageStateFile {
	m.mu.Lock()
	defer m.mu.Unlock()
	s := m.loadLocked(slug)
	if s.Slug == "" && len(s.Entries) == 0 {
		return nil
	}
	return s
}

// Clear removes the persisted state for a slug (called at the start of a new run).
func (m *stageManager) Clear(slug string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	_ = os.Remove(m.statePath(slug))
}

// handleWaveState handles GET /api/wave/{slug}/state.
// Returns the current stage state as JSON, or 404 if no run has started.
func (s *Server) handleWaveState(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	state := s.stages.Read(slug)
	if state == nil {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(state)
}
