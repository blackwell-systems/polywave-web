/**
 * statusColors.ts — Single source of truth for all status-to-color mappings.
 *
 * Centralizes color data extracted from:
 *   - StatusBadges.tsx (agentStatusConfig, waveStatusConfig, implStatusConfig)
 *   - AgentCard.tsx (getStatusStyle)
 *   - PipelineRow.tsx (hoverColors)
 *   - ProgramBoard.tsx (getImplStatusColor, PROGRAM_STATE_COLORS)
 *   - ProgramDependencyGraph.tsx (getNodeFill)
 *   - SuitabilityBadge.tsx (getBadgeClasses)
 *
 * All functions are pure — no DOM access, no side effects.
 */

export type StatusDomain = 'agent' | 'wave' | 'impl' | 'pipeline' | 'program'

// ---------------------------------------------------------------------------
// Internal data tables
// ---------------------------------------------------------------------------

interface BadgeConfig {
  label: string
  classes: string
}

const agentBadgeConfig: Record<string, BadgeConfig> = {
  pending: {
    label: 'Pending',
    classes: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700',
  },
  running: {
    label: 'Running',
    classes: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 animate-pulse',
  },
  complete: {
    label: 'Complete',
    classes: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800',
  },
  failed: {
    label: 'Failed',
    classes: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
  },
}

const waveBadgeConfig: Record<string, BadgeConfig> = {
  pending: {
    label: 'Pending',
    classes: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700',
  },
  running: {
    label: 'Running',
    classes: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 animate-pulse',
  },
  complete: {
    label: 'Complete',
    classes: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800',
  },
  partial: {
    label: 'Partial',
    classes: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
  },
  merged: {
    label: 'Merged',
    classes: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800',
  },
  failed: {
    label: 'Failed',
    classes: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
  },
}

const implBadgeConfig: Record<string, BadgeConfig> = {
  complete: {
    label: 'Complete',
    classes: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800',
  },
  executing: {
    label: 'Executing',
    classes: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 animate-pulse',
  },
  'in-progress': {
    label: 'In Progress',
    classes: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 animate-pulse',
  },
  reviewed: {
    label: 'Reviewed',
    classes: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
  },
  scouting: {
    label: 'Scouting',
    classes: 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800 animate-pulse',
  },
  blocked: {
    label: 'Blocked',
    classes: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
  },
  'not-suitable': {
    label: 'Not Suitable',
    classes: 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800',
  },
  pending: {
    label: 'Pending',
    classes: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700',
  },
}

// Fallback badge config for unknown status
const fallbackBadgeConfig: BadgeConfig = {
  label: 'Unknown',
  classes: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700',
}

// Pipeline hover classes (from PipelineRow.tsx hoverColors)
const pipelineHoverColors: Record<string, string> = {
  executing: 'hover:bg-blue-50 dark:hover:bg-blue-950/30',
  complete: 'hover:bg-green-50 dark:hover:bg-green-950/30',
  blocked: 'hover:bg-amber-50 dark:hover:bg-amber-950/30',
  queued: 'hover:bg-muted/50',
}

// Raw RGB border colors for agent card glow borders (from AgentCard.tsx getStatusStyle)
interface GlowStyle {
  borderColor: string
  boxShadow: string
}

const agentGlowStyles: Record<string, GlowStyle> = {
  running: {
    borderColor: 'rgb(88, 166, 255)',
    boxShadow: '0 0 12px rgba(88, 166, 255, 0.4), 0 0 24px rgba(88, 166, 255, 0.2)',
  },
  complete: {
    borderColor: 'rgba(63, 185, 80, 0.5)',
    boxShadow: '0 0 4px rgba(63, 185, 80, 0.12)',
  },
  failed: {
    borderColor: 'rgb(248, 81, 73)',
    boxShadow: '0 0 12px rgba(248, 81, 73, 0.5), 0 0 24px rgba(248, 81, 73, 0.25)',
  },
  pending: {
    borderColor: 'rgba(140, 140, 150, 0.4)',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3), 0 1px 3px rgba(0, 0, 0, 0.2)',
  },
}

// Raw RGB border colors for IMPL status (from ProgramBoard.tsx getImplStatusColor)
const implRgbColors: Record<string, string> = {
  complete: 'rgb(63, 185, 80)',
  executing: 'rgb(88, 166, 255)',
  'in-progress': 'rgb(88, 166, 255)',
  reviewed: 'rgb(210, 153, 34)',
  scouting: 'rgb(130, 100, 220)',
  blocked: 'rgb(248, 81, 73)',
  'not-suitable': 'rgb(248, 81, 73)',
}
const implRgbColorDefault = 'rgba(140, 140, 150, 0.4)'

// SVG node fill colors (from ProgramDependencyGraph.tsx getNodeFill)
interface NodeFillColors {
  bg: string
  border: string
  text: string
}

