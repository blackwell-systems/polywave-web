import { useState, useRef, useEffect, useCallback } from 'react'
import { IMPLDocResponse } from '../../types'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { getAgentColor, getAgentColorWithOpacity } from '../../lib/agentColors'
import { ExecutionSyncState } from '../../hooks/useExecutionSync'

interface WaveStructurePanelProps {
  impl: IMPLDocResponse
  executionState?: ExecutionSyncState
}

type NodeType = 'orchestrator' | 'wave' | 'scaffold' | 'merge' | 'complete'

interface TimelineNode {
  type: NodeType
  label: string
  description?: string
  agents?: string[]
  agentCount?: number
  scaffoldFiles?: number
  waveNum?: number
}

// Wave colors matching the dependency graph — each wave gets a distinct hue.
const WAVE_COLORS = [
  '#3b82f6', // wave 1 — blue
  '#ec4899', // wave 2 — pink
  '#22c55e', // wave 3 — green
  '#f59e0b', // wave 4 — amber
  '#6366f1', // wave 5 — indigo
  '#14b8a6', // wave 6 — teal
]

// Node type base colors for non-wave nodes
const NODE_COLORS: Record<NodeType, string> = {
  orchestrator: '#06b6d4', // cyan — distinct from waves but subtle
  scaffold: '#f59e0b',
  wave: '#3b82f6',         // fallback, overridden per-wave
  merge: '#94a3b8',        // lighter slate for small merge dots
  complete: '#7c3aed',
}

function getNodeColor(node: TimelineNode): string {
  if (node.type === 'wave' && node.waveNum !== undefined) {
    return WAVE_COLORS[(node.waveNum - 1) % WAVE_COLORS.length]
  }
  if (node.type === 'merge' && node.waveNum !== undefined) {
    return WAVE_COLORS[(node.waveNum - 1) % WAVE_COLORS.length]
  }
  return NODE_COLORS[node.type]
}

let orbCounter = 0

function Orb({ color, filled, filling, size = 20, type }: {
  color: string
  filled: boolean
  filling?: boolean
  size?: number
  type: NodeType
}) {
  const [uid] = useState(() => `orb-${++orbCounter}`)
  const r = size / 2

  // Derive lighter/darker shades from the base color
  const lightColor = color + '80'
  const midColor = color
  const darkColor = color + 'cc'

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={`flex-shrink-0 transition-all duration-700 ease-out${filling ? ' scale-110' : ''}`}
      style={{ filter: filled ? `drop-shadow(0 0 6px ${color}60)` : undefined }}
    >
      <defs>
        <radialGradient id={`${uid}-grad`} cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor={lightColor} stopOpacity={filled ? 1 : 0.3}>
            <animate attributeName="stop-opacity" from={filled ? '0.3' : '0.3'} to={filled ? '1' : '0.3'} dur="0.7s" fill="freeze" />
          </stop>
          <stop offset="50%" stopColor={midColor} stopOpacity={filled ? 0.85 : 0.15}>
            <animate attributeName="stop-opacity" from={filled ? '0.15' : '0.15'} to={filled ? '0.85' : '0.15'} dur="0.7s" fill="freeze" />
          </stop>
          <stop offset="100%" stopColor={darkColor} stopOpacity={filled ? 0.7 : 0.1}>
            <animate attributeName="stop-opacity" from={filled ? '0.1' : '0.1'} to={filled ? '0.7' : '0.1'} dur="0.7s" fill="freeze" />
          </stop>
        </radialGradient>
        <radialGradient id={`${uid}-hl`} cx="30%" cy="25%" r="35%">
          <stop offset="0%" stopColor="white" stopOpacity={filled ? 0.7 : 0.3} />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Outer glow ring — only when filled */}
      {filled && (
        <circle cx={r} cy={r} r={r - 0.5} fill={midColor} opacity={0.2}>
          <animate attributeName="opacity" from="0" to="0.2" dur="0.5s" fill="freeze" />
        </circle>
      )}
      {/* Body */}
      <circle
        cx={r} cy={r} r={r - 1.5}
        fill={`url(#${uid}-grad)`}
        stroke={midColor}
        strokeWidth={filled ? 1.5 : 1}
        strokeOpacity={filled ? 0.8 : 0.3}
      />
      {/* Inner highlight — glassy reflection */}
      <circle cx={r} cy={r} r={r - 2.5} fill={`url(#${uid}-hl)`} />
      {/* Completion ring */}
      {type === 'complete' && filled && (
        <circle cx={r} cy={r} r={r - 0.5} fill="none" stroke={lightColor} strokeWidth="0.75" strokeOpacity={0.6}>
          <animate attributeName="stroke-opacity" from="0" to="0.6" dur="0.8s" fill="freeze" />
        </circle>
      )}
    </svg>
  )
}

