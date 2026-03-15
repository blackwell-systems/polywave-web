// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── Hoist mock factories ─────────────────────────────────────────────────────

const {
  mockLoadTree,
  mockLoadFile,
  mockLoadDiff,
  mockRefreshStatus,
  mockUseFileBrowser,
} = vi.hoisted(() => {
  const mockLoadTree = vi.fn().mockResolvedValue(undefined)
  const mockLoadFile = vi.fn().mockResolvedValue(undefined)
  const mockLoadDiff = vi.fn().mockResolvedValue(undefined)
  const mockRefreshStatus = vi.fn().mockResolvedValue(undefined)

  // Default hook state – tests can override via mockUseFileBrowser.mockReturnValue(...)
  const mockUseFileBrowser = vi.fn(() => ({
    tree: null,
    content: null,
    diff: null,
    language: '',
    loading: false,
    error: null,
    selectedPath: null,
    loadTree: mockLoadTree,
    loadFile: mockLoadFile,
    loadDiff: mockLoadDiff,
    refreshStatus: mockRefreshStatus,
  }))

  return { mockLoadTree, mockLoadFile, mockLoadDiff, mockRefreshStatus, mockUseFileBrowser }
})

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../hooks/useFileBrowser', () => ({
  useFileBrowser: mockUseFileBrowser,
}))

// Lightweight FileTree stub
vi.mock('./FileTree', () => ({
  default: vi.fn(({ tree, onSelect, selectedPath }: {
    tree: { name: string; path: string; isDir: boolean; children?: unknown[] }
    onSelect: (path: string, isDir: boolean) => void
    selectedPath?: string | null
  }) => (
    <div data-testid="file-tree" data-selected-path={selectedPath ?? ''}>
      <button
        data-testid="tree-file-btn"
        onClick={() => onSelect('/src/index.ts', false)}
      >
        index.ts
      </button>
      <button
        data-testid="tree-modified-btn"
        onClick={() => onSelect('/src/modified.ts', false)}
      >
        modified.ts
      </button>
    </div>
  )),
}))

// Lightweight FileViewer stub
vi.mock('./FileViewer', () => ({
  default: vi.fn(({ content, path, loading }: {
    content: string
    path: string
    loading?: boolean
  }) => (
    <div data-testid="file-viewer" data-path={path} data-loading={String(loading ?? false)}>
      <pre>{content}</pre>
    </div>
  )),
}))

// Lightweight DiffViewer stub
vi.mock('./DiffViewer', () => ({
  default: vi.fn(({ diff, path, loading }: {
    diff: string
    path: string
    loading?: boolean
  }) => (
    <div data-testid="diff-viewer" data-path={path} data-loading={String(loading ?? false)}>
      <pre>{diff}</pre>
    </div>
  )),
}))

// Lightweight FilePicker stub
vi.mock('./FilePicker', () => ({
  default: vi.fn(({ files, onSelect, onClose }: {
    files: string[]
    onSelect: (path: string) => void
    onClose: () => void
  }) => (
    <div data-testid="file-picker">
      <button
        data-testid="picker-select-btn"
        onClick={() => onSelect(files[0] ?? '/src/index.ts')}
      >
        Select
      </button>
      <button data-testid="picker-close-btn" onClick={onClose}>
        Close
      </button>
    </div>
  )),
}))

// ─── Sample tree fixture ──────────────────────────────────────────────────────

import { FileNode } from '../../types/filebrowser'

const sampleTree: FileNode = {
  name: 'root',
  path: '/',
  isDir: true,
  children: [
    {
      name: 'src',
      path: '/src',
      isDir: true,
      children: [
        { name: 'index.ts', path: '/src/index.ts', isDir: false, gitStatus: null },
        { name: 'modified.ts', path: '/src/modified.ts', isDir: false, gitStatus: 'M' },
      ],
    },
  ],
}

// ─── Import after mocks ───────────────────────────────────────────────────────

