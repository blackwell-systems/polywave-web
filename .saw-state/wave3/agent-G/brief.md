# Agent G Brief - Wave 3

**IMPL Doc:** /Users/dayna.blackwell/code/scout-and-wave-go/docs/IMPL/IMPL-webhook-notifications.yaml

## Files Owned

- `pkg/api/server.go`
- `web/src/components/SettingsScreen.tsx`


## Task

## Agent G: Integration Wiring

**Repo:** scout-and-wave-web (`/Users/dayna.blackwell/code/scout-and-wave-web`)

Wire all webhook notification components into the existing application.

**Changes required:**

1. `pkg/api/server.go`:
   - Add `webhookBridge *WebhookBridge` field to Server struct
   - In New() function, after NotificationBus creation (~line 97):
     a. Read webhook config from saw.config.json "webhooks" key
     b. For each configured adapter, call notify.NewFromConfig(type, cfg)
     c. Create notify.Dispatcher with the adapters
     d. Create WebhookBridge with the dispatcher
     e. Store in s.webhookBridge
   - Register routes after existing notification routes (~line 181):
     ```go
     s.mux.HandleFunc("GET /api/webhooks", s.handleGetWebhookAdapters)
     s.mux.HandleFunc("POST /api/webhooks", s.handleSaveWebhookAdapters)
     s.mux.HandleFunc("POST /api/webhooks/test", s.handleTestWebhook)
     ```
   - Modify NotificationBus.Notify() callsite or add a wrapper that also
     calls s.webhookBridge.HandleNotification() for each notification event.
     Simplest approach: add a method to Server that wraps both calls.

2. `web/src/components/SettingsScreen.tsx`:
   - Add import: `import WebhookSettings from './WebhookSettings'`
   - Add import: `import { useWebhooks } from '../hooks/useWebhooks'`
   - Call useWebhooks() in component body
   - Add WebhookSettings section after the existing Notification Settings
     section (~line 397), inside a bordered card matching existing style:
     ```tsx
     <div className="rounded-lg border border-border bg-card p-4">
       <WebhookSettings {...webhookProps} />
     </div>
     ```

3. Ensure go.mod has correct scout-and-wave-go dependency version
   that includes pkg/notify (may need `go get` update).

**Verification:**
- `cd /Users/dayna.blackwell/code/scout-and-wave-web && go build ./cmd/saw/`
- `cd /Users/dayna.blackwell/code/scout-and-wave-web/web && npx tsc --noEmit`

**Constraints:**
- Minimal changes to existing files (add fields, routes, imports)
- Do not refactor existing notification code
- Follow existing patterns in server.go for route registration



## Interface Contracts

### Event type

Generic notification event with no SAW-specific imports

```
type Event struct {
    Type      string
    Severity  Severity
    Title     string
    Body      string
    Fields    map[string]string
    Timestamp time.Time
}

```

### Message type

Formatted output ready for adapter delivery

```
type Message struct {
    Text   string
    Embeds interface{}
}

```

### Adapter interface

Interface for external notification delivery

```
type Adapter interface {
    Name() string
    Send(ctx context.Context, msg Message) error
}

```

### Formatter interface

Transforms Event into adapter-specific Message

```
type Formatter interface {
    Format(event Event) Message
}

```

### Dispatcher

Fan-out dispatcher that sends to N adapters and collects errors

```
type Dispatcher struct { ... }
func NewDispatcher(adapters ...Adapter) *Dispatcher
func (d *Dispatcher) Dispatch(ctx context.Context, event Event, formatter Formatter) error
func (d *Dispatcher) AddAdapter(a Adapter)
func (d *Dispatcher) RemoveAdapter(name string)

```

### Registry

Adapter factory registry for config-driven instantiation

```
type AdapterFactory func(cfg map[string]string) (Adapter, error)
func Register(name string, factory AdapterFactory)
func NewFromConfig(name string, cfg map[string]string) (Adapter, error)
func RegisteredNames() []string

```

### SlackAdapter

Slack incoming webhook adapter with Block Kit formatting

```
type SlackAdapter struct { ... }
func NewSlackAdapter(cfg map[string]string) (Adapter, error)

```

### DiscordAdapter

Discord webhook adapter with embed formatting

```
type DiscordAdapter struct { ... }
func NewDiscordAdapter(cfg map[string]string) (Adapter, error)

```

### TelegramAdapter

Telegram Bot API adapter with Markdown formatting

```
type TelegramAdapter struct { ... }
func NewTelegramAdapter(cfg map[string]string) (Adapter, error)

```

### WebhookBridge

Bridges SAW NotificationBus events to notify.Dispatcher

```
type WebhookBridge struct { ... }
func NewWebhookBridge(dispatcher *notify.Dispatcher) *WebhookBridge
func (wb *WebhookBridge) HandleNotification(event NotificationEvent)

```



## Quality Gates

Level: standard

- **build**: `cd /Users/dayna.blackwell/code/scout-and-wave-go && go build ./pkg/notify/...` (required: true)
- **lint**: `cd /Users/dayna.blackwell/code/scout-and-wave-go && go vet ./pkg/notify/...` (required: true)
- **test**: `cd /Users/dayna.blackwell/code/scout-and-wave-go && go test ./pkg/notify/...` (required: true)
- **build**: `cd /Users/dayna.blackwell/code/scout-and-wave-web && go build ./pkg/api/...` (required: true)
- **test**: `cd /Users/dayna.blackwell/code/scout-and-wave-web && go test ./pkg/api/...` (required: true)

