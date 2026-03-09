import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { listImpls, fetchImpl, approveImpl, rejectImpl, startWave, deleteImpl, getConfig, saveConfig } from './api'
import { IMPLDocResponse, IMPLListEntry, RepoEntry } from './types'
import ReviewScreen from './components/ReviewScreen'
import DarkModeToggle from './components/DarkModeToggle'
import ImplList from './components/ImplList'
import ThemePicker from './components/ThemePicker'
import LiveRail from './components/LiveRail'
import { LiveView } from './components/LiveRail'
import SettingsScreen from './components/SettingsScreen'
import CommandPalette from './components/CommandPalette'
import { useResizableDivider } from './hooks/useResizableDivider'
import { ChevronLeft, ChevronRight, Settings, Search, Pencil } from 'lucide-react'

const MODEL_OPTIONS = [
  // CLI (shells out to claude command — can be Bedrock or Max Plan)
  'cli:claude-sonnet-4-5', 'cli:claude-opus-4-6', 'cli:claude-haiku-4-5',
  // Bedrock API (direct API calls with full IDs)
  'bedrock:claude-sonnet-4-5', 'bedrock:claude-opus-4-6', 'bedrock:claude-haiku-4-5',
  // Anthropic API (Max Plan)
  'anthropic:claude-sonnet-4-6', 'anthropic:claude-opus-4-6', 'anthropic:claude-haiku-4-5-20251001',
  // OpenAI
  'openai:gpt-4o', 'openai:gpt-4o-mini', 'openai:o1', 'openai:o1-mini',
  // Ollama (local)
  'ollama:qwen2.5-coder:32b', 'ollama:qwen2.5-coder:14b', 'ollama:deepseek-coder-v2',
  'ollama:llama3.1:70b', 'ollama:granite3.1-dense:8b',
  // LM Studio (local)
  'lmstudio:local-model',
]

