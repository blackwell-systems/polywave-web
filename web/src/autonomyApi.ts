// @deprecated — Use polywaveClient from lib/apiClient.ts instead.
// This file re-exports all functions as thin wrappers over polywaveClient.autonomy
// so existing imports continue to work without breaking anything.

import { polywaveClient } from './lib/apiClient'
import type {
  PipelineResponse,
  QueueItem,
  AddQueueItemRequest,
  AutonomyConfig,
  DaemonState,
} from './types/autonomy'

// --- Pipeline ---

export async function fetchPipeline(): Promise<PipelineResponse> {
  return polywaveClient.autonomy.fetchPipeline()
}

// --- Queue ---

export async function fetchQueue(): Promise<QueueItem[]> {
  return polywaveClient.autonomy.fetchQueue()
}

export async function addQueueItem(req: AddQueueItemRequest): Promise<QueueItem> {
  return polywaveClient.autonomy.addQueueItem(req)
}

export async function deleteQueueItem(slug: string): Promise<void> {
  return polywaveClient.autonomy.deleteQueueItem(slug)
}

export async function updateQueuePriority(slug: string, priority: number): Promise<void> {
  return polywaveClient.autonomy.updateQueuePriority(slug, priority)
}

// --- Autonomy config ---

export async function fetchAutonomy(): Promise<AutonomyConfig> {
  return polywaveClient.autonomy.fetchConfig()
}

export async function saveAutonomy(config: AutonomyConfig): Promise<void> {
  return polywaveClient.autonomy.saveConfig(config)
}

// --- Daemon control ---

export async function startDaemon(): Promise<DaemonState> {
  return polywaveClient.autonomy.startDaemon()
}

export async function stopDaemon(): Promise<void> {
  return polywaveClient.autonomy.stopDaemon()
}

export async function fetchDaemonStatus(): Promise<DaemonState> {
  return polywaveClient.autonomy.fetchDaemonStatus()
}

export function subscribeDaemonEvents(): EventSource {
  return polywaveClient.autonomy.subscribeDaemonEvents()
}
