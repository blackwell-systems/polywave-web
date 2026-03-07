import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import MarkdownContent from './MarkdownContent'

interface KnownIssue {
  description: string
  status: string
  workaround?: string
}

interface KnownIssuesPanelProps {
  knownIssues?: KnownIssue[]
}

interface ParsedIssue {
  title: string
  status: string
  description: string
  workaround: string
}

function parseIssueBlob(text: string): ParsedIssue[] {
  const issues: ParsedIssue[] = []
  const blocks = text.split(/(?=\*\*[^*]+\*\*\n)/)
  for (const block of blocks) {
    const trimmed = block.trim()
    if (!trimmed) continue
    const titleMatch = trimmed.match(/^\*\*([^*]+)\*\*/)
    const title = titleMatch ? titleMatch[1] : 'Issue'
    const statusMatch = trimmed.match(/- Status:\s*(.+)/i)
    const descMatch = trimmed.match(/- Description:\s*(.+)/i)
    const workaroundMatch = trimmed.match(/- Workaround:\s*(.+)/i)
    issues.push({
      title,
      status: statusMatch?.[1] || '',
      description: descMatch?.[1] || '',
      workaround: workaroundMatch?.[1] || '',
    })
  }
  return issues
}

const STATUS_COLORS: Record<string, string> = {
  'pre-existing': 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20',
  'new': 'bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/20',
  'resolved': 'bg-green-500/15 text-green-700 dark:text-green-400 border border-green-500/20',
  'mitigated': 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/20',
}

function StatusBadge({ status }: { status: string }) {
  const key = status.toLowerCase().trim()
  const colors = STATUS_COLORS[key] || 'bg-muted text-muted-foreground border border-border'
  return <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${colors}`}>{status}</span>
}

export default function KnownIssuesPanel({ knownIssues }: KnownIssuesPanelProps): JSX.Element {
  if (!knownIssues || knownIssues.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Known Issues</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No known issues</p>
        </CardContent>
      </Card>
    )
  }

  // Try to parse structured issues from the blob
  const allParsed: ParsedIssue[] = []
  for (const issue of knownIssues) {
    const parsed = parseIssueBlob(issue.description)
    if (parsed.length > 0 && parsed[0].description) {
      allParsed.push(...parsed)
    }
  }

  // Fallback to raw markdown if parsing didn't work
  if (allParsed.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Known Issues</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {knownIssues.map((issue, idx) => (
              <Card key={idx} className="bg-muted/50">
                <CardContent className="pt-6">
                  <MarkdownContent>{issue.description}</MarkdownContent>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Known Issues</CardTitle>
        <p className="text-xs text-muted-foreground">{allParsed.length} issue{allParsed.length !== 1 ? 's' : ''}</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {allParsed.map((issue, idx) => (
            <div key={idx} className="rounded-lg border border-border/60 bg-muted/30 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-semibold text-foreground">{issue.title}</span>
                {issue.status && <StatusBadge status={issue.status} />}
              </div>
              {issue.description && (
                <p className="text-xs text-muted-foreground leading-relaxed">{issue.description}</p>
              )}
              {issue.workaround && (
                <div className="mt-2 pl-3 border-l-2 border-primary/30">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/70">Workaround: </span>
                    <MarkdownContent>{issue.workaround}</MarkdownContent>
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
