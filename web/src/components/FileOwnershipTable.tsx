import { FileOwnershipEntry } from '../types'

interface FileOwnershipTableProps {
  fileOwnership: FileOwnershipEntry[]
}

const ROW_COLORS = [
  'bg-blue-50',
  'bg-purple-50',
  'bg-orange-50',
  'bg-teal-50',
  'bg-pink-50',
]

function getAgentColor(agentIndex: number): string {
  return ROW_COLORS[agentIndex % ROW_COLORS.length]
}

export default function FileOwnershipTable({ fileOwnership }: FileOwnershipTableProps): JSX.Element {
  // Collect unique agents sorted by letter
  const agents = Array.from(new Set(fileOwnership.map(e => e.agent))).sort()
  const agentColorMap = new Map(agents.map((agent, i) => [agent, getAgentColor(i)]))

  const hasWaves = fileOwnership.some(e => e.wave > 0)
  const hasActions = fileOwnership.some(e => e.action && e.action !== 'unknown')

  // Sort by agent letter, then wave
  const sorted = [...fileOwnership].sort((a, b) => {
    if (a.agent < b.agent) return -1
    if (a.agent > b.agent) return 1
    return a.wave - b.wave
  })

  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-gray-800 mb-3">File Ownership</h2>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left font-medium text-gray-600">File</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Agent</th>
              {hasWaves && <th className="px-4 py-3 text-left font-medium text-gray-600">Wave</th>}
              {hasActions && <th className="px-4 py-3 text-left font-medium text-gray-600">Action</th>}
            </tr>
          </thead>
          <tbody>
            {sorted.map((entry, idx) => {
              const rowColor = agentColorMap.get(entry.agent) ?? 'bg-white'
              return (
                <tr key={idx} className={`${rowColor} border-b border-gray-100 last:border-0`}>
                  <td className="px-4 py-2 font-mono text-xs text-gray-800">{entry.file}</td>
                  <td className="px-4 py-2 text-gray-700">{entry.agent}</td>
                  {hasWaves && <td className="px-4 py-2 text-gray-700">{entry.wave || ''}</td>}
                  {hasActions && <td className="px-4 py-2 text-gray-700 capitalize">{entry.action || ''}</td>}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
