import { useEffect, useRef, useState } from 'react'
import { AgentOutputData, AgentStatus, WaveState } from '../types'

export interface WaveMergeState {
  status: 'idle' | 'merging' | 'success' | 'failed'
  output: string
  conflictingFiles: string[]
  error?: string
}

export interface WaveTestState {
  status: 'idle' | 'running' | 'pass' | 'fail'
  output: string
}

// AppWaveState is the composite state managed by the hook.
// WaveState in types.ts is per-wave; we expose a top-level shape here
// and also return the list of per-wave WaveState objects for WaveBoard grouping.
export interface AppWaveState {
  agents: AgentStatus[]
  scaffoldStatus: 'idle' | 'running' | 'complete'
  runComplete: boolean
  runStatus?: string
  runFailed?: string
  connected: boolean
  error?: string
  waves: WaveState[]
  waveGate?: { wave: number; nextWave: number }
  wavesMergeState: Map<number, WaveMergeState>
  wavesTestState: Map<number, WaveTestState>
}

// useWaveEvents subscribes to the SSE stream for a given slug and returns
// live agent + wave state. The return type is AppWaveState (a superset of
// WaveState from types.ts) because the stream covers multiple waves and
// top-level scaffold/run state that WaveState does not model.
export function useWaveEvents(slug: string): AppWaveState {
  const [state, setState] = useState<AppWaveState>({
    agents: [],
    scaffoldStatus: 'idle',
    runComplete: false,
    connected: false,
    waves: [],
    wavesMergeState: new Map(),
    wavesTestState: new Map(),
  })

  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    const es = new EventSource(`/api/wave/${slug}/events`)
    esRef.current = es

    es.onopen = () => {
      setState(prev => ({ ...prev, connected: true, error: undefined }))
    }

    es.onerror = () => {
      setState(prev => ({ ...prev, connected: false, error: 'Connection lost' }))
    }

    // Helper: upsert an agent into the agents list
    function upsertAgent(
      prev: AppWaveState,
      agent: string,
      wave: number,
      update: Partial<AgentStatus>
    ): AppWaveState {
      const existing = prev.agents.find(a => a.agent === agent && a.wave === wave)
      let updatedAgents: AgentStatus[]
      if (existing) {
        updatedAgents = prev.agents.map(a =>
          a.agent === agent && a.wave === wave ? { ...a, ...update } : a
        )
      } else {
        updatedAgents = [
          ...prev.agents,
          { agent, wave, files: [], status: 'pending', ...update } as AgentStatus,
        ]
      }
      // Rebuild waves from agents
      const waves = buildWaves(updatedAgents, prev.waves)
      return { ...prev, agents: updatedAgents, waves }
    }

    function buildWaves(agents: AgentStatus[], prevWaves: WaveState[]): WaveState[] {
      const waveMap = new Map<number, WaveState>()
      // Preserve existing wave metadata (merge_status, complete flag)
      for (const w of prevWaves) {
        waveMap.set(w.wave, { ...w, agents: [] })
      }
      for (const a of agents) {
        if (!waveMap.has(a.wave)) {
          waveMap.set(a.wave, { wave: a.wave, agents: [], complete: false })
        }
        waveMap.get(a.wave)!.agents.push(a)
      }
      return Array.from(waveMap.values()).sort((a, b) => a.wave - b.wave)
    }

    es.addEventListener('scaffold_started', () => {
      setState(prev => ({ ...prev, scaffoldStatus: 'running' }))
    })

    es.addEventListener('scaffold_complete', () => {
      setState(prev => ({ ...prev, scaffoldStatus: 'complete' }))
    })

    es.addEventListener('agent_started', (event: MessageEvent) => {
      const data = JSON.parse(event.data) as { agent: string; wave: number; files: string[] }
      setState(prev =>
        upsertAgent(prev, data.agent, data.wave, {
          status: 'running',
          files: data.files,
          startedAt: Date.now(),
        })
      )
    })

    es.addEventListener('agent_complete', (event: MessageEvent) => {
      const data = JSON.parse(event.data) as {
        agent: string
        wave: number
        status: string
        branch: string
      }
      setState(prev =>
        upsertAgent(prev, data.agent, data.wave, {
          status: 'complete',
          branch: data.branch,
        })
      )
    })

    es.addEventListener('agent_failed', (event: MessageEvent) => {
      const data = JSON.parse(event.data) as {
        agent: string
        wave: number
        status: string
        failure_type: string
        message: string
      }
      setState(prev =>
        upsertAgent(prev, data.agent, data.wave, {
          status: 'failed',
          failure_type: data.failure_type,
          message: data.message,
        })
      )
    })

    es.addEventListener('agent_output', (event: MessageEvent) => {
      const data = JSON.parse(event.data) as AgentOutputData
      setState(prev => {
        const existing = prev.agents.find(a => a.agent === data.agent && a.wave === data.wave)
        const prevOutput = existing?.output ?? ''
        return upsertAgent(prev, data.agent, data.wave, { output: prevOutput + data.chunk })
      })
    })

    es.addEventListener('wave_complete', (event: MessageEvent) => {
      const data = JSON.parse(event.data) as { wave: number; merge_status: string }
      setState(prev => {
        const waves = prev.waves.map(w =>
          w.wave === data.wave ? { ...w, complete: true, merge_status: data.merge_status } : w
        )
        return { ...prev, waves }
      })
    })

    es.addEventListener('run_complete', (event: MessageEvent) => {
      const data = JSON.parse(event.data) as { status: string; waves: number; agents: number }
      setState(prev => ({ ...prev, runComplete: true, runStatus: data.status }))
    })

    es.addEventListener('run_failed', (event: MessageEvent) => {
      const data = JSON.parse(event.data) as { error: string }
      setState(prev => ({ ...prev, runFailed: data.error }))
    })

    es.addEventListener('wave_gate_pending', (event: MessageEvent) => {
      const data = JSON.parse(event.data) as { wave: number; next_wave: number; slug: string }
      setState(s => ({ ...s, waveGate: { wave: data.wave, nextWave: data.next_wave } }))
    })

    es.addEventListener('wave_gate_resolved', (event: MessageEvent) => {
      const data = JSON.parse(event.data) as { wave: number; action: string }
      void data // consumed for side-effect only
      setState(s => ({ ...s, waveGate: undefined }))
    })

    es.addEventListener('merge_started', (event: MessageEvent) => {
      const data = JSON.parse(event.data) as { slug: string; wave: number }
      setState(prev => {
        const next = new Map(prev.wavesMergeState)
        next.set(data.wave, { status: 'merging', output: '', conflictingFiles: [] })
        return { ...prev, wavesMergeState: next }
      })
    })

    es.addEventListener('merge_output', (event: MessageEvent) => {
      const data = JSON.parse(event.data) as { slug: string; wave: number; chunk: string }
      setState(prev => {
        const next = new Map(prev.wavesMergeState)
        const cur = next.get(data.wave) ?? { status: 'merging' as const, output: '', conflictingFiles: [] }
        next.set(data.wave, { ...cur, output: cur.output + data.chunk })
        return { ...prev, wavesMergeState: next }
      })
    })

    es.addEventListener('merge_complete', (event: MessageEvent) => {
      const data = JSON.parse(event.data) as { slug: string; wave: number; status: string }
      setState(prev => {
        const next = new Map(prev.wavesMergeState)
        const cur = next.get(data.wave) ?? { status: 'idle' as const, output: '', conflictingFiles: [] }
        next.set(data.wave, { ...cur, status: 'success' })
        return { ...prev, wavesMergeState: next }
      })
    })

    es.addEventListener('merge_failed', (event: MessageEvent) => {
      const data = JSON.parse(event.data) as { slug: string; wave: number; error: string; conflicting_files: string[] }
      setState(prev => {
        const next = new Map(prev.wavesMergeState)
        const cur = next.get(data.wave) ?? { status: 'idle' as const, output: '', conflictingFiles: [] }
        next.set(data.wave, { ...cur, status: 'failed', error: data.error, conflictingFiles: data.conflicting_files ?? [] })
        return { ...prev, wavesMergeState: next }
      })
    })

    es.addEventListener('test_started', (event: MessageEvent) => {
      const data = JSON.parse(event.data) as { slug: string; wave: number }
      setState(prev => {
        const next = new Map(prev.wavesTestState)
        next.set(data.wave, { status: 'running', output: '' })
        return { ...prev, wavesTestState: next }
      })
    })

    es.addEventListener('test_output', (event: MessageEvent) => {
      const data = JSON.parse(event.data) as { slug: string; wave: number; chunk: string }
      setState(prev => {
        const next = new Map(prev.wavesTestState)
        const cur = next.get(data.wave) ?? { status: 'running' as const, output: '' }
        next.set(data.wave, { ...cur, output: cur.output + data.chunk })
        return { ...prev, wavesTestState: next }
      })
    })

    es.addEventListener('test_complete', (event: MessageEvent) => {
      const data = JSON.parse(event.data) as { slug: string; wave: number; status: string }
      setState(prev => {
        const next = new Map(prev.wavesTestState)
        const cur = next.get(data.wave) ?? { status: 'idle' as const, output: '' }
        next.set(data.wave, { ...cur, status: 'pass' })
        return { ...prev, wavesTestState: next }
      })
    })

    es.addEventListener('test_failed', (event: MessageEvent) => {
      const data = JSON.parse(event.data) as { slug: string; wave: number; status: string; output: string }
      setState(prev => {
        const next = new Map(prev.wavesTestState)
        const cur = next.get(data.wave) ?? { status: 'idle' as const, output: '' }
        next.set(data.wave, { ...cur, status: 'fail', output: data.output })
        return { ...prev, wavesTestState: next }
      })
    })

    return () => {
      esRef.current?.close()
    }
  }, [slug])

  return state
}
