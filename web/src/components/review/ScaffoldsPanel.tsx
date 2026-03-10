import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import MarkdownContent from './MarkdownContent'

interface ScaffoldDetail {
  file_path: string
  contents: string
  import_path: string
}

interface ScaffoldsPanelProps {
  scaffoldsDetail?: ScaffoldDetail[]
}

/** Guess a Prism language tag from the file extension. */
function langFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    go: 'go', ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
    py: 'python', rs: 'rust', java: 'java', rb: 'ruby', cs: 'csharp',
    yaml: 'yaml', yml: 'yaml', json: 'json', toml: 'toml', md: 'markdown',
  }
  return map[ext] ?? ''
}

export default function ScaffoldsPanel({ scaffoldsDetail }: ScaffoldsPanelProps): JSX.Element {
  if (!scaffoldsDetail || scaffoldsDetail.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Scaffolds</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No scaffolds needed</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scaffolds ({scaffoldsDetail.length} files)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {scaffoldsDetail.map((scaffold, idx) => (
          <Card key={idx} className="bg-muted/50">
            <details className="group" open={scaffoldsDetail.length <= 3}>
              <summary className="cursor-pointer px-6 py-4 font-medium hover:bg-muted/80 transition-colors list-none">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm">{scaffold.file_path}</span>
                  <div className="flex items-center gap-3">
                    {scaffold.import_path && (
                      <span className="text-xs text-muted-foreground font-mono">{scaffold.import_path}</span>
                    )}
                    <span className="text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
                  </div>
                </div>
              </summary>
              <CardContent className="pt-0">
                {scaffold.contents ? (
                  <MarkdownContent compact>{`\`\`\`${langFromPath(scaffold.file_path)}\n${scaffold.contents}\n\`\`\``}</MarkdownContent>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No contents available</p>
                )}
              </CardContent>
            </details>
          </Card>
        ))}
      </CardContent>
    </Card>
  )
}
