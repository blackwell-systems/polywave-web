import { useState, useEffect, useCallback } from 'react'
import { WorktreeEntry } from '../types'
import { listWorktrees, deleteWorktree, batchDeleteWorktrees } from '../api'

export function useWorktrees(slug: string) {
  const [worktrees, setWorktrees] = useState<WorktreeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    setLoading(true)
    setError(null)
    listWorktrees(slug)
      .then((res) => {
        setWorktrees(res.worktrees ?? [])
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        setLoading(false)
      })
  }, [slug])

  useEffect(() => {
    refresh()
  }, [refresh])

  const deleteBranches = useCallback(
    async (branches: string[], force: boolean) => {
      try {
        await batchDeleteWorktrees(slug, { branches, force })
        setError(null)
        refresh()
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        setError(`Failed to delete branches: ${message}`)
        throw err // Re-throw so component knows it failed
      }
    },
    [slug, refresh],
  )

  const deleteSingle = useCallback(
    async (branch: string) => {
      try {
        await deleteWorktree(slug, branch)
        setError(null)
        refresh()
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        setError(`Failed to delete ${branch}: ${message}`)
        throw err // Re-throw so component knows it failed
      }
    },
    [slug, refresh],
  )

  return { worktrees, loading, error, refresh, deleteBranches, deleteSingle }
}
