import { IMPLDocResponse } from '../../types'
import { Card, CardContent } from '../ui/card'
import FileOwnershipTable from '../FileOwnershipTable'

interface FileOwnershipPanelProps {
  impl: IMPLDocResponse
}

export default function FileOwnershipPanel({ impl }: FileOwnershipPanelProps): JSX.Element {
  return (
    <Card>
      <CardContent className="pt-6">
        <FileOwnershipTable
          fileOwnership={impl.file_ownership}
          col4Name={impl.file_ownership_col4_name}
        />
      </CardContent>
    </Card>
  )
}
