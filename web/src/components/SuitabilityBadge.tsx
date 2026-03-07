import { SuitabilityInfo } from '../types'

interface SuitabilityBadgeProps {
  suitability: SuitabilityInfo
}

function getBadgeClasses(verdict: string): string {
  switch (verdict) {
    case 'SUITABLE':
      return 'bg-green-100 text-green-800'
    case 'NOT SUITABLE':
      return 'bg-red-100 text-red-800'
    case 'SUITABLE WITH CAVEATS':
      return 'bg-yellow-100 text-yellow-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

export default function SuitabilityBadge({ suitability }: SuitabilityBadgeProps): JSX.Element {
  const badgeClasses = getBadgeClasses(suitability.verdict)

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
        <p className="mt-2 text-sm text-gray-600">{suitability.rationale}</p>
      )}
    </div>
  )
}
