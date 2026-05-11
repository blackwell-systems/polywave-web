package api

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/blackwell-systems/polywave-go/pkg/queue"
	"gopkg.in/yaml.v3"
)

// AddQueueRequest is the JSON body for POST /api/queue.
type AddQueueRequest struct {
	Title              string   `json:"title"`
	Priority           int      `json:"priority"`
	FeatureDescription string   `json:"feature_description"`
	DependsOn          []string `json:"depends_on,omitempty"`
	AutonomyOverride   string   `json:"autonomy_override,omitempty"`
	RequireReview      bool     `json:"require_review,omitempty"`
}

// UpdatePriorityRequest is the JSON body for PUT /api/queue/{slug}/priority.
type UpdatePriorityRequest struct {
	Priority int `json:"priority"`
}

// handleListQueue serves GET /api/queue.
// Returns all queue items sorted by priority as a JSON array.
func (s *Server) handleListQueue(w http.ResponseWriter, r *http.Request) {
	mgr := queue.NewManager(s.cfg.RepoPath)
	listResult := mgr.List()
	if listResult.IsFatal() {
		http.Error(w, "failed to list queue: "+listResult.Errors[0].Error(), http.StatusInternalServerError)
		return
	}
	respondJSON(w, http.StatusOK, listResult.GetData().Items)
}

// handleAddQueue serves POST /api/queue.
// Creates a new queue item from the request body and writes it to disk.
func (s *Server) handleAddQueue(w http.ResponseWriter, r *http.Request) {
	var req AddQueueRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, "invalid JSON body", http.StatusBadRequest)
		return
	}
	if req.Title == "" {
		http.Error(w, "title is required", http.StatusBadRequest)
		return
	}

	item := queue.Item{
		Title:              req.Title,
		Priority:           req.Priority,
		FeatureDescription: req.FeatureDescription,
		DependsOn:          req.DependsOn,
		AutonomyOverride:   req.AutonomyOverride,
		RequireReview:      req.RequireReview,
	}

	mgr := queue.NewManager(s.cfg.RepoPath)
	if addResult := mgr.Add(item); addResult.IsFatal() {
		http.Error(w, "failed to add queue item: "+addResult.Errors[0].Error(), http.StatusInternalServerError)
		return
	}

	// Re-read to get the item with populated fields (slug, status, file_path).
	if relistResult := mgr.List(); relistResult.IsSuccess() {
		for _, it := range relistResult.GetData().Items {
			if it.Title == req.Title {
				item = it
				break
			}
		}
	}

	s.globalBroker.broadcast("impl_list_updated")

	respondJSON(w, http.StatusCreated, item)
}

// handleDeleteQueue serves DELETE /api/queue/{slug}.
// Finds the queue item file matching the slug and removes it from disk.
func (s *Server) handleDeleteQueue(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	if slug == "" {
		http.Error(w, "slug is required", http.StatusBadRequest)
		return
	}

	queueDir := filepath.Join(s.cfg.RepoPath, "docs", "IMPL", "queue")
	entries, err := os.ReadDir(queueDir)
	if err != nil {
		if os.IsNotExist(err) {
			http.Error(w, "queue item not found", http.StatusNotFound)
			return
		}
		http.Error(w, "failed to read queue dir", http.StatusInternalServerError)
		return
	}

	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".yaml") {
			continue
		}
		path := filepath.Join(queueDir, e.Name())
		data, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		var item queue.Item
		if err := yaml.Unmarshal(data, &item); err != nil {
			continue
		}
		if item.Slug == slug {
			if err := os.Remove(path); err != nil {
				http.Error(w, "failed to delete queue item", http.StatusInternalServerError)
				return
			}
			s.globalBroker.broadcast("impl_list_updated")
			w.WriteHeader(http.StatusNoContent)
			return
		}
	}

	http.Error(w, "queue item not found", http.StatusNotFound)
}

// handleReorderQueue serves PUT /api/queue/{slug}/priority.
// Updates the priority of a queue item identified by slug.
func (s *Server) handleReorderQueue(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	if slug == "" {
		http.Error(w, "slug is required", http.StatusBadRequest)
		return
	}

	var req UpdatePriorityRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, "invalid JSON body", http.StatusBadRequest)
		return
	}

	queueDir := filepath.Join(s.cfg.RepoPath, "docs", "IMPL", "queue")
	entries, err := os.ReadDir(queueDir)
	if err != nil {
		if os.IsNotExist(err) {
			http.Error(w, "queue item not found", http.StatusNotFound)
			return
		}
		http.Error(w, "failed to read queue dir", http.StatusInternalServerError)
		return
	}

	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".yaml") {
			continue
		}
		path := filepath.Join(queueDir, e.Name())
		data, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		var item queue.Item
		if err := yaml.Unmarshal(data, &item); err != nil {
			continue
		}
		if item.Slug == slug {
			item.Priority = req.Priority
			updated, err := yaml.Marshal(&item)
			if err != nil {
				http.Error(w, "failed to marshal item", http.StatusInternalServerError)
				return
			}

			// Remove old file, write new one with updated priority prefix
			if err := os.Remove(path); err != nil {
				http.Error(w, "failed to update queue item", http.StatusInternalServerError)
				return
			}
			newPath := filepath.Join(queueDir, fmt.Sprintf("%03d-%s.yaml", req.Priority, slug))
			if err := os.WriteFile(newPath, updated, 0o644); err != nil {
				http.Error(w, "failed to write updated queue item", http.StatusInternalServerError)
				return
			}

			s.globalBroker.broadcast("impl_list_updated")

			respondJSON(w, http.StatusOK, item)
			return
		}
	}

	http.Error(w, "queue item not found", http.StatusNotFound)
}
