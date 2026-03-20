//go:build wails

package build

import "io/fs"

// StaticFS returns nil for the Wails build. In Wails mode, static assets
// are served by the Wails runtime, not the Go HTTP server.
func StaticFS() (fs.FS, error) {
	return nil, nil
}
