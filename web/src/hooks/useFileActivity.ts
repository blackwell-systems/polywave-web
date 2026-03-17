import { useMemo } from 'react'
import type { AppWaveState } from './useWaveEvents'
import type { AgentStatus } from '../types'
import type { FileActivityEntry, FileActivityStatus } from '../types/fileActivity'

/**
 * useFileActivity derives per-file activity status from running agents'
 * tool calls. Maps file paths to their current activity state (reading,
 * writing, committed, idle).
 */
export function useFileActivity(waveState: AppWaveState): Map<string, FileActivityEntry> {
  return useMemo(() => deriveFileActivity(waveState.agents), [waveState.agents])
}

/**
 * Pure function to derive file activity from agents. Exported for testing.
 */
export function deriveFileActivity(agents: AgentStatus[]): Map<string, FileActivityEntry> {
  const activityMap = new Map<string, FileActivityEntry>()

  // Only process running agents
  const runningAgents = agents.filter(a => a.status === 'running')

  for (const agent of runningAgents) {
    const toolCalls = agent.toolCalls ?? []
    
    // Process each tool call to extract file activity
    for (const call of toolCalls) {
      const files = extractFilesFromToolCall(call.tool_name, call.input)
      
      for (const file of files) {
        const status = deriveFileStatus(call.tool_name, call.status)
        const existing = activityMap.get(file)
        
        // Only update if this is newer or higher priority
        if (!existing || shouldUpdateStatus(existing, status, call.started_at)) {
          activityMap.set(file, {
            status,
            agent: agent.agent,
            lastTool: call.tool_name,
            lastUpdated: call.started_at,
          })
        }
      }
    }
  }

  return activityMap
}

/**
 * Extract file paths from tool call input based on tool name.
 * Handles Read, Write, Edit, and other file-related tools.
 */
function extractFilesFromToolCall(toolName: string, input: string): string[] {
  const files: string[] = []
  
  try {
    const inputObj = JSON.parse(input)
    
    // Handle different tool input schemas
    if (toolName === 'Read' || toolName === 'read_file') {
      if (inputObj.file_path) files.push(inputObj.file_path)
    } else if (toolName === 'Write' || toolName === 'write_file') {
      if (inputObj.file_path) files.push(inputObj.file_path)
    } else if (toolName === 'Edit' || toolName === 'edit_file') {
      if (inputObj.file_path) files.push(inputObj.file_path)
    } else if (toolName === 'bash') {
      // Try to extract file paths from bash commands (heuristic)
      const bashCmd = inputObj.command || ''
      const fileMatches = bashCmd.match(/\b[\w\/.-]+\.(ts|tsx|js|jsx|go|py|java|rs)\b/g)
      if (fileMatches) files.push(...fileMatches)
    }
  } catch {
    // If input is not JSON or parsing fails, skip
  }
  
  return files
}

/**
 * Derive file activity status from tool name and tool call status.
 */
function deriveFileStatus(toolName: string, toolStatus: 'running' | 'done' | 'error'): FileActivityStatus {
  if (toolStatus === 'error') return 'idle'
  if (toolStatus === 'done') {
    // File operations that complete are "committed"
    if (toolName === 'Write' || toolName === 'write_file' || toolName === 'Edit' || toolName === 'edit_file') {
      return 'committed'
    }
    // Reads that complete return to idle
    return 'idle'
  }
  
  // toolStatus === 'running'
  if (toolName === 'Read' || toolName === 'read_file') {
    return 'reading'
  } else if (toolName === 'Write' || toolName === 'write_file' || toolName === 'Edit' || toolName === 'edit_file') {
    return 'writing'
  }
  
  return 'idle'
}

/**
 * Determine if we should update the existing file status with a new one.
 * Prioritizes writing > reading > committed/idle, and newer timestamps.
 */
function shouldUpdateStatus(
  existing: FileActivityEntry,
  newStatus: FileActivityStatus,
  newTimestamp: number
): boolean {
  // Priority order: writing > reading > committed > idle
  const priorityMap: Record<FileActivityStatus, number> = {
    writing: 3,
    reading: 2,
    committed: 1,
    idle: 0,
  }
  
  const existingPriority = priorityMap[existing.status]
  const newPriority = priorityMap[newStatus]
  
  // Update if higher priority
  if (newPriority > existingPriority) return true
  
  // If same priority, update if newer
  if (newPriority === existingPriority && newTimestamp > existing.lastUpdated) return true
  
  return false
}
