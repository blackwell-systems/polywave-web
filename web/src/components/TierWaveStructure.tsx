import { useState } from 'react'
import type { ImplTierStatus, ImplWaveInfo, ImplAgentInfo } from '../types/program'

function agentDotClass(status: string): string {
  switch (status) {
    case 'complete':  return 'bg-green-400 dark:bg-green-500'
    case 'running':   return 'bg-blue-400 dark:bg-blue-500 animate-pulse'
    case 'failed':    return 'bg-red-400 dark:bg-red-500'
    default:          return 'bg-gray-300 dark:bg-gray-600'
  }
}

function agentTextClass(status: string): string {
  switch (status) {
    case 'complete':  return 'text-green-600 dark:text-green-400'
    case 'running':   return 'text-blue-600 dark:text-blue-400'
    case 'failed':    return 'text-red-600 dark:text-red-400'
    default:          return 'text-gray-400 dark:text-gray-500'
  }
}

function TrunkLine({ height = 'h-5' }: { height?: string }): JSX.Element {
  return (
    <div className="flex justify-center">
      <div className={`w-0.5 ${height} bg-gray-300 dark:bg-gray-600`} />
    </div>
  )
}

function TrunkNode({ label, icon, muted }: { label: string; icon: string; muted?: boolean }): JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center text-[8px] shrink-0 ${
        muted
          ? 'border-gray-400 dark:border-gray-500 bg-gray-100 dark:bg-gray-800'
          : 'border-green-500 dark:border-green-400 bg-green-100 dark:bg-green-900'
      }`}>
        {icon}
      </div>
      <span className={`text-xs font-medium ${muted ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-200'}`}>
        {label}
      </span>
    </div>
  )
}

function AgentBranch({ agent }: { agent: ImplAgentInfo }): JSX.Element {
  return (
    <div className="flex items-center" style={{ minHeight: '24px' }}>
      {/* vertical trunk spur */}
      <div className="flex justify-center w-4 shrink-0">
        <div className="w-0.5 h-full bg-gray-300 dark:bg-gray-600" />
      </div>
      {/* horizontal branch */}
      <div className="flex items-center">
        <div className="w-3 h-0.5 bg-gray-300 dark:bg-gray-600" />
        <div className={`w-3 h-3 rounded-full ${agentDotClass(agent.status)} shrink-0 mx-1`} />
        <span className={`text-xs font-mono ${agentTextClass(agent.status)}`}>{agent.id}</span>
      </div>
    </div>
  )
}

function WaveBlock({ wave, isLast }: { wave: ImplWaveInfo; isLast: boolean }): JSX.Element {
  return (
    <div>
      {/* wave label on trunk */}
      <div className="flex items-center gap-2">
        <div className="w-4 flex justify-center shrink-0">
          <div className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500" />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          Wave {wave.number}
        </span>
      </div>
      {/* agent branches */}
      <div className="ml-2">
        {wave.agents.map((agent) => (
          <AgentBranch key={agent.id} agent={agent} />
        ))}
      </div>
      {/* merge + gate */}
      <TrunkLine height="h-3" />
      <TrunkNode label="Merge" icon={isLast ? '○' : '●'} muted={isLast} />
      {!isLast && <TrunkLine />}
    </div>
  )
}

function ImplTrack({ impl }: { impl: ImplTierStatus }): JSX.Element {
  const waves = (impl.waves ?? []).slice().sort((a, b) => a.number - b.number)

  return (
    <div className="flex flex-col min-w-[140px]">
      {/* IMPL slug header */}
      <div
        className="text-xs font-semibold text-foreground truncate mb-2 pb-1 border-b border-gray-200 dark:border-gray-700"
        title={impl.slug}
      >
        {impl.slug}
      </div>

      <TrunkNode label="Scout" icon="●" />
      <TrunkLine />

      {waves.length === 0 ? (
        <div className="text-[10px] text-muted-foreground italic mt-1">no wave data</div>
      ) : (
        waves.map((wave, idx) => (
          <WaveBlock key={wave.number} wave={wave} isLast={idx === waves.length - 1} />
        ))
      )}
    </div>
  )
}

interface TierWaveStructureProps {
  impls: ImplTierStatus[]
}

export default function TierWaveStructure({ impls }: TierWaveStructureProps): JSX.Element {
  const implsWithWaves = impls.filter((impl) => impl.waves && impl.waves.length > 0)

  if (implsWithWaves.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        Wave structure not yet available — IMPLs must be scouted first.
      </p>
    )
  }

  return (
    <div className="flex gap-8 overflow-x-auto pb-2">
      {implsWithWaves.map((impl) => (
        <ImplTrack key={impl.slug} impl={impl} />
      ))}
    </div>
  )
}

// Collapsible wrapper used in TierSection
export function TierWaveStructureToggle({ impls }: TierWaveStructureProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const hasWaves = impls.some((impl) => impl.waves && impl.waves.length > 0)

  if (!hasWaves) return <></>

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className={`transition-transform inline-block ${open ? 'rotate-90' : ''}`}>▶</span>
        Wave Structure
      </button>
      {open && (
        <div className="mt-3 p-4 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
          <TierWaveStructure impls={impls} />
        </div>
      )}
    </div>
  )
}
