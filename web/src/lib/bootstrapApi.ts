// Bootstrap API types and client function.
// Agent G (ScoutLauncher) calls runBootstrap(); Agent B registers the Go endpoint.
export { subscribeScoutEvents } from '../api'

export interface BootstrapRunRequest {
  description: string
  repo?: string
}
export interface BootstrapRunResponse {
  run_id: string
}
export async function runBootstrap(
  description: string,
  repo?: string
): Promise<BootstrapRunResponse> {
  const res = await fetch('/api/bootstrap/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description, repo } satisfies BootstrapRunRequest),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Bootstrap failed: ${text}`)
  }
  return res.json() as Promise<BootstrapRunResponse>
}