import FileModal from './FileModal'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderModal(props: Partial<{ repo: string; initialFile: string; onClose: () => void }> = {}) {
  const onClose = props.onClose ?? vi.fn()
  return {
    onClose,
    ...render(
      <FileModal
        repo={props.repo ?? 'my-repo'}
        initialFile={props.initialFile}
        onClose={onClose}
      />
    ),
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('FileModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Reset hook to default state (no file selected)
    mockUseFileBrowser.mockReturnValue({
      tree: sampleTree,
      content: null,
      diff: null,
      language: '',
      loading: false,
      error: null,
      selectedPath: null,
      loadTree: mockLoadTree,
      loadFile: mockLoadFile,
      loadDiff: mockLoadDiff,
      refreshStatus: mockRefreshStatus,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ── 1. FileModal renders tree and viewer ─────────────────────────────────────

  test('FileModal renders tree and viewer', () => {
    renderModal({ repo: 'my-repo' })

    // Modal container is present (rendered via portal at document.body)
    expect(screen.getByTestId('file-modal')).toBeInTheDocument()

    // Header shows repo name
    expect(screen.getByTestId('file-modal-repo')).toHaveTextContent('my-repo')

    // Tree panel is present
    expect(screen.getByTestId('file-modal-tree-panel')).toBeInTheDocument()

    // FileTree component is rendered
    expect(screen.getByTestId('file-tree')).toBeInTheDocument()

    // Viewer panel is present
    expect(screen.getByTestId('file-modal-viewer-panel')).toBeInTheDocument()

    // Empty state shown when no file is selected
    expect(screen.getByTestId('viewer-empty-state')).toBeInTheDocument()

    // Close button present
    expect(screen.getByTestId('file-modal-close')).toBeInTheDocument()

    // loadTree was called on mount
    expect(mockLoadTree).toHaveBeenCalledTimes(1)
  })

  test('FileModal shows file content after selecting a file from tree', async () => {
    // Simulate hook returning content after loadFile is called
    mockUseFileBrowser.mockReturnValue({
      tree: sampleTree,
      content: 'const x = 1',
      diff: null,
      language: 'typescript',
      loading: false,
      error: null,
      selectedPath: '/src/index.ts',
      loadTree: mockLoadTree,
      loadFile: mockLoadFile,
      loadDiff: mockLoadDiff,
      refreshStatus: mockRefreshStatus,
    })

    renderModal({ repo: 'my-repo' })

    // FileViewer should be displayed for non-modified file
    expect(screen.getByTestId('file-viewer')).toBeInTheDocument()
    expect(screen.getByTestId('file-viewer')).toHaveAttribute('data-path', '/src/index.ts')
  })

  // ── 2. FileModal loads initial file from deep link ───────────────────────────

  test('FileModal loads initial file from deep link', async () => {
    renderModal({ repo: 'my-repo', initialFile: '/src/index.ts' })

    // loadFile should have been called with the initial file path on mount
    await waitFor(() => {
      expect(mockLoadFile).toHaveBeenCalledWith('/src/index.ts')
    })
  })

  test('FileModal does not call loadFile when no initialFile provided', () => {
    renderModal({ repo: 'my-repo' })

    // loadFile should NOT have been called (no deep link)
    expect(mockLoadFile).not.toHaveBeenCalled()
  })

  // ── 3. FileModal closes on Escape key ────────────────────────────────────────

  test('FileModal closes on Escape key', async () => {
    const onClose = vi.fn()
    renderModal({ onClose })

    // Fire Escape key event on document
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test('FileModal closes when close button is clicked', () => {
    const onClose = vi.fn()
    renderModal({ onClose })

    fireEvent.click(screen.getByTestId('file-modal-close'))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test('FileModal closes when backdrop is clicked', () => {
    const onClose = vi.fn()
    renderModal({ onClose })

    fireEvent.mouseDown(screen.getByTestId('file-modal-backdrop'))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test('FileModal does NOT close when clicking inside the modal', () => {
    const onClose = vi.fn()
    renderModal({ onClose })

    // Click the modal body, not the backdrop
    fireEvent.mouseDown(screen.getByTestId('file-modal'))

    expect(onClose).not.toHaveBeenCalled()
  })

  // ── 4. FileModal toggles to diff view for modified files ─────────────────────

  test('FileModal toggles to diff view for modified files', async () => {
    // Start with a modified file selected
    mockUseFileBrowser.mockReturnValue({
      tree: sampleTree,
      content: 'original content',
      diff: null,
      language: 'typescript',
      loading: false,
      error: null,
      selectedPath: '/src/modified.ts',
      loadTree: mockLoadTree,
      loadFile: mockLoadFile,
      loadDiff: mockLoadDiff,
      refreshStatus: mockRefreshStatus,
    })

    renderModal({ repo: 'my-repo' })

    // Diff toggle button should be visible for modified file
    const diffToggle = screen.getByTestId('diff-toggle-btn')
    expect(diffToggle).toBeInTheDocument()
    // Initially shows "Diff" (file view active)
    expect(diffToggle).toHaveTextContent('Diff')

    // FileViewer is currently shown
    expect(screen.getByTestId('file-viewer')).toBeInTheDocument()
    expect(screen.queryByTestId('diff-viewer')).not.toBeInTheDocument()

    // Click toggle to switch to diff view
    // After click, loadDiff is called and we re-render the component with diff state
    mockUseFileBrowser.mockReturnValue({
      tree: sampleTree,
      content: null,
      diff: '@@ -1,1 +1,1 @@\n-original content\n+modified content',
      language: 'typescript',
      loading: false,
      error: null,
      selectedPath: '/src/modified.ts',
      loadTree: mockLoadTree,
      loadFile: mockLoadFile,
      loadDiff: mockLoadDiff,
      refreshStatus: mockRefreshStatus,
    })

    fireEvent.click(diffToggle)

    // loadDiff should have been called
    expect(mockLoadDiff).toHaveBeenCalledWith('/src/modified.ts')
  })

  test('FileModal does NOT show diff toggle for unmodified files', () => {
    // Non-modified file selected
    mockUseFileBrowser.mockReturnValue({
      tree: sampleTree,
      content: 'some content',
      diff: null,
      language: 'typescript',
      loading: false,
      error: null,
      selectedPath: '/src/index.ts',  // gitStatus: null
      loadTree: mockLoadTree,
      loadFile: mockLoadFile,
      loadDiff: mockLoadDiff,
      refreshStatus: mockRefreshStatus,
    })

    renderModal({ repo: 'my-repo' })

    // Diff toggle button should NOT be present for a non-modified file
    expect(screen.queryByTestId('diff-toggle-btn')).not.toBeInTheDocument()
  })

  test('FileModal keyboard shortcut ⌘D toggles diff for modified files', async () => {
    mockUseFileBrowser.mockReturnValue({
      tree: sampleTree,
      content: 'original content',
      diff: null,
      language: 'typescript',
      loading: false,
      error: null,
      selectedPath: '/src/modified.ts',
      loadTree: mockLoadTree,
      loadFile: mockLoadFile,
      loadDiff: mockLoadDiff,
      refreshStatus: mockRefreshStatus,
    })

    renderModal({ repo: 'my-repo' })

    act(() => {
      fireEvent.keyDown(document, { key: 'd', metaKey: true })
    })

    expect(mockLoadDiff).toHaveBeenCalledWith('/src/modified.ts')
  })

  test('FileModal keyboard shortcut ⌘P opens FilePicker', async () => {
    renderModal({ repo: 'my-repo' })

    // FilePicker should not be visible initially
    expect(screen.queryByTestId('file-picker')).not.toBeInTheDocument()

    act(() => {
      fireEvent.keyDown(document, { key: 'p', metaKey: true })
    })

    // FilePicker should now be visible
    expect(screen.getByTestId('file-picker')).toBeInTheDocument()
  })

  test('FileModal shows header with repo name and file path when file selected', () => {
    mockUseFileBrowser.mockReturnValue({
      tree: sampleTree,
      content: 'console.log("hello")',
      diff: null,
      language: 'typescript',
      loading: false,
      error: null,
      selectedPath: '/src/index.ts',
      loadTree: mockLoadTree,
      loadFile: mockLoadFile,
      loadDiff: mockLoadDiff,
      refreshStatus: mockRefreshStatus,
    })

    renderModal({ repo: 'my-repo' })

    expect(screen.getByTestId('file-modal-repo')).toHaveTextContent('my-repo')
    expect(screen.getByTestId('file-modal-path')).toHaveTextContent('/src/index.ts')
  })

  test('FileModal shows tree skeleton while loading', () => {
    mockUseFileBrowser.mockReturnValue({
      tree: null,
      content: null,
      diff: null,
      language: '',
      loading: true,
      error: null,
      selectedPath: null,
      loadTree: mockLoadTree,
      loadFile: mockLoadFile,
      loadDiff: mockLoadDiff,
      refreshStatus: mockRefreshStatus,
    })

    renderModal({ repo: 'my-repo' })

    expect(screen.getByTestId('tree-skeleton')).toBeInTheDocument()
  })

  test('FileModal shows error when tree fails to load', () => {
    mockUseFileBrowser.mockReturnValue({
      tree: null,
      content: null,
      diff: null,
      language: '',
      loading: false,
      error: 'Failed to load tree',
      selectedPath: null,
      loadTree: mockLoadTree,
      loadFile: mockLoadFile,
      loadDiff: mockLoadDiff,
      refreshStatus: mockRefreshStatus,
    })

    renderModal({ repo: 'my-repo' })

    expect(screen.getByTestId('tree-error')).toHaveTextContent('Failed to load tree')
  })

  test('FileModal resize divider is rendered', () => {
    renderModal({ repo: 'my-repo' })
    expect(screen.getByTestId('resize-divider')).toBeInTheDocument()
  })

  test('FileModal renders via portal at document.body', () => {
    const { baseElement } = render(
      <FileModal repo="my-repo" onClose={vi.fn()} />
    )
    // The modal backdrop should be a direct child of document.body (portal)
    expect(document.body.querySelector('[data-testid="file-modal-backdrop"]')).toBeInTheDocument()
  })
})
