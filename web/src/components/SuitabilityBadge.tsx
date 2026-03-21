import { SuitabilityInfo } from '../types'
import { getSuitabilityBadgeClasses } from '../lib/statusColors'

interface SuitabilityBadgeProps {
  suitability: SuitabilityInfo
}

export default function SuitabilityBadge({ suitability }: SuitabilityBadgeProps): JSX.Element {
  const badgeClasses = getSuitabilityBadgeClasses(suitability.verdict)

  return (
    <div className="mb-6">
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold ${badgeClasses}`}
        >
          {suitability.verdict}
        </span>
      </div>
      {suitability.rationale && (
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{suitability.rationale}</p>
      )}
    </div>
  )
}
