/** Status of a file during live wave execution. */
export type FileActivityStatus = 'idle' | 'reading' | 'writing' | 'committed'

/** Per-file activity state derived from SSE tool_call events. */
export interface FileActivityEntry {
  status: FileActivityStatus
  agent: string
  lastTool?: string      // e.g. "Read", "Write", "Edit"
  lastUpdated: number    // Date.now() timestamp
}
