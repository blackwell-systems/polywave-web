import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import ToastContainer, { Toast } from '../ToastContainer'

describe('ToastContainer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders toasts with correct severity colors', () => {
    const toasts: Toast[] = [
      {
        id: '1',
        type: 'wave_complete',
        title: 'Success',
        message: 'Wave completed',
        severity: 'success',
        timestamp: Date.now(),
      },
      {
        id: '2',
        type: 'agent_failed',
        title: 'Error',
        message: 'Agent failed',
        severity: 'error',
        timestamp: Date.now(),
      },
      {
        id: '3',
        type: 'build_verify_fail',
        title: 'Warning',
        message: 'Build verification failed',
        severity: 'warning',
        timestamp: Date.now(),
      },
      {
        id: '4',
        type: 'merge_complete',
        title: 'Info',
        message: 'Merge complete',
        severity: 'info',
        timestamp: Date.now(),
      },
    ]

    const { container } = render(<ToastContainer toasts={toasts} onDismiss={() => {}} />)

    // Verify all toasts are rendered
    expect(screen.getByText('Success')).toBeInTheDocument()
    expect(screen.getByText('Error')).toBeInTheDocument()
    expect(screen.getByText('Warning')).toBeInTheDocument()
    expect(screen.getByText('Info')).toBeInTheDocument()

    // Verify severity-specific styling is present in the outermost toast div
    const successToast = screen.getByText('Success').closest('[role="alert"]')
    const errorToast = screen.getByText('Error').closest('[role="alert"]')
    const warningToast = screen.getByText('Warning').closest('[role="alert"]')
    const infoToast = screen.getByText('Info').closest('[role="alert"]')

    expect(successToast?.className).toContain('green')
    expect(errorToast?.className).toContain('red')
    expect(warningToast?.className).toContain('amber')
    expect(infoToast?.className).toContain('blue')
  })

  it('calls onDismiss when X clicked', async () => {
    const onDismiss = vi.fn()
    const toasts: Toast[] = [
      {
        id: 'test-1',
        type: 'wave_complete',
        title: 'Test Toast',
        message: 'Test message',
        severity: 'info',
        timestamp: Date.now(),
      },
    ]

    render(<ToastContainer toasts={toasts} onDismiss={onDismiss} />)

    const dismissButton = screen.getByLabelText('Dismiss notification')
    dismissButton.click()

    expect(onDismiss).toHaveBeenCalledWith('test-1')
  })

  it('auto-dismisses after timeout', () => {
    const onDismiss = vi.fn()
    const toasts: Toast[] = [
      {
        id: 'auto-dismiss',
        type: 'wave_complete',
        title: 'Auto Dismiss',
        message: 'This should auto-dismiss',
        severity: 'success',
        timestamp: Date.now(),
      },
    ]

    render(<ToastContainer toasts={toasts} onDismiss={onDismiss} autoDismissMs={5000} />)

    expect(screen.getByText('Auto Dismiss')).toBeInTheDocument()

    // Fast-forward time by 5 seconds
    vi.advanceTimersByTime(5000)

    // Should have been called immediately after timer fires
    expect(onDismiss).toHaveBeenCalledWith('auto-dismiss')
  })

  it('respects custom autoDismissMs', () => {
    const onDismiss = vi.fn()
    const toasts: Toast[] = [
      {
        id: 'custom-timeout',
        type: 'wave_complete',
        title: 'Custom Timeout',
        message: 'Custom timeout test',
        severity: 'info',
        timestamp: Date.now(),
      },
    ]

    render(<ToastContainer toasts={toasts} onDismiss={onDismiss} autoDismissMs={3000} />)

    // Should not dismiss before timeout
    vi.advanceTimersByTime(2000)
    expect(onDismiss).not.toHaveBeenCalled()

    // Should dismiss after custom timeout
    vi.advanceTimersByTime(1000)
    expect(onDismiss).toHaveBeenCalledWith('custom-timeout')
  })

  it('limits visible toasts to 5', () => {
    const onDismiss = vi.fn()
    const toasts: Toast[] = Array.from({ length: 7 }, (_, i) => ({
      id: `toast-${i}`,
      type: 'wave_complete',
      title: `Toast ${i}`,
      message: `Message ${i}`,
      severity: 'info' as const,
      timestamp: Date.now() + i, // Ensure different timestamps
    }))

    render(<ToastContainer toasts={toasts} onDismiss={onDismiss} />)

    // Should auto-dismiss the 2 oldest toasts immediately
    expect(onDismiss).toHaveBeenCalledWith('toast-0')
    expect(onDismiss).toHaveBeenCalledWith('toast-1')
  })

  it('renders nothing when toasts array is empty', () => {
    const { container } = render(<ToastContainer toasts={[]} onDismiss={() => {}} />)
    
    // Container should be empty (only empty fragment)
    expect(container.firstChild).toBeNull()
  })

  it('handles multiple toasts with different severities', () => {
    const toasts: Toast[] = [
      {
        id: '1',
        type: 'wave_complete',
        title: 'Wave 1 Complete',
        message: 'All agents succeeded',
        severity: 'success',
        timestamp: Date.now(),
      },
      {
        id: '2',
        type: 'agent_failed',
        title: 'Agent Failed',
        message: 'Agent B encountered an error',
        severity: 'error',
        timestamp: Date.now() + 1,
      },
    ]

    render(<ToastContainer toasts={toasts} onDismiss={() => {}} />)

    expect(screen.getByText('Wave 1 Complete')).toBeInTheDocument()
    expect(screen.getByText('All agents succeeded')).toBeInTheDocument()
    expect(screen.getByText('Agent Failed')).toBeInTheDocument()
    expect(screen.getByText('Agent B encountered an error')).toBeInTheDocument()
  })

  it('cleans up timers on unmount', () => {
    const onDismiss = vi.fn()
    const toasts: Toast[] = [
      {
        id: 'cleanup-test',
        type: 'wave_complete',
        title: 'Cleanup Test',
        message: 'Should clean up timer',
        severity: 'info',
        timestamp: Date.now(),
      },
    ]

    const { unmount } = render(<ToastContainer toasts={toasts} onDismiss={onDismiss} />)

    // Unmount before timeout
    unmount()

    // Advance time - should not call onDismiss after unmount
    vi.advanceTimersByTime(5000)
    expect(onDismiss).not.toHaveBeenCalled()
  })
})
