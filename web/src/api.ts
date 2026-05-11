// @deprecated — Use polywaveClient from lib/apiClient.ts instead.
// This file re-exports all functions as thin wrappers over the new PolywaveClient
// so existing imports continue to work without breaking anything.

import { polywaveClient } from './lib/apiClient'
import type { IMPLDocResponse, IMPLListEntry, WorktreeListResponse, WorktreeBatchDeleteRequest, WorktreeBatchDeleteResponse, FileDiffResponse, PolyConfig, ChatMessage, AgentContextResponse, ScoutContext, InterruptedSession } from './types'
import type { FileTreeResponse, FileContentResponse, GitStatusResponse, FileResolveResponse } from './types/filebrowser'

// Re-export types that consumers may import from this file
export type { BrowseResult, DiskAgentStatus, DiskWaveStatus } from './lib/apiClient'

export async function listImpls(): Promise<IMPLListEntry[]> {
  return polywaveClient.impl.list()
}

export async function fetchImpl(slug: string): Promise<IMPLDocResponse> {
  return polywaveClient.impl.get(slug)
}

export async function approveImpl(slug: string): Promise<void> {
  return polywaveClient.impl.approve(slug)
}

export async function rejectImpl(slug: string): Promise<void> {
  return polywaveClient.impl.reject(slug)
}

export async function startWave(slug: string): Promise<void> {
  return polywaveClient.wave.start(slug)
}

export async function runScout(feature: string, repo?: string, context?: ScoutContext): Promise<{ runId: string }> {
  return polywaveClient.scout.run(feature, repo, context)
}

export function subscribeScoutEvents(runId: string): EventSource {
  return polywaveClient.scout.subscribeEvents(runId)
}

export async function proceedWaveGate(slug: string): Promise<void> {
  return polywaveClient.wave.proceedGate(slug)
}

export async function fetchImplRaw(slug: string): Promise<string> {
  return polywaveClient.impl.getRaw(slug)
}

export async function deleteImpl(slug: string): Promise<void> {
  return polywaveClient.impl.delete(slug)
}

export async function cancelScout(runId: string): Promise<void> {
  return polywaveClient.scout.cancel(runId)
}

// cancelRevise has no direct PolywaveClient mapping; keep inline fetch for now
export async function cancelRevise(slug: string, runId: string): Promise<void> {
  await fetch(`/api/impl/${encodeURIComponent(slug)}/revise/${encodeURIComponent(runId)}/cancel`, { method: 'POST' })
}

export async function mergeWave(slug: string, wave: number): Promise<void> {
  return polywaveClient.wave.mergeWave(slug, wave)
}

export async function mergeAbort(slug: string): Promise<void> {
  return polywaveClient.wave.mergeAbort(slug)
}

export async function runWaveTests(slug: string, wave: number): Promise<void> {
  return polywaveClient.wave.runTests(slug, wave)
}

export async function resolveConflicts(slug: string, wave: number): Promise<void> {
  return polywaveClient.wave.resolveConflicts(slug, wave)
}

export async function saveImplRaw(slug: string, content: string): Promise<void> {
  return polywaveClient.impl.saveRaw(slug, content)
}

export async function runImplRevise(slug: string, feedback: string): Promise<{ runId: string }> {
  return polywaveClient.impl.revise(slug, feedback)
}

export function subscribeReviseEvents(slug: string, runId: string): EventSource {
  return polywaveClient.impl.subscribeReviseEvents(slug, runId)
}

export async function rerunAgent(slug: string, wave: number, agentLetter: string, opts?: { scopeHint?: string }): Promise<void> {
  return polywaveClient.wave.rerunAgent(slug, wave, agentLetter, opts)
}

export async function retryFinalize(slug: string, wave: number): Promise<void> {
  return polywaveClient.wave.retryFinalize(slug, wave)
}

export async function fixBuild(slug: string, wave: number, errorLog: string, gateType: string): Promise<void> {
  return polywaveClient.wave.fixBuild(slug, wave, errorLog, gateType)
}

