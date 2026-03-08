// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useGitActivity } from './useGitActivity'
import { GitActivitySnapshot } from '../types/gitActivity'

interface MockEventSourceInstance {
  url: string
  onopen: (() => void) | null
  onerror: (() => void) | null
  close: ReturnType<typeof vi.fn>
  addEventListener: ReturnType<typeof vi.fn>
  _listeners: Map<string, ((event: MessageEvent) => void)[]>
  _fire: (eventName: string, data: unknown) => void
}

class MockEventSource {
  url: string
  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  close = vi.fn()
  _listeners: Map<string, ((event: MessageEvent) => void)[]> = new Map()

  constructor(url: string) {
    this.url = url
    MockEventSource.instances.push(this as unknown as MockEventSourceInstance)
  }

  addEventListener(eventName: string, handler: (event: MessageEvent) => void) {
    if (!this._listeners.has(eventName)) {
      this._listeners.set(eventName, [])
    }
    this._listeners.get(eventName)!.push(handler)
  }

  _fire(eventName: string, data: unknown) {
    const handlers = this._listeners.get(eventName) ?? []
    const event = { data: JSON.stringify(data) } as MessageEvent
    for (const h of handlers) {
      h(event)
    }
  }

  static instances: MockEventSourceInstance[] = []
  static reset() {
    MockEventSource.instances = []
  }
}

beforeEach(() => {
  MockEventSource.reset()
  vi.stubGlobal('EventSource', MockEventSource)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const mockSnapshot: GitActivitySnapshot = {
  slug: 'test-slug',
  main_commits: [],
  branches: [
    {
      name: 'wave1-agent-a',
      agent: 'A',
      wave: 1,
      commits: [],
      merged: false,
      status: 'running',
    },
  ],
  polled_at: '2026-03-07T00:00:00Z',
}

describe('useGitActivity', () => {
  it('returns null before first event', () => {
    const { result } = renderHook(() => useGitActivity('test-slug'))
    expect(result.current).toBeNull()
  })

  it('returns snapshot after git_activity event', async () => {
    const { result } = renderHook(() => useGitActivity('test-slug'))

    expect(result.current).toBeNull()

    act(() => {
      const es = MockEventSource.instances[0]
      es._fire('git_activity', mockSnapshot)
    })

    expect(result.current).toEqual(mockSnapshot)
  })
})
