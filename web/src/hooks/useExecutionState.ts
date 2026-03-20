import { useState, useMemo, useEffect, useCallback } from 'react'
import { useWaveEvents, AppWaveState } from './useWaveEvents'
import { ExecutionSyncState, AgentExecStatus, WaveProgress } from './useExecutionSync'
import { fetchDiskWaveStatus, DiskWaveStatus } from '../api'

/**
 * Unified execution state that consolidates:
 * - useWaveEvents (live SSE state)
 * - useExecutionSync (derived agent/wave maps)
 * - ReviewScreen.effectiveExecutionState (disk fallback logic)
 * - WaveBoard.statusOverrides (optimistic overrides)
 */
export interface UnifiedExecutionState {
  waveState: AppWaveState
  syncState: ExecutionSyncState
  effectiveState: ExecutionSyncState | null
  statusOverrides: Map<string, string>
  applyOverride: (agent: string, wave: number, status: string) => void
  clearOverride: (agent: string, wave: number) => void
}

function agentKey(agent: string, wave: number): string {
  return `${wave}:${agent}`
}

function normalizeScaffoldStatus(
  raw: AppWaveState['scaffoldStatus']
): ExecutionSyncState['scaffoldStatus'] {
  if (raw === 'failed') return 'idle'
  return raw
}

function deriveSyncState(state: AppWaveState, slug: string): ExecutionSyncState {
  if (!slug) {
    return { agents: new Map(), waveProgress: new Map(), scaffoldStatus: 'idle', isLive: false }
  }

  const agents = new Map<string, AgentExecStatus>()
  for (const agent of state.agents) {
    const key = agentKey(agent.agent, agent.wave)
    const result: AgentExecStatus = {
      status: agent.status as AgentExecStatus['status'],
      agent: agent.agent,
      wave: agent.wave,
    }
    if (agent.failure_type) {
      result.failureType = agent.failure_type
    }
    agents.set(key, result)
  }

  const waveProgress = new Map<number, WaveProgress>()
  for (const wave of state.waves) {
    const completeCount = wave.agents.filter(a => a.status === 'complete').length
    const mergeStateEntry = state.wavesMergeState.get(wave.wave)
    const progress: WaveProgress = {
      complete: completeCount,
      total: wave.agents.length,
    }
    if (mergeStateEntry) {
      progress.mergeStatus = mergeStateEntry.status
    }
    waveProgress.set(wave.wave, progress)
  }

  const scaffoldStatus = normalizeScaffoldStatus(state.scaffoldStatus)

  const hasActiveWork = state.agents.some(a => a.status === 'running' || a.status === 'pending')
    || scaffoldStatus === 'running'
  const isLive = !!slug && state.connected && !state.runComplete && hasActiveWork

  return { agents, waveProgress, scaffoldStatus, isLive }
}

function deriveEffectiveState(
  syncState: ExecutionSyncState,
  diskStatus: DiskWaveStatus | null,
): ExecutionSyncState | null {
  // Prefer live SSE data when available
  if (syncState.isLive && syncState.agents.size > 0) return syncState

  // Fall back to disk status
  if (!diskStatus || diskStatus.agents.length === 0) return null

  const agents = new Map<string, AgentExecStatus>()
  const waveCounts = new Map<number, { complete: number; total: number }>()
  for (const da of diskStatus.agents) {
    const status = (da.status === 'complete' || da.status === 'failed') ? da.status : 'pending' as const
    agents.set(`${da.wave}:${da.agent}`, { status, agent: da.agent, wave: da.wave, failureType: da.failure_type })
    const wc = waveCounts.get(da.wave) ?? { complete: 0, total: 0 }
    wc.total++
    if (status === 'complete') wc.complete++
    waveCounts.set(da.wave, wc)
  }
  const waveProgress = new Map<number, WaveProgress>()
  for (const [w, c] of waveCounts) waveProgress.set(w, c)
  return {
    agents,
    waveProgress,
    scaffoldStatus: diskStatus.scaffold_status === 'committed' ? 'complete' as const : 'idle' as const,
    isLive: false,
  }
}

export function useExecutionState(slug: string): UnifiedExecutionState {
  const waveState = useWaveEvents(slug)
  const [statusOverrides, setStatusOverrides] = useState<Map<string, string>>(new Map())
  const [diskStatus, setDiskStatus] = useState<DiskWaveStatus | null>(null)

  // Fetch disk status for fallback
  useEffect(() => {
    if (!slug) return
    fetchDiskWaveStatus(slug)
      .then(setDiskStatus)
      .catch(() => setDiskStatus(null))
  }, [slug])

  const syncState = useMemo(() => deriveSyncState(waveState, slug), [waveState, slug])
  const effectiveState = useMemo(() => deriveEffectiveState(syncState, diskStatus), [syncState, diskStatus])

  const applyOverride = useCallback((agent: string, wave: number, status: string) => {
    setStatusOverrides(prev => {
      const next = new Map(prev)
      next.set(agentKey(agent, wave), status)
      return next
    })
  }, [])

  const clearOverride = useCallback((agent: string, wave: number) => {
    setStatusOverrides(prev => {
      const next = new Map(prev)
      next.delete(agentKey(agent, wave))
      return next
    })
  }, [])

  return {
    waveState,
    syncState,
    effectiveState,
    statusOverrides,
    applyOverride,
    clearOverride,
  }
}
