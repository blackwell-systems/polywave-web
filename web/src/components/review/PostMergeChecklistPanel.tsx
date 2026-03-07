import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import MarkdownContent from './MarkdownContent'

interface PostMergeChecklistPanelProps {
  checklistText?: string
}

interface ChecklistGroup {
  heading: string
  items: string[]
}

function parseChecklist(text: string): ChecklistGroup[] {
  const groups: ChecklistGroup[] = []
  let current: ChecklistGroup | null = null

  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
      current = { heading: trimmed.replace(/^\*\*|\*\*$/g, ''), items: [] }
      groups.push(current)
    } else if (trimmed.startsWith('- [ ]') || trimmed.startsWith('- [x]')) {
      if (!current) {
        current = { heading: '', items: [] }
        groups.push(current)
      }
      current.items.push(trimmed)
    }
  }
  return groups
}

function ChecklistItem({ text }: { text: string }) {
  const checked = text.startsWith('- [x]')
  const content = text.replace(/^- \[.\]\s*/, '')

  return (
    <label className="flex items-start gap-3 py-2 px-3 rounded-md hover:bg-muted/50 transition-colors cursor-default group">
      <div className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
        checked
          ? 'bg-primary border-primary'
          : 'border-muted-foreground/30 group-hover:border-muted-foreground/50'
      }`}>
        {checked && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 5L4.5 7.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <span className="text-xs leading-relaxed">
        <MarkdownContent>{content}</MarkdownContent>
      </span>
    </label>
  )
}

export default function PostMergeChecklistPanel({ checklistText }: PostMergeChecklistPanelProps): JSX.Element {
  if (!checklistText || checklistText.trim() === '') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Post-Merge Checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No post-merge checklist</p>
        </CardContent>
      </Card>
    )
  }

  const groups = parseChecklist(checklistText)
  const hasGroups = groups.length > 0 && groups.some(g => g.items.length > 0)

  if (!hasGroups) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Post-Merge Checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <MarkdownContent>{checklistText}</MarkdownContent>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Post-Merge Checklist</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {groups.map((group, gi) => (
            <div key={gi}>
              {group.heading && (
                <div className="text-sm font-semibold text-foreground mb-2 pb-1 border-b border-border/50">
                  {group.heading}
                </div>
              )}
              <div className="space-y-0.5">
                {group.items.map((item, ii) => (
                  <ChecklistItem key={ii} text={item} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
