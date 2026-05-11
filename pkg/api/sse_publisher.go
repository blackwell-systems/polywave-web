package api

import (
	"encoding/json"
	"strings"
	"sync"

	"github.com/blackwell-systems/polywave-web/pkg/service"
)

// SSEPublisher implements service.EventPublisher by delegating to the existing
// sseBroker (per-slug wave/scout events) and globalBroker (broadcast events).
// This adapter allows service-layer functions to publish events without
// depending on the concrete SSE transport.
type SSEPublisher struct {
	broker       *sseBroker
	globalBroker *globalBroker
}

// Compile-time check that SSEPublisher satisfies EventPublisher.
var _ service.EventPublisher = (*SSEPublisher)(nil)

// NewSSEPublisher creates an SSEPublisher that routes events through the given
// brokers. Both brokers must be non-nil.
func NewSSEPublisher(broker *sseBroker, globalBroker *globalBroker) *SSEPublisher {
	return &SSEPublisher{
		broker:       broker,
		globalBroker: globalBroker,
	}
}

// Publish routes an event to the appropriate broker based on channel name.
//
// Channel routing rules:
//   - "global" or "global:*" channels use globalBroker.broadcastJSON
//   - "wave:{slug}" channels use sseBroker.Publish with the slug as key
//   - "scout:{runID}" channels use sseBroker.Publish with "scout-"+runID as key
//   - All other channels use sseBroker.Publish with the channel name as key
func (p *SSEPublisher) Publish(channel string, event service.Event) {
	if channel == "global" || strings.HasPrefix(channel, "global:") {
		p.globalBroker.broadcastJSON(event.Name, event.Data)
		return
	}

	var key string
	switch {
	case strings.HasPrefix(channel, "wave:"):
		key = strings.TrimPrefix(channel, "wave:")
	case strings.HasPrefix(channel, "scout:"):
		key = "scout-" + strings.TrimPrefix(channel, "scout:")
	default:
		key = channel
	}

	p.broker.Publish(key, SSEEvent{
		Event: event.Name,
		Data:  event.Data,
	})
}

// Subscribe returns a channel that receives events published to the given
// channel name, and a cancel function that unsubscribes and closes the
// returned channel.
//
// For global channels, it wraps globalBroker.subscribe() and converts the
// raw string messages into service.Event values. For all other channels,
// it wraps sseBroker.subscribe() and converts SSEEvent values.
func (p *SSEPublisher) Subscribe(channel string) (<-chan service.Event, func()) {
	if channel == "global" || strings.HasPrefix(channel, "global:") {
		return p.subscribeGlobal(channel)
	}

	var key string
	switch {
	case strings.HasPrefix(channel, "wave:"):
		key = strings.TrimPrefix(channel, "wave:")
	case strings.HasPrefix(channel, "scout:"):
		key = "scout-" + strings.TrimPrefix(channel, "scout:")
	default:
		key = channel
	}

	return p.subscribeSSE(channel, key)
}

// subscribeGlobal bridges the globalBroker string-based channel into the
// typed service.Event channel.
func (p *SSEPublisher) subscribeGlobal(channel string) (<-chan service.Event, func()) {
	raw := p.globalBroker.subscribe()
	out := make(chan service.Event, cap(raw))
	var once sync.Once
	done := make(chan struct{})

	go func() {
		defer close(out)
		for {
			select {
			case <-done:
				return
			case msg, ok := <-raw:
				if !ok {
					return
				}
				ev := parseGlobalMessage(channel, msg)
				select {
				case out <- ev:
				case <-done:
					return
				}
			}
		}
	}()

	cancel := func() {
		once.Do(func() {
			close(done)
			p.globalBroker.unsubscribe(raw)
		})
	}
	return out, cancel
}

// parseGlobalMessage converts a raw globalBroker string message into a
// service.Event. Messages may be plain event names or "eventType:jsonPayload".
func parseGlobalMessage(channel, msg string) service.Event {
	if idx := strings.IndexByte(msg, ':'); idx != -1 {
		eventType := msg[:idx]
		jsonData := msg[idx+1:]
		var data interface{}
		if err := json.Unmarshal([]byte(jsonData), &data); err != nil {
			data = jsonData
		}
		return service.Event{
			Channel: channel,
			Name:    eventType,
			Data:    data,
		}
	}
	return service.Event{
		Channel: channel,
		Name:    msg,
		Data:    nil,
	}
}

// subscribeSSE bridges the sseBroker SSEEvent-based channel into the typed
// service.Event channel.
func (p *SSEPublisher) subscribeSSE(channel, key string) (<-chan service.Event, func()) {
	raw := p.broker.subscribe(key)
	out := make(chan service.Event, cap(raw))
	var once sync.Once
	done := make(chan struct{})

	go func() {
		defer close(out)
		for {
			select {
			case <-done:
				return
			case ev, ok := <-raw:
				if !ok {
					return
				}
				select {
				case out <- service.Event{
					Channel: channel,
					Name:    ev.Event,
					Data:    ev.Data,
				}:
				case <-done:
					return
				}
			}
		}
	}()

	cancel := func() {
		once.Do(func() {
			close(done)
			p.broker.unsubscribe(key, raw)
		})
	}
	return out, cancel
}
