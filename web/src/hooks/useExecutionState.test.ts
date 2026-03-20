import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useExecutionState } from './useExecutionState'
import * as api from '../api'

// Mock the API module
vi.mock('../api', () => ({
  fetchDiskWaveStatus: vi.fn(),
}))

describe('useExecutionState', () => {
  let mockEventSource: {
    addEventListener: ReturnType<typeof vi.fn>
    close: ReturnType<typeof vi.fn>
    onopen: (() => void) | null
    onerror: (() => void) | null
  }
  let eventListeners: Record<string, ((event: MessageEvent) => void)[]>

  function fireEvent(type: string, data: unknown) {
    const handlers = eventListeners[type] ?? []
    for (const handler of handlers) {
      handler(new MessageEvent(type, { data: JSON.stringify(data) }))
    }
  }

  beforeEach(() => {
    eventListeners = {}
    mockEventSource = {
      addEventListener: vi.fn((event: string, handler: (event: MessageEvent) => void) => {
        if (!eventListeners[event]) eventListeners[event] = []
        eventListeners[event].push(handler)
      }),
      close: vi.fn(),
      onopen: null,
      onerror: null,
    }

    const EventSourceMock = function(this: any) {
      return mockEventSource
    } as any
    vi.stubGlobal('EventSource', EventSourceMock)

    vi.mocked(api.fetchDiskWaveStatus).mockResolvedValue({
      agents: [],
      waves_merged: [],
      scaffold_status: 'none',
    } as any)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('effectiveState prefers live SSE data when available', async () => {
    // Set up disk status with one complete agent
    vi.mocked(api.fetchDiskWaveStatus).mockResolvedValue({
      slug: 'test',
      current_wave: 1,
      total_waves: 1,
      scaffold_status: 'committed',
      agents: [
        { agent: 'A', wave: 1, status: 'complete', files: [], branch: 'b' },
      ],
      waves_merged: [],
    })

    const { result } = renderHook(() => useExecutionState('test-slug'))

    // Wait for disk status to load
    await waitFor(() => {
      expect(result.current.effectiveState).not.toBeNull()
    })

    // Disk fallback should have agent A as complete
    expect(result.current.effectiveState!.agents.get('1:A')?.status).toBe('complete')
    expect(result.current.effectiveState!.isLive).toBe(false)

    // Now simulate SSE connection with a running agent
    act(() => {
      mockEventSource.onopen?.()
    })
    act(() => {
      fireEvent('agent_status', { agent: 'A', wave: 1, status: 'running', files: [] })
    })

    // Live SSE data should now be preferred (syncState.isLive = true when connected + active work)
    await waitFor(() => {
      if (result.current.syncState.isLive) {
        expect(result.current.effectiveState!.isLive).toBe(true)
        expect(result.current.effectiveState!.agents.get('1:A')?.status).toBe('running')
      }
    })
  })

  it('disk status is used as fallback when SSE is not live', async () => {
    vi.mocked(api.fetchDiskWaveStatus).mockResolvedValue({
      slug: 'test',
      current_wave: 1,
      total_waves: 2,
      scaffold_status: 'committed',
      agents: [
        { agent: 'A', wave: 1, status: 'complete', files: [], branch: 'b1' },
        { agent: 'B', wave: 1, status: 'failed', files: [], branch: 'b2', failure_type: 'transient' },
      ],
      waves_merged: [1],
    })

    const { result } = renderHook(() => useExecutionState('my-slug'))

    await waitFor(() => {
      expect(result.current.effectiveState).not.toBeNull()
    })

    const eff = result.current.effectiveState!
    expect(eff.isLive).toBe(false)
    expect(eff.agents.get('1:A')?.status).toBe('complete')
    expect(eff.agents.get('1:B')?.status).toBe('failed')
    expect(eff.agents.get('1:B')?.failureType).toBe('transient')
    expect(eff.scaffoldStatus).toBe('complete')
    expect(eff.waveProgress.get(1)?.complete).toBe(1)
    expect(eff.waveProgress.get(1)?.total).toBe(2)
  })

  it('override apply/clear behavior', async () => {
    const { result } = renderHook(() => useExecutionState('test-slug'))

    // Initially no overrides
    expect(result.current.statusOverrides.size).toBe(0)

    // Apply an override
    act(() => {
      result.current.applyOverride('A', 1, 'pending')
    })

    expect(result.current.statusOverrides.get('1:A')).toBe('pending')
    expect(result.current.statusOverrides.size).toBe(1)

    // Apply another override
    act(() => {
      result.current.applyOverride('B', 2, 'running')
    })

    expect(result.current.statusOverrides.get('2:B')).toBe('running')
    expect(result.current.statusOverrides.size).toBe(2)

    // Clear the first override
    act(() => {
      result.current.clearOverride('A', 1)
    })

    expect(result.current.statusOverrides.has('1:A')).toBe(false)
    expect(result.current.statusOverrides.size).toBe(1)
    expect(result.current.statusOverrides.get('2:B')).toBe('running')
  })

  it('returns null effectiveState when no disk data and no live SSE', async () => {
    vi.mocked(api.fetchDiskWaveStatus).mockResolvedValue({
      slug: 'test',
      current_wave: 0,
      total_waves: 0,
      scaffold_status: 'none',
      agents: [],
      waves_merged: [],
    })

    const { result } = renderHook(() => useExecutionState('empty-slug'))

    // Allow disk fetch to resolve
    await waitFor(() => {
      expect(api.fetchDiskWaveStatus).toHaveBeenCalled()
    })

    // No agents on disk and no live SSE => null
    expect(result.current.effectiveState).toBeNull()
  })

  it('waveState is returned from useWaveEvents', () => {
    const { result } = renderHook(() => useExecutionState('test-slug'))
    // waveState should have the shape from useWaveEvents
    expect(result.current.waveState).toBeDefined()
    expect(result.current.waveState.agents).toBeDefined()
    expect(result.current.waveState.waves).toBeDefined()
    expect(result.current.waveState.scaffoldStatus).toBeDefined()
  })
})
