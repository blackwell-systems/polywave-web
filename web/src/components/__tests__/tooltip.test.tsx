import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Tooltip } from '../ui/tooltip'

describe('Tooltip', () => {
  it('renders children', () => {
    render(
      <Tooltip content="Help text">
        <span>Hover me</span>
      </Tooltip>,
    )
    expect(screen.getByText('Hover me')).toBeInTheDocument()
  })

  it('renders tooltip content in the DOM', () => {
    render(
      <Tooltip content="Help text">
        <span>Hover me</span>
      </Tooltip>,
    )
    expect(screen.getByRole('tooltip')).toHaveTextContent('Help text')
  })

  it('tooltip starts hidden (opacity-0)', () => {
    render(
      <Tooltip content="Help text">
        <span>Hover me</span>
      </Tooltip>,
    )
    const tooltip = screen.getByRole('tooltip')
    expect(tooltip.className).toContain('opacity-0')
  })

  it('shows tooltip on hover', async () => {
    const user = userEvent.setup()
    render(
      <Tooltip content="Help text">
        <span>Hover me</span>
      </Tooltip>,
    )
    const wrapper = screen.getByText('Hover me').closest('span[class*="relative"]')!
    await user.hover(wrapper)
    const tooltip = screen.getByRole('tooltip')
    expect(tooltip.className).toContain('opacity-100')
  })

  it('hides tooltip on unhover', async () => {
    const user = userEvent.setup()
    render(
      <Tooltip content="Help text">
        <span>Hover me</span>
      </Tooltip>,
    )
    const wrapper = screen.getByText('Hover me').closest('span[class*="relative"]')!
    await user.hover(wrapper)
    await user.unhover(wrapper)
    const tooltip = screen.getByRole('tooltip')
    expect(tooltip.className).toContain('opacity-0')
  })

  it('applies correct position classes for bottom', () => {
    render(
      <Tooltip content="Bottom tip" position="bottom">
        <span>Target</span>
      </Tooltip>,
    )
    const tooltip = screen.getByRole('tooltip')
    expect(tooltip.className).toContain('top-full')
  })

  it('applies correct position classes for left', () => {
    render(
      <Tooltip content="Left tip" position="left">
        <span>Target</span>
      </Tooltip>,
    )
    const tooltip = screen.getByRole('tooltip')
    expect(tooltip.className).toContain('right-full')
  })

  it('applies correct position classes for right', () => {
    render(
      <Tooltip content="Right tip" position="right">
        <span>Target</span>
      </Tooltip>,
    )
    const tooltip = screen.getByRole('tooltip')
    expect(tooltip.className).toContain('left-full')
  })

  it('defaults to top position', () => {
    render(
      <Tooltip content="Top tip">
        <span>Target</span>
      </Tooltip>,
    )
    const tooltip = screen.getByRole('tooltip')
    expect(tooltip.className).toContain('bottom-full')
  })

  it('respects custom maxWidth', () => {
    render(
      <Tooltip content="Wide tooltip" maxWidth={500}>
        <span>Target</span>
      </Tooltip>,
    )
    const tooltip = screen.getByRole('tooltip')
    expect(tooltip.style.maxWidth).toBe('500px')
  })

  it('uses default maxWidth of 300', () => {
    render(
      <Tooltip content="Default width">
        <span>Target</span>
      </Tooltip>,
    )
    const tooltip = screen.getByRole('tooltip')
    expect(tooltip.style.maxWidth).toBe('300px')
  })

  it('sets aria-label for string content', () => {
    render(
      <Tooltip content="Accessible text">
        <span>Target</span>
      </Tooltip>,
    )
    const wrapper = screen.getByText('Target').closest('span[class*="relative"]')!
    expect(wrapper).toHaveAttribute('aria-label', 'Accessible text')
  })

  it('does not set aria-label for JSX content', () => {
    render(
      <Tooltip content={<strong>Bold tip</strong>}>
        <span>Target</span>
      </Tooltip>,
    )
    const wrapper = screen.getByText('Target').closest('span[class*="relative"]')!
    expect(wrapper).not.toHaveAttribute('aria-label')
  })

  it('renders JSX content inside tooltip', () => {
    render(
      <Tooltip content={<strong data-testid="bold">Bold</strong>}>
        <span>Target</span>
      </Tooltip>,
    )
    expect(screen.getByTestId('bold')).toBeInTheDocument()
  })
})
