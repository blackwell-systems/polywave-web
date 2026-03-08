import { GitCommit } from '../../types/gitActivity'

interface CommitDotProps {
  commit: GitCommit
  color: string
  x: number
  y: number
  isPulse: boolean
}

export default function CommitDot({ commit, color, x, y, isPulse }: CommitDotProps): JSX.Element {
  const tooltipText = `${commit.sha}: ${commit.message.slice(0, 60)}`

  // Parse color to rgba for pulse ring
  const r = parseInt(color.slice(1, 3), 16)
  const g = parseInt(color.slice(3, 5), 16)
  const b = parseInt(color.slice(5, 7), 16)
  const pulseColor = `rgba(${r}, ${g}, ${b}, 0.2)`

  return (
    <g>
      {isPulse && (
        <circle
          cx={x}
          cy={y}
          r={9}
          fill={pulseColor}
          style={{ animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}
        >
          <title>{tooltipText}</title>
        </circle>
      )}
      <circle cx={x} cy={y} r={5} fill={color}>
        <title>{tooltipText}</title>
      </circle>
    </g>
  )
}
