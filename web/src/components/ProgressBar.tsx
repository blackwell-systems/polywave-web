interface ProgressBarProps {
  complete: number
  total: number
  label?: string
}

export default function ProgressBar({ complete, total, label }: ProgressBarProps) {
  const pct = total === 0 ? 0 : Math.round((complete / total) * 100)
  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm text-gray-600">{label}</span>
          <span className="text-sm text-gray-500">{complete}/{total} ({pct}%)</span>
        </div>
      )}
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div
          className="bg-blue-500 h-2.5 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
