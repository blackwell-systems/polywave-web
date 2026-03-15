// DiffViewer – renders a unified diff with +/- line highlighting.
// Owned by Agent E (Wave 1).

export interface DiffViewerProps {
  diff: string
  path: string
  loading?: boolean
}

type LineType = 'added' | 'removed' | 'hunk' | 'unchanged'

interface DiffLine {
  type: LineType
  content: string
}

function parseDiffLines(raw: string): DiffLine[] {
  return raw.split('\n').map(line => {
    if (line.startsWith('+') && !line.startsWith('+++')) return { type: 'added', content: line }
    if (line.startsWith('-') && !line.startsWith('---')) return { type: 'removed', content: line }
    if (line.startsWith('@@')) return { type: 'hunk', content: line }
    return { type: 'unchanged', content: line }
  })
}

function lineClass(type: LineType): string {
  switch (type) {
    case 'added':
      return 'bg-green-500/15 text-green-800 dark:text-green-300'
    case 'removed':
      return 'bg-red-500/15 text-red-800 dark:text-red-300'
    case 'hunk':
      return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 font-semibold'
    default:
      return 'text-foreground/80'
  }
}

/** Skeleton loader shown while diff is being fetched. */
function SkeletonLoader(): JSX.Element {
  return (
    <div className="animate-pulse space-y-1 py-2" aria-busy="true" aria-label="Loading diff">
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="h-4 rounded bg-muted"
          style={{ width: `${55 + ((i * 17) % 40)}%` }}
        />
      ))}
    </div>
  )
}

export default function DiffViewer({ diff, path, loading = false }: DiffViewerProps): JSX.Element {
  if (loading) {
    return (
      <div className="rounded-md border bg-card px-4 py-3">
        <p className="text-xs font-mono text-muted-foreground mb-2 truncate">{path}</p>
        <SkeletonLoader />
      </div>
    )
  }

  if (diff.trim() === '') {
    return (
      <div className="rounded-md border bg-card px-4 py-6 text-center">
        <p className="text-xs font-mono text-muted-foreground mb-1 truncate">{path}</p>
        <p className="text-sm text-muted-foreground">No changes</p>
      </div>
    )
  }

  const lines = parseDiffLines(diff)

  return (
    <div className="rounded-md border bg-card">
      <div className="border-b px-4 py-2">
        <span className="text-xs font-mono text-muted-foreground truncate block">{path}</span>
      </div>
      <div className="overflow-x-auto">
        <pre className="text-[11px] font-mono leading-5 select-text" aria-label="Diff content">
          {lines.map((line, idx) => (
            <div
              key={idx}
              className={`px-2 ${lineClass(line.type)}`}
              data-line-type={line.type}
            >
              {/* preserve empty lines so the diff block layout isn't collapsed */}
              {line.content || '\u00a0'}
            </div>
          ))}
        </pre>
      </div>
    </div>
  )
}
