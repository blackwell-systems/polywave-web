import { describe, it, expect } from 'vitest'
import {
  getStatusBadgeClasses,
  getStatusHoverClass,
  getStatusLabel,
  getStatusBorderColor,
  getStatusGlowStyle,
  getNodeFillColors,
  getProgramStateDotClass,
  getSuitabilityBadgeClasses,
} from './statusColors'

// ---------------------------------------------------------------------------
// getStatusBadgeClasses
// ---------------------------------------------------------------------------

describe('getStatusBadgeClasses', () => {
  it('returns agent pending classes', () => {
    const cls = getStatusBadgeClasses('agent', 'pending')
    expect(cls).toContain('bg-gray-100')
    expect(cls).toContain('text-gray-600')
  })

  it('returns agent running classes with animate-pulse', () => {
    const cls = getStatusBadgeClasses('agent', 'running')
    expect(cls).toContain('bg-blue-100')
    expect(cls).toContain('animate-pulse')
  })

  it('returns agent complete classes', () => {
    const cls = getStatusBadgeClasses('agent', 'complete')
    expect(cls).toContain('bg-green-100')
  })

  it('returns agent failed classes', () => {
    const cls = getStatusBadgeClasses('agent', 'failed')
    expect(cls).toContain('bg-red-100')
  })

  it('returns fallback for unknown agent status', () => {
    const cls = getStatusBadgeClasses('agent', 'unknown-xyz')
    expect(cls).toContain('bg-gray-100')
  })

  it('returns wave pending classes', () => {
    const cls = getStatusBadgeClasses('wave', 'pending')
    expect(cls).toContain('bg-gray-100')
  })

  it('returns wave partial classes', () => {
    const cls = getStatusBadgeClasses('wave', 'partial')
    expect(cls).toContain('bg-yellow-100')
  })

  it('returns wave merged classes (same as complete)', () => {
    const cls = getStatusBadgeClasses('wave', 'merged')
    expect(cls).toContain('bg-green-100')
  })

  it('returns fallback for unknown wave status', () => {
    const cls = getStatusBadgeClasses('wave', 'unknown-xyz')
    expect(cls).toContain('bg-gray-100')
  })

  it('returns impl complete classes', () => {
    const cls = getStatusBadgeClasses('impl', 'complete')
    expect(cls).toContain('bg-green-100')
  })

  it('returns impl executing classes with animate-pulse', () => {
    const cls = getStatusBadgeClasses('impl', 'executing')
    expect(cls).toContain('bg-blue-100')
    expect(cls).toContain('animate-pulse')
  })

  it('returns impl in-progress classes with animate-pulse', () => {
    const cls = getStatusBadgeClasses('impl', 'in-progress')
    expect(cls).toContain('animate-pulse')
  })

  it('returns impl scouting classes', () => {
    const cls = getStatusBadgeClasses('impl', 'scouting')
    expect(cls).toContain('bg-purple-100')
    expect(cls).toContain('animate-pulse')
  })

  it('returns impl blocked classes', () => {
    const cls = getStatusBadgeClasses('impl', 'blocked')
    expect(cls).toContain('bg-red-100')
  })

  it('returns impl not-suitable classes', () => {
    const cls = getStatusBadgeClasses('impl', 'not-suitable')
    expect(cls).toContain('bg-red-100')
  })

  it('returns fallback for unknown impl status', () => {
    const cls = getStatusBadgeClasses('impl', 'unknown-xyz')
    expect(cls).toContain('bg-gray-100')
  })

  it('returns fallback for unhandled domain', () => {
    // 'pipeline' and 'program' don't have badge configs
    const cls = getStatusBadgeClasses('pipeline', 'executing')
    expect(cls).toContain('bg-gray-100')
  })
})

// ---------------------------------------------------------------------------
// getStatusHoverClass
// ---------------------------------------------------------------------------

describe('getStatusHoverClass', () => {
  it('returns blue hover class for pipeline executing', () => {
    const cls = getStatusHoverClass('pipeline', 'executing')
    expect(cls).toContain('hover:bg-blue-50')
  })

  it('returns green hover class for pipeline complete', () => {
    const cls = getStatusHoverClass('pipeline', 'complete')
    expect(cls).toContain('hover:bg-green-50')
  })

  it('returns amber hover class for pipeline blocked', () => {
    const cls = getStatusHoverClass('pipeline', 'blocked')
    expect(cls).toContain('hover:bg-amber-50')
  })

  it('returns queued hover class for pipeline queued', () => {
    const cls = getStatusHoverClass('pipeline', 'queued')
    expect(cls).toContain('hover:bg-muted')
  })

  it('returns fallback hover class for unknown pipeline status', () => {
    const cls = getStatusHoverClass('pipeline', 'unknown-xyz')
    expect(cls).toBe('hover:bg-muted/50')
  })

  it('returns fallback hover class for non-pipeline domain', () => {
    const cls = getStatusHoverClass('agent', 'running')
    expect(cls).toBe('hover:bg-muted/50')
  })
})

