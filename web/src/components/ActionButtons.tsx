import { Button } from './ui/button'

interface ActionButtonsProps {
  onApprove: () => void
  onReject: () => void
}

export default function ActionButtons({ onApprove, onReject }: ActionButtonsProps): JSX.Element {
  function handleRequestChanges() {
    alert('Edit the IMPL doc in your text editor and reload')
  }

  return (
    <div className="flex items-center gap-3 pt-4 border-t">
      <Button onClick={onApprove} className="bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 dark:bg-green-950 dark:hover:bg-green-900 dark:text-green-400 dark:border-green-800">
        Approve
      </Button>
      <Button onClick={handleRequestChanges} className="bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-950 dark:hover:bg-amber-900 dark:text-amber-400 dark:border-amber-800">
        Request Changes
      </Button>
      <Button onClick={onReject} className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 dark:bg-red-950 dark:hover:bg-red-900 dark:text-red-400 dark:border-red-800">
        Reject
      </Button>
    </div>
  )
}
