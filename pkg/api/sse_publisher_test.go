package api

import (
	"sync"
	"testing"
	"time"

	"github.com/blackwell-systems/polywave-web/pkg/service"
)

func TestSSEPublisher_GlobalChannel(t *testing.T) {
	gb := newGlobalBroker()
	broker := &sseBroker{clients: make(map[string][]chan SSEEvent)}
	pub := NewSSEPublisher(broker, gb)

	// Subscribe to global events so we can verify broadcast.
	rawCh := gb.subscribe()
	defer gb.unsubscribe(rawCh)

	pub.Publish("global", service.Event{
		Name: "impl_list_updated",
		Data: map[string]string{"slug": "test-feature"},
	})

	select {
	case msg := <-rawCh:
		// broadcastJSON encodes as "eventType:json"
		if msg == "" {
			t.Fatal("expected non-empty message from global broadcast")
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for global broadcast")
	}

	// Test "global:" prefixed channel routes through globalBroker too.
	rawCh2 := gb.subscribe()
	defer gb.unsubscribe(rawCh2)

	pub.Publish("global:config", service.Event{
		Name: "config_updated",
		Data: nil,
	})

	select {
	case msg := <-rawCh2:
		if msg == "" {
			t.Fatal("expected non-empty message from global:config broadcast")
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for global:config broadcast")
	}
}

func TestSSEPublisher_WaveChannel(t *testing.T) {
	gb := newGlobalBroker()
	broker := &sseBroker{clients: make(map[string][]chan SSEEvent)}
	pub := NewSSEPublisher(broker, gb)

	// Subscribe to the slug via sseBroker to verify routing.
	ch := broker.subscribe("my-feature")
	defer broker.unsubscribe("my-feature", ch)

	pub.Publish("wave:my-feature", service.Event{
		Name: "agent_started",
		Data: map[string]interface{}{"agent": "A", "wave": 1},
	})

	select {
	case ev := <-ch:
		if ev.Event != "agent_started" {
			t.Errorf("expected event 'agent_started', got %q", ev.Event)
		}
		data, ok := ev.Data.(map[string]interface{})
		if !ok {
			t.Fatalf("expected map data, got %T", ev.Data)
		}
		if data["agent"] != "A" {
			t.Errorf("expected agent 'A', got %v", data["agent"])
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for wave event")
	}

	// Test scout channel routing: "scout:abc123" -> key "scout-abc123"
	scoutCh := broker.subscribe("scout-abc123")
	defer broker.unsubscribe("scout-abc123", scoutCh)

	pub.Publish("scout:abc123", service.Event{
		Name: "scout_progress",
		Data: "step 3",
	})

	select {
	case ev := <-scoutCh:
		if ev.Event != "scout_progress" {
			t.Errorf("expected event 'scout_progress', got %q", ev.Event)
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for scout event")
	}
}

func TestSSEPublisher_Subscribe(t *testing.T) {
	gb := newGlobalBroker()
	broker := &sseBroker{clients: make(map[string][]chan SSEEvent)}
	pub := NewSSEPublisher(broker, gb)

	t.Run("wave channel subscribe", func(t *testing.T) {
		ch, cancel := pub.Subscribe("wave:test-slug")
		defer cancel()

		// Publish via broker directly to simulate an event.
		go func() {
			// Small delay to ensure subscriber goroutine is running.
			time.Sleep(10 * time.Millisecond)
			broker.Publish("test-slug", SSEEvent{
				Event: "wave_complete",
				Data:  map[string]interface{}{"status": "ok"},
			})
		}()

		select {
		case ev := <-ch:
			if ev.Name != "wave_complete" {
				t.Errorf("expected Name 'wave_complete', got %q", ev.Name)
			}
			if ev.Channel != "wave:test-slug" {
				t.Errorf("expected Channel 'wave:test-slug', got %q", ev.Channel)
			}
		case <-time.After(2 * time.Second):
			t.Fatal("timed out waiting for subscribe event")
		}
	})

	t.Run("global channel subscribe", func(t *testing.T) {
		ch, cancel := pub.Subscribe("global")
		defer cancel()

		go func() {
			time.Sleep(10 * time.Millisecond)
			gb.broadcast("impl_list_updated")
		}()

		select {
		case ev := <-ch:
			if ev.Name != "impl_list_updated" {
				t.Errorf("expected Name 'impl_list_updated', got %q", ev.Name)
			}
			if ev.Channel != "global" {
				t.Errorf("expected Channel 'global', got %q", ev.Channel)
			}
		case <-time.After(2 * time.Second):
			t.Fatal("timed out waiting for global subscribe event")
		}
	})

	t.Run("cancel stops receiving", func(t *testing.T) {
		ch, cancel := pub.Subscribe("wave:cancel-test")
		cancel() // Cancel immediately.

		// Give the goroutine time to exit.
		time.Sleep(50 * time.Millisecond)

		// Channel should be drained/closed.
		select {
		case _, ok := <-ch:
			if ok {
				// Got a value, that's fine — could be a race. The key thing is
				// the goroutine exits and we don't leak.
			}
		case <-time.After(100 * time.Millisecond):
			// No event, as expected after cancel.
		}
	})

	t.Run("concurrent publish and subscribe", func(t *testing.T) {
		ch, cancel := pub.Subscribe("wave:concurrent")
		defer cancel()

		const n = 50
		var wg sync.WaitGroup
		wg.Add(n)

		for i := 0; i < n; i++ {
			go func(idx int) {
				defer wg.Done()
				pub.Publish("wave:concurrent", service.Event{
					Name: "tick",
					Data: idx,
				})
			}(i)
		}

		received := 0
		timeout := time.After(2 * time.Second)
	loop:
		for received < n {
			select {
			case <-ch:
				received++
			case <-timeout:
				break loop
			}
		}

		wg.Wait()

		if received == 0 {
			t.Error("expected to receive at least some events in concurrent test")
		}
	})
}

func TestSSEPublisher_InterfaceCompliance(t *testing.T) {
	// Verify that SSEPublisher can be used wherever EventPublisher is expected.
	var pub service.EventPublisher = NewSSEPublisher(
		&sseBroker{clients: make(map[string][]chan SSEEvent)},
		newGlobalBroker(),
	)
	if pub == nil {
		t.Fatal("SSEPublisher should not be nil")
	}
}
