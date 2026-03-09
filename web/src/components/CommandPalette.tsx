import { useState, useEffect, useRef } from 'react'
import { IMPLListEntry } from '../types'
import { Search } from 'lucide-react'

interface CommandPaletteProps {
  entries: IMPLListEntry[]
  onSelect: (slug: string) => void
  onClose: () => void
}

export default function CommandPalette({ entries, onSelect, onClose }: CommandPaletteProps): JSX.Element {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const [activeIdx, setActiveIdx] = useState(0)

  const filtered = entries.filter(e =>
    query === '' || e.slug.toLowerCase().includes(query.toLowerCase())
  )

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    setActiveIdx(0)
  }, [query])

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && filtered[activeIdx]) { onSelect(filtered[activeIdx].slug); onClose() }
    if (e.key === 'Escape') onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-popover border border-border rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search size={16} className="text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search plans…"
            className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground"
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground font-mono">esc</kbd>
        </div>

        {/* Results */}
        <div className="max-h-72 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground px-4 py-3">No plans found</p>
          ) : (
            filtered.map((e, i) => (
              <button
                key={e.slug}
                onClick={() => { onSelect(e.slug); onClose() }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${i === activeIdx ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${e.doc_status === 'complete' ? 'bg-primary/40' : 'bg-green-500'}`} />
                <span className="text-sm font-mono truncate">{e.slug}</span>
                <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded ${e.doc_status === 'complete' ? 'bg-muted text-muted-foreground' : 'bg-green-500/10 text-green-600 dark:text-green-400'}`}>
                  {e.doc_status}
                </span>
              </button>
            ))
          )}
        </div>

        <div className="px-4 py-2 border-t border-border flex items-center gap-4 text-[10px] text-muted-foreground">
          <span><kbd className="font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono">↵</kbd> open</span>
          <span><kbd className="font-mono">esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}
