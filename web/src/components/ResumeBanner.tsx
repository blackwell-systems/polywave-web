import { useState } from 'react'
import { InterruptedSession } from '../types'
import { resumeExecution } from '../api'

interface ResumeBannerProps {
  sessions: InterruptedSession[]
  onSelect: (slug: string) => void
}

export default function ResumeBanner({ sessions, onSelect }: ResumeBannerProps): JSX.Element | null {
  const [resuming, setResuming] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  if (sessions.length === 0) return null

  async function handleResume(slug: string) {
    setResuming((prev) => ({ ...prev, [slug]: true }))
    setErrors((prev) => { const next = { ...prev }; delete next[slug]; return next })
    const result = await resumeExecution(slug)
    setResuming((prev) => ({ ...prev, [slug]: false }))
    if (!result.success) {
      setErrors((prev) => ({ ...prev, [slug]: result.error ?? 'Resume failed' }))
    }
  }

  return (
    <div className="mx-2 mt-2 mb-1 rounded-none border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-2 space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-300">
        <span className="w-1.5 h-1.5 rounded-none bg-amber-500 animate-pulse" />
        Interrupted {sessions.length === 1 ? 'session' : 'sessions'}
      </div>
      {sessions.map((s) => {
        const dirtyWithChanges = s.dirty_worktrees?.filter((w) => w.has_changes) ?? []
        const dirtyCount = dirtyWithChanges.length
        const isResuming = resuming[s.impl_slug] ?? false
        const resumeLabel = dirtyCount > 0
          ? `Resume (continue ${dirtyCount} agent${dirtyCount !== 1 ? 's' : ''})`
          : 'Resume'

        return (
          <div key={s.impl_slug} className="rounded-none px-2 py-1.5 bg-transparent">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-foreground truncate">{s.impl_slug}</span>
              <span className="text-[10px] font-medium text-amber-700 dark:text-amber-400">
                {Math.round(s.progress_pct)}%
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
              Wave {s.current_wave}/{s.total_waves}
              {s.failed_agents.length > 0 && (
                <span className="text-destructive ml-1">
                  — {s.failed_agents.length} failed
                </span>
              )}
              {s.orphaned_worktrees.length > 0 && (
                <span className="text-amber-600 dark:text-amber-400 ml-1">
                  — {s.orphaned_worktrees.length} orphaned worktree{s.orphaned_worktrees.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            {dirtyCount > 0 && (
              <div className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5 leading-tight">
                {dirtyCount} agent{dirtyCount !== 1 ? 's' : ''} have uncommitted work:{' '}
                {dirtyWithChanges.map((w) => w.agent_id).join(', ')}
              </div>
            )}
            <div className="text-[10px] text-muted-foreground/70 mt-0.5 italic">
              {s.suggested_action}
            </div>
            {errors[s.impl_slug] && (
              <div className="text-[10px] text-destructive mt-0.5 leading-tight">
                {errors[s.impl_slug]}
              </div>
            )}
            <div className="flex items-center gap-1.5 mt-1.5">
              <button
                onClick={() => onSelect(s.impl_slug)}
                className="text-[10px] font-medium px-2 py-0.5 rounded-none border border-amber-400 dark:border-amber-600 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
              >
                View
              </button>
              <button
                onClick={() => handleResume(s.impl_slug)}
                disabled={!s.can_auto_resume || isResuming}
                className="text-[10px] font-medium px-2 py-0.5 rounded-none border border-emerald-600 dark:border-emerald-500 bg-emerald-600 dark:bg-emerald-600 text-white hover:bg-emerald-700 dark:hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isResuming ? 'Resuming…' : resumeLabel}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
