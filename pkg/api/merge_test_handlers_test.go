package api

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	engine "github.com/blackwell-systems/scout-and-wave-go/pkg/engine"
)

// ---------------------------------------------------------------------------
// handleWaveMerge tests
// ---------------------------------------------------------------------------

// TestHandleWaveMerge_Returns409WhenAlreadyMerging verifies that a second
// concurrent merge request for the same slug returns 409 Conflict.
func TestHandleWaveMerge_Returns409WhenAlreadyMerging(t *testing.T) {
	s, _ := makeTestServer(t)

	// Pre-load the slug to simulate a merge already in progress.
	s.mergingRuns.Store("my-feature", struct{}{})

	body, _ := json.Marshal(MergeWaveRequest{Wave: 1})
	req := httptest.NewRequest(http.MethodPost, "/api/wave/my-feature/merge", bytes.NewReader(body))
	req.SetPathValue("slug", "my-feature")
	rr := httptest.NewRecorder()

	s.handleWaveMerge(rr, req)

	if rr.Code != http.StatusConflict {
		t.Errorf("expected 409 when merge already in progress, got %d: %s", rr.Code, rr.Body.String())
	}
}

// TestHandleWaveMerge_Returns202 verifies that a merge request returns 202
// Accepted and publishes merge_started via the broker. Uses mergeWaveFunc
// seam to avoid real git operations.
func TestHandleWaveMerge_Returns202(t *testing.T) {
	// Inject a no-op merge function so no real git/engine calls occur.
	orig := mergeWaveFunc
	mergeCalled := make(chan struct{}, 1)
	mergeWaveFunc = func(ctx context.Context, opts engine.RunMergeOpts) error {
		mergeCalled <- struct{}{}
		return nil
	}
	t.Cleanup(func() { mergeWaveFunc = orig })

	s, _ := makeTestServer(t)

	// Subscribe to broker events for "my-feature" so we can observe publishes.
	ch := s.broker.subscribe("my-feature")
	defer s.broker.unsubscribe("my-feature", ch)

	body, _ := json.Marshal(MergeWaveRequest{Wave: 1})
	req := httptest.NewRequest(http.MethodPost, "/api/wave/my-feature/merge", bytes.NewReader(body))
	req.SetPathValue("slug", "my-feature")
	rr := httptest.NewRecorder()

	s.handleWaveMerge(rr, req)

	if rr.Code != http.StatusAccepted {
		t.Errorf("expected 202, got %d: %s", rr.Code, rr.Body.String())
	}

	// Wait for merge_started event from the background goroutine.
	timer := time.NewTimer(3 * time.Second)
	defer timer.Stop()

	var gotMergeStarted bool
	for !gotMergeStarted {
		select {
		case ev := <-ch:
			if ev.Event == "merge_started" {
				gotMergeStarted = true
			}
		case <-timer.C:
			t.Fatal("timed out waiting for merge_started event")
		}
	}

	// Also wait for the mock to be called so goroutine cleanup is complete.
	select {
	case <-mergeCalled:
	case <-time.After(3 * time.Second):
		t.Fatal("timed out waiting for mergeWaveFunc to be called")
	}
}

// TestHandleWaveMerge_PublishesMergeComplete verifies the happy path: the
// background goroutine publishes merge_started, merge_output, merge_complete.
func TestHandleWaveMerge_PublishesMergeComplete(t *testing.T) {
	orig := mergeWaveFunc
	mergeWaveFunc = func(ctx context.Context, opts engine.RunMergeOpts) error {
		return nil // success
	}
	t.Cleanup(func() { mergeWaveFunc = orig })

	s, _ := makeTestServer(t)

	ch := s.broker.subscribe("slug-a")
	defer s.broker.unsubscribe("slug-a", ch)

	body, _ := json.Marshal(MergeWaveRequest{Wave: 2})
	req := httptest.NewRequest(http.MethodPost, "/api/wave/slug-a/merge", bytes.NewReader(body))
	req.SetPathValue("slug", "slug-a")
	rr := httptest.NewRecorder()

	s.handleWaveMerge(rr, req)

	if rr.Code != http.StatusAccepted {
		t.Fatalf("expected 202, got %d", rr.Code)
	}

	// Collect events until merge_complete or timeout.
	var events []string
	timer := time.NewTimer(3 * time.Second)
	defer timer.Stop()
	for {
		select {
		case ev := <-ch:
			events = append(events, ev.Event)
			if ev.Event == "merge_complete" {
				goto done
			}
		case <-timer.C:
			t.Fatalf("timed out; events collected so far: %v", events)
		}
	}
done:
	want := []string{"merge_started", "merge_output", "merge_complete"}
	for i, w := range want {
		if i >= len(events) || events[i] != w {
			t.Errorf("expected events[%d] == %q, got events: %v", i, w, events)
		}
	}
}

