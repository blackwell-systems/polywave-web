import { IMPLDocResponse, IMPLListEntry } from './types'

export async function listImpls(): Promise<IMPLListEntry[]> {
  const response = await fetch('/api/impl')
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`)
  }
  return response.json() as Promise<IMPLListEntry[]>
}

export async function fetchImpl(slug: string): Promise<IMPLDocResponse> {
  const response = await fetch(`/api/impl/${encodeURIComponent(slug)}`)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`)
  }
  return response.json() as Promise<IMPLDocResponse>
}

export async function approveImpl(slug: string): Promise<void> {
  const response = await fetch(`/api/impl/${encodeURIComponent(slug)}/approve`, {
    method: 'POST',
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`)
  }
}

export async function rejectImpl(slug: string): Promise<void> {
  const response = await fetch(`/api/impl/${encodeURIComponent(slug)}/reject`, {
    method: 'POST',
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`)
  }
}

export async function startWave(slug: string): Promise<void> {
  const response = await fetch(`/api/wave/${encodeURIComponent(slug)}/start`, {
    method: 'POST',
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`)
  }
}

export async function runScout(feature: string, repo?: string): Promise<{ runId: string }> {
  const r = await fetch('/api/scout/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ feature, repo }),
  })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const data = await r.json()
  return { runId: data.run_id }
}

export function subscribeScoutEvents(runId: string): EventSource {
  return new EventSource(`/api/scout/${encodeURIComponent(runId)}/events`)
}

export async function proceedWaveGate(slug: string): Promise<void> {
  const r = await fetch(`/api/wave/${encodeURIComponent(slug)}/gate/proceed`, { method: 'POST' })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
}

export async function fetchImplRaw(slug: string): Promise<string> {
  const r = await fetch(`/api/impl/${encodeURIComponent(slug)}/raw`)
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.text()
}

export async function deleteImpl(slug: string): Promise<void> {
  const r = await fetch(`/api/impl/${encodeURIComponent(slug)}`, { method: 'DELETE' })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
}

export async function cancelScout(runId: string): Promise<void> {
  await fetch(`/api/scout/${encodeURIComponent(runId)}/cancel`, { method: 'POST' })
}

export async function cancelRevise(slug: string, runId: string): Promise<void> {
  await fetch(`/api/impl/${encodeURIComponent(slug)}/revise/${encodeURIComponent(runId)}/cancel`, { method: 'POST' })
}

export async function mergeWave(slug: string, wave: number): Promise<void> {
  const r = await fetch(`/api/wave/${encodeURIComponent(slug)}/merge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wave }),
  })
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`)
}

export async function runWaveTests(slug: string, wave: number): Promise<void> {
  const r = await fetch(`/api/wave/${encodeURIComponent(slug)}/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wave }),
  })
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`)
}

export async function saveImplRaw(slug: string, content: string): Promise<void> {
  const r = await fetch(`/api/impl/${encodeURIComponent(slug)}/raw`, {
    method: 'PUT',
    headers: { 'Content-Type': 'text/plain' },
    body: content,
  })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
}

export async function runImplRevise(slug: string, feedback: string): Promise<{ runId: string }> {
  const r = await fetch(`/api/impl/${encodeURIComponent(slug)}/revise`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ feedback }),
  })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const data = await r.json()
  return { runId: data.run_id }
}

export function subscribeReviseEvents(slug: string, runId: string): EventSource {
  return new EventSource(`/api/impl/${encodeURIComponent(slug)}/revise/${encodeURIComponent(runId)}/events`)
}

export async function rerunAgent(slug: string, wave: number, agentLetter: string): Promise<void> {
  const r = await fetch(`/api/wave/${encodeURIComponent(slug)}/agent/${encodeURIComponent(agentLetter)}/rerun`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wave }),
  })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
}
