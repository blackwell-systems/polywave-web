import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

export type PanelKey =
  | 'reactions' | 'pre-mortem' | 'wiring' | 'stub-report'
  | 'file-ownership' | 'wave-structure' | 'agent-prompts'
  | 'interface-contracts' | 'scaffolds' | 'dependency-graph'
  | 'known-issues' | 'post-merge-checklist' | 'quality-gates'
  | 'worktrees' | 'context-viewer' | 'validation' | 'amend'

export interface ReviewContextValue {
  activePanels: PanelKey[]
  togglePanel: (key: PanelKey) => void
  showChat: boolean
  setShowChat: (show: boolean) => void
  diffTarget: { agent: string; wave: number; file: string } | null
  setDiffTarget: (target: { agent: string; wave: number; file: string } | null) => void
  showRevise: boolean
  setShowRevise: (show: boolean) => void
}

const defaultPanels: PanelKey[] = [
  'file-ownership', 'wave-structure', 'interface-contracts',
]

const defaultValue: ReviewContextValue = {
  activePanels: defaultPanels,
  togglePanel: () => {},
  showChat: false,
  setShowChat: () => {},
  diffTarget: null,
  setDiffTarget: () => {},
  showRevise: false,
  setShowRevise: () => {},
}

export const ReviewContext = createContext<ReviewContextValue>(defaultValue)

export function useReviewContext(): ReviewContextValue {
  return useContext(ReviewContext)
}

export function ReviewProvider({ children }: { children: ReactNode }): JSX.Element {
  const [activePanels, setActivePanels] = useState<PanelKey[]>(() => {
    try {
      const stored = localStorage.getItem('polywave-review-panels')
      if (stored) return JSON.parse(stored) as PanelKey[]
    } catch { /* ignore */ }
    return [...defaultPanels]
  })

  const [showChat, setShowChat] = useState(false)
  const [diffTarget, setDiffTarget] = useState<{ agent: string; wave: number; file: string } | null>(null)
  const [showRevise, setShowRevise] = useState(false)

  const togglePanel = useCallback((key: PanelKey) => {
    setActivePanels(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
      try { localStorage.setItem('polywave-review-panels', JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [])

  const value: ReviewContextValue = {
    activePanels,
    togglePanel,
    showChat,
    setShowChat,
    diffTarget,
    setDiffTarget,
    showRevise,
    setShowRevise,
  }

  return <ReviewContext.Provider value={value}>{children}</ReviewContext.Provider>
}
