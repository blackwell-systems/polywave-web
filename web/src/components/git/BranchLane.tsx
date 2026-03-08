import { GitBranch, GitCommit } from '../../types/gitActivity'
import { getAgentColor } from '../../lib/agentColors'
import CommitDot from './CommitDot'

interface BranchLaneProps {
  branch: GitBranch
  mainCommits: GitCommit[]
  totalWidth: number
}

const STATUS_ICONS: Record<string, string> = {
  running: '⏳',
  complete: '✓',
  failed: '✗',
  pending: '·',
}

export default function BranchLane({ branch, mainCommits, totalWidth }: BranchLaneProps): JSX.Element {
  const color = getAgentColor(branch.agent)
  const railY = 30
  const leftPad = 24
  const rightPad = 48
  const railWidth = totalWidth - leftPad - rightPad
  const statusIcon = STATUS_ICONS[branch.status] ?? '·'
  const commits = branch.commits

  // Compute commit dot positions
  let dotPositions: number[] = []
  if (commits.length > 0) {
    const spacing = Math.max(20, Math.min(50, railWidth / commits.length))
    dotPositions = commits.map((_, i) => leftPad + (i + 1) * spacing)
  }

  // Bezier merge curve: from last commit dot up to main rail (y=0 in parent coords, but we aim y=0 in our group)
  const lastDotX = dotPositions.length > 0 ? dotPositions[dotPositions.length - 1] : leftPad
  const mergeTargetX = mainCommits.length > 0
    ? leftPad + Math.max(20, Math.min(50, railWidth / Math.max(mainCommits.length, 1))) * mainCommits.length
    : lastDotX

  return (
    <g data-testid={`branch-lane-${branch.agent}`}>
      {/* Agent label */}
      <text
        x={8}
        y={railY + 4}
        fontSize={11}
        fontWeight="bold"
        fill={color}
      >
        {branch.agent}
      </text>

      {/* Rail */}
      {commits.length === 0 ? (
        <line
          x1={leftPad}
          y1={railY}
          x2={totalWidth - rightPad}
          y2={railY}
          stroke={color}
          strokeOpacity={0.7}
          strokeWidth={2}
          strokeDasharray="4 4"
        />
      ) : (
        <line
          x1={leftPad}
          y1={railY}
          x2={totalWidth - rightPad}
          y2={railY}
          stroke={color}
          strokeOpacity={0.7}
          strokeWidth={2}
        />
      )}

      {/* Commit dots */}
      {commits.map((commit, i) => {
        const isPulse = branch.status === 'running' && i === commits.length - 1
        return (
          <CommitDot
            key={commit.sha}
            commit={commit}
            color={color}
            x={dotPositions[i]}
            y={railY}
            isPulse={isPulse}
          />
        )
      })}

      {/* Merge bezier curve */}
      {branch.merged && commits.length > 0 && (
        <path
          d={`M ${lastDotX} ${railY} C ${lastDotX} ${railY - 20}, ${mergeTargetX} ${-10}, ${mergeTargetX} 0`}
          stroke={color}
          strokeOpacity={0.8}
          strokeWidth={2}
          fill="none"
        />
      )}

      {/* Status icon */}
      <text
        x={totalWidth - rightPad + 8}
        y={railY + 4}
        fontSize={12}
        fill={color}
      >
        {statusIcon}
      </text>
    </g>
  )
}
