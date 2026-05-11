import { render, screen, fireEvent } from '@testing-library/react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { ReviewProvider, useReviewContext } from './ReviewContext'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
  }
})()
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

function TestConsumer() {
  const ctx = useReviewContext()
  return (
    <div>
      <span data-testid="panels">{ctx.activePanels.join(',')}</span>
      <span data-testid="chat">{String(ctx.showChat)}</span>
      <span data-testid="revise">{String(ctx.showRevise)}</span>
      <span data-testid="diff">{ctx.diffTarget ? `${ctx.diffTarget.agent}:${ctx.diffTarget.wave}:${ctx.diffTarget.file}` : 'none'}</span>
      <button data-testid="toggle-wiring" onClick={() => ctx.togglePanel('wiring')}>toggle wiring</button>
      <button data-testid="toggle-file-ownership" onClick={() => ctx.togglePanel('file-ownership')}>toggle fo</button>
      <button data-testid="set-chat" onClick={() => ctx.setShowChat(true)}>show chat</button>
      <button data-testid="set-diff" onClick={() => ctx.setDiffTarget({ agent: 'A', wave: 1, file: 'foo.ts' })}>set diff</button>
      <button data-testid="clear-diff" onClick={() => ctx.setDiffTarget(null)}>clear diff</button>
      <button data-testid="set-revise" onClick={() => ctx.setShowRevise(true)}>show revise</button>
    </div>
  )
}

describe('ReviewContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
  })

  test('provides default active panels', () => {
    render(
      <ReviewProvider>
        <TestConsumer />
      </ReviewProvider>
    )
    const panels = screen.getByTestId('panels').textContent!
    expect(panels).toContain('file-ownership')
    expect(panels).toContain('wave-structure')
    expect(panels).toContain('interface-contracts')
  })

  test('togglePanel adds a panel', () => {
    render(
      <ReviewProvider>
        <TestConsumer />
      </ReviewProvider>
    )
    expect(screen.getByTestId('panels').textContent).not.toContain('wiring')
    fireEvent.click(screen.getByTestId('toggle-wiring'))
    expect(screen.getByTestId('panels').textContent).toContain('wiring')
  })

  test('togglePanel removes a panel that is active', () => {
    render(
      <ReviewProvider>
        <TestConsumer />
      </ReviewProvider>
    )
    expect(screen.getByTestId('panels').textContent).toContain('file-ownership')
    fireEvent.click(screen.getByTestId('toggle-file-ownership'))
    expect(screen.getByTestId('panels').textContent).not.toContain('file-ownership')
  })

  test('togglePanel persists to localStorage', () => {
    render(
      <ReviewProvider>
        <TestConsumer />
      </ReviewProvider>
    )
    fireEvent.click(screen.getByTestId('toggle-wiring'))
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'polywave-review-panels',
      expect.stringContaining('wiring')
    )
  })

  test('showChat state toggles', () => {
    render(
      <ReviewProvider>
        <TestConsumer />
      </ReviewProvider>
    )
    expect(screen.getByTestId('chat').textContent).toBe('false')
    fireEvent.click(screen.getByTestId('set-chat'))
    expect(screen.getByTestId('chat').textContent).toBe('true')
  })

  test('diffTarget state changes', () => {
    render(
      <ReviewProvider>
        <TestConsumer />
      </ReviewProvider>
    )
    expect(screen.getByTestId('diff').textContent).toBe('none')
    fireEvent.click(screen.getByTestId('set-diff'))
    expect(screen.getByTestId('diff').textContent).toBe('A:1:foo.ts')
    fireEvent.click(screen.getByTestId('clear-diff'))
    expect(screen.getByTestId('diff').textContent).toBe('none')
  })

  test('showRevise state changes', () => {
    render(
      <ReviewProvider>
        <TestConsumer />
      </ReviewProvider>
    )
    expect(screen.getByTestId('revise').textContent).toBe('false')
    fireEvent.click(screen.getByTestId('set-revise'))
    expect(screen.getByTestId('revise').textContent).toBe('true')
  })
})
