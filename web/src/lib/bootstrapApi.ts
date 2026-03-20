// Bootstrap API types and client function.
// Agent G (ScoutLauncher) calls runBootstrap(); Agent B registers the Go endpoint.
// SCAFFOLD: Agent G implements the body of runBootstrap in this wave.
export interface BootstrapRunRequest {
  description: string
  repo?: string
}
export interface BootstrapRunResponse {
  run_id: string
}
export async function runBootstrap(_description: string, _repo?: string): Promise<BootstrapRunResponse> {
  throw new Error('Not implemented: scaffold stub — Agent G will implement this')
}
