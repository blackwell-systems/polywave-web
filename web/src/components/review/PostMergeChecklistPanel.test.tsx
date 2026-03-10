import { render, screen } from '@testing-library/react'
import PostMergeChecklistPanel from './PostMergeChecklistPanel'

test('parses and renders typed YAML block', () => {
  const input = `\`\`\`yaml type=impl-post-merge-checklist
groups:
  - title: "Build Verification"
    items:
      - description: "Full build passes"
        command: "go build ./..."
  - title: "Integration Tests"
    items:
      - description: "End-to-end tests pass"
        command: "npm run test:e2e"
\`\`\``

  render(<PostMergeChecklistPanel checklistText={input} />)
  expect(screen.getByText(/Build Verification/)).toBeInTheDocument()
  expect(screen.getByText(/Full build passes/)).toBeInTheDocument()
  expect(screen.getByText(/go build/)).toBeInTheDocument()
  expect(screen.getByText(/Integration Tests/)).toBeInTheDocument()
  expect(screen.getByText(/End-to-end tests pass/)).toBeInTheDocument()
})

test('renders groups without commands', () => {
  const input = `\`\`\`yaml type=impl-post-merge-checklist
groups:
  - title: "Manual Checks"
    items:
      - description: "Review UI changes"
      - description: "Test error handling"
\`\`\``

  render(<PostMergeChecklistPanel checklistText={input} />)
  expect(screen.getByText(/Manual Checks/)).toBeInTheDocument()
  expect(screen.getByText(/Review UI changes/)).toBeInTheDocument()
  expect(screen.getByText(/Test error handling/)).toBeInTheDocument()
})

test('handles empty checklist', () => {
  render(<PostMergeChecklistPanel checklistText="" />)
  expect(screen.getByText(/No checklist defined/)).toBeInTheDocument()
})

test('handles invalid YAML', () => {
  const input = `\`\`\`yaml type=impl-post-merge-checklist
invalid: [yaml: syntax
\`\`\``

  render(<PostMergeChecklistPanel checklistText={input} />)
  expect(screen.getByText(/Invalid checklist format/)).toBeInTheDocument()
})
