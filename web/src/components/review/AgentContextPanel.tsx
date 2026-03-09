import AgentPromptsPanel from './AgentPromptsPanel'
import { IMPLDocResponse } from '../../types'

interface AgentContextPanelProps {
  slug: string
  impl: IMPLDocResponse
}

/**
 * AgentContextPanel passes slug to AgentPromptsPanel so "View Full Context" buttons
 * appear nested inside each agent's prompt card.
 *
 * Usage in ReviewScreen:
 *   import AgentContextPanel from './review/AgentContextPanel'
 *   // replace: <AgentPromptsPanel agentPrompts={(impl as any).agent_prompts} />
 *   // with:    <AgentContextPanel slug={slug} impl={impl} />
 */
export default function AgentContextPanel({ slug, impl }: AgentContextPanelProps): JSX.Element {
  const agentPrompts = (impl as any).agent_prompts as Array<{ wave: number; agent: string; prompt: string }> | undefined

  return <AgentPromptsPanel agentPrompts={agentPrompts} slug={slug} />
}
