package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/blackwell-systems/scout-and-wave-go/pkg/autonomy"
	"github.com/blackwell-systems/scout-and-wave-go/pkg/engine"
)

// daemonControl holds the state for a single daemon run.
// Declared at package level per constraints (server.go is owned by another agent).
// Agent F will wire this into the Server struct when registering routes.
type daemonControl struct {
	mu     sync.Mutex
	cancel context.CancelFunc
	state  *engine.DaemonState
	events []engine.Event // ring buffer, last 100
}

// globalDaemon is the package-level daemon state.
var globalDaemon daemonControl

// daemonEventBroker fans out daemon events to SSE subscribers.
// Same pattern as globalBroker but carries JSON-encoded event payloads.
type daemonEventBroker struct {
	mu      sync.Mutex
	clients map[chan string]struct{}
}

var globalDaemonBroker = &daemonEventBroker{
	clients: make(map[chan string]struct{}),
}

func (b *daemonEventBroker) subscribe() chan string {
	ch := make(chan string, 16)
	b.mu.Lock()
	b.clients[ch] = struct{}{}
	b.mu.Unlock()
	return ch
}

func (b *daemonEventBroker) unsubscribe(ch chan string) {
	b.mu.Lock()
	delete(b.clients, ch)
	b.mu.Unlock()
}

func (b *daemonEventBroker) broadcast(eventType, data string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	msg := fmt.Sprintf("event: %s\ndata: %s\n\n", eventType, data)
	for ch := range b.clients {
		select {
		case ch <- msg:
		default:
		}
	}
}

// addEvent appends an event to the ring buffer (max 100).
func (dc *daemonControl) addEvent(e engine.Event) {
	dc.mu.Lock()
	defer dc.mu.Unlock()
	dc.events = append(dc.events, e)
	if len(dc.events) > 100 {
		dc.events = dc.events[len(dc.events)-100:]
	}
}

// recentEvents returns a copy of the buffered events.
func (dc *daemonControl) recentEvents() []engine.Event {
	dc.mu.Lock()
	defer dc.mu.Unlock()
	out := make([]engine.Event, len(dc.events))
	copy(out, dc.events)
	return out
}

// handleDaemonStart serves POST /api/daemon/start.
// Starts the daemon loop in a background goroutine.
// Returns 409 if the daemon is already running.
func (s *Server) handleDaemonStart(w http.ResponseWriter, r *http.Request) {
	globalDaemon.mu.Lock()
	if globalDaemon.state != nil && globalDaemon.state.Running {
		globalDaemon.mu.Unlock()
		http.Error(w, "daemon already running", http.StatusConflict)
		return
	}

	// Load autonomy config for daemon opts.
	autoCfg, err := autonomy.LoadConfig(s.cfg.RepoPath)
	if err != nil {
		globalDaemon.mu.Unlock()
		http.Error(w, "failed to load autonomy config: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Load SAW config to get model and repo settings.
	var chatModel string
	if fallbackSAWConfig != nil {
		chatModel = fallbackSAWConfig.Agent.ChatModel
	}

	ctx, cancel := context.WithCancel(context.Background())
	globalDaemon.cancel = cancel
	globalDaemon.state = &engine.DaemonState{Running: true}
	globalDaemon.events = nil // clear previous run's events
	stateCopy := *globalDaemon.state
	globalDaemon.mu.Unlock()

	opts := engine.DaemonOpts{
		RepoPath:       s.cfg.RepoPath,
		AutonomyConfig: autoCfg,
		ChatModel:      chatModel,
		OnEvent: func(e engine.Event) {
			globalDaemon.addEvent(e)

			// Broadcast to SSE subscribers.
			data, _ := json.Marshal(e)
			globalDaemonBroker.broadcast("daemon_event", string(data))

			// Also broadcast global event so pipeline views refresh.
			s.globalBroker.broadcast("impl_list_updated")
		},
	}

	go func() {
		_ = engine.RunDaemon(ctx, opts)
		globalDaemon.mu.Lock()
		if globalDaemon.state != nil {
			globalDaemon.state.Running = false
		}
		globalDaemon.mu.Unlock()

		// Notify subscribers that daemon stopped.
		stopped, _ := json.Marshal(engine.DaemonState{Running: false})
		globalDaemonBroker.broadcast("daemon_stopped", string(stopped))
	}()

	respondJSON(w, http.StatusOK, stateCopy)
}

// handleDaemonStop serves POST /api/daemon/stop.
// Cancels the running daemon context.
func (s *Server) handleDaemonStop(w http.ResponseWriter, r *http.Request) {
	globalDaemon.mu.Lock()
	defer globalDaemon.mu.Unlock()

	if globalDaemon.cancel != nil {
		globalDaemon.cancel()
		globalDaemon.cancel = nil
	}
	if globalDaemon.state != nil {
		globalDaemon.state.Running = false
	}

	w.WriteHeader(http.StatusOK)
}

// handleDaemonStatus serves GET /api/daemon/status.
// Returns the current daemon state, or {running: false} if never started.
func (s *Server) handleDaemonStatus(w http.ResponseWriter, r *http.Request) {
	globalDaemon.mu.Lock()
	var state engine.DaemonState
	if globalDaemon.state != nil {
		state = *globalDaemon.state
	}
	globalDaemon.mu.Unlock()

	respondJSON(w, http.StatusOK, state)
}

// handleDaemonEvents serves GET /api/daemon/events.
// SSE stream of daemon events with replay of recent buffered events on connect.
func (s *Server) handleDaemonEvents(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	ch := globalDaemonBroker.subscribe()
	defer globalDaemonBroker.unsubscribe(ch)

	// Send initial heartbeat.
	fmt.Fprintf(w, "event: connected\ndata: {}\n\n")
	if f, ok := w.(http.Flusher); ok {
		f.Flush()
	}

	// Replay recent events so newly-connected clients get context.
	for _, e := range globalDaemon.recentEvents() {
		data, _ := json.Marshal(e)
		fmt.Fprintf(w, "event: daemon_event\ndata: %s\n\n", data)
	}
	if f, ok := w.(http.Flusher); ok {
		f.Flush()
	}

	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case msg := <-ch:
			fmt.Fprint(w, msg)
			if f, ok := w.(http.Flusher); ok {
				f.Flush()
			}
		case <-ticker.C:
			fmt.Fprintf(w, ": ping\n\n")
			if f, ok := w.(http.Flusher); ok {
				f.Flush()
			}
		}
	}
}
