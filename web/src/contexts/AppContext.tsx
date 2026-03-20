import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { listImpls, getConfig, saveConfig, fetchInterruptedSessions } from '../api'
import { listPrograms } from '../programApi'
import { useGlobalEvents } from '../hooks/useGlobalEvents'
import type { IMPLListEntry, RepoEntry } from '../types'
import type { ProgramDiscovery } from '../types/program'

export interface AppContextValue {
  repos: RepoEntry[]
  activeRepo: RepoEntry | null
  activeRepoIndex: number
  setActiveRepoIndex: (index: number) => void
  setRepos: (repos: RepoEntry[]) => void
  entries: IMPLListEntry[]
  refreshEntries: () => Promise<void>
  models: {
    scout: string; scaffold: string; wave: string
    integration: string; chat: string; planner: string
  }
  saveModel: (field: string, value: string) => Promise<void>
  sseConnected: boolean
  programs: ProgramDiscovery[]
  refreshPrograms: () => Promise<void>
}

const defaultModels = {
  scout: 'claude-sonnet-4-6',
  scaffold: 'claude-sonnet-4-6',
  wave: 'claude-sonnet-4-6',
  integration: 'claude-sonnet-4-6',
  chat: 'claude-sonnet-4-6',
  planner: 'claude-sonnet-4-6',
}

const defaultValue: AppContextValue = {
  repos: [],
  activeRepo: null,
  activeRepoIndex: 0,
  setActiveRepoIndex: () => {},
  setRepos: () => {},
  entries: [],
  refreshEntries: async () => {},
  models: { ...defaultModels },
  saveModel: async () => {},
  sseConnected: false,
  programs: [],
  refreshPrograms: async () => {},
}

export const AppContext = createContext<AppContextValue>(defaultValue)

export function useAppContext(): AppContextValue {
  return useContext(AppContext)
}

export function AppProvider({ children }: { children: ReactNode }): JSX.Element {
  const [repos, setRepos] = useState<RepoEntry[]>([])
  const [activeRepoIndex, setActiveRepoIndex] = useState<number>(0)
  const activeRepo: RepoEntry | null = repos[activeRepoIndex] ?? null

  const [entries, setEntries] = useState<IMPLListEntry[]>([])
  const [sseConnected, setSseConnected] = useState(false)
  const [programs, setPrograms] = useState<ProgramDiscovery[]>([])

  const [scoutModel, setScoutModel] = useState<string>(defaultModels.scout)
  const [scaffoldModel, setScaffoldModel] = useState<string>(defaultModels.scaffold)
  const [waveModel, setWaveModel] = useState<string>(defaultModels.wave)
  const [integrationModel, setIntegrationModel] = useState<string>(defaultModels.integration)
  const [chatModel, setChatModel] = useState<string>(defaultModels.chat)
  const [plannerModel, setPlannerModel] = useState<string>(defaultModels.planner)

  // SSE subscription: keep IMPL list in sync with external changes
  const handleImplListUpdated = useCallback(() => {
    setSseConnected(true)
    listImpls().then(setEntries).catch(() => {})
    fetchInterruptedSessions().catch(() => {})
  }, [])
  useGlobalEvents({ impl_list_updated: handleImplListUpdated })

  // Initial data fetch
  useEffect(() => {
    listImpls().then(setEntries).catch(() => {})
    listPrograms().then(setPrograms).catch(() => {})
    getConfig().then(config => {
      if (config.repos && config.repos.length > 0) {
        setRepos(config.repos)
      } else if (config.repo?.path) {
        setRepos([{ name: 'repo', path: config.repo.path }])
      }
      setScoutModel(config.agent?.scout_model || defaultModels.scout)
      setScaffoldModel(config.agent?.scaffold_model || defaultModels.scaffold)
      setWaveModel(config.agent?.wave_model || defaultModels.wave)
      setIntegrationModel(config.agent?.integration_model || defaultModels.integration)
      setChatModel(config.agent?.chat_model || defaultModels.chat)
      setPlannerModel(config.agent?.planner_model || defaultModels.planner)
    }).catch(() => {})
  }, [])

  // Refetch IMPL list when repos change
  useEffect(() => {
    if (repos.length > 0) {
      listImpls().then(setEntries).catch(() => {})
    }
  }, [repos])

  const refreshEntries = useCallback(async () => {
    const updated = await listImpls()
    setEntries(updated)
  }, [])

  const refreshPrograms = useCallback(async () => {
    const updated = await listPrograms()
    setPrograms(updated)
  }, [])

  const handleSaveModel = useCallback(async (field: string, value: string) => {
    try {
      const cfg = await getConfig()
      const updated = {
        ...cfg,
        agent: {
          ...cfg.agent,
          ...(field === 'scout' && { scout_model: value }),
          ...(field === 'scaffold' && { scaffold_model: value }),
          ...(field === 'wave' && { wave_model: value }),
          ...(field === 'integration' && { integration_model: value }),
          ...(field === 'chat' && { chat_model: value }),
          ...(field === 'planner' && { planner_model: value }),
          ...(field === 'all' && {
            scout_model: value, scaffold_model: value, wave_model: value,
            integration_model: value, chat_model: value, planner_model: value,
          }),
        },
      }
      await saveConfig(updated)
      if (field === 'scout' || field === 'all') setScoutModel(value)
      if (field === 'scaffold' || field === 'all') setScaffoldModel(value)
      if (field === 'wave' || field === 'all') setWaveModel(value)
      if (field === 'integration' || field === 'all') setIntegrationModel(value)
      if (field === 'chat' || field === 'all') setChatModel(value)
      if (field === 'planner' || field === 'all') setPlannerModel(value)
    } catch { /* ignore */ }
  }, [])

  const value: AppContextValue = {
    repos,
    activeRepo,
    activeRepoIndex,
    setActiveRepoIndex,
    setRepos,
    entries,
    refreshEntries,
    models: {
      scout: scoutModel,
      scaffold: scaffoldModel,
      wave: waveModel,
      integration: integrationModel,
      chat: chatModel,
      planner: plannerModel,
    },
    saveModel: handleSaveModel,
    sseConnected,
    programs,
    refreshPrograms,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
