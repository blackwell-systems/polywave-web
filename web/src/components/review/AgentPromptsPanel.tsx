import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useEffect, useState } from 'react'

interface AgentPrompt {
  agent: string
  wave: number
  prompt: string
}

interface AgentPromptsPanelProps {
  agentPrompts?: AgentPrompt[]
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

export default function AgentPromptsPanel({ agentPrompts }: AgentPromptsPanelProps): JSX.Element {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'))
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'))
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  if (!agentPrompts || agentPrompts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Agent Prompts</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No agent prompts available</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent Prompts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {agentPrompts.map((ap, idx) => {
          const parts = parseMarkdownWithCodeBlocks(ap.prompt)
          return (
            <Card key={idx} className="bg-muted/50">
              <details className="group">
                <summary className="cursor-pointer px-6 py-4 font-medium hover:bg-muted/80 transition-colors list-none">
                  <div className="flex items-center justify-between">
                    <span>Agent {ap.agent} - Wave {ap.wave}</span>
                    <span className="text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
                  </div>
                </summary>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {parts.map((part, partIdx) => {
                      if (part.type === 'code') {
                        return (
                          <SyntaxHighlighter
                            key={partIdx}
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
                        <pre key={partIdx} className="text-xs whitespace-pre-wrap">
                          {part.content}
                        </pre>
                      )
                    })}
                  </div>
                </CardContent>
              </details>
            </Card>
          )
        })}
      </CardContent>
    </Card>
  )
}
