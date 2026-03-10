import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import * as yaml from 'js-yaml'
import type { PostMergeChecklist } from '@/types'

function parsePostMergeChecklist(text: string): PostMergeChecklist | null {
  const stripped = text.replace(/^```yaml.*\n|```$/gm, '')
  try {
    return yaml.load(stripped) as PostMergeChecklist
  } catch (e) {
    console.error('Failed to parse post-merge checklist YAML:', e)
    return null
  }
}

export default function PostMergeChecklistPanel({ checklistText }: { checklistText?: string }): JSX.Element {
  if (!checklistText || checklistText.trim() === '') {
    return (
      <Card>
        <CardHeader><CardTitle>Post-Merge Checklist</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">No checklist defined</p></CardContent>
      </Card>
    )
  }

  const checklist = parsePostMergeChecklist(checklistText)
  if (!checklist) {
    return (
      <Card>
        <CardHeader><CardTitle>Post-Merge Checklist</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-destructive">Invalid checklist format</p></CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader><CardTitle>Post-Merge Checklist</CardTitle></CardHeader>
      <CardContent>
        {checklist.groups.map((group, idx) => (
          <div key={idx} className="mb-4 last:mb-0">
            <h4 className="font-semibold mb-2">{group.title}</h4>
            <ul className="list-disc list-inside space-y-1">
              {group.items.map((item, itemIdx) => (
                <li key={itemIdx} className="text-sm">
                  {item.description}
                  {item.command && <code className="ml-2 text-xs bg-muted px-1 rounded">{item.command}</code>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
