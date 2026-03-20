/**
 * EventTransport — abstraction layer over EventSource that can be swapped
 * for a Wails runtime transport in the future.
 *
 * Channel naming convention:
 *   "global"                -> /api/events
 *   "wave:{slug}"           -> /api/wave/{slug}/events
 *   "scout:{runId}"         -> /api/scout/{runId}/events
 *   "revise:{slug}:{runId}" -> /api/impl/{slug}/revise/{runId}/events
 *   "chat:{slug}:{runId}"   -> /api/impl/{slug}/chat/{runId}/events
 *   "planner:{runId}"       -> /api/planner/{runId}/events
 *   "program"               -> /api/program/events
 *   "daemon"                -> /api/daemon/events
 */

export interface TransportEvent {
  name: string
  data: any
}

export interface EventTransport {
  subscribe(channel: string, handler: (event: TransportEvent) => void): () => void
  close(): void
}

/**
 * Maps a channel string to the corresponding SSE endpoint URL.
 * Exported for testing.
 */
export function channelToURL(channel: string): string {
  if (channel === 'global') return '/api/events'
  if (channel === 'program') return '/api/program/events'
  if (channel === 'daemon') return '/api/daemon/events'

  const parts = channel.split(':')
  const kind = parts[0]

  switch (kind) {
    case 'wave':
      return `/api/wave/${encodeURIComponent(parts[1])}/events`
    case 'scout':
      return `/api/scout/${encodeURIComponent(parts[1])}/events`
    case 'revise':
      return `/api/impl/${encodeURIComponent(parts[1])}/revise/${encodeURIComponent(parts[2])}/events`
    case 'chat':
      return `/api/impl/${encodeURIComponent(parts[1])}/chat/${encodeURIComponent(parts[2])}/events`
    case 'planner':
      return `/api/planner/${encodeURIComponent(parts[1])}/events`
    default:
      throw new Error(`Unknown event channel: ${channel}`)
  }
}

interface ChannelEntry {
  es: EventSource
  refCount: number
  handlers: Set<(event: TransportEvent) => void>
}

/**
 * Creates an SSE-backed EventTransport.
 *
 * Manages ref-counting per channel: the first subscriber opens the
 * EventSource, the last unsubscribe closes it. EventSource handles
 * reconnection natively.
 */
export function createSSETransport(): EventTransport {
  const channels = new Map<string, ChannelEntry>()

  function subscribe(
    channel: string,
    handler: (event: TransportEvent) => void,
  ): () => void {
    let entry = channels.get(channel)

    if (!entry) {
      const url = channelToURL(channel)
      const es = new EventSource(url)
      entry = { es, refCount: 0, handlers: new Set() }
      channels.set(channel, entry)

      // SSE sends named events via addEventListener (not onmessage).
      // We use the generic 'message' listener as a fallback AND listen
      // for all named events by hooking into onmessage.
      es.onmessage = (e: MessageEvent) => {
        const evt: TransportEvent = { name: 'message', data: tryParseJSON(e.data) }
        entry!.handlers.forEach(h => h(evt))
      }
    }

    entry.handlers.add(handler)
    entry.refCount++

    return () => {
      const e = channels.get(channel)
      if (!e) return

      e.handlers.delete(handler)
      e.refCount--

      if (e.refCount === 0) {
        e.es.close()
        channels.delete(channel)
      }
    }
  }

  function close(): void {
    channels.forEach(entry => {
      entry.es.close()
    })
    channels.clear()
  }

  return { subscribe, close }
}

function tryParseJSON(data: string): any {
  try {
    return JSON.parse(data)
  } catch {
    return data
  }
}
