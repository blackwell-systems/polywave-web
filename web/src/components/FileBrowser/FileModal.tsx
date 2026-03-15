// FileModal – two-column modal integrating FileTree, FileViewer, DiffViewer, FilePicker.
// Owned by Agent H (Wave 2).

import { useEffect, useRef, useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, GitBranch } from 'lucide-react'

import { useFileBrowser } from '../../hooks/useFileBrowser'
import FileTree from './FileTree'
import FileViewer from './FileViewer'
import DiffViewer from './DiffViewer'
import FilePicker from './FilePicker'
import { FileNode } from '../../types/filebrowser'

// ─── Props ───────────────────────────────────────────────────────────────────

export interface FileModalProps {
  repo: string
  initialFile?: string
  onClose: () => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Recursively collect all file paths (non-dir) from a tree node. */
function collectFilePaths(node: FileNode): string[] {
  if (!node.isDir) return [node.path]
  return (node.children ?? []).flatMap(collectFilePaths)
}

/** Return the gitStatus of the node at the given path, or undefined if not found. */
function findNodeStatus(node: FileNode, path: string): FileNode['gitStatus'] | undefined {
  if (node.path === path) return node.gitStatus ?? null
  for (const child of node.children ?? []) {
    const result = findNodeStatus(child, path)
    if (result !== undefined) return result
  }
  return undefined
}

// ─── Divider (resizable) ─────────────────────────────────────────────────────

interface DividerProps {
  onMouseDown: (e: React.MouseEvent) => void
}

function Divider({ onMouseDown }: DividerProps) {
  return (
    <div
      role="separator"
      aria-label="Resize divider"
      aria-orientation="vertical"
      className="w-1 cursor-col-resize bg-border hover:bg-primary/30 active:bg-primary/50 transition-colors shrink-0"
      onMouseDown={onMouseDown}
      data-testid="resize-divider"
    />
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function FileModal({ repo, initialFile, onClose }: FileModalProps): JSX.Element {
  const {
    tree,
    content,
    diff,
    language,
    loading,
    error,
    selectedPath,
    loadTree,
    loadFile,
    loadDiff,
  } = useFileBrowser(repo)

  // Whether we're showing diff or file content
  const [showDiff, setShowDiff] = useState(false)
  // Whether the FilePicker overlay is open
  const [pickerOpen, setPickerOpen] = useState(false)
  // Left panel width as percentage (default 30%)
  const [leftWidthPct, setLeftWidthPct] = useState(30)

  const modalRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(30)

  // ── Load tree on mount ──────────────────────────────────────────────────────
  useEffect(() => {
    loadTree()
  }, [loadTree])

  // ── Load initial file on mount (deep link) ──────────────────────────────────
  useEffect(() => {
    if (initialFile) {
      loadFile(initialFile)
    }
  }, [initialFile, loadFile])

  // ── Reset diff view when selected path changes ──────────────────────────────
  useEffect(() => {
    setShowDiff(false)
  }, [selectedPath])

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Escape → close modal (unless picker is open, in which case picker handles it)
      if (e.key === 'Escape' && !pickerOpen) {
        onClose()
        return
      }

      const isMeta = e.metaKey || e.ctrlKey

      // ⌘P / Ctrl+P → open FilePicker
      if (isMeta && e.key === 'p') {
        e.preventDefault()
        setPickerOpen(true)
        return
      }

      // ⌘D / Ctrl+D → toggle diff view (only for modified files)
      if (isMeta && e.key === 'd') {
        e.preventDefault()
        if (selectedPath && isModified) {
          handleToggleDiff()
        }
        return
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onClose, pickerOpen, selectedPath],
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // ── Determine if the current file is modified ───────────────────────────────
  const isModified: boolean =
    selectedPath !== null &&
    tree !== null &&
    (['M', 'A'] as Array<FileNode['gitStatus']>).includes(findNodeStatus(tree, selectedPath) ?? null)

  // ── Diff toggle ─────────────────────────────────────────────────────────────
  function handleToggleDiff() {
    if (!selectedPath || !isModified) return
    if (!showDiff) {
      setShowDiff(true)
      loadDiff(selectedPath)
    } else {
      setShowDiff(false)
      loadFile(selectedPath)
    }
  }

  // ── Tree selection ──────────────────────────────────────────────────────────
  function handleTreeSelect(path: string, isDir: boolean) {
    if (!isDir) {
      loadFile(path)
    }
  }

  // ── FilePicker selection ─────────────────────────────────────────────────────
  function handlePickerSelect(path: string) {
    loadFile(path)
    setPickerOpen(false)
  }

  // ── Resizable divider ────────────────────────────────────────────────────────
  function handleDividerMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    isDragging.current = true
    dragStartX.current = e.clientX
    dragStartWidth.current = leftWidthPct

    function onMouseMove(ev: MouseEvent) {
      if (!isDragging.current || !modalRef.current) return
      const modalWidth = modalRef.current.getBoundingClientRect().width
      const delta = ev.clientX - dragStartX.current
      const newPct = Math.min(
        60,
        Math.max(15, dragStartWidth.current + (delta / modalWidth) * 100),
      )
      setLeftWidthPct(newPct)
    }

    function onMouseUp() {
      isDragging.current = false
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  // ── Backdrop click ───────────────────────────────────────────────────────────
  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  // ── All file paths for picker ─────────────────────────────────────────────
  const allFilePaths: string[] = tree ? collectFilePaths(tree) : []

  // ── Render ──────────────────────────────────────────────────────────────────
  const modal = (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onMouseDown={handleBackdropClick}
      data-testid="file-modal-backdrop"
      aria-modal="true"
      role="dialog"
      aria-label={`File browser: ${repo}`}
    >
      {/* Modal container */}
      <div
        ref={modalRef}
        className="relative flex flex-col bg-background border border-border rounded-xl shadow-2xl overflow-hidden"
        style={{ width: '90vw', height: '90vh' }}
        data-testid="file-modal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* ── Header ───────────────────────────────────────────────────────── */}
        <header
          className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/30 shrink-0"
          data-testid="file-modal-header"
        >
          {/* Repo name */}
          <span
            className="font-semibold text-sm text-foreground"
            data-testid="file-modal-repo"
          >
            {repo}
          </span>

          {/* Divider */}
          {selectedPath && (
            <>
              <span className="text-muted-foreground text-sm" aria-hidden="true">
                /
              </span>
              {/* File path */}
              <span
                className="font-mono text-xs text-muted-foreground truncate flex-1"
                data-testid="file-modal-path"
              >
                {selectedPath}
              </span>
            </>
          )}

          {/* Spacer */}
          {!selectedPath && <span className="flex-1" />}

          {/* Diff toggle button (only for modified files) */}
          {selectedPath && isModified && (
            <button
              type="button"
              onClick={handleToggleDiff}
              className={[
                'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors',
                showDiff
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80',
              ].join(' ')}
              data-testid="diff-toggle-btn"
              aria-pressed={showDiff}
              title="Toggle diff view (⌘D)"
            >
              <GitBranch size={12} aria-hidden="true" />
              {showDiff ? 'File' : 'Diff'}
            </button>
          )}

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="ml-2 rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            data-testid="file-modal-close"
            aria-label="Close file browser"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        {/* ── Body: two-column layout ───────────────────────────────────────── */}
        <div className="flex flex-1 min-h-0" data-testid="file-modal-body">
          {/* Left panel – file tree */}
          <div
            className="flex flex-col border-r border-border bg-muted/10 overflow-hidden"
            style={{ width: `${leftWidthPct}%` }}
            data-testid="file-modal-tree-panel"
          >
            <div className="flex-1 overflow-y-auto">
              {tree ? (
                <FileTree
                  tree={tree}
                  onSelect={handleTreeSelect}
                  selectedPath={selectedPath}
                />
              ) : loading ? (
                <div
                  className="p-4 space-y-2"
                  data-testid="tree-skeleton"
                  aria-busy="true"
                  aria-label="Loading file tree"
                >
                  {[80, 60, 70, 50, 65].map((w, i) => (
                    <div
                      key={i}
                      className="h-4 rounded bg-muted animate-pulse"
                      style={{ width: `${w}%` }}
                    />
                  ))}
                </div>
              ) : error ? (
                <div className="p-4 text-sm text-destructive" data-testid="tree-error">
                  {error}
                </div>
              ) : null}
            </div>
          </div>

          {/* Resizable divider */}
          <Divider onMouseDown={handleDividerMouseDown} />

          {/* Right panel – viewer */}
          <div
            className="flex flex-col flex-1 min-w-0 overflow-hidden"
            data-testid="file-modal-viewer-panel"
          >
            {/* Content area */}
            <div className="flex-1 overflow-auto p-3">
              {selectedPath ? (
                showDiff ? (
                  <DiffViewer
                    diff={diff ?? ''}
                    path={selectedPath}
                    loading={loading}
                  />
                ) : (
                  <FileViewer
                    content={content ?? ''}
                    language={language}
                    path={selectedPath}
                    loading={loading}
                  />
                )
              ) : (
                /* Empty state */
                <div
                  className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2"
                  data-testid="viewer-empty-state"
                >
                  <p className="text-sm">Select a file to view its contents</p>
                  <p className="text-xs opacity-60">
                    Press{' '}
                    <kbd className="px-1 py-0.5 rounded border border-border font-mono text-[10px]">
                      ⌘P
                    </kbd>{' '}
                    to search
                  </p>
                </div>
              )}

              {/* Error banner */}
              {error && !loading && (
                <div
                  className="mt-3 px-3 py-2 rounded-md bg-destructive/10 text-destructive text-xs"
                  data-testid="viewer-error"
                >
                  {error}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* FilePicker overlay */}
      {pickerOpen && (
        <FilePicker
          files={allFilePaths}
          onSelect={handlePickerSelect}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  )

  return createPortal(modal, document.body)
}
