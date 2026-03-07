package types

import "testing"

func TestState_String_AllStates(t *testing.T) {
	cases := []struct {
		state State
		want  string
	}{
		{ScoutPending, "ScoutPending"},
		{NotSuitable, "NotSuitable"},
		{Reviewed, "Reviewed"},
		{ScaffoldPending, "ScaffoldPending"},
		{WavePending, "WavePending"},
		{WaveExecuting, "WaveExecuting"},
		{WaveMerging, "WaveMerging"},
		{WaveVerified, "WaveVerified"},
		{Blocked, "Blocked"},
		{Complete, "Complete"},
		{State(99), "Unknown"},
	}

	for _, tc := range cases {
		got := tc.state.String()
		if got != tc.want {
			t.Errorf("State(%d).String() = %q, want %q", int(tc.state), got, tc.want)
		}
	}
}
