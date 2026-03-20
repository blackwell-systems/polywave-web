import { describe, it, expect, vi, beforeEach } from 'vitest'
import { channelToURL, createSSETransport } from './eventTransport'

// ---------------------------------------------------------------------------
// Mock EventSource
// ---------------------------------------------------------------------------

let mockInstances: MockES[] = []

class MockES {
  url: string
  onmessage: ((e: MessageEvent) => void) | null = null
  closed = false

  constructor(url: string) {
    this.url = url
    mockInstances.push(this)
  }

  close() {
    this.closed = true
  }

  // Helper: simulate an SSE message event
  simulateMessage(data: string) {
    if (this.onmessage) {
      this.onmessage({ data } as MessageEvent)
    }
  }
}

beforeEach(() => {
  mockInstances = []
  vi.stubGlobal('EventSource', MockES)
})

// ---------------------------------------------------------------------------
// channelToURL mapping
// ---------------------------------------------------------------------------

describe('channelToURL', () => {
  it('maps "global" to /api/events', () => {
    expect(channelToURL('global')).toBe('/api/events')
  })

  it('maps "program" to /api/program/events', () => {
    expect(channelToURL('program')).toBe('/api/program/events')
  })

  it('maps "daemon" to /api/daemon/events', () => {
    expect(channelToURL('daemon')).toBe('/api/daemon/events')
  })

  it('maps "wave:{slug}" correctly', () => {
    expect(channelToURL('wave:my-feature')).toBe('/api/wave/my-feature/events')
  })

  it('maps "scout:{runId}" correctly', () => {
    expect(channelToURL('scout:run-123')).toBe('/api/scout/run-123/events')
  })

  it('maps "revise:{slug}:{runId}" correctly', () => {
    expect(channelToURL('revise:my-slug:run-456')).toBe(
      '/api/impl/my-slug/revise/run-456/events',
    )
  })

  it('maps "chat:{slug}:{runId}" correctly', () => {
    expect(channelToURL('chat:my-slug:run-789')).toBe(
      '/api/impl/my-slug/chat/run-789/events',
    )
  })

  it('maps "planner:{runId}" correctly', () => {
    expect(channelToURL('planner:plan-1')).toBe('/api/planner/plan-1/events')
  })

  it('encodes special characters in slug/runId', () => {
    expect(channelToURL('wave:has space')).toBe('/api/wave/has%20space/events')
  })

  it('throws on unknown channel kind', () => {
    expect(() => channelToURL('unknown:foo')).toThrow('Unknown event channel')
  })
})

// ---------------------------------------------------------------------------
// createSSETransport — ref counting
// ---------------------------------------------------------------------------

describe('createSSETransport', () => {
  it('opens one EventSource per channel on first subscribe', () => {
    const transport = createSSETransport()
    const unsub = transport.subscribe('global', vi.fn())

    expect(mockInstances).toHaveLength(1)
    expect(mockInstances[0].url).toBe('/api/events')

    unsub()
  })

  it('ref-counts: second subscriber reuses the same EventSource', () => {
    const transport = createSSETransport()
    const unsub1 = transport.subscribe('wave:foo', vi.fn())
    const unsub2 = transport.subscribe('wave:foo', vi.fn())

    expect(mockInstances).toHaveLength(1)

    unsub1()
    // Still one subscriber — ES should remain open
    expect(mockInstances[0].closed).toBe(false)

    unsub2()
    // Last subscriber gone — ES should be closed
    expect(mockInstances[0].closed).toBe(true)
  })

  it('dispatches parsed JSON data to handlers', () => {
    const transport = createSSETransport()
    const handler = vi.fn()
    transport.subscribe('global', handler)

    mockInstances[0].simulateMessage('{"type":"update","value":42}')

    expect(handler).toHaveBeenCalledWith({
      name: 'message',
      data: { type: 'update', value: 42 },
    })
  })

  it('dispatches raw string when data is not valid JSON', () => {
    const transport = createSSETransport()
    const handler = vi.fn()
    transport.subscribe('global', handler)

    mockInstances[0].simulateMessage('plain text')

    expect(handler).toHaveBeenCalledWith({
      name: 'message',
      data: 'plain text',
    })
  })

  it('close() cleans up all connections', () => {
    const transport = createSSETransport()
    transport.subscribe('global', vi.fn())
    transport.subscribe('wave:bar', vi.fn())

    expect(mockInstances).toHaveLength(2)

    transport.close()

    expect(mockInstances[0].closed).toBe(true)
    expect(mockInstances[1].closed).toBe(true)
  })

  it('does not dispatch to removed handlers', () => {
    const transport = createSSETransport()
    const h1 = vi.fn()
    const h2 = vi.fn()
    const unsub1 = transport.subscribe('global', h1)
    transport.subscribe('global', h2)

    unsub1()
    mockInstances[0].simulateMessage('"hello"')

    expect(h1).not.toHaveBeenCalled()
    expect(h2).toHaveBeenCalledOnce()
  })

  it('reopens EventSource after full unsubscribe and re-subscribe', () => {
    const transport = createSSETransport()
    const unsub = transport.subscribe('daemon', vi.fn())
    unsub()

    expect(mockInstances).toHaveLength(1)
    expect(mockInstances[0].closed).toBe(true)

    // Re-subscribe should open a new EventSource
    const unsub2 = transport.subscribe('daemon', vi.fn())
    expect(mockInstances).toHaveLength(2)
    expect(mockInstances[1].closed).toBe(false)

    unsub2()
  })
})
