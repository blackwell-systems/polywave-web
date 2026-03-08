// Package internal — engine_import_anchor.go
// This file ensures scout-and-wave-go is included in go.sum.
// It will be deleted post-merge once Agent G's imports pull in the package naturally.
package internal

import _ "github.com/blackwell-systems/scout-and-wave-go/pkg/engine"