export default function App() {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const [entries, setEntries] = useState<IMPLListEntry[]>([])
  const [liveView, setLiveView] = useState<LiveView>(null)
  const [impl, setImpl] = useState<IMPLDocResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rejected, setRejected] = useState(false)

  const [repos, setRepos] = useState<RepoEntry[]>([])
  const [activeRepoIndex, setActiveRepoIndex] = useState<number>(0)
  const activeRepo: RepoEntry | null = repos[activeRepoIndex] ?? null

  const [scoutModel, setScoutModel] = useState<string>('claude-sonnet-4-6')
  const [waveModel, setWaveModel] = useState<string>('claude-sonnet-4-6')
  const [chatModel, setChatModel] = useState<string>('claude-sonnet-4-6')

  const [pickerOpen, setPickerOpen] = useState<'scout' | 'wave' | 'chat' | 'all' | null>(null)
  const [pickerValue, setPickerValue] = useState('')
  const pickerOriginalRef = useRef('')

  const [sseConnected, setSseConnected] = useState(false)
  const [showPalette, setShowPalette] = useState(false)

  function handleReposChange(updated: RepoEntry[]): void {
    setRepos(updated)
  }
  function handleRepoSwitch(index: number): void {
    setActiveRepoIndex(index)
  }

  const { leftWidthPx, dividerProps } = useResizableDivider({ initialWidthPx: Math.round(window.innerWidth * 0.15) - 20, minWidthPx: 140, maxFraction: 0.15 })
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const [rightWidthPx, setRightWidthPx] = useState(() => Math.min(340, Math.round(window.innerWidth * 0.30)))
  const rightDividerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    const onMove = (mv: MouseEvent) => {
      setRightWidthPx(Math.max(240, Math.min(window.innerWidth - mv.clientX, window.innerWidth * 0.30)))
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // Subscribe to global server events so the IMPL list stays in sync
  // with any external changes (CLI scout runs, wave completion, approve/reject).
  useEffect(() => {
    const es = new EventSource('/api/events')
    es.onopen = () => setSseConnected(true)
    es.onerror = () => setSseConnected(false)
    es.addEventListener('impl_list_updated', () => {
      setSseConnected(true)
      listImpls().then(setEntries).catch(() => {})
    })
    return () => es.close()
  }, [])

  useEffect(() => {
    listImpls().then(setEntries).catch(() => {})
    getConfig().then(config => {
      if (config.repos && config.repos.length > 0) {
        setRepos(config.repos)
      } else if (config.repo?.path) {
        setRepos([{ name: 'repo', path: config.repo.path }])
      }
      setScoutModel(config.agent?.scout_model || 'claude-sonnet-4-6')
      setWaveModel(config.agent?.wave_model || 'claude-sonnet-4-6')
      setChatModel(config.agent?.chat_model || 'claude-sonnet-4-6')
    }).catch(() => {})
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // Command palette keyboard shortcut (⌘K / Ctrl+K)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowPalette(v => !v)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  async function handleSelect(selected: string) {
    setSelectedSlug(selected)
    setRejected(false)
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
      setLiveView('wave')
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

  async function handleDelete(slug: string) {
    try {
      await deleteImpl(slug)
      const updated = await listImpls()
      setEntries(updated)
      if (selectedSlug === slug) {
        setSelectedSlug(null)
        setImpl(null)
        setRejected(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function saveModel(field: 'scout' | 'wave' | 'chat' | 'all', value: string) {
    try {
      const cfg = await getConfig()
      const updated = {
        ...cfg,
        agent: {
          ...cfg.agent,
          ...(field === 'scout' && { scout_model: value }),
          ...(field === 'wave' && { wave_model: value }),
          ...(field === 'chat' && { chat_model: value }),
          ...(field === 'all' && { scout_model: value, wave_model: value, chat_model: value }),
        }
      }
      await saveConfig(updated)
      if (field === 'scout') setScoutModel(value)
      if (field === 'wave') setWaveModel(value)
      if (field === 'chat') setChatModel(value)
      if (field === 'all') { setScoutModel(value); setWaveModel(value); setChatModel(value) }
    } catch { /* ignore */ }
  }

  async function handleScoutReady() {
    try {
      const updated = await listImpls()
      setEntries(updated)
    } catch {
      // non-fatal
    }
  }

  async function handleScoutComplete(slug: string) {
    try {
      const updated = await listImpls()
      setEntries(updated)
    } catch {
      // non-fatal: sidebar will just not show the new entry until next refresh
    }
    if (slug) {
      setSelectedSlug(slug)
      setLoading(true)
      setError(null)
      try {
        const data = await fetchImpl(slug)
        setImpl(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    }
    setLiveView(null)
  }

  return (
    <>
    <div className="h-screen flex flex-col bg-gradient-to-br from-background via-background to-muted/20 overflow-hidden">
      <header className="relative flex items-stretch justify-between h-16 backdrop-blur-xl bg-background/80 border-b border-border/50 shrink-0 shadow-sm">
        {/* Gradient overlay for visual depth */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-transparent to-violet-500/5 pointer-events-none" />
        
        <div className="relative flex items-stretch">
          <button
            onClick={() => setLiveView(v => v === 'scout' ? null : 'scout')}
            className="group relative flex items-center justify-center text-sm font-semibold px-8 transition-all duration-200 border-r border-border/50 overflow-hidden"
          >
            {/* Gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-violet-500 opacity-90 group-hover:opacity-100 transition-opacity" />
            {/* Shine effect on hover */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            <span className="relative text-white drop-shadow-sm">New Plan</span>
          </button>
          <button
            onClick={() => setShowPalette(true)}
            className="flex items-center gap-2 px-5 text-xs text-muted-foreground border-r border-border/50 hover:bg-muted/50 hover:text-foreground transition-all duration-150 group"
            title="Search plans (⌘K)"
          >
            <Search size={14} className="group-hover:scale-110 transition-transform" />
            <kbd className="font-mono text-[10px] hidden sm:inline px-1.5 py-0.5 rounded bg-muted/50 border border-border/50 group-hover:border-border transition-colors">⌘K</kbd>
          </button>
        </div>
        <div className="flex items-stretch">
          {(['scout', 'wave', 'chat'] as const).map(field => {
            const model = field === 'scout' ? scoutModel : field === 'wave' ? waveModel : chatModel
            return (
              <div key={field} className="relative flex items-stretch border-r border-border">
                <button
                  title={`${field} model: ${model}\nClick to change`}
                  onClick={() => { pickerOriginalRef.current = model; setPickerOpen(field); setPickerValue('') }}
                  className="flex items-center gap-2 px-4 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors group"
                >
                  <span className="text-xs text-muted-foreground/60 group-hover:text-muted-foreground">{field}</span>
                  <span className="text-sm font-mono truncate max-w-[140px]">{model}</span>
                  <Pencil size={11} className="opacity-0 group-hover:opacity-50 transition-opacity shrink-0" />
                </button>
                {pickerOpen === field && (
                  <div className="absolute top-full left-0 mt-2 z-50 bg-popover/95 backdrop-blur-xl border border-border rounded-lg shadow-2xl p-3 w-72 animate-in fade-in slide-in-from-top-2 duration-200">
                    <input
                      autoFocus
                      list="header-model-options"
                      className="w-full text-sm px-3 py-2 bg-background/50 backdrop-blur border border-border rounded-md text-foreground outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 font-mono transition-all"
                      value={pickerValue}
                      onChange={e => setPickerValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { saveModel(field, pickerValue || pickerOriginalRef.current); setPickerOpen(null) }
                        if (e.key === 'Escape') { setPickerValue(pickerOriginalRef.current); setPickerOpen(null) }
                      }}
                      onBlur={() => { saveModel(field, pickerValue || pickerOriginalRef.current); setPickerOpen(null) }}
                    />
                    <datalist id="header-model-options">
                      {MODEL_OPTIONS.map(m => <option key={m} value={m} />)}
                    </datalist>
                  </div>
                )}
              </div>
            )
          })}
          <ThemePicker />
          <DarkModeToggle />
          <button 
            onClick={() => setShowSettings(s => !s)} 
            title="Settings" 
            className="flex items-center justify-center px-4 border-l border-border/50 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all duration-150 hover:scale-105"
          >
            <Settings size={16} />
          </button>
          <div
            title={sseConnected ? 'Live updates connected' : 'Live updates disconnected'}
            className="flex items-center justify-center px-4 border-l border-border/50"
          >
            <div className="relative">
              <span className={`block w-2 h-2 rounded-full transition-all duration-300 ${sseConnected ? 'bg-green-500' : 'bg-muted-foreground/40'}`} />
              {sseConnected && (
                <span className="absolute inset-0 w-2 h-2 rounded-full bg-green-500 animate-ping" />
              )}
            </div>
          </div>
        </div>
      </header>
      <div className="flex flex-1 min-h-0">
        {/* Left sidebar */}
        {sidebarCollapsed ? (
          <div className="relative shrink-0 border-r w-0 bg-muted">
            <button
              onClick={() => setSidebarCollapsed(false)}
              title="Expand sidebar"
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-20 flex items-center justify-center w-5 h-8 rounded-full border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shadow-sm"
            >
              <ChevronRight size={12} />
            </button>
          </div>
        ) : (
          <>
            {/* Outer wrapper: positioning context for the toggle button, no overflow */}
            <div className="relative shrink-0" style={{ width: leftWidthPx }}>
              {/* Inner div: scroll container, separate from button positioning */}
              <div className="flex flex-col overflow-y-auto h-full border-r bg-muted w-full">
                <ImplList
                  entries={entries}
                  selectedSlug={selectedSlug}
                  onSelect={handleSelect}
                  onDelete={handleDelete}
                  loading={loading}
                  repos={repos}
                />
              </div>
              <button
                onClick={() => setSidebarCollapsed(true)}
                title="Collapse sidebar"
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-20 flex items-center justify-center w-5 h-8 rounded-full border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shadow-sm"
              >
                <ChevronLeft size={12} />
              </button>
            </div>
            <div {...dividerProps} />
          </>
        )}

        {/* Center column */}
        <div className="flex-1 overflow-y-auto min-w-0">
          {error && <p className="text-destructive text-sm p-4">{error}</p>}
          {loading && (
            <div className="p-6 space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="animate-pulse h-5 bg-muted rounded w-1/3" />
                  <div className="animate-pulse h-3 bg-muted rounded w-2/3" />
                  <div className="animate-pulse h-3 bg-muted rounded w-1/2" />
                </div>
              ))}
            </div>
          )}
          {rejected && <p className="text-orange-600 text-sm p-4">Plan rejected.</p>}
          {!loading && impl !== null && selectedSlug !== null && (
            <ReviewScreen slug={selectedSlug} impl={impl} onApprove={handleApprove} onReject={handleReject} onRefreshImpl={handleSelect} repos={repos} />
          )}
          {!loading && impl === null && !error && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="text-muted-foreground/30">
                <rect x="6" y="8" width="36" height="32" rx="3" stroke="currentColor" strokeWidth="2"/>
                <path d="M14 18h20M14 24h14M14 30h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <div>
                <p className="text-sm font-medium text-foreground">No plan selected</p>
                <p className="text-xs text-muted-foreground mt-1">Select a plan from the sidebar or create a new one with New Plan</p>
              </div>
            </div>
          )}
        </div>

        {/* Right divider + rail — only when liveView is not null */}
        {liveView !== null && (
          <div
            onMouseDown={rightDividerMouseDown}
            style={{ width: '4px', flexShrink: 0, alignSelf: 'stretch' }}
            className="cursor-col-resize select-none bg-border hover:bg-primary/30 transition-colors"
          />
        )}
        {liveView !== null && (
          <div className="shrink-0 overflow-hidden border-l" style={{ width: rightWidthPx }}>
            <LiveRail
              slug={selectedSlug}
              liveView={liveView}
              widthPx={rightWidthPx}
              onScoutComplete={handleScoutComplete}
              onScoutReady={handleScoutReady}
              onClose={() => setLiveView(null)}
              repos={repos}
              activeRepo={activeRepo}
              onRepoSwitch={handleRepoSwitch}
            />
          </div>
        )}
      </div>
    </div>

    {showSettings && createPortal(
      <>
        {/* Backdrop */}
        <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setShowSettings(false)} />
        {/* Drawer */}
        <div className="fixed inset-y-0 right-0 z-50 w-[560px] max-w-[90vw] bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-700 shadow-2xl overflow-y-auto">
          <SettingsScreen
          onClose={() => {
            setShowSettings(false)
            getConfig().then(config => {
              setScoutModel(config.agent?.scout_model ?? '')
              setWaveModel(config.agent?.wave_model ?? '')
              setChatModel(config.agent?.chat_model ?? '')
            }).catch(() => {})
          }}
          onReposChange={handleReposChange}
        />
        </div>
      </>,
      document.body
    )}

    {showPalette && (
      <CommandPalette
        entries={entries}
        onSelect={(slug) => { handleSelect(slug); setShowPalette(false) }}
        onClose={() => setShowPalette(false)}
      />
    )}
    </>
  )
}
