package api

import (
	"testing"
	"time"

	engine "github.com/blackwell-systems/scout-and-wave-go/pkg/engine"
)

// TestMakeEnginePublisher verifies that the closure returned by makeEnginePublisher
// correctly maps engine.Event fields to SSEEvent and publishes to the broker
// under the given slug.
func TestMakeEnginePublisher(t *testing.T) {
	s, _ := makeTestServer(t)

	const slug = "eng-pub-slug"
	ch := s.broker.subscribe(slug)
	defer s.broker.unsubscribe(slug, ch)

	pub := s.makeEnginePublisher(slug)

	wantEvent := "agent_complete"
	wantData := map[string]string{"agent": "A"}

	pub(engine.Event{Event: wantEvent, Data: wantData})

	select {
	case got := <-ch:
		if got.Event != wantEvent {
			t.Errorf("expected SSEEvent.Event = %q, got %q", wantEvent, got.Event)
		}
		gotData, ok := got.Data.(map[string]string)
		if !ok {
			t.Fatalf("expected SSEEvent.Data to be map[string]string, got %T", got.Data)
		}
		if gotData["agent"] != "A" {
			t.Errorf("expected SSEEvent.Data[\"agent\"] = %q, got %q", "A", gotData["agent"])
		}
	case <-time.After(time.Second):
		t.Fatal("timed out: makeEnginePublisher did not deliver event to broker subscriber")
	}
}
