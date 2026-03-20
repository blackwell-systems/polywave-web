import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Tooltip component for inline concept explanations.
 * Displays contextual help text on hover over wrapped children.
 *
 * Pure CSS positioning with minimal React state for visibility toggle.
 * No external tooltip libraries. Dark mode aware via Tailwind classes.
 */

export interface TooltipProps {
  /** Element to wrap (triggers tooltip on hover) */
  children: React.ReactNode
  /** Tooltip content (text or JSX) */
  content: string | React.ReactNode
  /** Tooltip position relative to children. Default: 'top' */
  position?: 'top' | 'bottom' | 'left' | 'right'
  /** Max width in pixels. Default: 300 */
  maxWidth?: number
}

const positionClasses: Record<string, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
}

const arrowClasses: Record<string, string> = {
  top: 'top-full left-1/2 -translate-x-1/2 border-t-[var(--tooltip-bg,#1f2937)] border-x-transparent border-b-transparent',
  bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-[var(--tooltip-bg,#1f2937)] border-x-transparent border-t-transparent',
  left: 'left-full top-1/2 -translate-y-1/2 border-l-[var(--tooltip-bg,#1f2937)] border-y-transparent border-r-transparent',
  right: 'right-full top-1/2 -translate-y-1/2 border-r-[var(--tooltip-bg,#1f2937)] border-y-transparent border-l-transparent',
}

export function Tooltip({
  children,
  content,
  position = 'top',
  maxWidth = 300,
}: TooltipProps): JSX.Element {
  const [visible, setVisible] = React.useState(false)

  const ariaLabel = typeof content === 'string' ? content : undefined

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
      aria-label={ariaLabel}
    >
      {children}
      <span
        role="tooltip"
        className={cn(
          'absolute z-50 pointer-events-none',
          'rounded px-2 py-1 text-xs leading-snug',
          'bg-[var(--tooltip-bg,#1f2937)] text-[var(--tooltip-text,#f9fafb)]',
          'shadow-md',
          'transition-opacity duration-200',
          visible ? 'opacity-100' : 'opacity-0',
          positionClasses[position],
        )}
        style={{ maxWidth }}
      >
        {content}
        {/* Arrow */}
        <span
          className={cn(
            'absolute w-0 h-0 border-4',
            arrowClasses[position],
          )}
        />
      </span>
    </span>
  )
}
