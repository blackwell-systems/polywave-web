//go:build !wails

package build

import (
	"io/fs"

	web "github.com/blackwell-systems/polywave-web/web"
)

// StaticFS returns the embedded static files for the web server build.
// This is the default build path (no build tags required).
func StaticFS() (fs.FS, error) {
	return fs.Sub(web.StaticFiles, "dist")
}
