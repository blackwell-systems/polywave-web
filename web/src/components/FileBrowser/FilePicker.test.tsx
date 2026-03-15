import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FilePicker from './FilePicker'

const FILES = [
  'src/components/App.tsx',
  'src/components/FilePicker.tsx',
  'src/hooks/useFileBrowser.ts',
  'src/types/filebrowser.ts',
  'README.md',
]

describe('FilePicker', () => {
  it('renders all files when query is empty', () => {
    render(<FilePicker files={FILES} onSelect={vi.fn()} onClose={vi.fn()} />)
    FILES.forEach(file => {
      expect(screen.getByText(file)).toBeInTheDocument()
    })
  })

  it('filters files on input', async () => {
    const user = userEvent.setup()
    render(<FilePicker files={FILES} onSelect={vi.fn()} onClose={vi.fn()} />)

    const input = screen.getByPlaceholderText('Search files…')
    await user.type(input, 'hooks')

    expect(screen.getByText('src/hooks/useFileBrowser.ts')).toBeInTheDocument()
    expect(screen.queryByText('src/components/App.tsx')).not.toBeInTheDocument()
    expect(screen.queryByText('README.md')).not.toBeInTheDocument()
  })

  it('filter is case-insensitive', async () => {
    const user = userEvent.setup()
    render(<FilePicker files={FILES} onSelect={vi.fn()} onClose={vi.fn()} />)

    const input = screen.getByPlaceholderText('Search files…')
    await user.type(input, 'FILEPICKER')

    expect(screen.getByText('src/components/FilePicker.tsx')).toBeInTheDocument()
    expect(screen.queryByText('README.md')).not.toBeInTheDocument()
  })

  it('shows no files found message when no match', async () => {
    const user = userEvent.setup()
    render(<FilePicker files={FILES} onSelect={vi.fn()} onClose={vi.fn()} />)

    const input = screen.getByPlaceholderText('Search files…')
    await user.type(input, 'zzznomatch')

    expect(screen.getByText('No files found')).toBeInTheDocument()
  })

  it('navigates with arrow keys', async () => {
    const user = userEvent.setup()
    render(<FilePicker files={FILES} onSelect={vi.fn()} onClose={vi.fn()} />)

    const input = screen.getByPlaceholderText('Search files…')

    // Initially first item should be highlighted (activeIdx=0)
    const buttons = screen.getAllByRole('button')
    expect(buttons[0]).toHaveClass('bg-primary/10')
    expect(buttons[1]).not.toHaveClass('bg-primary/10')

    // Press ArrowDown to move to second item
    await user.type(input, '{ArrowDown}')
    const buttonsAfter = screen.getAllByRole('button')
    expect(buttonsAfter[0]).not.toHaveClass('bg-primary/10')
    expect(buttonsAfter[1]).toHaveClass('bg-primary/10')

    // Press ArrowDown again to move to third item
    await user.type(input, '{ArrowDown}')
    const buttonsAfter2 = screen.getAllByRole('button')
    expect(buttonsAfter2[2]).toHaveClass('bg-primary/10')

    // Press ArrowUp to go back to second
    await user.type(input, '{ArrowUp}')
    const buttonsAfter3 = screen.getAllByRole('button')
    expect(buttonsAfter3[1]).toHaveClass('bg-primary/10')
  })

  it('does not navigate above index 0 with ArrowUp', async () => {
    const user = userEvent.setup()
    render(<FilePicker files={FILES} onSelect={vi.fn()} onClose={vi.fn()} />)

    const input = screen.getByPlaceholderText('Search files…')

    // Press ArrowUp when already at top – should stay at index 0
    await user.type(input, '{ArrowUp}')
    const buttons = screen.getAllByRole('button')
    expect(buttons[0]).toHaveClass('bg-primary/10')
  })

  it('selects with Enter', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const onClose = vi.fn()
    render(<FilePicker files={FILES} onSelect={onSelect} onClose={onClose} />)

    const input = screen.getByPlaceholderText('Search files…')
    await user.type(input, '{Enter}')

    // Should select the first file (activeIdx=0) and close
    expect(onSelect).toHaveBeenCalledWith(FILES[0])
    expect(onClose).toHaveBeenCalled()
  })

  it('selects with Enter after navigating', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const onClose = vi.fn()
    render(<FilePicker files={FILES} onSelect={onSelect} onClose={onClose} />)

    const input = screen.getByPlaceholderText('Search files…')
    // Navigate to second item then press Enter
    await user.type(input, '{ArrowDown}{Enter}')

    expect(onSelect).toHaveBeenCalledWith(FILES[1])
    expect(onClose).toHaveBeenCalled()
  })

  it('closes with Escape', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<FilePicker files={FILES} onSelect={vi.fn()} onClose={onClose} />)

    const input = screen.getByPlaceholderText('Search files…')
    await user.type(input, '{Escape}')

    expect(onClose).toHaveBeenCalled()
  })

  it('closes when clicking backdrop', () => {
    const onClose = vi.fn()
    const { container } = render(
      <FilePicker files={FILES} onSelect={vi.fn()} onClose={onClose} />
    )

    // The backdrop is the outer fixed div
    const backdrop = container.firstChild as HTMLElement
    fireEvent.mouseDown(backdrop)

    expect(onClose).toHaveBeenCalled()
  })

  it('does not close when clicking inside modal', () => {
    const onClose = vi.fn()
    render(<FilePicker files={FILES} onSelect={vi.fn()} onClose={onClose} />)

    const input = screen.getByPlaceholderText('Search files…')
    fireEvent.mouseDown(input)

    expect(onClose).not.toHaveBeenCalled()
  })

  it('auto-focuses input on mount', () => {
    render(<FilePicker files={FILES} onSelect={vi.fn()} onClose={vi.fn()} />)
    const input = screen.getByPlaceholderText('Search files…')
    expect(document.activeElement).toBe(input)
  })

  it('selects file by clicking on it', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const onClose = vi.fn()
    render(<FilePicker files={FILES} onSelect={onSelect} onClose={onClose} />)

    await user.click(screen.getByText('src/hooks/useFileBrowser.ts'))

    expect(onSelect).toHaveBeenCalledWith('src/hooks/useFileBrowser.ts')
    expect(onClose).toHaveBeenCalled()
  })
})
