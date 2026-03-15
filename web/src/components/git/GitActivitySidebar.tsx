import { GitActivitySnapshot, GitCommit } from '../../types/gitActivity'
import BranchLane from './BranchLane'
import CommitDot from './CommitDot'

interface GitActivitySidebarProps {
  slug: string
  snapshot: GitActivitySnapshot | null
}

const VIEWBOX_WIDTH = 600
const ROW_HEIGHT = 60
const MAIN_RAIL_Y = 20
const MAIN_COLOR = '#6b7280'

function mainCommitPositions(commits: GitCommit[], totalWidth: number): number[] {
  if (commits.length === 0) return []
  const leftPad = 24
  const rightPad = 48
  const railWidth = totalWidth - leftPad - rightPad
  const spacing = Math.max(20, Math.min(50, railWidth / commits.length))
  return commits.map((_, i) => leftPad + (i + 1) * spacing)
}

export default function GitActivitySidebar({ snapshot }: GitActivitySidebarProps): JSX.Element {
  if (!snapshot || !snapshot.branches || snapshot.branches.length === 0) {
    return <div className="text-sm text-gray-400 dark:text-gray-500 p-4">No git activity yet.</div>
  }

  const branches = snapshot.branches ?? []
  const main_commits = snapshot.main_commits ?? []
  const totalHeight = (branches.length + 1) * ROW_HEIGHT
  const mainPositions = mainCommitPositions(main_commits, VIEWBOX_WIDTH)

  return (
    <div className="w-full overflow-x-auto">
      <svg
        width="100%"
        height={totalHeight}
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${totalHeight}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Main rail */}
        <g transform={`translate(0, 0)`}>
          <line
            x1={24}
            y1={MAIN_RAIL_Y}
            x2={VIEWBOX_WIDTH - 48}
            y2={MAIN_RAIL_Y}
            stroke={MAIN_COLOR}
            strokeWidth={2}
            strokeOpacity={0.6}
          />
          <text x={8} y={MAIN_RAIL_Y + 4} fontSize={10} fill={MAIN_COLOR} fontWeight="bold">
            main
          </text>
          {main_commits.map((commit, i) => (
            <CommitDot
              key={commit.sha}
              commit={commit}
              color={MAIN_COLOR}
              x={mainPositions[i]}
              y={MAIN_RAIL_Y}
              isPulse={false}
            />
          ))}
        </g>

        {/* Branch lanes */}
        {branches.map((branch, i) => (
          <g key={branch.name} transform={`translate(0, ${(i + 1) * ROW_HEIGHT})`}>
            <BranchLane
              branch={branch}
              mainCommits={main_commits}
              totalWidth={VIEWBOX_WIDTH}
            />
          </g>
        ))}
      </svg>
    </div>
  )
}