const nodeFillColors: Record<string, NodeFillColors> = {
  complete: { bg: '#22c55e40', border: '#22c55e80', text: '#22c55e' },
  executing: { bg: '#3b82f640', border: '#3b82f680', text: '#3b82f6' },
  blocked: { bg: '#ef444440', border: '#ef444480', text: '#ef4444' },
  reviewed: { bg: '#eab30840', border: '#eab30880', text: '#eab308' },
}
const nodeFillDefault: NodeFillColors = { bg: '#6b728020', border: '#6b728060', text: '#6b7280' }

// Program state dot colors (from ProgramBoard.tsx PROGRAM_STATE_COLORS)
const programStateDotColors: Record<string, string> = {
  COMPLETE: 'bg-green-500',
  TIER_EXECUTING: 'bg-blue-500 animate-pulse',
  REVIEWED: 'bg-yellow-400',
  SCAFFOLD: 'bg-purple-400',
  BLOCKED: 'bg-red-500',
}
const programStateDotDefault = 'bg-gray-400'

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns Tailwind badge class string for a given domain and status.
 * Falls back to a neutral gray badge for unknown statuses.
 */
export function getStatusBadgeClasses(domain: StatusDomain, status: string): string {
  switch (domain) {
    case 'agent':
      return (agentBadgeConfig[status] ?? fallbackBadgeConfig).classes
    case 'wave':
      return (waveBadgeConfig[status] ?? fallbackBadgeConfig).classes
    case 'impl':
      return (implBadgeConfig[status] ?? fallbackBadgeConfig).classes
    default:
      return fallbackBadgeConfig.classes
  }
}

/**
 * Returns Tailwind hover class string for pipeline/row hover states.
 * Falls back to 'hover:bg-muted/50' for unknown statuses.
 */
export function getStatusHoverClass(domain: StatusDomain, status: string): string {
  if (domain === 'pipeline') {
    return pipelineHoverColors[status] ?? 'hover:bg-muted/50'
  }
  return 'hover:bg-muted/50'
}

/**
 * Returns a human-readable label for a given domain and status.
 * Falls back to the raw status string for unknown values.
 */
export function getStatusLabel(domain: StatusDomain, status: string): string {
  switch (domain) {
    case 'agent':
      return (agentBadgeConfig[status] ?? { label: status }).label
    case 'wave':
      return (waveBadgeConfig[status] ?? { label: status }).label
    case 'impl':
      return (implBadgeConfig[status] ?? { label: status }).label
    default:
      return status
  }
}

/**
 * Returns raw RGB border color string for inline styles.
 * Currently supports 'agent' and 'impl' domains.
 * Falls back to a neutral gray for unknown statuses.
 */
export function getStatusBorderColor(domain: StatusDomain, status: string): string {
  if (domain === 'agent') {
    return agentGlowStyles[status]?.borderColor ?? agentGlowStyles.pending.borderColor
  }
  if (domain === 'impl') {
    return implRgbColors[status] ?? implRgbColorDefault
  }
  return 'rgba(140, 140, 150, 0.4)'
}

/**
 * Returns the full glow style object (borderColor + boxShadow) for agent card borders.
 * Falls back to the 'pending' style for unknown statuses.
 */
export function getStatusGlowStyle(domain: StatusDomain, status: string): GlowStyle {
  if (domain === 'agent') {
    return agentGlowStyles[status] ?? agentGlowStyles.pending
  }
  // Other domains don't have glow styles; return a neutral fallback
  return {
    borderColor: 'rgba(140, 140, 150, 0.4)',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3), 0 1px 3px rgba(0, 0, 0, 0.2)',
  }
}

/**
 * Returns SVG node fill colors for ProgramDependencyGraph nodes.
 * Returns an object with bg, border, and text hex color strings.
 * Falls back to a neutral gray palette for unknown statuses.
 */
export function getNodeFillColors(status: string): NodeFillColors {
  return nodeFillColors[status] ?? nodeFillDefault
}

/**
 * Returns Tailwind dot class for program state indicators (ProgramCard).
 * Falls back to 'bg-gray-400' for unknown states.
 */
export function getProgramStateDotClass(state: string): string {
  return programStateDotColors[state] ?? programStateDotDefault
}

/**
 * Returns Tailwind badge classes for suitability verdict badges (SuitabilityBadge).
 * Falls back to a neutral gray for unknown verdicts.
 */
export function getSuitabilityBadgeClasses(verdict: string): string {
  switch (verdict) {
    case 'SUITABLE':
      return 'bg-green-100 text-green-800'
    case 'NOT SUITABLE':
      return 'bg-red-100 text-red-800'
    case 'SUITABLE WITH CAVEATS':
      return 'bg-yellow-100 text-yellow-800'
    default:
      return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100'
  }
}
