import { useEffect, useRef, useState } from 'react'
import { GitActivitySnapshot } from '../types/gitActivity'

export function useGitActivity(slug: string): GitActivitySnapshot | null {
  const [snapshot, setSnapshot] = useState<GitActivitySnapshot | null>(null)
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    const es = new EventSource('/api/git/' + slug + '/activity')
    esRef.current = es

    es.onerror = () => {
      console.error('[useGitActivity] SSE connection error; will reconnect automatically')
    }

    es.addEventListener('git_activity', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as GitActivitySnapshot
        setSnapshot(data)
      } catch (err) {
        console.error('[useGitActivity] Failed to parse git_activity event:', err)
      }
    })

    return () => {
      esRef.current?.close()
    }
  }, [slug])

  return snapshot
}
