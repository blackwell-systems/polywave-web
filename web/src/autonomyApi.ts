// @deprecated — Use sawClient from lib/apiClient.ts instead.
// This file re-exports all functions as thin wrappers over sawClient.autonomy
// so existing imports continue to work without breaking anything.

import { sawClient } from './lib/apiClient'
import type {
  PipelineResponse,
  QueueItem,
  AddQueueItemRequest,
  AutonomyConfig,
  DaemonState,
} from './types/autonomy'

// --- Pipeline ---

export async function fetchPipeline(): Promise<PipelineResponse> {
  return sawClient.autonomy.fetchPipeline()
}

// --- Queue ---

export async function fetchQueue(): Promise<QueueItem[]> {
  return sawClient.autonomy.fetchQueue()
}

export async function addQueueItem(req: AddQueueItemRequest): Promise<QueueItem> {
  return sawClient.autonomy.addQueueItem(req)
}

export async function deleteQueueItem(slug: string): Promise<void> {
  return sawClient.autonomy.deleteQueueItem(slug)
}

export async function updateQueuePriority(slug: string, priority: number): Promise<void> {
  return sawClient.autonomy.updateQueuePriority(slug, priority)
}

// --- Autonomy config ---

export async function fetchAutonomy(): Promise<AutonomyConfig> {
  return sawClient.autonomy.fetchConfig()
}

export async function saveAutonomy(config: AutonomyConfig): Promise<void> {
  return sawClient.autonomy.saveConfig(config)
}

// --- Daemon control ---

export async function startDaemon(): Promise<DaemonState> {
  return sawClient.autonomy.startDaemon()
}

export async function stopDaemon(): Promise<void> {
  return sawClient.autonomy.stopDaemon()
}

export async function fetchDaemonStatus(): Promise<DaemonState> {
  return sawClient.autonomy.fetchDaemonStatus()
}

export function subscribeDaemonEvents(): EventSource {
  return sawClient.autonomy.subscribeDaemonEvents()
}
