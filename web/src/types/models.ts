// ModelRole is the single source of truth for all agent model role identifiers.
// Adding a new role requires updating this type, MODEL_ROLES, and defaultModels.
export type ModelRole = 'scout' | 'critic' | 'scaffold' | 'wave' | 'integration' | 'chat' | 'planner'

// MODEL_ROLES is the ordered array of all roles, used for iteration in UI components
// such as AppHeader. Replaces the local ROLES constant in AppHeader.tsx.
export const MODEL_ROLES: ModelRole[] = ['planner', 'scout', 'critic', 'scaffold', 'wave', 'integration', 'chat']

// defaultModels provides the default model string for each role.
// Used as initial state in AppContext and as fallback values.
export const defaultModels: Record<ModelRole, string> = {
  scout: 'claude-sonnet-4-6',
  critic: 'claude-sonnet-4-6',
  scaffold: 'claude-sonnet-4-6',
  wave: 'claude-sonnet-4-6',
  integration: 'claude-sonnet-4-6',
  chat: 'claude-sonnet-4-6',
  planner: 'claude-sonnet-4-6',
}
