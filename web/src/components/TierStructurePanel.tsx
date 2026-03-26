import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import type { ProgramStatus, ImplTierStatus, ImplAgentInfo } from '../types/program'

// Tier colors mirror WAVE_COLORS from WaveStructurePanel
const TIER_COLORS = [
  '#3b82f6', '#ec4899', '#22c55e', '#f59e0b', '#6366f1', '#14b8a6',
]
// Wave colors within each IMPL track — same palette, same meaning
const WAVE_COLORS = [
  '#3b82f6', '#ec4899', '#22c55e', '#f59e0b', '#6366f1', '#14b8a6',
]

const PLANNER_COLOR = '#06b6d4'
const COMPLETE_COLOR = '#7c3aed'

function getTierColor(n: number): string { return TIER_COLORS[(n - 1) % TIER_COLORS.length] }
function getWaveColor(n: number): string { return WAVE_COLORS[(n - 1) % WAVE_COLORS.length] }

// --- Shared Orb SVG ---
let orbId = 0
function Orb({ color, filled, size = 20 }: { color: string; filled: boolean; size?: number }): JSX.Element {
  const [uid] = useState(() => `torb-${++orbId}`)
  const r = size / 2
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0"
      style={{ filter: filled ? `drop-shadow(0 0 5px ${color}60)` : undefined }}>
      <defs>
        <radialGradient id={`${uid}-g`} cx="35%" cy="35%" r="65%">
          <stop offset="0%"   stopColor={color + '80'} stopOpacity={filled ? 1    : 0.3} />
          <stop offset="50%"  stopColor={color}        stopOpacity={filled ? 0.85 : 0.15} />
          <stop offset="100%" stopColor={color + 'cc'} stopOpacity={filled ? 0.7  : 0.1} />
        </radialGradient>
        <radialGradient id={`${uid}-h`} cx="30%" cy="25%" r="35%">
          <stop offset="0%"   stopColor="white" stopOpacity={filled ? 0.65 : 0.25} />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
      </defs>
      {filled && <circle cx={r} cy={r} r={r - 0.5} fill={color} opacity={0.18} />}
      <circle cx={r} cy={r} r={r - 1.5} fill={`url(#${uid}-g)`}
        stroke={color} strokeWidth={filled ? 1.5 : 1} strokeOpacity={filled ? 0.8 : 0.3} />
      <circle cx={r} cy={r} r={r - 2.5} fill={`url(#${uid}-h)`} />
    </svg>
  )
}

// --- Agent status helpers ---
function agentColors(status: string): { border: string; bg: string; text: string; shadow?: string } {
  switch (status) {
    case 'complete': return { border: 'rgb(63,185,80)',  bg: 'rgba(63,185,80,0.12)',  text: 'rgb(63,185,80)',  shadow: '0 0 8px rgba(63,185,80,0.35)' }
    case 'running':  return { border: 'rgb(88,166,255)', bg: 'rgba(88,166,255,0.12)', text: 'rgb(88,166,255)', shadow: '0 0 10px rgba(88,166,255,0.45)' }
    case 'failed':   return { border: 'rgb(248,81,73)',  bg: 'rgba(248,81,73,0.12)',  text: 'rgb(248,81,73)',  shadow: '0 0 10px rgba(248,81,73,0.45)' }
    default:         return { border: 'rgba(100,116,139,0.3)', bg: 'rgba(100,116,139,0.07)', text: '#94a3b8' }
  }
}

function waveState(agents: ImplAgentInfo[]): 'complete' | 'running' | 'failed' | 'pending' {
  if (agents.length === 0) return 'pending'
  if (agents.every(a => a.status === 'complete')) return 'complete'
  if (agents.some(a => a.status === 'failed'))    return 'failed'
  if (agents.some(a => a.status === 'running'))   return 'running'
  return 'pending'
}

