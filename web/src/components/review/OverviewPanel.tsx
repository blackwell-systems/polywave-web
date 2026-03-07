import { IMPLDocResponse } from '../../types'

interface OverviewPanelProps {
  impl: IMPLDocResponse
}

export default function OverviewPanel({ impl }: OverviewPanelProps): JSX.Element {
  const fileCount = impl.file_ownership.length
  const agentSet = new Set(impl.file_ownership.map(e => e.agent))
  const agentCount = agentSet.size
  const waveCount = impl.waves.length
  const verdict = impl.suitability.verdict

  const verdictColor = verdict === 'SUITABLE'
    ? 'text-green-600 dark:text-green-400'
    : 'text-red-600 dark:text-red-400'

  return (
    <div className="border-b pb-2 mb-4">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className={`font-medium ${verdictColor}`}>{verdict}</span>
        <span>·</span>
        <span>{fileCount} files</span>
        <span>·</span>
        <span>{agentCount} agents</span>
        <span>·</span>
        <span>{waveCount} {waveCount === 1 ? 'wave' : 'waves'}</span>
      </div>
    </div>
  )
}