function getAgentBoxStyle(
  letter: string,
  waveNum: number,
  executionState: ExecutionSyncState | undefined
): React.CSSProperties {
  if (!executionState || executionState.agents.size === 0) return {}
  const exec = executionState.agents.get(`${waveNum}:${letter}`)
  if (!exec) return {}
  switch (exec.status) {
    case 'running':
      return {
        borderColor: 'rgb(88, 166, 255)',
        boxShadow: '0 0 12px rgba(88, 166, 255, 0.4)',
      }
    case 'complete':
      return {
        borderColor: 'rgb(63, 185, 80)',
        boxShadow: '0 0 10px rgba(63, 185, 80, 0.3)',
      }
    case 'failed':
      return {
        borderColor: 'rgb(248, 81, 73)',
        boxShadow: '0 0 12px rgba(248, 81, 73, 0.5)',
      }
    default:
      return {}
  }
}

function getAgentBoxClassName(
  letter: string,
  waveNum: number,
  executionState: ExecutionSyncState | undefined
): string {
  if (!executionState || executionState.agents.size === 0) return ''
  const exec = executionState.agents.get(`${waveNum}:${letter}`)
  if (!exec) return ''
  switch (exec.status) {
    case 'running':
      return 'exec-node-running'
    case 'complete':
      return 'exec-node-complete'
    case 'failed':
      return 'exec-node-failed'
    default:
      return ''
  }
}

