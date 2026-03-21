import React from 'react'
import { Play, Eye, Pencil, X } from 'lucide-react'
import { Tooltip } from './ui/tooltip'

interface ActionButtonsProps {
  onApprove: () => void
  onReject: () => void
  onRequestChanges: () => void
  onViewWaves?: () => void
  hasWaveWork?: boolean
}

const base = "flex items-center justify-center gap-2 text-sm font-medium px-6 h-14 transition-all duration-150 border-t-2 hover:scale-[1.02] active:scale-[0.98]"

export default React.memo(function ActionButtons({ onApprove, onReject, onRequestChanges, onViewWaves, hasWaveWork }: ActionButtonsProps): JSX.Element {
  return (
    <div className="flex items-stretch">
      {hasWaveWork && onViewWaves && (
        <button onClick={onViewWaves} className={`${base} border-t-blue-500 text-blue-700 dark:text-blue-400 hover:bg-blue-500/10 active:bg-blue-500/20`}>
          <Eye className="w-4 h-4" />
          <Tooltip content="Live dashboard showing agent progress, logs, and completion status for the current wave execution." position="top">
            <span>View WaveBoard</span>
          </Tooltip>
        </button>
      )}
      <button onClick={onApprove} className={`${base} border-t-green-500 text-green-700 dark:text-green-400 hover:bg-green-500/10 active:bg-green-500/20`}>
        <Play className="w-4 h-4" />
        <Tooltip content="Launches Wave 1 agents in parallel. Each agent works in an isolated git worktree. Scaffolds are created first if needed (I2)." position="top">
          <span>Approve</span>
        </Tooltip>
      </button>
      <button onClick={onRequestChanges} className={`${base} border-t-amber-500 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 active:bg-amber-500/20`}>
        <Pencil className="w-4 h-4" />
        <Tooltip content="Edit the IMPL doc before execution. Adjust agent briefs, file ownership, interface contracts, or wave structure." position="top">
          <span>Request Changes</span>
        </Tooltip>
      </button>
      <button onClick={onReject} className={`${base} border-t-red-500 text-red-700 dark:text-red-400 hover:bg-red-500/10 active:bg-red-500/20`}>
        <X className="w-4 h-4" />
        <Tooltip content="Reject this plan entirely. The IMPL doc will be archived and no agents will be launched." position="top">
          <span>Reject</span>
        </Tooltip>
      </button>
    </div>
  )
})
