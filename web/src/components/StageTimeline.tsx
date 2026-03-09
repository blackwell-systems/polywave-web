import type { StageEntry } from '../hooks/useWaveEvents'

function stageLabel(entry: StageEntry): string {
  switch (entry.stage) {
    case 'scaffold':     return 'Scaffold'
    case 'wave_execute': return `Wave ${entry.wave_num} Execute`
    case 'wave_merge':   return `Wave ${entry.wave_num} Merge`
    case 'wave_verify':  return `Wave ${entry.wave_num} Verify`
    case 'wave_gate':    return `Wave ${entry.wave_num} Gate`
    case 'complete':     return 'Complete'
    case 'failed':       return 'Failed'
    default:             return entry.stage
  }
}

function StatusDot({ status }: { status: StageEntry['status'] }) {
  if (status === 'complete') {
    return <span className="text-green-500 font-bold leading-none">✓</span>
  }
  if (status === 'running') {
    return (
      <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
    )
  }
  if (status === 'failed') {
    return <span className="text-red-500 font-bold leading-none">✗</span>
  }
  return <span className="inline-block w-2 h-2 rounded-full bg-muted-foreground/30" />
}

interface StageTimelineProps {
  entries: StageEntry[]
}

export default function StageTimeline({ entries }: StageTimelineProps): JSX.Element | null {
  if (entries.length === 0) return null

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2.5">
        Pipeline
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5">
        {entries.map((entry, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs">
            <StatusDot status={entry.status} />
            <span
              className={
                entry.status === 'running'
                  ? 'text-blue-700 dark:text-blue-400 font-medium'
                  : entry.status === 'complete'
                  ? 'text-gray-600 dark:text-gray-400'
                  : entry.status === 'failed'
                  ? 'text-red-600 dark:text-red-400 font-medium'
                  : 'text-muted-foreground'
              }
            >
              {stageLabel(entry)}
            </span>
            {entry.status === 'failed' && entry.message && (
              <span
                className="text-red-500 text-[10px] max-w-[120px] truncate"
                title={entry.message}
              >
                — {entry.message}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