// ---------------------------------------------------------------------------
// getStatusLabel
// ---------------------------------------------------------------------------

describe('getStatusLabel', () => {
  it('returns "Pending" for agent pending', () => {
    expect(getStatusLabel('agent', 'pending')).toBe('Pending')
  })

  it('returns "Running" for agent running', () => {
    expect(getStatusLabel('agent', 'running')).toBe('Running')
  })

  it('returns "Complete" for agent complete', () => {
    expect(getStatusLabel('agent', 'complete')).toBe('Complete')
  })

  it('returns "Failed" for agent failed', () => {
    expect(getStatusLabel('agent', 'failed')).toBe('Failed')
  })

  it('returns raw status string for unknown agent status', () => {
    expect(getStatusLabel('agent', 'mystery')).toBe('mystery')
  })

  it('returns "Partial" for wave partial', () => {
    expect(getStatusLabel('wave', 'partial')).toBe('Partial')
  })

  it('returns "Merged" for wave merged', () => {
    expect(getStatusLabel('wave', 'merged')).toBe('Merged')
  })

  it('returns "In Progress" for impl in-progress', () => {
    expect(getStatusLabel('impl', 'in-progress')).toBe('In Progress')
  })

  it('returns "Scouting" for impl scouting', () => {
    expect(getStatusLabel('impl', 'scouting')).toBe('Scouting')
  })

  it('returns "Not Suitable" for impl not-suitable', () => {
    expect(getStatusLabel('impl', 'not-suitable')).toBe('Not Suitable')
  })

  it('returns raw status string for unknown impl status', () => {
    expect(getStatusLabel('impl', 'mystery')).toBe('mystery')
  })

  it('returns raw status string for unhandled domain', () => {
    expect(getStatusLabel('pipeline', 'executing')).toBe('executing')
  })
})

// ---------------------------------------------------------------------------
// getStatusBorderColor
// ---------------------------------------------------------------------------

describe('getStatusBorderColor', () => {
  it('returns blue RGB for agent running', () => {
    const color = getStatusBorderColor('agent', 'running')
    expect(color).toContain('88, 166, 255')
  })

  it('returns green RGBA for agent complete', () => {
    const color = getStatusBorderColor('agent', 'complete')
    expect(color).toContain('63, 185, 80')
  })

  it('returns red RGB for agent failed', () => {
    const color = getStatusBorderColor('agent', 'failed')
    expect(color).toContain('248, 81, 73')
  })

  it('returns neutral fallback for unknown agent status', () => {
    const color = getStatusBorderColor('agent', 'unknown-xyz')
    expect(color).toContain('140, 140, 150')
  })

  it('returns green RGB for impl complete', () => {
    const color = getStatusBorderColor('impl', 'complete')
    expect(color).toBe('rgb(63, 185, 80)')
  })

  it('returns blue RGB for impl executing', () => {
    const color = getStatusBorderColor('impl', 'executing')
    expect(color).toBe('rgb(88, 166, 255)')
  })

  it('returns same blue RGB for impl in-progress as executing', () => {
    expect(getStatusBorderColor('impl', 'in-progress')).toBe(
      getStatusBorderColor('impl', 'executing')
    )
  })

  it('returns red RGB for impl blocked', () => {
    const color = getStatusBorderColor('impl', 'blocked')
    expect(color).toBe('rgb(248, 81, 73)')
  })

  it('returns neutral fallback for unknown impl status', () => {
    const color = getStatusBorderColor('impl', 'unknown-xyz')
    expect(color).toContain('140, 140, 150')
  })

  it('returns neutral fallback for unhandled domain', () => {
    const color = getStatusBorderColor('wave', 'complete')
    expect(color).toContain('140, 140, 150')
  })
})

// ---------------------------------------------------------------------------
// getStatusGlowStyle
// ---------------------------------------------------------------------------

