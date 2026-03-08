import { useState, useEffect } from 'react'
import { listImpls, fetchImpl, approveImpl, rejectImpl, startWave } from './api'
import { IMPLDocResponse, IMPLListEntry } from './types'
import ReviewScreen from './components/ReviewScreen'
import WaveBoard from './components/WaveBoard'
import DarkModeToggle from './components/DarkModeToggle'
import ImplList from './components/ImplList'
import { useResizableDivider } from './hooks/useResizableDivider'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type AppMode = 'split' | 'wave'

export default function App() {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const [entries, setEntries] = useState<IMPLListEntry[]>([])
  const [appMode, setAppMode] = useState<AppMode>('split')
  const [impl, setImpl] = useState<IMPLDocResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rejected, setRejected] = useState(false)

  const { leftWidthPx, dividerProps } = useResizableDivider({ initialWidthPx: 220, minWidthPx: 140, maxFraction: 0.10 })
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => {
    listImpls().then(setEntries).catch(() => {})
  }, [])

  async function handleSelect(selected: string) {
    setSelectedSlug(selected)
    setLoading(true)
    setError(null)
    try {
      const data = await fetchImpl(selected)
      setImpl(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove() {
    setLoading(true)
    setError(null)
    try {
      await approveImpl(selectedSlug!)
      try {
        await startWave(selectedSlug!)
      } catch (startErr) {
        // Swallow 409 (already running) and other start errors — still transition to wave screen
        const msg = startErr instanceof Error ? startErr.message : String(startErr)
        if (!msg.includes('409')) {
          console.warn('startWave error (non-fatal):', msg)
        }
      }
      setAppMode('wave')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleReject() {
    setLoading(true)
    setError(null)
    try {
      await rejectImpl(selectedSlug!)
      setRejected(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  if (appMode === 'wave') {
    return (
      <>
        <div className="fixed top-4 right-4 z-50">
          <DarkModeToggle />
        </div>
        <WaveBoard slug={selectedSlug!} />
      </>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <header className="flex items-center justify-between px-4 py-2 border-b shrink-0">
        <span className="text-sm font-semibold tracking-tight">Scout and Wave</span>
        <DarkModeToggle />
      </header>
      <div className="flex flex-1 min-h-0">
        {sidebarCollapsed ? (
          <div
            className="flex flex-col items-center shrink-0 border-r w-9 bg-background dark:bg-[#191919] cursor-pointer"
            onDoubleClick={() => setSidebarCollapsed(false)}
            title="Double-click to expand"
          >
            <button
              onClick={() => setSidebarCollapsed(false)}
              title="Expand sidebar"
              className="mt-2 p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-col overflow-y-auto shrink-0 border-r relative dark:bg-[#191919]" style={{ width: leftWidthPx }}>
              <button
                onClick={() => setSidebarCollapsed(true)}
                title="Collapse sidebar"
                className="absolute top-2 right-2 z-10 p-0.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft size={14} />
              </button>
              <ImplList
                entries={entries}
                selectedSlug={selectedSlug}
                onSelect={handleSelect}
                loading={loading}
              />
            </div>
            <div {...dividerProps} />
          </>
        )}
        <div className="flex-1 overflow-y-auto min-w-0">
          {error && <p className="text-destructive text-sm p-4">{error}</p>}
          {loading && <p className="text-muted-foreground text-sm p-4">Loading...</p>}
          {rejected && <p className="text-orange-600 text-sm p-4">Plan rejected.</p>}
          {!loading && impl !== null && selectedSlug !== null && (
            <ReviewScreen slug={selectedSlug} impl={impl} onApprove={handleApprove} onReject={handleReject} onRefreshImpl={handleSelect} />
          )}
          {!loading && impl === null && !error && (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Select a plan from the list to review.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
