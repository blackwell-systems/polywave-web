# Build Pipeline Abstraction

This package provides build-tag-gated asset serving for dual-target compilation:
**web server** (default) and **Wails native app**.

## How It Works

The `build` package exports a single function:

```go
func StaticFS() (fs.FS, error)
```

Two implementations exist, selected at compile time via Go build tags:

| File       | Build Tag  | Behavior                                       |
|------------|------------|-------------------------------------------------|
| `web.go`   | `!wails`   | Returns embedded static files from `web/dist/`  |
| `wails.go` | `wails`    | Returns `nil` (Wails runtime serves assets)     |

## Building

### Web Server (default)

No build tags needed. This is the standard build:

```bash
go build -o polywave ./cmd/polywave
```

The binary embeds the frontend assets from `web/dist/` and serves them
via the Go HTTP server.

### Wails Native App (future)

Use the `wails` build tag:

```bash
go build -tags wails -o polywave-desktop ./cmd/polywave
```

In this mode, `StaticFS()` returns `nil`. The Wails runtime handles
asset serving, so the Go server does not need embedded files.

## Integration

Callers should use `build.StaticFS()` to obtain the filesystem for
serving static assets:

```go
import "github.com/blackwell-systems/polywave-web/build"

staticFS, err := build.StaticFS()
if staticFS != nil {
    // Serve embedded assets via HTTP
    http.Handle("/", http.FileServer(http.FS(staticFS)))
}
```

When `staticFS` is `nil` (Wails build), skip HTTP static file serving
entirely -- the Wails runtime handles it.