export default function WaveStructurePanel({ impl, executionState }: WaveStructurePanelProps): JSX.Element {
  const sortedWaves = [...impl.waves].sort((a, b) => a.number - b.number)
  const isComplete = impl.doc_status === 'complete'
  const isLive = executionState?.isLive ?? false

  // Build timeline nodes
  const nodes: TimelineNode[] = []

  nodes.push({ type: 'orchestrator', label: 'Scout', description: 'Analyze codebase and produce IMPL doc' })

  if (impl.scaffold.required) {
    nodes.push({
      type: 'scaffold',
      label: 'Scaffold',
      scaffoldFiles: impl.scaffold.files?.length ?? 0,
    })
  }

  sortedWaves.forEach((wave, i) => {
    const agents = wave.agents ?? []
    nodes.push({
      type: 'wave',
      label: `Wave ${wave.number}`,
      agents,
      agentCount: agents.length,
      waveNum: wave.number,
    })
    nodes.push({
      type: 'merge',
      label: 'Merge',
      description: i < sortedWaves.length - 1
        ? `Merge ${wave.agents.length} branches, verify, gate Wave ${wave.number + 1}`
        : `Merge ${wave.agents.length} branches, final verification`,
      waveNum: wave.number,
    })
  })

  nodes.push({ type: 'complete', label: 'Complete', description: 'All waves merged and verified' })

  // Compute filled state per node.
  // Uses executionState when available (live or disk-seeded), falls back to
  // isComplete for nodes that can't be determined from agent data alone.
  const isNodeFilled = useCallback((node: TimelineNode): boolean => {
    switch (node.type) {
      case 'orchestrator':
        // Scout always ran — we're viewing its output
        return true

      case 'scaffold':
        return executionState?.scaffoldStatus === 'complete' || isComplete

      case 'wave': {
        if (isComplete) return true
        const waveNum = node.waveNum!
        const progress = executionState?.waveProgress.get(waveNum)
        if (!progress) return isComplete
        return progress.total > 0 && progress.complete === progress.total
      }

      case 'merge': {
        if (isComplete) return true
        const waveNum = node.waveNum!
        const progress = executionState?.waveProgress.get(waveNum)
        if (!progress) return isComplete
        return progress.mergeStatus === 'success'
      }

      case 'complete':
        return isComplete

      default:
        return isComplete
    }
  }, [isComplete, executionState])

  // Track node element positions for the progress rail
  const railRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const nodeRefs = useRef<(HTMLDivElement | null)[]>([])
  const [progressHeight, setProgressHeight] = useState(0)
  const [progressGradient, setProgressGradient] = useState('')

  // Compute progress rail height and gradient based on filled nodes
  useEffect(() => {
    if (!containerRef.current || !railRef.current) return

    const railTop = railRef.current.getBoundingClientRect().top
    const railHeight = railRef.current.getBoundingClientRect().height

    if (railHeight === 0) return

    // Find the last filled node's position and build gradient stops
    let lastFilledBottom = 0
    const gradientStops: string[] = []

    for (let i = 0; i < nodes.length; i++) {
      const el = nodeRefs.current[i]
      if (!el) continue

      const nodeRect = el.getBoundingClientRect()
      const nodeCenter = nodeRect.top + nodeRect.height / 2 - railTop
      const filled = isNodeFilled(nodes[i])
      const color = getNodeColor(nodes[i])

      if (filled) {
        lastFilledBottom = nodeCenter
        gradientStops.push(`${color} ${(nodeCenter / railHeight) * 100}%`)
      }
    }

    if (gradientStops.length > 0) {
      // Add transparent stop at the end of filled region
      const pct = Math.min((lastFilledBottom / railHeight) * 100, 100)
      setProgressHeight(pct)
      setProgressGradient(`linear-gradient(to bottom, ${gradientStops.join(', ')}, transparent ${pct}%)`)
    } else {
      setProgressHeight(0)
      setProgressGradient('')
    }
  }, [nodes, isNodeFilled, executionState])

  // Ensure refs array matches nodes length
  if (nodeRefs.current.length !== nodes.length) {
    nodeRefs.current = new Array(nodes.length).fill(null)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wave Structure</CardTitle>
      </CardHeader>
      <CardContent>
        <div ref={containerRef} className="relative pl-8">
          {/* Background rail — always visible */}
          <div
            ref={railRef}
            className="absolute left-[9px] top-2 bottom-2 w-px bg-border"
          />

          {/* Progress rail overlay — fills from top as nodes complete */}
          {(isComplete || isLive) && progressGradient && (
            <div
              className="absolute left-[8px] top-2 w-[3px] rounded-full"
              style={{
                height: `${progressHeight}%`,
                background: progressGradient,
                transition: 'height 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                opacity: 0.9,
              }}
            />
          )}

          {nodes.map((node, i) => {
            const filled = isNodeFilled(node)
            const filling = isLive && filled
            const color = getNodeColor(node)
            const orbSize = node.type === 'merge' ? 12 : 20

            return (
              <div
                key={i}
                ref={el => { nodeRefs.current[i] = el }}
                className={`relative ${i > 0 ? (node.type === 'wave' || node.type === 'scaffold' ? 'mt-6' : 'mt-4') : ''}`}
              >
                {/* Orb on rail */}
                <div className="absolute -left-8 flex items-center justify-center w-5" style={{ top: node.type === 'merge' ? 2 : 14 }}>
                  <Orb
                    type={node.type}
                    color={color}
                    size={orbSize}
                    filled={filled}
                    filling={filling}
                  />
                </div>

                {node.type === 'wave' ? (
                  <div>
                    <div className="text-sm font-semibold text-foreground mb-2">{node.label}</div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {node.agents?.map(agentLetter => {
                        const agentColor = getAgentColor(agentLetter)
                        const bgColor = getAgentColorWithOpacity(agentLetter, 0.1)
                        const statusStyle = getAgentBoxStyle(agentLetter, node.waveNum!, executionState)
                        const statusClass = getAgentBoxClassName(agentLetter, node.waveNum!, executionState)
                        return (
                          <div
                            key={agentLetter}
                            className={`flex items-center justify-center w-12 h-12 rounded-lg font-semibold text-base border-2${statusClass ? ` ${statusClass}` : ''}`}
                            style={{
                              backgroundColor: bgColor,
                              borderColor: `${agentColor}50`,
                              color: agentColor,
                              ...statusStyle,
                            }}
                          >
                            {agentLetter}
                          </div>
                        )
                      })}
                      <span className="text-xs text-muted-foreground ml-1">
                        {isLive && node.waveNum !== undefined ? (() => {
                          const progress = executionState?.waveProgress.get(node.waveNum)
                          if (progress) {
                            return `${progress.complete}/${progress.total} complete`
                          }
                          return `${node.agentCount} parallel`
                        })() : `${node.agentCount} parallel`}
                      </span>
                    </div>
                  </div>
                ) : node.type === 'scaffold' ? (
                  <div>
                    <div className="text-sm font-semibold text-foreground mb-2">{node.label}</div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div
                        className={`flex items-center justify-center w-12 h-12 rounded-lg font-semibold text-base border-2${
                          isLive && executionState?.scaffoldStatus === 'running' ? ' exec-node-running' :
                          isLive && executionState?.scaffoldStatus === 'complete' ? ' exec-node-complete' :
                          isLive && executionState?.scaffoldStatus === 'failed' ? ' exec-node-failed' : ''
                        }`}
                        style={{
                          backgroundColor: isLive && executionState?.scaffoldStatus === 'failed'
                            ? 'rgba(248,81,73,0.15)' : isLive && executionState?.scaffoldStatus === 'running'
                            ? 'rgba(245,158,11,0.15)' : 'rgba(100,116,139,0.08)',
                          borderColor: isLive && executionState?.scaffoldStatus === 'failed'
                            ? 'rgb(248,81,73)' : isLive && executionState?.scaffoldStatus === 'running'
                            ? 'rgb(245,158,11)' : isLive && executionState?.scaffoldStatus === 'complete'
                            ? 'rgb(63,185,80)' : 'rgba(100,116,139,0.3)',
                          color: isLive && executionState?.scaffoldStatus === 'failed'
                            ? '#f85149' : isLive && executionState?.scaffoldStatus === 'running'
                            ? '#f59e0b' : '#64748b',
                          boxShadow: isLive && executionState?.scaffoldStatus === 'failed'
                            ? '0 0 12px rgba(248,81,73,0.5)' : isLive && executionState?.scaffoldStatus === 'running'
                            ? '0 0 12px rgba(245,158,11,0.4)' : isLive && executionState?.scaffoldStatus === 'complete'
                            ? '0 0 10px rgba(63,185,80,0.3)' : undefined,
                          '--exec-pulse-color': 'rgba(245,158,11,0.6)',
                        } as React.CSSProperties}
                      >
                        S
                      </div>
                      <span className="text-xs text-muted-foreground ml-1">
                        {isLive && executionState?.scaffoldStatus === 'running' ? 'Running...' :
                         isLive && executionState?.scaffoldStatus === 'complete' ? 'Done' :
                         `${node.scaffoldFiles} interface ${node.scaffoldFiles === 1 ? 'file' : 'files'}`}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-2">
                    <span className={`text-sm font-semibold ${node.type === 'complete' ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {node.label}
                    </span>
                    {node.description && (
                      <span className="text-xs text-muted-foreground">{node.description}</span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
