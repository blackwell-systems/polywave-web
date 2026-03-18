import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getSnapshot, subscribe, dispatch, resetStore } from './waveEventStore'
import * as api from '../api'
import { initialWaveState } from '../hooks/waveEventsReducer'

// Mock the API module
vi.mock('../api', () => ({
  fetchDiskWaveStatus: vi.fn(),
}))

describe('waveEventStore', () => {
  let mockEventSource: {
    addEventListener: ReturnType<typeof vi.fn>
    close: ReturnType<typeof vi.fn>
    onopen: (() => void) | null
    onerror: (() => void) | null
  }
  let eventListeners: Record<string, ((event: MessageEvent) => void)[]>

  beforeEach(() => {
    eventListeners = {}
    mockEventSource = {
      addEventListener: vi.fn((event: string, handler: (event: MessageEvent) => void) => {
        if (!eventListeners[event]) {
          eventListeners[event] = []
        }
        eventListeners[event].push(handler)
      }),
      close: vi.fn(),
      onopen: null,
      onerror: null,
    }

    // Mock EventSource constructor — needs to be a vi.fn() to track calls
    const EventSourceMock = vi.fn(function (this: any) {
      return mockEventSource
    })
    vi.stubGlobal('EventSource', EventSourceMock)

    // Mock fetchDiskWaveStatus to resolve with empty data
    vi.mocked(api.fetchDiskWaveStatus).mockResolvedValue({
      slug: 'test-slug',
      current_wave: 1,
      total_waves: 1,
      agents: [],
      waves_merged: [],
      scaffold_status: 'none',
    })
  })

  afterEach(() => {
    resetStore()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  // Helper to fire a mock SSE event
  function fireEvent(eventType: string, data: unknown) {
    const handlers = eventListeners[eventType] || []
    const event = {
      data: JSON.stringify(data),
      type: eventType,
    } as MessageEvent
    handlers.forEach(handler => handler(event))
  }

  it('TestGetSnapshotDefault — getSnapshot returns initialWaveState for unknown slug', () => {
    const snapshot = getSnapshot('unknown-slug')
    expect(snapshot).toEqual(initialWaveState)
  })

  it('TestSubscribeOpensEventSource — first subscribe call creates EventSource', () => {
    const listener = vi.fn()
    const unsubscribe = subscribe('test-slug', listener)

    expect(EventSource).toHaveBeenCalledWith('/api/wave/test-slug/events')

    unsubscribe()
  })

  it('TestSubscribeRefCounting — second subscribe does NOT create a new EventSource', () => {
    const listener1 = vi.fn()
    const listener2 = vi.fn()

    const unsubscribe1 = subscribe('test-slug', listener1)
    expect(EventSource).toHaveBeenCalledTimes(1)

    const unsubscribe2 = subscribe('test-slug', listener2)
    expect(EventSource).toHaveBeenCalledTimes(1) // Still 1

    unsubscribe1()
    unsubscribe2()
  })

  it('TestUnsubscribeClosesEventSource — last unsubscribe closes EventSource', () => {
    const listener1 = vi.fn()
    const listener2 = vi.fn()

    const unsubscribe1 = subscribe('test-slug', listener1)
    const unsubscribe2 = subscribe('test-slug', listener2)

    expect(mockEventSource.close).not.toHaveBeenCalled()

    unsubscribe1()
    expect(mockEventSource.close).not.toHaveBeenCalled() // Still has one subscriber

    unsubscribe2()
    expect(mockEventSource.close).toHaveBeenCalledOnce() // Now closed
  })

  it('TestStatePersistsAfterUnsubscribe — getSnapshot still returns accumulated state', () => {
    const listener = vi.fn()
    const unsubscribe = subscribe('test-slug', listener)

    // Dispatch an action
    dispatch('test-slug', { type: 'SCAFFOLD_STARTED' })

    // Check state
    let snapshot = getSnapshot('test-slug')
    expect(snapshot.scaffoldStatus).toBe('running')

    // Unsubscribe
    unsubscribe()

    // State should still be there
    snapshot = getSnapshot('test-slug')
    expect(snapshot.scaffoldStatus).toBe('running')
  })

  it('TestResubscribeReusesState — re-subscribing after full unsubscribe gets cached state and opens new EventSource', () => {
    const listener1 = vi.fn()
    const unsubscribe1 = subscribe('test-slug', listener1)

    // Dispatch an action
    dispatch('test-slug', { type: 'SCAFFOLD_STARTED' })

    // Unsubscribe
    unsubscribe1()

    // Reset mock to track new EventSource
    vi.mocked(EventSource).mockClear()

    // Re-subscribe
    const listener2 = vi.fn()
    const unsubscribe2 = subscribe('test-slug', listener2)

    // Should have created a new EventSource
    expect(EventSource).toHaveBeenCalledTimes(1)

    // Should still have the old state
    const snapshot = getSnapshot('test-slug')
    expect(snapshot.scaffoldStatus).toBe('running')

    unsubscribe2()
  })

  it('TestDispatchNotifiesListeners — dispatch calls all registered listeners', () => {
    const listener1 = vi.fn()
    const listener2 = vi.fn()

    const unsubscribe1 = subscribe('test-slug', listener1)
    const unsubscribe2 = subscribe('test-slug', listener2)

    dispatch('test-slug', { type: 'SCAFFOLD_STARTED' })

    expect(listener1).toHaveBeenCalledOnce()
    expect(listener2).toHaveBeenCalledOnce()

    unsubscribe1()
    unsubscribe2()
  })

  it('TestDispatchCreatesEntryIfMissing — dispatch on unknown slug creates entry', () => {
    // No subscribe yet
    dispatch('new-slug', { type: 'SCAFFOLD_STARTED' })

    const snapshot = getSnapshot('new-slug')
    expect(snapshot.scaffoldStatus).toBe('running')
  })

  it('TestSSEEventWiring — fire mock SSE events and verify state updates via getSnapshot', () => {
    const listener = vi.fn()
    const unsubscribe = subscribe('test-slug', listener)

    // Fire scaffold_started
    fireEvent('scaffold_started', {})
    expect(getSnapshot('test-slug').scaffoldStatus).toBe('running')

    // Fire agent_started
    fireEvent('agent_started', { agent: 'agent-a', wave: 1, files: ['file1.ts'] })
    let snapshot = getSnapshot('test-slug')
    expect(snapshot.agents).toHaveLength(1)
    expect(snapshot.agents[0].agent).toBe('agent-a')
    expect(snapshot.agents[0].status).toBe('running')

    // Fire agent_complete
    fireEvent('agent_complete', {
      agent: 'agent-a',
      wave: 1,
      status: 'complete',
      branch: 'wave-1-agent-a',
    })
    snapshot = getSnapshot('test-slug')
    expect(snapshot.agents[0].status).toBe('complete')
    expect(snapshot.agents[0].branch).toBe('wave-1-agent-a')

    unsubscribe()
  })

  it('TestDiskSeeding — verify fetchDiskWaveStatus is called on first subscribe', async () => {
    vi.mocked(api.fetchDiskWaveStatus).mockResolvedValue({
      slug: 'test-slug',
      current_wave: 1,
      total_waves: 1,
      agents: [
        {
          agent: 'agent-disk',
          wave: 1,
          status: 'complete',
          files: ['file.ts'],
          branch: 'wave-1-agent-disk',
        },
      ],
      waves_merged: [1],
      scaffold_status: 'committed',
    })

    const listener = vi.fn()
    const unsubscribe = subscribe('test-slug', listener)

    expect(api.fetchDiskWaveStatus).toHaveBeenCalledWith('test-slug')

    // Wait for async disk seeding
    await vi.waitFor(() => {
      const snapshot = getSnapshot('test-slug')
      expect(snapshot.agents).toHaveLength(1)
      expect(snapshot.agents[0].agent).toBe('agent-disk')
      expect(snapshot.agents[0].status).toBe('complete')
      expect(snapshot.scaffoldStatus).toBe('complete')
      expect(snapshot.wavesMergeState.get(1)?.status).toBe('success')
    })

    unsubscribe()
  })

  it('TestDiskSeedingOnlyOnce — second subscribe after unsubscribe does not re-seed', async () => {
    const listener1 = vi.fn()
    const unsubscribe1 = subscribe('test-slug', listener1)

    expect(api.fetchDiskWaveStatus).toHaveBeenCalledTimes(1)

    unsubscribe1()

    const listener2 = vi.fn()
    const unsubscribe2 = subscribe('test-slug', listener2)

    // Should not call fetchDiskWaveStatus again
    expect(api.fetchDiskWaveStatus).toHaveBeenCalledTimes(1)

    unsubscribe2()
  })

  it('TestResetStore — resetStore clears all entries and closes EventSources', () => {
    const listener1 = vi.fn()
    const listener2 = vi.fn()

    const unsubscribe1 = subscribe('slug-1', listener1)
    const unsubscribe2 = subscribe('slug-2', listener2)

    dispatch('slug-1', { type: 'SCAFFOLD_STARTED' })
    dispatch('slug-2', { type: 'SCAFFOLD_STARTED' })

    expect(getSnapshot('slug-1').scaffoldStatus).toBe('running')
    expect(getSnapshot('slug-2').scaffoldStatus).toBe('running')

    resetStore()

    // State should be cleared
    expect(getSnapshot('slug-1')).toEqual(initialWaveState)
    expect(getSnapshot('slug-2')).toEqual(initialWaveState)

    // EventSources should be closed
    expect(mockEventSource.close).toHaveBeenCalled()

    unsubscribe1()
    unsubscribe2()
  })

  it('TestSnapshotReferentialStability — getSnapshot returns same reference when state unchanged', () => {
    const listener = vi.fn()
    const unsubscribe = subscribe('test-slug', listener)

    const snapshot1 = getSnapshot('test-slug')
    const snapshot2 = getSnapshot('test-slug')

    // Should be the same reference
    expect(snapshot1).toBe(snapshot2)

    // Dispatch an action
    dispatch('test-slug', { type: 'SCAFFOLD_STARTED' })

    const snapshot3 = getSnapshot('test-slug')

    // Should be a different reference now
    expect(snapshot3).not.toBe(snapshot1)

    // But subsequent calls should return the same reference again
    const snapshot4 = getSnapshot('test-slug')
    expect(snapshot3).toBe(snapshot4)

    unsubscribe()
  })

  it('TestConnectDisconnectEvents — onopen and onerror dispatch correct actions', () => {
    const listener = vi.fn()
    const unsubscribe = subscribe('test-slug', listener)

    // Initially not connected
    expect(getSnapshot('test-slug').connected).toBe(false)

    // Trigger onopen
    mockEventSource.onopen?.()

    expect(getSnapshot('test-slug').connected).toBe(true)
    expect(getSnapshot('test-slug').error).toBeUndefined()

    // Trigger onerror
    mockEventSource.onerror?.()

    expect(getSnapshot('test-slug').connected).toBe(false)
    expect(getSnapshot('test-slug').error).toBe('Connection lost')

    unsubscribe()
  })

  it('TestAgentOutput — agent_output accumulates correctly', () => {
    const listener = vi.fn()
    const unsubscribe = subscribe('test-slug', listener)

    fireEvent('agent_started', { agent: 'agent-a', wave: 1, files: [] })

    fireEvent('agent_output', { agent: 'agent-a', wave: 1, chunk: 'Line 1\n' })
    expect(getSnapshot('test-slug').agents[0].output).toBe('Line 1\n')

    fireEvent('agent_output', { agent: 'agent-a', wave: 1, chunk: 'Line 2\n' })
    expect(getSnapshot('test-slug').agents[0].output).toBe('Line 1\nLine 2\n')

    unsubscribe()
  })

  it('TestMergeEvents — merge_started, merge_output, merge_complete', () => {
    const listener = vi.fn()
    const unsubscribe = subscribe('test-slug', listener)

    fireEvent('merge_started', { slug: 'test-slug', wave: 1 })
    expect(getSnapshot('test-slug').wavesMergeState.get(1)?.status).toBe('merging')

    fireEvent('merge_output', { slug: 'test-slug', wave: 1, chunk: 'Merging...\n' })
    expect(getSnapshot('test-slug').wavesMergeState.get(1)?.output).toBe('Merging...\n')

    fireEvent('merge_complete', { slug: 'test-slug', wave: 1, status: 'success' })
    expect(getSnapshot('test-slug').wavesMergeState.get(1)?.status).toBe('success')

    unsubscribe()
  })

  it('TestTestEvents — test_started, test_output, test_complete', () => {
    const listener = vi.fn()
    const unsubscribe = subscribe('test-slug', listener)

    fireEvent('test_started', { slug: 'test-slug', wave: 1 })
    expect(getSnapshot('test-slug').wavesTestState.get(1)?.status).toBe('running')

    fireEvent('test_output', { slug: 'test-slug', wave: 1, chunk: 'Running tests...\n' })
    expect(getSnapshot('test-slug').wavesTestState.get(1)?.output).toBe('Running tests...\n')

    fireEvent('test_complete', { slug: 'test-slug', wave: 1, status: 'pass' })
    expect(getSnapshot('test-slug').wavesTestState.get(1)?.status).toBe('pass')

    unsubscribe()
  })

  it('TestWaveComplete — wave_complete marks wave as complete', () => {
    const listener = vi.fn()
    const unsubscribe = subscribe('test-slug', listener)

    // Start an agent to create a wave
    fireEvent('agent_started', { agent: 'agent-a', wave: 1, files: [] })
    expect(getSnapshot('test-slug').waves).toHaveLength(1)

    fireEvent('wave_complete', { wave: 1, merge_status: 'success' })
    expect(getSnapshot('test-slug').waves[0].complete).toBe(true)
    expect(getSnapshot('test-slug').waves[0].merge_status).toBe('success')

    unsubscribe()
  })

  it('TestRunComplete — run_complete sets runComplete flag', () => {
    const listener = vi.fn()
    const unsubscribe = subscribe('test-slug', listener)

    fireEvent('run_complete', { status: 'success', waves: 3, agents: 6 })
    expect(getSnapshot('test-slug').runComplete).toBe(true)
    expect(getSnapshot('test-slug').runStatus).toBe('success')

    unsubscribe()
  })

  it('TestRunFailed — run_failed marks pending agents as failed', () => {
    const listener = vi.fn()
    const unsubscribe = subscribe('test-slug', listener)

    // Add some agents
    fireEvent('agent_started', { agent: 'agent-a', wave: 1, files: [] })
    fireEvent('agent_started', { agent: 'agent-b', wave: 1, files: [] })

    // Complete one agent
    fireEvent('agent_complete', { agent: 'agent-a', wave: 1, status: 'complete', branch: 'wave-1-agent-a' })

    const snapshot1 = getSnapshot('test-slug')
    expect(snapshot1.agents[0].status).toBe('complete')
    expect(snapshot1.agents[1].status).toBe('running')

    // Fail the run
    fireEvent('run_failed', { error: 'Run terminated' })

    const snapshot2 = getSnapshot('test-slug')
    expect(snapshot2.runFailed).toBe('Run terminated')
    // agent-a should stay complete
    expect(snapshot2.agents[0].status).toBe('complete')
    // agent-b should be marked failed
    expect(snapshot2.agents[1].status).toBe('failed')
    expect(snapshot2.agents[1].message).toBe('Run terminated')

    unsubscribe()
  })

  it('TestAgentToolCall — agent_tool_call updates toolCalls', () => {
    const listener = vi.fn()
    const unsubscribe = subscribe('test-slug', listener)

    fireEvent('agent_started', { agent: 'agent-a', wave: 1, files: [] })

    // First tool call (tool_use)
    fireEvent('agent_tool_call', {
      agent: 'agent-a',
      wave: 1,
      tool_id: 'toolu_123',
      tool_name: 'bash',
      input: 'ls -la',
      is_result: false,
      is_error: false,
      duration_ms: 0,
    })

    let snapshot = getSnapshot('test-slug')
    expect(snapshot.agents[0].toolCalls).toHaveLength(1)
    expect(snapshot.agents[0].toolCalls![0].tool_id).toBe('toolu_123')
    expect(snapshot.agents[0].toolCalls![0].status).toBe('running')

    // Tool result
    fireEvent('agent_tool_call', {
      agent: 'agent-a',
      wave: 1,
      tool_id: 'toolu_123',
      tool_name: 'bash',
      input: '',
      is_result: true,
      is_error: false,
      duration_ms: 120,
    })

    snapshot = getSnapshot('test-slug')
    expect(snapshot.agents[0].toolCalls![0].status).toBe('done')
    expect(snapshot.agents[0].toolCalls![0].duration_ms).toBe(120)

    unsubscribe()
  })

  it('TestWaveGate — wave_gate_pending and wave_gate_resolved', () => {
    const listener = vi.fn()
    const unsubscribe = subscribe('test-slug', listener)

    fireEvent('wave_gate_pending', { wave: 1, next_wave: 2, slug: 'test-slug' })
    expect(getSnapshot('test-slug').waveGate).toEqual({ wave: 1, nextWave: 2 })

    fireEvent('wave_gate_resolved', { wave: 1, action: 'proceed' })
    expect(getSnapshot('test-slug').waveGate).toBeUndefined()

    unsubscribe()
  })

  it('TestConflictResolution — conflict_resolving, conflict_resolved, conflict_resolution_failed', () => {
    const listener = vi.fn()
    const unsubscribe = subscribe('test-slug', listener)

    fireEvent('conflict_resolving', { slug: 'test-slug', wave: 1, file: 'file1.ts' })
    let snapshot = getSnapshot('test-slug')
    expect(snapshot.wavesMergeState.get(1)?.status).toBe('resolving')
    expect(snapshot.wavesMergeState.get(1)?.resolvingFile).toBe('file1.ts')

    fireEvent('conflict_resolved', { slug: 'test-slug', wave: 1, file: 'file1.ts' })
    snapshot = getSnapshot('test-slug')
    expect(snapshot.wavesMergeState.get(1)?.resolvedFiles).toContain('file1.ts')

    fireEvent('conflict_resolution_failed', {
      slug: 'test-slug',
      wave: 1,
      file: 'file2.ts',
      error: 'Failed to resolve',
    })
    snapshot = getSnapshot('test-slug')
    expect(snapshot.wavesMergeState.get(1)?.status).toBe('failed')
    expect(snapshot.wavesMergeState.get(1)?.failedFile).toBe('file2.ts')
    expect(snapshot.wavesMergeState.get(1)?.resolutionError).toBe('Failed to resolve')

    unsubscribe()
  })

  it('TestStaleBranches — stale_branches_detected', () => {
    const listener = vi.fn()
    const unsubscribe = subscribe('test-slug', listener)

    fireEvent('stale_branches_detected', {
      slug: 'test-slug',
      branches: ['wave-1-agent-a', 'wave-2-agent-b'],
      count: 2,
    })

    const snapshot = getSnapshot('test-slug')
    expect(snapshot.staleBranches).toEqual({
      slug: 'test-slug',
      branches: ['wave-1-agent-a', 'wave-2-agent-b'],
      count: 2,
    })

    unsubscribe()
  })

  it('TestStageTransition — stage_transition', () => {
    const listener = vi.fn()
    const unsubscribe = subscribe('test-slug', listener)

    fireEvent('stage_transition', {
      stage: 'merge',
      status: 'running',
      wave_num: 1,
      message: 'Merging wave 1',
      started_at: '2024-01-01T00:00:00Z',
    })

    const snapshot = getSnapshot('test-slug')
    expect(snapshot.stageEntries).toHaveLength(1)
    expect(snapshot.stageEntries[0].stage).toBe('merge')
    expect(snapshot.stageEntries[0].status).toBe('running')

    unsubscribe()
  })

  it('TestPipelineStep — pipeline_step', () => {
    const listener = vi.fn()
    const unsubscribe = subscribe('test-slug', listener)

    fireEvent('pipeline_step', {
      step: 'typecheck',
      status: 'running',
      wave: 1,
    })

    let snapshot = getSnapshot('test-slug')
    expect(snapshot.pipelineSteps?.typecheck).toEqual({ status: 'running' })

    fireEvent('pipeline_step', {
      step: 'typecheck',
      status: 'failed',
      wave: 1,
      error: 'Type error',
    })

    snapshot = getSnapshot('test-slug')
    expect(snapshot.pipelineSteps?.typecheck).toEqual({ status: 'failed', error: 'Type error' })

    unsubscribe()
  })

  it('TestFixBuild — fix_build_started, fix_build_output, fix_build_complete, fix_build_failed', () => {
    const listener = vi.fn()
    const unsubscribe = subscribe('test-slug', listener)

    fireEvent('fix_build_started', {})
    expect(getSnapshot('test-slug').fixBuildStatus).toBe('running')
    expect(getSnapshot('test-slug').fixBuildOutput).toBe('')

    fireEvent('fix_build_output', { chunk: 'Fixing...\n' })
    expect(getSnapshot('test-slug').fixBuildOutput).toBe('Fixing...\n')

    fireEvent('fix_build_complete', {})
    expect(getSnapshot('test-slug').fixBuildStatus).toBe('complete')

    // Test failed path
    fireEvent('fix_build_started', {})
    fireEvent('fix_build_failed', { error: 'Fix failed' })
    expect(getSnapshot('test-slug').fixBuildStatus).toBe('failed')
    expect(getSnapshot('test-slug').fixBuildError).toBe('Fix failed')

    unsubscribe()
  })
})
