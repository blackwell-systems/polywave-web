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
      <Button onClick={onApprove} className="bg-green-600 hover:bg-green-700 text-white">
        Approve
      </Button>
      <Button onClick={handleRequestChanges} className="bg-yellow-400 hover:bg-yellow-500 text-yellow-900">
        Request Changes
      </Button>
      <Button onClick={onReject} variant="destructive">
        Reject
      </Button>
    </div>
  )
}
