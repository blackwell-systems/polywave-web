import { FileOwnershipEntry } from '../types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table'
import { Badge } from './ui/badge'

interface FileOwnershipTableProps {
  fileOwnership: FileOwnershipEntry[]
  col4Name?: string
  onFileClick?: (file: string, agent: string, wave: number) => void
}

// Agent-level colors (background) - inner hierarchy
const AGENT_COLORS = [
  { bg: 'bg-blue-100 dark:bg-blue-950', text: 'text-gray-800 dark:text-blue-200' },
  { bg: 'bg-purple-100 dark:bg-purple-950', text: 'text-gray-800 dark:text-purple-200' },
  { bg: 'bg-orange-100 dark:bg-orange-950', text: 'text-gray-800 dark:text-orange-200' },
  { bg: 'bg-teal-100 dark:bg-teal-950', text: 'text-gray-800 dark:text-teal-200' },
  { bg: 'bg-pink-100 dark:bg-pink-950', text: 'text-gray-800 dark:text-pink-200' },
]

// Wave-level colors (border wrapper + badge) - outer hierarchy
const WAVE_COLORS = {
  0: { border: 'border-gray-400', badge: 'border-gray-400 text-gray-700 dark:border-gray-600 dark:text-gray-300' },
  1: { border: 'border-green-500', badge: 'border-green-500 text-green-700 dark:border-green-600 dark:text-green-400' },
  2: { border: 'border-amber-500', badge: 'border-amber-500 text-amber-700 dark:border-amber-600 dark:text-amber-400' },
  3: { border: 'border-cyan-500', badge: 'border-cyan-500 text-cyan-700 dark:border-cyan-600 dark:text-cyan-400' },
  4: { border: 'border-rose-500', badge: 'border-rose-500 text-rose-700 dark:border-rose-600 dark:text-rose-400' },
} as const

function getAgentColor(agentIndex: number) {
  return AGENT_COLORS[agentIndex % AGENT_COLORS.length]
}

function getWaveColor(wave: number) {
  if (wave in WAVE_COLORS) return WAVE_COLORS[wave as keyof typeof WAVE_COLORS]
  return WAVE_COLORS[4]
}

export default function FileOwnershipTableNew({ fileOwnership, col4Name, onFileClick: _onFileClick }: FileOwnershipTableProps): JSX.Element {
  // Build agent color map (excluding Scaffold which gets grey)
  const agents = Array.from(new Set(fileOwnership.map(e => e.agent))).sort()
  const nonScaffoldAgents = agents.filter(a => a.toLowerCase() !== 'scaffold')
  const agentColorMap = new Map(nonScaffoldAgents.map((agent, i) => [agent, getAgentColor(i)]))

  const hasWaves = fileOwnership.some(e => e.wave > 0)
  const isCol4DependsOn = col4Name ? col4Name.toLowerCase().includes('depends') : false
  const col4Label = col4Name || 'Action'
  const hasCol4 = fileOwnership.some(e =>
    isCol4DependsOn
      ? e.depends_on && e.depends_on !== ''
      : e.action && e.action !== 'unknown'
  )
  const hasRepo = fileOwnership.some(e => e.repo && e.repo !== "")

  const sorted = [...fileOwnership].sort((a, b) => {
    const isAScaffold = a.agent.toLowerCase() === 'scaffold'
    const isBScaffold = b.agent.toLowerCase() === 'scaffold'
    if (isAScaffold && !isBScaffold) return -1
    if (!isAScaffold && isBScaffold) return 1

    const waveA = a.wave || 0
    const waveB = b.wave || 0
    if (waveA !== waveB) return waveA - waveB

    if (a.agent < b.agent) return -1
    if (a.agent > b.agent) return 1
    return 0
  })

  // Group by wave
  const groupedByWave: { wave: number; entries: FileOwnershipEntry[] }[] = []
  let currentWave = -1
  let currentGroup: FileOwnershipEntry[] = []

  sorted.forEach(entry => {
    const wave = entry.wave || 0
    if (wave !== currentWave) {
      if (currentGroup.length > 0) {
        groupedByWave.push({ wave: currentWave, entries: currentGroup })
      }
      currentWave = wave
      currentGroup = [entry]
    } else {
      currentGroup.push(entry)
    }
  })
  if (currentGroup.length > 0) {
    groupedByWave.push({ wave: currentWave, entries: currentGroup })
  }

  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold mb-3">File Ownership</h2>
      <div className="space-y-4">
        {groupedByWave.map((group, groupIdx) => {
          const waveColor = getWaveColor(group.wave)
          const isScaffoldGroup = group.wave === 0

          return (
            <div key={groupIdx} className={`rounded-lg border-2 ${waveColor.border} overflow-hidden`}>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[50%]">File</TableHead>
                    <TableHead>Agent</TableHead>
                    {hasWaves && <TableHead className={`w-[80px] ${isScaffoldGroup ? 'opacity-0' : ''}`}>Wave</TableHead>}
                    {hasCol4 && <TableHead>{col4Label}</TableHead>}
                    {hasRepo && <TableHead>Repo</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.entries.map((entry, idx) => {
                    const isScaffold = entry.agent.toLowerCase() === 'scaffold'
                    const agentColors = isScaffold
                      ? { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-800 dark:text-gray-300' }
                      : agentColorMap.get(entry.agent) ?? AGENT_COLORS[0]
                    return (
                      <TableRow
                        key={idx}
                        className={`${agentColors.bg} ${agentColors.text}`}
                      >
                        <TableCell className="font-mono text-xs">{entry.file}</TableCell>
                        <TableCell className="font-medium">{entry.agent}</TableCell>
                        {hasWaves && (
                          <TableCell>
                            {!isScaffold && (
                              <Badge variant="outline" className={`${waveColor.badge} font-mono text-[10px]`}>
                                {entry.wave}
                              </Badge>
                            )}
                          </TableCell>
                        )}
                        {hasCol4 && (
                          <TableCell className="capitalize text-sm opacity-70">
                            {isCol4DependsOn ? (entry.depends_on || '') : (entry.action || '')}
                          </TableCell>
                        )}
                        {hasRepo && (
                          <TableCell className="text-sm opacity-70">
                            {entry.repo || ""}
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )
        })}
      </div>
    </div>
  )
}
