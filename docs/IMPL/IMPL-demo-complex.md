# IMPL: demo-complex

### Suitability Assessment

Verdict: SUITABLE

test_command: `echo "Demo IMPL - no actual tests"`

lint_command: `echo "Demo IMPL - no linting"`

This is a demonstration IMPL doc designed to showcase SAW's UI capabilities with a complex multi-wave structure, intricate dependency graphs, and rich metadata across all sections.

The work decomposes into 3 waves with 11 total agents:
- **Wave 1** (4 agents): Core infrastructure - database schema, API foundation, auth middleware, cache layer
- **Wave 2** (4 agents): Feature modules depending on Wave 1 - user profiles (→A), payment processing (→A,B), notifications (→B), analytics (→C)
- **Wave 3** (3 agents): Integration layer - admin dashboard (→E,F,G), mobile API (→E,H), webhooks (→F,G,H)

Pre-implementation scan results:
- Total estimated time: ~87 min (3 waves × ~29 min avg, accounting for dependencies)
- Parallelism efficiency: 47% (11 agents would take ~121 min sequentially)
- Critical path: Wave 1[A] → Wave 2[E] → Wave 3[I] (longest dependency chain)

Recommendation: Clear win. The complex dependency structure still allows significant parallelism within each wave. Proceed.

---

### Scaffolds

| File | Contents | Import path | Status |
|------|----------|-------------|--------|
| `pkg/types/entities.go` | User, Payment, Notification, Event entity types | `github.com/example/demo/pkg/types` | committed |
| `pkg/api/contracts.go` | Request/response types for all API endpoints | `github.com/example/demo/pkg/api` | committed |
| `web/src/types/api.ts` | TypeScript interfaces matching Go API contracts | `@/types/api` | committed |

---

### Known Issues

**Database migration performance**
- Status: Pre-existing
- Description: Large-scale schema migrations (>1M rows) can cause table locks lasting 30+ seconds
- Workaround: Agent A should use `ALTER TABLE ... LOCK=NONE` for MySQL or `CREATE INDEX CONCURRENTLY` for Postgres

**Redis connection pooling**
- Status: Pre-existing
- Description: The existing cache client doesn't handle connection pool exhaustion gracefully under high load
- Workaround: Agent D should implement circuit breaker pattern with exponential backoff

**TypeScript strict mode violations**
- Status: Pre-existing
- Description: Legacy code has ~47 `@ts-ignore` comments that need gradual cleanup
- Workaround: Agents working on frontend should add proper types incrementally rather than fixing all at once

---

### Dependency Graph

```
Wave 1 (4 parallel agents, all roots):

    [A] pkg/db/schema.go + migrations/
         (database schema: users, payments, notifications, events tables)
         ✓ root (no dependencies)

    [B] pkg/api/server.go + routes.go
         (API server foundation: routing, middleware chain, error handling)
         ✓ root (no dependencies)

    [C] pkg/auth/middleware.go
         (JWT validation, session management, RBAC helpers)
         ✓ root (no dependencies)

    [D] pkg/cache/redis.go
         (Redis client wrapper: get/set/delete with TTL, circuit breaker)
         ✓ root (no dependencies)

Wave 2 (4 parallel agents, depends on Wave 1):

    [E] pkg/users/profiles.go + web/src/pages/ProfilePage.tsx
         (user profile CRUD: bio, avatar, preferences)
         depends on: [A] (users table schema)

    [F] pkg/payments/stripe.go + webhook handlers
         (Stripe integration: checkout, subscriptions, invoice sync)
         depends on: [A] (payments table), [B] (API routes)

    [G] pkg/notify/email.go + push.go
         (notification delivery: email via SendGrid, push via FCM)
         depends on: [B] (API endpoints for send/status)

    [H] pkg/analytics/events.go
         (event tracking: capture, batch, send to Mixpanel)
         depends on: [C] (user context from auth middleware)

Wave 3 (3 parallel agents, depends on Wave 2):

    [I] web/src/pages/AdminDashboard.tsx + components/
         (admin UI: user list, payment reports, notification logs)
         depends on: [E] (profile API), [F] (payment API), [G] (notification API)

    [J] pkg/api/mobile/v1/
         (mobile-optimized endpoints: compressed responses, offline sync)
         depends on: [E] (profiles), [H] (analytics events)

    [K] pkg/webhooks/incoming.go + outgoing.go
         (webhook system: receive from Stripe, send to customer URLs)
         depends on: [F] (payment events), [G] (notification callbacks), [H] (analytics hooks)
```