// --- Mini wave structure per IMPL ---
function MiniWaveTrack({
  impl,
  tierColor,
  onClick,
  waveProgress,
}: {
  impl: ImplTierStatus
  tierColor: string
  onClick?: () => void
  waveProgress?: string
}): JSX.Element {
  const waves = useMemo(() => (impl.waves ?? []).slice().sort((a, b) => a.number - b.number), [impl.waves])
  const implDone = impl.status === 'complete'
  const hasWaves = waves.length > 0

  return (
    <div className="flex flex-col" style={{ minWidth: 130 }}>
      {/* IMPL slug header — clickable, colored by tier */}
      <button
        onClick={onClick}
        disabled={!onClick}
        className={`text-xs font-semibold text-left pb-1 mb-2 border-b truncate max-w-[160px] transition-opacity ${onClick ? 'hover:opacity-70 cursor-pointer' : 'cursor-default'}`}
        style={{ color: tierColor, borderColor: tierColor + '40' }}
        title={impl.slug + (waveProgress ? ` — ${waveProgress}` : '')}
      >
        {impl.slug}
      </button>

      <div className="relative pl-5">
        {/* Vertical rail */}
        <div className="absolute left-[6px] top-0 bottom-0 w-px bg-border" />

        {/* Scout */}
        <div className="relative flex items-center gap-2 mb-3">
          <div className="absolute -left-5 top-0"><Orb color={tierColor} filled size={14} /></div>
          <span className="text-xs font-medium text-foreground">Scout</span>
        </div>

        {!hasWaves && (
          <p className="text-[10px] text-muted-foreground italic">no wave data</p>
        )}

        {waves.map((wave, idx) => {
          const ws     = waveState(wave.agents)
          const wColor = getWaveColor(wave.number)
          const wFill  = ws === 'complete' || implDone
          const isLast = idx === waves.length - 1

          return (
            <div key={wave.number}>
              {/* Wave label + orb */}
              <div className="relative flex items-center gap-2 mb-1.5">
                <div className="absolute -left-[18px] top-[1px]"><Orb color={wColor} filled={wFill} size={11} /></div>
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: wColor }}>
                  W{wave.number}
                </span>
                {waveProgress && idx === waves.length - 1 && ws === 'running' && (
                  <span className="text-[9px] text-muted-foreground">{waveProgress}</span>
                )}
              </div>

              {/* Agent boxes */}
              <div className="flex flex-wrap gap-1 mb-2 ml-0.5">
                {wave.agents.map(agent => {
                  const sc = agentColors(agent.status)
                  return (
                    <div
                      key={agent.id}
                      title={`${agent.id} — ${agent.status}`}
                      className={`w-8 h-8 rounded flex items-center justify-center text-xs font-semibold border-2 ${
                        agent.status === 'running' ? 'animate-pulse' : ''
                      }`}
                      style={{ backgroundColor: sc.bg, borderColor: sc.border, color: sc.text, boxShadow: sc.shadow }}
                    >
                      {agent.id}
                    </div>
                  )
                })}
              </div>

              {/* Merge node */}
              <div className="relative flex items-center gap-2 mb-3">
                <div className="absolute -left-[16px] top-[1px]"><Orb color={wColor} filled={wFill} size={9} /></div>
                <span className="text-[10px] text-muted-foreground">{isLast ? 'Complete' : 'Merge'}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// --- Tier structure node types ---
type NodeKind = 'planner' | 'tier' | 'gate' | 'complete'

interface TierNode {
  kind: NodeKind
  label: string
  description?: string
  tierNumber?: number
  implStatuses?: ImplTierStatus[]
}

// --- Main panel ---
interface TierStructurePanelProps {
  status: ProgramStatus
  onSelectImpl?: (slug: string) => void
  waveProgress?: Record<string, string>
}

export default function TierStructurePanel({ status, onSelectImpl, waveProgress }: TierStructurePanelProps): JSX.Element {
  const sortedTiers = useMemo(() =>
    [...status.tier_statuses].sort((a, b) => a.number - b.number),
    [status.tier_statuses]
  )
  const isComplete = status.state === 'complete' || status.state === 'COMPLETE'

  const nodes: TierNode[] = useMemo(() => {
    const result: TierNode[] = []
    result.push({ kind: 'planner', label: 'Planner', description: 'Produce PROGRAM manifest' })
    sortedTiers.forEach((tier, idx) => {
      result.push({ kind: 'tier', label: `Tier ${tier.number}`, tierNumber: tier.number, implStatuses: tier.impl_statuses })
      result.push({
        kind: 'gate',
        label: 'Tier Gate',
        description: idx < sortedTiers.length - 1
          ? `Verify Tier ${tier.number}, advance to Tier ${tier.number + 1}`
          : `Verify Tier ${tier.number}, finalize`,
        tierNumber: tier.number,
      })
    })
    result.push({ kind: 'complete', label: 'Complete', description: 'All tiers merged and verified' })
    return result
  }, [sortedTiers])

  const nodeColor = useCallback((node: TierNode): string => {
    if (node.kind === 'tier' || node.kind === 'gate') return getTierColor(node.tierNumber!)
    if (node.kind === 'complete') return COMPLETE_COLOR
    return PLANNER_COLOR
  }, [])

  const nodeFilled = useCallback((node: TierNode): boolean => {
    if (isComplete) return true
    if (node.kind === 'planner') return true
    if (node.kind === 'complete') return sortedTiers.length > 0 && sortedTiers.every(t => t.complete)
    const tier = sortedTiers.find(t => t.number === node.tierNumber)
    return tier?.complete ?? false
  }, [isComplete, sortedTiers])

  // Colored rail segments
  const railRef  = useRef<HTMLDivElement>(null)
  const nodeRefs = useRef<(HTMLDivElement | null)[]>([])
  const [segments, setSegments] = useState<{ top: number; height: number; color: string }[]>([])

  useEffect(() => {
    if (!railRef.current) return
    const railTop = railRef.current.getBoundingClientRect().top
    const filled: { top: number; bottom: number; color: string }[] = []
    for (let i = 0; i < nodes.length; i++) {
      const el = nodeRefs.current[i]
      if (!el || !nodeFilled(nodes[i])) continue
      const rect = el.getBoundingClientRect()
      const isGate = nodes[i].kind === 'gate'
      const offset = isGate ? 2 : 14
      const sz     = isGate ? 10 : 20
      filled.push({ top: rect.top + offset - railTop, bottom: rect.top + offset + sz - railTop, color: nodeColor(nodes[i]) })
    }
    const segs: { top: number; height: number; color: string }[] = []
    for (let i = 0; i < filled.length - 1; i++)
      segs.push({ top: filled[i].top, height: filled[i + 1].top - filled[i].top, color: filled[i].color })
    if (filled.length > 0) {
      const last = filled[filled.length - 1]
      segs.push({ top: last.top, height: last.bottom - last.top, color: last.color })
    }
    setSegments(segs)
  }, [nodes, nodeFilled, nodeColor, status])

  if (nodeRefs.current.length !== nodes.length)
    nodeRefs.current = new Array(nodes.length).fill(null)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tier Structure</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative pl-8">
          {/* Background rail */}
          <div ref={railRef} className="absolute left-[9px] top-2 bottom-2 w-px bg-border" />

          {/* Colored segments */}
          {segments.map((seg, i) => (
            <div key={i} className="absolute left-[8px] w-[3px] rounded-full"
              style={{ top: `calc(0.5rem + ${seg.top}px)`, height: `${seg.height}px`,
                backgroundColor: seg.color, opacity: 0.9, zIndex: 0 }} />
          ))}

          {nodes.map((node, i) => {
            const filled  = nodeFilled(node)
            const color   = nodeColor(node)
            const isGate  = node.kind === 'gate'
            const orbSize = isGate ? 10 : 20

            return (
              <div
                key={i}
                ref={el => { nodeRefs.current[i] = el }}
                className={`relative ${i > 0 ? (node.kind === 'tier' || node.kind === 'planner' ? 'mt-8' : 'mt-4') : ''}`}
              >
                {/* Rail orb */}
                <div className="absolute flex items-center justify-center"
                  style={{ left: -32, width: 20, top: isGate ? 2 : 14, zIndex: 1 }}>
                  <Orb color={color} filled={filled} size={orbSize} />
                </div>

                {node.kind === 'tier' ? (
                  <div>
                    <div className="text-sm font-semibold text-foreground mb-4">{node.label}</div>
                    {/* Mini wave tracks — one column per IMPL, side by side */}
                    <div className="flex gap-8 overflow-x-auto pb-2">
                      {node.implStatuses?.map(impl => (
                        <MiniWaveTrack
                          key={impl.slug}
                          impl={impl}
                          tierColor={color}
                          onClick={onSelectImpl ? () => onSelectImpl(impl.slug) : undefined}
                          waveProgress={waveProgress?.[impl.slug]}
                        />
                      ))}
                    </div>
                    {(node.implStatuses?.length ?? 0) > 1 && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {node.implStatuses!.length} plans executing in parallel
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-baseline gap-2">
                    <span className={`text-sm font-semibold ${node.kind === 'complete' ? 'text-foreground' : 'text-muted-foreground'}`}>
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
