import { render, screen } from '@testing-library/react'
import { describe, test, expect } from 'vitest'
import DiffViewer from './DiffViewer'

const SAMPLE_DIFF = `diff --git a/foo.ts b/foo.ts
index 1234567..abcdefg 100644
--- a/foo.ts
+++ b/foo.ts
@@ -1,6 +1,7 @@
 import { useState } from 'react'
-const old = 'removed line'
+const added = 'new line'
+const extra = 'another new line'
 
 export default function Foo() {
   return null
 }`

describe('DiffViewer', () => {
  test('DiffViewer renders diff content', () => {
    render(<DiffViewer diff={SAMPLE_DIFF} path="foo.ts" />)

    // Path header is displayed
    expect(screen.getByText('foo.ts')).toBeInTheDocument()

    // The diff pre/block is rendered
    expect(screen.getByLabelText('Diff content')).toBeInTheDocument()

    // Unchanged context line is present
    expect(screen.getByText(/import \{ useState \}/)).toBeInTheDocument()
  })

  test('DiffViewer highlights added lines', () => {
    render(<DiffViewer diff={SAMPLE_DIFF} path="foo.ts" />)

    // Find all elements marked as added lines
    const addedLines = document.querySelectorAll('[data-line-type="added"]')
    expect(addedLines.length).toBeGreaterThan(0)

    // Added lines should carry the green background class
    addedLines.forEach(el => {
      expect(el.className).toMatch(/bg-green/)
    })

    // The added text content should be visible
    expect(screen.getByText(/\+const added = 'new line'/)).toBeInTheDocument()
    expect(screen.getByText(/\+const extra = 'another new line'/)).toBeInTheDocument()
  })

  test('DiffViewer highlights removed lines', () => {
    render(<DiffViewer diff={SAMPLE_DIFF} path="foo.ts" />)

    // Find all elements marked as removed lines
    const removedLines = document.querySelectorAll('[data-line-type="removed"]')
    expect(removedLines.length).toBeGreaterThan(0)

    // Removed lines should carry the red background class
    removedLines.forEach(el => {
      expect(el.className).toMatch(/bg-red/)
    })

    // The removed text content should be visible
    expect(screen.getByText(/-const old = 'removed line'/)).toBeInTheDocument()
  })

  test('DiffViewer highlights hunk headers', () => {
    render(<DiffViewer diff={SAMPLE_DIFF} path="foo.ts" />)

    const hunkLines = document.querySelectorAll('[data-line-type="hunk"]')
    expect(hunkLines.length).toBeGreaterThan(0)

    hunkLines.forEach(el => {
      expect(el.className).toMatch(/bg-blue/)
    })
  })

  test('DiffViewer shows "No changes" when diff is empty', () => {
    render(<DiffViewer diff="" path="empty.ts" />)
    expect(screen.getByText('No changes')).toBeInTheDocument()
  })

  test('DiffViewer shows "No changes" when diff is only whitespace', () => {
    render(<DiffViewer diff={"   \n  "} path="blank.ts" />)
    expect(screen.getByText('No changes')).toBeInTheDocument()
  })

  test('DiffViewer shows skeleton loader when loading', () => {
    render(<DiffViewer diff="" path="loading.ts" loading />)
    expect(screen.getByLabelText('Loading diff')).toBeInTheDocument()
    // Should NOT render diff content while loading
    expect(screen.queryByLabelText('Diff content')).not.toBeInTheDocument()
    // Should NOT render "No changes" while loading
    expect(screen.queryByText('No changes')).not.toBeInTheDocument()
  })

  test('DiffViewer uses monospace font class', () => {
    render(<DiffViewer diff={SAMPLE_DIFF} path="foo.ts" />)
    const pre = screen.getByLabelText('Diff content')
    expect(pre.className).toMatch(/font-mono/)
  })

  test('DiffViewer does not mark +++ lines as added', () => {
    const diffWithHeader = `--- a/file.ts\n+++ b/file.ts\n+actual addition`
    render(<DiffViewer diff={diffWithHeader} path="file.ts" />)

    const addedLines = document.querySelectorAll('[data-line-type="added"]')
    // Only the "+actual addition" line should be marked added, not "+++ b/file.ts"
    expect(addedLines.length).toBe(1)
    expect(addedLines[0].textContent).toContain('+actual addition')
  })

  test('DiffViewer does not mark --- lines as removed', () => {
    const diffWithHeader = `--- a/file.ts\n+++ b/file.ts\n-actual removal`
    render(<DiffViewer diff={diffWithHeader} path="file.ts" />)

    const removedLines = document.querySelectorAll('[data-line-type="removed"]')
    // Only the "-actual removal" line should be marked removed, not "--- a/file.ts"
    expect(removedLines.length).toBe(1)
    expect(removedLines[0].textContent).toContain('-actual removal')
  })
})
