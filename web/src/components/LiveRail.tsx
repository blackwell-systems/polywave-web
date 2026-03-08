// LiveRail — right-rail live execution panel
// Stub created by Scaffold Agent. Full implementation by Wave 1 Agent D.

export type LiveView = null | 'scout' | 'wave'

export interface LiveRailProps {
  slug: string | null
  liveView: LiveView
  widthPx: number
  onScoutComplete: (slug: string) => void
  onClose: () => void
}

export default function LiveRail(_props: LiveRailProps): JSX.Element {
  return <div />
}
