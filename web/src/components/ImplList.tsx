import { useState } from 'react'
import { IMPLListEntry } from '../types'
import { Button } from './ui/button'
import { cn } from '@/lib/utils'

interface ImplListProps {
  entries: IMPLListEntry[]
  selectedSlug: string | null
  onSelect: (slug: string) => void
  loading: boolean
}

export default function ImplList(props: ImplListProps): JSX.Element {
  const { entries, selectedSlug, onSelect, loading } = props
  const [manualSlug, setManualSlug] = useState('')

  const activeEntries = entries.filter((e) => e.doc_status !== 'complete')
  const completedEntries = entries.filter((e) => e.doc_status === 'complete')

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = manualSlug.trim()
    if (trimmed) {
      onSelect(trimmed)
    }
  }

  return (
    <div className="flex flex-col gap-1 p-2">
      {entries.length === 0 ? (
        <p className="text-muted-foreground text-xs px-2">
          No IMPL docs found. Run <code className="bg-muted px-1 rounded">saw scout</code> first.
        </p>
      ) : (
        <>
          {activeEntries.map((e) => {
            const isSelected = e.slug === selectedSlug
            return (
              <Button
                key={e.slug}
                variant="ghost"
                size="sm"
                className={cn(
                  'w-full justify-start font-mono text-xs',
                  isSelected && 'bg-accent border-l-2 border-primary rounded-none'
                )}
                disabled={loading}
                onClick={() => onSelect(e.slug)}
              >
                {e.slug}
              </Button>
            )
          })}

          {completedEntries.length > 0 && (
            <>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground pt-2">
                Completed
              </p>
              {completedEntries.map((e) => {
                const isSelected = e.slug === selectedSlug
                return (
                  <Button
                    key={e.slug}
                    variant="ghost"
                    size="sm"
                    className={cn(
                      'w-full justify-start font-mono text-xs',
                      isSelected
                        ? 'bg-accent border-l-2 border-primary rounded-none'
                        : 'opacity-60 hover:opacity-100'
                    )}
                    disabled={loading}
                    onClick={() => onSelect(e.slug)}
                  >
                    {'\u2713 '}{e.slug}
                  </Button>
                )
              })}
            </>
          )}
        </>
      )}

      <div className="border-t mt-4 pt-4">
        <p className="text-muted-foreground text-xs mb-2">Or enter a slug manually:</p>
        <form onSubmit={handleManualSubmit}>
          <input
            type="text"
            value={manualSlug}
            onChange={(e) => setManualSlug(e.target.value)}
            className="border border-input bg-background text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring w-full mb-2"
          />
          <Button type="submit" disabled={loading}>
            Go
          </Button>
        </form>
      </div>
    </div>
  )
}
