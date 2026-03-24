package api

import (
	"encoding/json"
	"testing"

	"github.com/blackwell-systems/scout-and-wave-go/pkg/result"
)

// TestTypesAPIResponseAlias verifies that APIResponse[T] is a usable alias for result.Result[T].
func TestTypesAPIResponseAlias(t *testing.T) {
	data := IMPLDocResponse{Slug: "test-slug"}
	r := result.NewSuccess(data)

	var resp APIResponse[IMPLDocResponse] = r

	if !resp.IsSuccess() {
		t.Fatal("expected IsSuccess() == true")
	}
	got := resp.GetData()
	if got.Slug != "test-slug" {
		t.Errorf("expected slug %q, got %q", "test-slug", got.Slug)
	}
}

// TestTypesAPIResponseFailure verifies APIResponse[T] correctly represents a failure.
func TestTypesAPIResponseFailure(t *testing.T) {
	r := result.NewFailure[IMPLDocResponse]([]result.SAWError{
		{Code: "E001", Message: "not found", Severity: "fatal"},
	})

	var resp APIResponse[IMPLDocResponse] = r

	if resp.IsSuccess() {
		t.Fatal("expected IsSuccess() == false")
	}
	if !resp.IsFatal() {
		t.Fatal("expected IsFatal() == true")
	}
	if !resp.HasErrors() {
		t.Fatal("expected HasErrors() == true")
	}
	if resp.Errors[0].Code != "E001" {
		t.Errorf("expected error code %q, got %q", "E001", resp.Errors[0].Code)
	}
}

// TestTypesAPIResponsePartial verifies APIResponse[T] correctly represents partial success.
func TestTypesAPIResponsePartial(t *testing.T) {
	data := WaveStatusResponse{Slug: "partial-slug"}
	warnings := []result.SAWError{
		{Code: "W001", Message: "some warning", Severity: "warning"},
	}
	r := result.NewPartial(data, warnings)

	var resp APIResponse[WaveStatusResponse] = r

	if !resp.IsPartial() {
		t.Fatal("expected IsPartial() == true")
	}
	if resp.IsFatal() {
		t.Fatal("expected IsFatal() == false")
	}
	got := resp.GetData()
	if got.Slug != "partial-slug" {
		t.Errorf("expected slug %q, got %q", "partial-slug", got.Slug)
	}
}

// TestTypesAPIErrorAlias verifies that APIError is usable as result.SAWError.
func TestTypesAPIErrorAlias(t *testing.T) {
	var e APIError
	e.Code = "E042"
	e.Message = "something went wrong"
	e.Severity = "error"
	e.Suggestion = "try again"

	if e.Code != "E042" {
		t.Errorf("expected code %q, got %q", "E042", e.Code)
	}

	// Verify it marshals to JSON correctly.
	b, err := json.Marshal(e)
	if err != nil {
		t.Fatalf("json.Marshal failed: %v", err)
	}
	var decoded result.SAWError
	if err := json.Unmarshal(b, &decoded); err != nil {
		t.Fatalf("json.Unmarshal failed: %v", err)
	}
	if decoded.Code != "E042" {
		t.Errorf("round-trip: expected code %q, got %q", "E042", decoded.Code)
	}
}

// TestTypesAPIResponseJSON verifies APIResponse[T] marshals and unmarshals correctly.
func TestTypesAPIResponseJSON(t *testing.T) {
	data := RepoEntry{Name: "my-repo", Path: "/path/to/repo"}
	r := result.NewSuccess(data)

	b, err := json.Marshal(r)
	if err != nil {
		t.Fatalf("json.Marshal failed: %v", err)
	}

	var decoded APIResponse[RepoEntry]
	if err := json.Unmarshal(b, &decoded); err != nil {
		t.Fatalf("json.Unmarshal failed: %v", err)
	}
	if !decoded.IsSuccess() {
		t.Fatal("expected IsSuccess() == true after round-trip")
	}
	got := decoded.GetData()
	if got.Name != "my-repo" {
		t.Errorf("expected name %q, got %q", "my-repo", got.Name)
	}
}