// ---------------------------------------------------------------------------
// handleWaveTest tests
// ---------------------------------------------------------------------------

// TestHandleWaveTest_Returns409WhenAlreadyTesting verifies that a second
// concurrent test request for the same slug returns 409 Conflict.
func TestHandleWaveTest_Returns409WhenAlreadyTesting(t *testing.T) {
	s, _ := makeTestServer(t)

	// Pre-load the slug to simulate a test run already in progress.
	s.testingRuns.Store("my-feature", struct{}{})

	body, _ := json.Marshal(TestWaveRequest{Wave: 1})
	req := httptest.NewRequest(http.MethodPost, "/api/wave/my-feature/test", bytes.NewReader(body))
	req.SetPathValue("slug", "my-feature")
	rr := httptest.NewRecorder()

	s.handleWaveTest(rr, req)

	if rr.Code != http.StatusConflict {
		t.Errorf("expected 409 when test already in progress, got %d: %s", rr.Code, rr.Body.String())
	}
}

// TestHandleWaveTest_Returns202 verifies that a test request returns 202
// Accepted when no test is currently running.
func TestHandleWaveTest_Returns202(t *testing.T) {
	s, dir := makeTestServer(t)

	// Write an IMPL doc with a test command so the handler can parse it.
	writeIMPLDoc(t, dir, "my-feature", minimalIMPL)

	body, _ := json.Marshal(TestWaveRequest{Wave: 1})
	req := httptest.NewRequest(http.MethodPost, "/api/wave/my-feature/test", bytes.NewReader(body))
	req.SetPathValue("slug", "my-feature")
	rr := httptest.NewRecorder()

	s.handleWaveTest(rr, req)

	if rr.Code != http.StatusAccepted {
		t.Errorf("expected 202, got %d: %s", rr.Code, rr.Body.String())
	}
}

// TestHandleWaveTest_PublishesTestFailed_WhenNoTestCommand verifies that when
// the IMPL doc has no test_command, test_failed is published with the
// "no test_command in IMPL doc" message.
func TestHandleWaveTest_PublishesTestFailed_WhenNoTestCommand(t *testing.T) {
	s, dir := makeTestServer(t)

	// Write a minimal IMPL doc that has no Test Command field.
	noTestCommandIMPL := `# IMPL: no-test-feature

## Wave 1

### Agent A: Do the thing

Implement it.

### File Ownership

| File | Agent | Wave | Depends On |
|------|-------|------|------------|
| pkg/foo/bar.go | A | 1 | — |
`
	writeIMPLDoc(t, dir, "no-test-feature", noTestCommandIMPL)

	ch := s.broker.subscribe("no-test-feature")
	defer s.broker.unsubscribe("no-test-feature", ch)

	body, _ := json.Marshal(TestWaveRequest{Wave: 1})
	req := httptest.NewRequest(http.MethodPost, "/api/wave/no-test-feature/test", bytes.NewReader(body))
	req.SetPathValue("slug", "no-test-feature")
	rr := httptest.NewRecorder()

	s.handleWaveTest(rr, req)

	if rr.Code != http.StatusAccepted {
		t.Fatalf("expected 202, got %d", rr.Code)
	}

	// Collect events until we see test_failed or timeout.
	timer := time.NewTimer(3 * time.Second)
	defer timer.Stop()
	for {
		select {
		case ev := <-ch:
			if ev.Event == "test_failed" {
				// Verify the output contains the expected message.
				dataMap, ok := ev.Data.(map[string]interface{})
				if !ok {
					t.Fatalf("expected map data, got %T", ev.Data)
				}
				output, _ := dataMap["output"].(string)
				if output != "no test_command in IMPL doc" {
					t.Errorf("expected output %q, got %q", "no test_command in IMPL doc", output)
				}
				return
			}
		case <-timer.C:
			t.Fatal("timed out waiting for test_failed event")
		}
	}
}
