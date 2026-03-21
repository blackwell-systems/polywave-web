import { getStatusBadgeClasses, getStatusLabel, StatusDomain } from '../../lib/statusColors'

export interface StatusBadgeProps {
  status: string
  size?: 'sm' | 'md'
  className?: string
}

const sizeClasses = {
  sm: 'text-[10px] px-1.5 py-0.5',
  md: 'text-xs px-2 py-0.5',
}

/**
 * Returns a display label, falling back to 'Pending' for unknown statuses.
 * Matches original badge behavior where unknown statuses showed the pending config label.
 */
function resolveLabel(domain: StatusDomain, status: string): string {
  const label = getStatusLabel(domain, status)
  // getStatusLabel returns the raw status string for unknown values;
  // in that case we fall back to 'Pending' to match the original behavior.
  return label === status ? 'Pending' : label
}

// ---- Agent Status Badge ----

export function AgentStatusBadge({ status, size = 'md', className = '' }: StatusBadgeProps): JSX.Element {
  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${sizeClasses[size]} ${getStatusBadgeClasses('agent', status)} ${className}`}
      data-testid={`agent-status-badge-${status}`}
    >
      {resolveLabel('agent', status)}
    </span>
  )
}

// ---- Wave Status Badge ----

export function WaveStatusBadge({ status, size = 'md', className = '' }: StatusBadgeProps): JSX.Element {
  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${sizeClasses[size]} ${getStatusBadgeClasses('wave', status)} ${className}`}
      data-testid={`wave-status-badge-${status}`}
    >
      {resolveLabel('wave', status)}
    </span>
  )
}

// ---- IMPL Status Badge ----

export function ImplStatusBadge({ status, size = 'md', className = '' }: StatusBadgeProps): JSX.Element {
  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${sizeClasses[size]} ${getStatusBadgeClasses('impl', status)} ${className}`}
      data-testid={`impl-status-badge-${status}`}
    >
      {resolveLabel('impl', status)}
    </span>
  )
}