// Disk-based wave status (survives server restarts)
export async function fetchDiskWaveStatus(slug: string): Promise<import('./lib/apiClient').DiskWaveStatus> {
  return polywaveClient.wave.diskStatus(slug)
}

// Worktree manager
export async function listWorktrees(slug: string): Promise<WorktreeListResponse> {
  return polywaveClient.impl.worktrees.list(slug)
}

export async function deleteWorktree(slug: string, branch: string): Promise<void> {
  return polywaveClient.impl.worktrees.delete(slug, branch)
}

export async function batchDeleteWorktrees(slug: string, req: WorktreeBatchDeleteRequest): Promise<WorktreeBatchDeleteResponse> {
  return polywaveClient.impl.worktrees.batchDelete(slug, req)
}

// File diff viewer
export async function fetchFileDiff(slug: string, agent: string, wave: number, file: string): Promise<FileDiffResponse> {
  return polywaveClient.impl.diff(slug, agent, wave, file)
}

// Settings
export async function getConfig(): Promise<PolyConfig> {
  return polywaveClient.config.get()
}

export async function browse(path?: string): Promise<import('./lib/apiClient').BrowseResult> {
  return polywaveClient.config.browse(path)
}

/** Opens the OS-native folder picker dialog (macOS only).
 *  Returns the selected path, null if cancelled, or throws if unsupported. */
export async function browseNative(prompt?: string): Promise<string | null> {
  return polywaveClient.config.browseNative(prompt)
}

export async function saveConfig(config: PolyConfig): Promise<void> {
  return polywaveClient.config.save(config)
}

// CONTEXT.md viewer
export async function getContext(): Promise<string> {
  return polywaveClient.config.context.get()
}

export async function putContext(content: string): Promise<void> {
  return polywaveClient.config.context.put(content)
}

// Chat with Claude
export async function startImplChat(slug: string, message: string, history: ChatMessage[]): Promise<{ runId: string }> {
  return polywaveClient.impl.chat(slug, message, history)
}

export function subscribeChatEvents(slug: string, runId: string): EventSource {
  return polywaveClient.impl.subscribeChatEvents(slug, runId)
}

// Scaffold rerun
export async function rerunScaffold(slug: string): Promise<void> {
  return polywaveClient.scout.rerunScaffold(slug)
}

// Per-agent context payload
export async function fetchAgentContext(slug: string, agent: string): Promise<AgentContextResponse> {
  return polywaveClient.impl.fetchAgentContext(slug, agent)
}

// Interrupted session detection (resume)
export async function fetchInterruptedSessions(): Promise<InterruptedSession[]> {
  return polywaveClient.wave.interruptedSessions()
}

// Resume execution for an interrupted session.
// Unlike other api.ts functions, this does NOT throw on failure.
// It returns { success: false, error: message } so callers can handle
// errors inline without try/catch in the render tree.
export async function resumeExecution(slug: string): Promise<{ success: boolean; error?: string }> {
  return polywaveClient.wave.resumeExecution(slug)
}

// File browser API
export async function fetchFileTree(repo: string, path?: string): Promise<FileTreeResponse> {
  return polywaveClient.files.tree(repo, path)
}

export async function fetchFileContent(repo: string, path: string): Promise<FileContentResponse> {
  return polywaveClient.files.read(repo, path)
}

export async function fetchFileDiffForBrowser(repo: string, path: string): Promise<{ repo: string; path: string; diff: string }> {
  return polywaveClient.files.diff(repo, path)
}

export async function fetchGitStatus(repo: string): Promise<GitStatusResponse> {
  return polywaveClient.files.gitStatus(repo)
}

export async function fetchResolveFile(path: string): Promise<FileResolveResponse> {
  return polywaveClient.files.resolve(path)
}

// Pipeline recovery controls
export async function retryStep(slug: string, step: string, wave: number): Promise<void> {
  return polywaveClient.wave.retryStep(slug, step, wave)
}

export async function skipStep(slug: string, step: string, wave: number, reason: string): Promise<void> {
  return polywaveClient.wave.skipStep(slug, step, wave, reason)
}

export async function forceMarkComplete(slug: string): Promise<void> {
  return polywaveClient.wave.forceMarkComplete(slug)
}
