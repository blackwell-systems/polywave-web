import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import MarkdownContent from './MarkdownContent'

interface StubReportPanelProps {
  stubReportText: string
}

export default function StubReportPanel({ stubReportText }: StubReportPanelProps): JSX.Element {
  const isEmpty = !stubReportText || stubReportText.trim() === ''
  const isClean = !isEmpty && stubReportText.toLowerCase().includes('no stub')

  return (
    <Card className={isClean ? 'border-green-500/30' : isEmpty ? '' : 'border-amber-500/30'}>
      <CardHeader>
        <div className="flex items-center gap-3">
          <CardTitle>Stub Report</CardTitle>
          {isClean && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-500/15 text-green-700 dark:text-green-400 border border-green-500/20">
              clean
            </span>
          )}
          {!isEmpty && !isClean && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20">
              stubs detected
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Static scan for hollow implementations in agent-changed files
        </p>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <p className="text-sm text-muted-foreground">No stub report — scan has not run yet.</p>
        ) : (
          <MarkdownContent>{stubReportText}</MarkdownContent>
        )}
      </CardContent>
    </Card>
  )
}
