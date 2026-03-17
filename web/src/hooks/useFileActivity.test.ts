import { describe, it, expect } from 'vitest'
import { deriveFileActivity } from './useFileActivity'
import type { AgentStatus } from '../types'

describe('useFileActivity', () => {
  it('should return empty map when no agents are running', () => {
    const agents: AgentStatus[] = [
      {
        agent: 'A',
        wave: 1,
        files: ['src/file.ts'],
        status: 'complete',
      },
    ]

    const result = deriveFileActivity(agents)
    expect(result.size).toBe(0)
  })

  it('should track reading status for running Read tool', () => {
    const agents: AgentStatus[] = [
      {
        agent: 'A',
        wave: 1,
        files: ['src/file.ts'],
        status: 'running',
        toolCalls: [
          {
            tool_id: 'tc1',
            tool_name: 'Read',
            input: JSON.stringify({ file_path: 'src/file.ts' }),
            started_at: Date.now(),
            status: 'running',
          },
        ],
      },
    ]

    const result = deriveFileActivity(agents)
    expect(result.size).toBe(1)
    expect(result.get('src/file.ts')?.status).toBe('reading')
    expect(result.get('src/file.ts')?.agent).toBe('A')
  })

  it('should track writing status for running Write tool', () => {
    const agents: AgentStatus[] = [
      {
        agent: 'B',
        wave: 1,
        files: ['src/new.ts'],
        status: 'running',
        toolCalls: [
          {
            tool_id: 'tc2',
            tool_name: 'Write',
            input: JSON.stringify({ file_path: 'src/new.ts', content: 'const x = 1' }),
            started_at: Date.now(),
            status: 'running',
          },
        ],
      },
    ]

    const result = deriveFileActivity(agents)
    expect(result.size).toBe(1)
    expect(result.get('src/new.ts')?.status).toBe('writing')
    expect(result.get('src/new.ts')?.agent).toBe('B')
    expect(result.get('src/new.ts')?.lastTool).toBe('Write')
  })

  it('should show committed status when Write completes', () => {
    const agents: AgentStatus[] = [
      {
        agent: 'C',
        wave: 1,
        files: ['src/done.ts'],
        status: 'running',
        toolCalls: [
          {
            tool_id: 'tc3',
            tool_name: 'Write',
            input: JSON.stringify({ file_path: 'src/done.ts', content: 'done' }),
            started_at: Date.now(),
            duration_ms: 120,
            status: 'done',
          },
        ],
      },
    ]

    const result = deriveFileActivity(agents)
    expect(result.size).toBe(1)
    expect(result.get('src/done.ts')?.status).toBe('committed')
  })

  it('should prioritize writing over reading for the same file', () => {
    const now = Date.now()
    const agents: AgentStatus[] = [
      {
        agent: 'A',
        wave: 1,
        files: ['src/conflict.ts'],
        status: 'running',
        toolCalls: [
          {
            tool_id: 'tc1',
            tool_name: 'Read',
            input: JSON.stringify({ file_path: 'src/conflict.ts' }),
            started_at: now,
            status: 'running',
          },
        ],
      },
      {
        agent: 'B',
        wave: 1,
        files: ['src/conflict.ts'],
        status: 'running',
        toolCalls: [
          {
            tool_id: 'tc2',
            tool_name: 'Write',
            input: JSON.stringify({ file_path: 'src/conflict.ts', content: 'new content' }),
            started_at: now + 100,
            status: 'running',
          },
        ],
      },
    ]

    const result = deriveFileActivity(agents)
    expect(result.size).toBe(1)
    expect(result.get('src/conflict.ts')?.status).toBe('writing')
    expect(result.get('src/conflict.ts')?.agent).toBe('B')
  })

  it('should handle Edit tool as writing', () => {
    const agents: AgentStatus[] = [
      {
        agent: 'D',
        wave: 1,
        files: ['src/edit.ts'],
        status: 'running',
        toolCalls: [
          {
            tool_id: 'tc4',
            tool_name: 'Edit',
            input: JSON.stringify({ file_path: 'src/edit.ts', old_string: 'x', new_string: 'y' }),
            started_at: Date.now(),
            status: 'running',
          },
        ],
      },
    ]

    const result = deriveFileActivity(agents)
    expect(result.size).toBe(1)
    expect(result.get('src/edit.ts')?.status).toBe('writing')
  })
})
