interface ActionButtonsProps {
  onApprove: () => void
  onReject: () => void
  onRequestChanges: () => void
}

const base = "flex items-center justify-center text-sm font-medium px-6 h-14 transition-all duration-150 border-t-2"

export default function ActionButtons({ onApprove, onReject, onRequestChanges }: ActionButtonsProps): JSX.Element {
  return (
    <div className="flex items-stretch">
      <button onClick={onApprove} className={`${base} border-t-green-500 text-green-700 dark:text-green-400 hover:bg-green-500/10`}>
        Approve
      </button>
      <button onClick={onRequestChanges} className={`${base} border-t-amber-500 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10`}>
        Request Changes
      </button>
      <button onClick={onReject} className={`${base} border-t-red-500 text-red-700 dark:text-red-400 hover:bg-red-500/10`}>
        Reject
      </button>
    </div>
  )
}
