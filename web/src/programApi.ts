// @deprecated — Use sawClient from lib/apiClient.ts instead.
// This file re-exports all functions as thin wrappers over sawClient.program
// so existing imports continue to work without breaking anything.

import { sawClient } from './lib/apiClient'
import type {
  ProgramDiscovery,
  ProgramStatus,
  TierStatus,
  ContractStatus,
} from './types/program'

export async function listPrograms(): Promise<ProgramDiscovery[]> {
  return sawClient.program.list()
}

export async function fetchProgramStatus(slug: string): Promise<ProgramStatus> {
  return sawClient.program.status(slug)
}

export async function fetchTierStatus(slug: string, tier: number): Promise<TierStatus> {
  return sawClient.program.tierStatus(slug, tier)
}

export async function executeTier(slug: string, tier: number, auto?: boolean): Promise<void> {
  return sawClient.program.executeTier(slug, tier, auto)
}

export async function fetchProgramContracts(slug: string): Promise<ContractStatus[]> {
  return sawClient.program.contracts(slug)
}

export async function replanProgram(slug: string): Promise<void> {
  return sawClient.program.replan(slug)
}

// ── Planner API ──────────────────────────────────────────────────────────────

export async function runPlanner(
  description: string,
  repo?: string,
): Promise<{ runId: string }> {
  return sawClient.program.runPlanner(description, repo)
}

export function subscribePlannerEvents(runId: string): EventSource {
  return sawClient.program.subscribePlannerEvents(runId)
}

export async function cancelPlanner(runId: string): Promise<void> {
  return sawClient.program.cancelPlanner(runId)
}
