// Git activity types — shared between useGitActivity hook and GitActivitySidebar.
// These mirror the Go types in pkg/git/activity.go exactly.

export interface GitCommit {
  sha: string          // short 7-char SHA
  message: string      // first line of commit message
  author: string       // author name
  timestamp: string    // ISO 8601 timestamp
  files_changed: number
}

export interface GitBranch {
  name: string         // e.g. "wave1-agent-a"
  agent: string        // uppercase letter, e.g. "A"
  wave: number
  commits: GitCommit[]
  merged: boolean      // true when branch has been merged to main
  merge_commit?: string // SHA of the merge commit on main, present when merged === true
  status: 'pending' | 'running' | 'complete' | 'failed'
}

export interface GitActivitySnapshot {
  slug: string
  main_commits: GitCommit[]   // commits on main since wave started
  branches: GitBranch[]       // one entry per active agent branch
  polled_at: string           // ISO 8601 server timestamp
}

// The SSE event payload type sent by the backend on the git_activity event name.
export type GitActivityEvent = GitActivitySnapshot