describe('getStatusGlowStyle', () => {
  it('returns object with borderColor and boxShadow keys', () => {
    const style = getStatusGlowStyle('agent', 'running')
    expect(style).toHaveProperty('borderColor')
    expect(style).toHaveProperty('boxShadow')
  })

  it('returns blue glow for agent running', () => {
    const style = getStatusGlowStyle('agent', 'running')
    expect(style.borderColor).toContain('88, 166, 255')
    expect(style.boxShadow).toContain('88, 166, 255')
  })

  it('returns green glow for agent complete', () => {
    const style = getStatusGlowStyle('agent', 'complete')
    expect(style.borderColor).toContain('63, 185, 80')
  })

  it('returns red glow for agent failed', () => {
    const style = getStatusGlowStyle('agent', 'failed')
    expect(style.borderColor).toContain('248, 81, 73')
    expect(style.boxShadow).toContain('248, 81, 73')
  })

  it('returns neutral fallback for unknown agent status', () => {
    const style = getStatusGlowStyle('agent', 'unknown-xyz')
    expect(style.borderColor).toContain('140, 140, 150')
  })

  it('returns neutral fallback for non-agent domain', () => {
    const style = getStatusGlowStyle('impl', 'complete')
    expect(style).toHaveProperty('borderColor')
    expect(style).toHaveProperty('boxShadow')
  })
})

// ---------------------------------------------------------------------------
// getNodeFillColors
// ---------------------------------------------------------------------------

describe('getNodeFillColors', () => {
  it('returns object with bg, border, text keys for known status', () => {
    const fill = getNodeFillColors('complete')
    expect(fill).toHaveProperty('bg')
    expect(fill).toHaveProperty('border')
    expect(fill).toHaveProperty('text')
  })

  it('returns green colors for complete', () => {
    const fill = getNodeFillColors('complete')
    expect(fill.bg).toContain('22c55e')
    expect(fill.border).toContain('22c55e')
    expect(fill.text).toContain('22c55e')
  })

  it('returns blue colors for executing', () => {
    const fill = getNodeFillColors('executing')
    expect(fill.bg).toContain('3b82f6')
  })

  it('returns red colors for blocked', () => {
    const fill = getNodeFillColors('blocked')
    expect(fill.bg).toContain('ef4444')
  })

  it('returns yellow colors for reviewed', () => {
    const fill = getNodeFillColors('reviewed')
    expect(fill.bg).toContain('eab308')
  })

  it('returns neutral gray fallback for unknown status', () => {
    const fill = getNodeFillColors('unknown-xyz')
    expect(fill).toHaveProperty('bg')
    expect(fill).toHaveProperty('border')
    expect(fill).toHaveProperty('text')
    expect(fill.bg).toContain('6b7280')
  })

  it('returns fallback object with bg, border, text keys for unknown status', () => {
    const fill = getNodeFillColors('pending')
    expect(fill).toHaveProperty('bg')
    expect(fill).toHaveProperty('border')
    expect(fill).toHaveProperty('text')
  })
})

// ---------------------------------------------------------------------------
// getProgramStateDotClass
// ---------------------------------------------------------------------------

describe('getProgramStateDotClass', () => {
  it('returns green dot for COMPLETE', () => {
    expect(getProgramStateDotClass('COMPLETE')).toBe('bg-green-500')
  })

  it('returns blue animated dot for TIER_EXECUTING', () => {
    const cls = getProgramStateDotClass('TIER_EXECUTING')
    expect(cls).toContain('bg-blue-500')
    expect(cls).toContain('animate-pulse')
  })

  it('returns yellow dot for REVIEWED', () => {
    expect(getProgramStateDotClass('REVIEWED')).toBe('bg-yellow-400')
  })

  it('returns purple dot for SCAFFOLD', () => {
    expect(getProgramStateDotClass('SCAFFOLD')).toBe('bg-purple-400')
  })

  it('returns red dot for BLOCKED', () => {
    expect(getProgramStateDotClass('BLOCKED')).toBe('bg-red-500')
  })

  it('returns gray fallback for unknown state', () => {
    expect(getProgramStateDotClass('unknown-xyz')).toBe('bg-gray-400')
  })
})

// ---------------------------------------------------------------------------
// getSuitabilityBadgeClasses
// ---------------------------------------------------------------------------

describe('getSuitabilityBadgeClasses', () => {
  it('returns green classes for SUITABLE', () => {
    const cls = getSuitabilityBadgeClasses('SUITABLE')
    expect(cls).toContain('bg-green-100')
    expect(cls).toContain('text-green-800')
  })

  it('returns red classes for NOT SUITABLE', () => {
    const cls = getSuitabilityBadgeClasses('NOT SUITABLE')
    expect(cls).toContain('bg-red-100')
    expect(cls).toContain('text-red-800')
  })

  it('returns yellow classes for SUITABLE WITH CAVEATS', () => {
    const cls = getSuitabilityBadgeClasses('SUITABLE WITH CAVEATS')
    expect(cls).toContain('bg-yellow-100')
    expect(cls).toContain('text-yellow-800')
  })

  it('returns gray fallback for unknown verdict', () => {
    const cls = getSuitabilityBadgeClasses('unknown-xyz')
    expect(cls).toContain('bg-gray-100')
  })
})
