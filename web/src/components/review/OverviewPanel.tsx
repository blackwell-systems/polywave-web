import { useState } from 'react'
import { IMPLDocResponse } from '../../types'

interface OverviewPanelProps {
  impl: IMPLDocResponse
}

export default function OverviewPanel({ impl }: OverviewPanelProps): JSX.Element {
  const [showRationale, setShowRationale] = useState(false)
  const fileCount = impl.file_ownership.length
  const agentSet = new Set(impl.file_ownership.map(e => e.agent))
  const agentCount = agentSet.size
  const waveCount = impl.waves.length
  const verdict = impl.suitability.verdict
  const rationale = impl.suitability.rationale

  const verdictColor = verdict === 'SUITABLE'
    ? 'text-green-600 dark:text-green-400'
    : verdict === 'SUITABLE WITH CAVEATS'
      ? 'text-yellow-600 dark:text-yellow-400'
      : 'text-red-600 dark:text-red-400'

  return (
    <div className="border-b pb-2 mb-4">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <button
          onClick={() => rationale && setShowRationale(v => !v)}
          className={`font-medium ${verdictColor} ${rationale ? 'cursor-pointer hover:underline' : ''}`}
        >
          {verdict}{rationale ? (showRationale ? ' ▾' : ' ▸') : ''}
        </button>
        <span>·</span>
        <span>{fileCount} files</span>
        <span>·</span>
        <span>{agentCount} agents</span>
        <span>·</span>
        <span>{waveCount} {waveCount === 1 ? 'wave' : 'waves'}</span>
      </div>
      {showRationale && rationale && (
        <pre className="mt-3 p-3 text-xs leading-relaxed text-muted-foreground bg-muted/50 rounded-md border border-border overflow-x-auto whitespace-pre-wrap font-mono">
          {rationale}
        </pre>
      )}
    </div>
  )
}
