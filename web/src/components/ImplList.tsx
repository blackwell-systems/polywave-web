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

  const activeEntries = entries.filter((e) => e.doc_status !== 'complete')
  const completedEntries = entries.filter((e) => e.doc_status === 'complete')

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
    </div>
  )
}
