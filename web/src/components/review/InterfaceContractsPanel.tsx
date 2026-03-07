import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useEffect, useState } from 'react'

interface InterfaceContractsPanelProps {
  contractsText?: string
}

function parseMarkdownWithCodeBlocks(text: string) {
  const parts: Array<{ type: 'text' | 'code'; content: string; language?: string }> = []
  const lines = text.split('\n')
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const codeBlockMatch = line.match(/^```(\w+)?$/)

    if (codeBlockMatch) {
      const language = codeBlockMatch[1] || 'text'
      const codeLines: string[] = []
      i++

      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }

      parts.push({ type: 'code', content: codeLines.join('\n'), language })
      i++ // skip closing ```
    } else {
      const textLines: string[] = []
      while (i < lines.length && !lines[i].startsWith('```')) {
        textLines.push(lines[i])
        i++
      }
      if (textLines.length > 0) {
        parts.push({ type: 'text', content: textLines.join('\n') })
      }
    }
  }

  return parts
}

export default function InterfaceContractsPanel({ contractsText }: InterfaceContractsPanelProps): JSX.Element {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'))
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'))
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  if (!contractsText || contractsText.trim() === '') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Interface Contracts</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No interface contracts defined</p>
        </CardContent>
      </Card>
    )
  }

  const parts = parseMarkdownWithCodeBlocks(contractsText)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Interface Contracts</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {parts.map((part, idx) => {
            if (part.type === 'code') {
              return (
                <SyntaxHighlighter
                  key={idx}
                  language={part.language}
                  style={isDark ? vscDarkPlus : vs}
                  customStyle={{
                    fontSize: '0.75rem',
                    borderRadius: '0.375rem',
                    margin: 0
                  }}
                >
                  {part.content}
                </SyntaxHighlighter>
              )
            }
            return (
              <pre key={idx} className="text-sm whitespace-pre-wrap">
                {part.content}
              </pre>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
