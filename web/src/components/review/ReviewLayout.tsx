import { IMPLDocResponse } from '../../types'
import { ExecutionSyncState } from '../../hooks/useExecutionSync'
import WaveStructurePanel from './WaveStructurePanel'
import DependencyGraphPanel from './DependencyGraphPanel'
import FileOwnershipPanel from './FileOwnershipPanel'
import InterfaceContractsPanel from './InterfaceContractsPanel'
import AgentContextPanel from './AgentContextPanel'
import ScaffoldsPanel from './ScaffoldsPanel'
import PreMortemPanel from './PreMortemPanel'
import WiringPanel from './WiringPanel'
import ReactionsPanel from './ReactionsPanel'
import KnownIssuesPanel from './KnownIssuesPanel'
import StubReportPanel from './StubReportPanel'
import PostMergeChecklistPanel from './PostMergeChecklistPanel'
import QualityGatesPanel from './QualityGatesPanel'
import ContextViewerPanel from './ContextViewerPanel'
import AmendPanel from '../AmendPanel'

type PanelKey = 'reactions' | 'pre-mortem' | 'wiring' | 'stub-report' | 'file-ownership' | 'wave-structure' | 'agent-prompts' | 'interface-contracts' | 'scaffolds' | 'dependency-graph' | 'known-issues' | 'post-merge-checklist' | 'quality-gates' | 'worktrees' | 'context-viewer' | 'validation' | 'amend'

export interface ReviewLayoutProps {
  activePanels: PanelKey[]
  impl: IMPLDocResponse
  slug: string
  executionState?: ExecutionSyncState | null
  repos?: import('../../types').RepoEntry[]
  onFileClick?: (agent: string, wave: number, file: string) => void
  onAmendComplete?: () => void
}

export function ReviewLayout(props: ReviewLayoutProps): JSX.Element {
  const { activePanels, impl, slug, executionState, repos, onFileClick, onAmendComplete } = props

  return (
    <div className="space-y-6">
      {/* Wave Structure + Dependency Graph pair */}
      {(activePanels.includes('wave-structure') || activePanels.includes('dependency-graph')) && (
        <div className={`panel-animate grid gap-6 ${
          activePanels.includes('wave-structure') && activePanels.includes('dependency-graph')
            ? 'grid-cols-1 md:grid-cols-2'
            : 'grid-cols-1'
        }`}>
          {activePanels.includes('wave-structure') && <WaveStructurePanel impl={impl} {...(executionState ? { executionState } : {})} />}
          {activePanels.includes('dependency-graph') && <DependencyGraphPanel dependencyGraphText={(impl as any).dependency_graph_text} {...(executionState ? { executionState } : {})} />}
        </div>
      )}

      {/* File Ownership — full width when alone */}
      {activePanels.includes('file-ownership') && (() => {
        const AnyFileOwnershipPanel = FileOwnershipPanel as any
        return <div className="panel-animate"><AnyFileOwnershipPanel impl={impl} repos={repos} onFileClick={onFileClick} /></div>
      })()}

      {/* Interface Contracts — full width */}
      {activePanels.includes('interface-contracts') && (
        <div className="panel-animate"><InterfaceContractsPanel contractsText={(impl as any).interface_contracts_text} /></div>
      )}

      {/* Agent Prompts — full width */}
      {activePanels.includes('agent-prompts') && (
        <div className="panel-animate"><AgentContextPanel impl={impl} slug={slug} /></div>
      )}

      {/* Scaffolds — full width, above pre-mortem */}
      {activePanels.includes('scaffolds') && (
        <div className="panel-animate"><ScaffoldsPanel scaffoldsDetail={(impl as any).scaffolds_detail} /></div>
      )}

      {/* Pre-Mortem — full width */}
      {activePanels.includes('pre-mortem') && <div className="panel-animate"><PreMortemPanel preMortem={impl.pre_mortem} /></div>}

      {/* Wiring Declarations — full width */}
      {activePanels.includes('wiring') && (
        <div className="panel-animate">
          <WiringPanel wiring={impl.wiring} />
        </div>
      )}

      {/* Reactions Config — full width */}
      {activePanels.includes('reactions') && (
        <div className="panel-animate">
          <ReactionsPanel reactions={impl.reactions} />
        </div>
      )}

      {/* Known Issues — full width */}
      {activePanels.includes('known-issues') && <div className="panel-animate"><KnownIssuesPanel knownIssues={(impl as any).known_issues} /></div>}

      {/* Stub Report — full width */}
      {activePanels.includes('stub-report') && <div className="panel-animate"><StubReportPanel stubReportText={impl.stub_report_text} /></div>}

      {/* Post-Merge Checklist — full width */}
      {activePanels.includes('post-merge-checklist') && <div className="panel-animate"><PostMergeChecklistPanel checklistText={(impl as any).post_merge_checklist_text} /></div>}

      {/* Amend — full width */}
      {activePanels.includes('amend') && (
        <div className="panel-animate">
          <AmendPanel
            slug={slug}
            waves={impl.waves}
            onAmendComplete={onAmendComplete}
          />
        </div>
      )}

      {/* Quality Gates — full width */}
      {activePanels.includes('quality-gates') && (
        <div className="panel-animate"><QualityGatesPanel gatesText={(impl as any).quality_gates_text ?? ''} /></div>
      )}

      {/* Project Memory (CONTEXT.md) — full width */}
      {activePanels.includes('context-viewer') && (
        <div className="panel-animate"><ContextViewerPanel /></div>
      )}
    </div>
  )
}
