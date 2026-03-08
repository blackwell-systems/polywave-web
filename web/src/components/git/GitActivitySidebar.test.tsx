// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import GitActivitySidebar from './GitActivitySidebar'
import { GitActivitySnapshot } from '../../types/gitActivity'

const snapshotWith2Branches: GitActivitySnapshot = {
  slug: 'test',
  main_commits: [],
  branches: [
    {
      name: 'wave1-agent-a',
      agent: 'A',
      wave: 1,
      commits: [
        {
          sha: 'abc1234',
          message: 'feat: add something',
          author: 'Agent A',
          timestamp: '2026-03-07T00:00:00Z',
          files_changed: 2,
        },
      ],
      merged: false,
      status: 'running',
    },
    {
      name: 'wave1-agent-b',
      agent: 'B',
      wave: 1,
      commits: [],
      merged: false,
      status: 'pending',
    },
  ],
  polled_at: '2026-03-07T00:00:00Z',
}

const snapshotWithMergedBranch: GitActivitySnapshot = {
  slug: 'test',
  main_commits: [
    {
      sha: 'main001',
      message: 'Merge wave1-agent-a',
      author: 'Orchestrator',
      timestamp: '2026-03-07T00:01:00Z',
      files_changed: 3,
    },
  ],
  branches: [
    {
      name: 'wave1-agent-a',
      agent: 'A',
      wave: 1,
      commits: [
        {
          sha: 'abc1234',
          message: 'feat: implement feature',
          author: 'Agent A',
          timestamp: '2026-03-07T00:00:00Z',
          files_changed: 2,
        },
      ],
      merged: true,
      merge_commit: 'main001',
      status: 'complete',
    },
  ],
  polled_at: '2026-03-07T00:01:00Z',
}

describe('GitActivitySidebar', () => {
  it('renders no-activity placeholder when snapshot is null', () => {
    render(<GitActivitySidebar slug="test" snapshot={null} />)
    expect(screen.getByText('No git activity yet.')).toBeInTheDocument()
  })

  it('renders branch lanes for each branch in snapshot', () => {
    render(<GitActivitySidebar slug="test" snapshot={snapshotWith2Branches} />)
    // Each BranchLane renders the agent letter as a text element
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
    // Verify data-testid attributes are present
    const laneA = document.querySelector('[data-testid="branch-lane-A"]')
    const laneB = document.querySelector('[data-testid="branch-lane-B"]')
    expect(laneA).not.toBeNull()
    expect(laneB).not.toBeNull()
  })

  it('renders merged bezier path when branch is merged', () => {
    render(<GitActivitySidebar slug="test" snapshot={snapshotWithMergedBranch} />)
    const paths = document.querySelectorAll('path')
    expect(paths.length).toBeGreaterThan(0)
  })
})