Roots: [A], [B], [C], [D] (can start immediately)

Wave 2 dependencies:
- [E] → [A]
- [F] → [A], [B]
- [G] → [B]
- [H] → [C]

Wave 3 dependencies:
- [I] → [E], [F], [G]
- [J] → [E], [H]
- [K] → [F], [G], [H]

Leaf nodes: [I], [J], [K] (no downstream dependencies)

Cascade candidates (files that reference changed interfaces but are NOT in any agent's scope):
- `cmd/server/main.go` — wires together API server (Agent B), auth middleware (Agent C), and cache (Agent D)
- `pkg/jobs/worker.go` — background job system that uses notification (Agent G) and analytics (Agent H) APIs

---

### Interface Contracts

#### Database Schema (Agent A produces, Wave 2 consumes)

```go
// pkg/db/schema.go (Agent A creates)
package db

import "time"

type User struct {
    ID        int64     `db:"id" json:"id"`
    Email     string    `db:"email" json:"email"`
    Bio       string    `db:"bio" json:"bio"`
    AvatarURL string    `db:"avatar_url" json:"avatar_url"`
    CreatedAt time.Time `db:"created_at" json:"created_at"`
}

type Payment struct {
    ID             int64     `db:"id" json:"id"`
    UserID         int64     `db:"user_id" json:"user_id"`
    StripeID       string    `db:"stripe_id" json:"stripe_id"`
    AmountCents    int       `db:"amount_cents" json:"amount_cents"`
    Status         string    `db:"status" json:"status"` // pending, succeeded, failed
    CreatedAt      time.Time `db:"created_at" json:"created_at"`
}

type Notification struct {
    ID        int64     `db:"id" json:"id"`
    UserID    int64     `db:"user_id" json:"user_id"`
    Type      string    `db:"type" json:"type"` // email, push
    Title     string    `db:"title" json:"title"`
    Body      string    `db:"body" json:"body"`
    SentAt    *time.Time `db:"sent_at" json:"sent_at"`
    CreatedAt time.Time `db:"created_at" json:"created_at"`
}
```

#### API Routes (Agent B produces, Wave 2 consumes)

```go
// pkg/api/server.go (Agent B creates)
package api

import "net/http"

type Server struct {
    router *http.ServeMux
}

// RegisterRoutes allows other agents to register endpoint handlers
func (s *Server) RegisterRoutes(path string, handler http.HandlerFunc)

// WithAuth wraps a handler with JWT authentication (uses Agent C's middleware)
func (s *Server) WithAuth(handler http.HandlerFunc) http.HandlerFunc
```

#### Auth Middleware (Agent C produces, Wave 2 consumes)

```go
// pkg/auth/middleware.go (Agent C creates)
package auth

import (
    "context"
    "net/http"
)

type UserContext struct {
    UserID int64
    Email  string
    Roles  []string
}

// ExtractUser pulls authenticated user from request context
func ExtractUser(ctx context.Context) (*UserContext, error)

// RequireRole returns middleware that checks for specific role
func RequireRole(role string) func(http.Handler) http.Handler
```

#### Cache Interface (Agent D produces, Wave 2 consumes)

```go
// pkg/cache/redis.go (Agent D creates)
package cache

import (
    "context"
    "time"
)

type Client interface {
    Get(ctx context.Context, key string) (string, error)
    Set(ctx context.Context, key string, value string, ttl time.Duration) error
    Delete(ctx context.Context, key string) error
}

// NewClient creates a Redis client with connection pooling and circuit breaker
func NewClient(addr string) (Client, error)
```

#### Profile API (Agent E produces, Wave 3 consumes)

```go
// pkg/users/profiles.go (Agent E creates)
package users

type ProfileService interface {
    GetProfile(ctx context.Context, userID int64) (*Profile, error)
    UpdateProfile(ctx context.Context, userID int64, updates ProfileUpdate) error
}

type Profile struct {
    ID        int64  `json:"id"`
    Email     string `json:"email"`
    Bio       string `json:"bio"`
    AvatarURL string `json:"avatar_url"`
}
```

```typescript
// web/src/types/api.ts (Agent E creates - TypeScript side)
export interface Profile {
  id: number
  email: string
  bio: string
  avatar_url: string
}

export interface ProfileUpdate {
  bio?: string
  avatar_url?: string
}
```

#### Payment API (Agent F produces, Wave 3 consumes)

```go
// pkg/payments/stripe.go (Agent F creates)
package payments

type PaymentService interface {
    CreateCheckout(ctx context.Context, userID int64, amountCents int) (*CheckoutSession, error)
    ListPayments(ctx context.Context, userID int64) ([]Payment, error)
}
```

#### Notification API (Agent G produces, Wave 3 consumes)

```go
// pkg/notify/email.go (Agent G creates)
package notify

type NotificationService interface {
    SendEmail(ctx context.Context, userID int64, subject, body string) error
    SendPush(ctx context.Context, userID int64, title, body string) error
    GetHistory(ctx context.Context, userID int64) ([]Notification, error)
}
```

#### Analytics API (Agent H produces, Wave 3 consumes)

```go
// pkg/analytics/events.go (Agent H creates)
package analytics

type EventTracker interface {
    Track(ctx context.Context, userID int64, event string, properties map[string]interface{}) error
    Flush(ctx context.Context) error
}
```

---

### File Ownership

| File | Agent | Wave | Action | Depends On |
| `pkg/types/entities.go` | Scaffold | 0 | new | - |
| `pkg/api/contracts.go` | Scaffold | 0 | new | - |
| `web/src/types/api.ts` | Scaffold | 0 | new | - |
|------|-------|------|--------|------------|
| `pkg/db/schema.go` | A | 1 | new | - |
| `migrations/001_create_users.sql` | A | 1 | new | - |
| `migrations/002_create_payments.sql` | A | 1 | new | - |
| `migrations/003_create_notifications.sql` | A | 1 | new | - |
| `pkg/api/server.go` | B | 1 | new | - |
| `pkg/api/routes.go` | B | 1 | new | - |
| `pkg/api/errors.go` | B | 1 | new | - |
| `pkg/auth/middleware.go` | C | 1 | new | - |
| `pkg/auth/jwt.go` | C | 1 | new | - |
| `pkg/auth/rbac.go` | C | 1 | new | - |
| `pkg/cache/redis.go` | D | 1 | new | - |
| `pkg/cache/circuit.go` | D | 1 | new | - |
| `pkg/users/profiles.go` | E | 2 | new | A |
| `pkg/users/handlers.go` | E | 2 | new | A |
| `web/src/pages/ProfilePage.tsx` | E | 2 | new | A |
| `web/src/components/ProfileForm.tsx` | E | 2 | new | A |
| `pkg/payments/stripe.go` | F | 2 | new | A, B |
| `pkg/payments/webhooks.go` | F | 2 | new | A, B |
| `pkg/payments/handlers.go` | F | 2 | new | A, B |
| `pkg/notify/email.go` | G | 2 | new | B |
| `pkg/notify/push.go` | G | 2 | new | B |
| `pkg/notify/handlers.go` | G | 2 | new | B |
| `pkg/analytics/events.go` | H | 2 | new | C |
| `pkg/analytics/mixpanel.go` | H | 2 | new | C |
| `pkg/analytics/handlers.go` | H | 2 | new | C |
| `web/src/pages/AdminDashboard.tsx` | I | 3 | new | E, F, G |
| `web/src/components/UserList.tsx` | I | 3 | new | E, F, G |
| `web/src/components/PaymentReports.tsx` | I | 3 | new | E, F, G |
| `web/src/components/NotificationLogs.tsx` | I | 3 | new | E, F, G |
| `pkg/api/mobile/v1/profiles.go` | J | 3 | new | E, H |
| `pkg/api/mobile/v1/sync.go` | J | 3 | new | E, H |
| `pkg/api/mobile/v1/compress.go` | J | 3 | new | E, H |
| `pkg/webhooks/incoming.go` | K | 3 | new | F, G, H |
| `pkg/webhooks/outgoing.go` | K | 3 | new | F, G, H |
| `pkg/webhooks/handlers.go` | K | 3 | new | F, G, H |

---

### Wave Structure

```
Wave 1:  [A] [B] [C] [D]    <- 4 parallel agents (all roots)
         |   |   |   |
       schema API auth cache

Wave 2:  [E] [F] [G] [H]    <- 4 parallel agents
         |   |   |   |
     profiles pay notify analytics
     ↑[A]  ↑[A,B] ↑[B] ↑[C]

Wave 3:  [I] [J] [K]         <- 3 parallel agents (all leaves)
         |   |   |
      admin mobile webhooks
      ↑[E,F,G] ↑[E,H] ↑[F,G,H]

(All agents in each wave complete, merge all N, verify, then proceed to next wave)
```

---

### Agent Prompts

(Placeholder prompts - in a real IMPL doc these would be full multi-page instructions)

#### Agent A - Database Schema

**Role & mission:** You are Wave 1 Agent A. Create database schema and migrations for users, payments, notifications, and events tables...

#### Agent B - API Server Foundation

**Role & mission:** You are Wave 1 Agent B. Build the HTTP server foundation with routing, middleware chain, and error handling...

#### Agent C - Auth Middleware

**Role & mission:** You are Wave 1 Agent C. Implement JWT validation, session management, and RBAC helpers...

#### Agent D - Redis Cache Client

**Role & mission:** You are Wave 1 Agent D. Create Redis client wrapper with connection pooling and circuit breaker...

#### Agent E - User Profiles

**Role & mission:** You are Wave 2 Agent E. Build user profile CRUD API and frontend ProfilePage component. Depends on Agent A's schema...

#### Agent F - Payment Processing

**Role & mission:** You are Wave 2 Agent F. Integrate Stripe checkout, subscriptions, and webhook handlers. Depends on Agents A (payments table) and B (API routes)...

#### Agent G - Notifications

**Role & mission:** You are Wave 2 Agent G. Implement email (SendGrid) and push (FCM) notification delivery. Depends on Agent B's API endpoints...

#### Agent H - Analytics

**Role & mission:** You are Wave 2 Agent H. Build event tracking system with Mixpanel integration. Depends on Agent C's auth middleware for user context...

#### Agent I - Admin Dashboard

**Role & mission:** You are Wave 3 Agent I. Create admin dashboard UI with user list, payment reports, and notification logs. Depends on Agents E, F, G APIs...

#### Agent J - Mobile API

**Role & mission:** You are Wave 3 Agent J. Build mobile-optimized endpoints with compressed responses and offline sync. Depends on Agents E (profiles) and H (analytics)...

#### Agent K - Webhooks

**Role & mission:** You are Wave 3 Agent K. Implement webhook system for receiving Stripe events and sending to customer URLs. Depends on Agents F, G, H for event callbacks...

---

### Orchestrator Post-Merge Checklist

**After Wave 1 completes (A + B + C + D):**

- [ ] Read all 4 agent completion reports — confirm all `status: complete`
- [ ] Conflict prediction — expect zero conflicts (disjoint file ownership)
- [ ] Merge Agent A: `git merge --no-ff wave1-agent-A -m "Merge wave1-agent-A: database schema"`
- [ ] Merge Agent B: `git merge --no-ff wave1-agent-B -m "Merge wave1-agent-B: API server foundation"`
- [ ] Merge Agent C: `git merge --no-ff wave1-agent-C -m "Merge wave1-agent-C: auth middleware"`
- [ ] Merge Agent D: `git merge --no-ff wave1-agent-D -m "Merge wave1-agent-D: Redis cache client"`
- [ ] Worktree cleanup: `git worktree remove` + `git branch -d` for each agent
- [ ] Post-merge verification: `echo "Demo IMPL - verification passed"`
- [ ] Tick A, B, C, D in Status table
- [ ] Proceed to Wave 2

**After Wave 2 completes (E + F + G + H):**

- [ ] Read all 4 agent completion reports
- [ ] Merge Agent E, F, G, H
- [ ] Verify cascade candidates: check `cmd/server/main.go` and `pkg/jobs/worker.go` still compile
- [ ] Tick E, F, G, H in Status table
- [ ] Proceed to Wave 3

**After Wave 3 completes (I + J + K):**

- [ ] Read all 3 agent completion reports
- [ ] Merge Agent I, J, K
- [ ] Final verification: full build + test suite
- [ ] Tick I, J, K in Status table
- [ ] Mark IMPL complete with E15 tag

---

### Status

| Wave | Agent | Description | Status |
|------|-------|-------------|--------|
| 1 | A | Database schema + migrations | TO-DO |
| 1 | B | API server foundation | TO-DO |
| 1 | C | Auth middleware (JWT, RBAC) | TO-DO |
| 1 | D | Redis cache client | TO-DO |
| 2 | E | User profiles (API + UI) | TO-DO |
| 2 | F | Payment processing (Stripe) | TO-DO |
| 2 | G | Notifications (email + push) | TO-DO |
| 2 | H | Analytics (Mixpanel) | TO-DO |
| 3 | I | Admin dashboard UI | TO-DO |
| 3 | J | Mobile API endpoints | TO-DO |
| 3 | K | Webhook system | TO-DO |
| — | Orch | Post-merge verification | TO-DO |
