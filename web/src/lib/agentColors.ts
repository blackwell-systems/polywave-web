// Agent color scheme - consistent across all UI components
export const AGENT_COLORS = {
  A: '#3b82f6', // blue
  B: '#22c55e', // green
  C: '#f97316', // orange
  D: '#a855f7', // purple
  E: '#ec4899', // pink
  F: '#06b6d4', // cyan
  G: '#f59e0b', // amber
  H: '#8b5cf6', // violet
  I: '#10b981', // emerald
  J: '#ef4444', // red
  K: '#6366f1', // indigo
} as const

export type AgentName = keyof typeof AGENT_COLORS

/**
 * Get the color for an agent by name
 * @param agent - Agent identifier (A-K)
 * @returns Hex color code
 */
export function getAgentColor(agent: string): string {
  const normalized = agent.toUpperCase().trim()
  return AGENT_COLORS[normalized as AgentName] || '#6b7280' // gray fallback
}

/**
 * Get opacity variant of agent color for backgrounds
 * @param agent - Agent identifier (A-K)
 * @param opacity - Opacity value (0-1)
 * @returns rgba color string
 */
export function getAgentColorWithOpacity(agent: string, opacity: number = 0.1): string {
  const color = getAgentColor(agent)
  const r = parseInt(color.slice(1, 3), 16)
  const g = parseInt(color.slice(3, 5), 16)
  const b = parseInt(color.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}
