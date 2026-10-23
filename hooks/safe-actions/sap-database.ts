import { useEffect } from 'react'
import { useAction } from 'next-safe-action/hooks'

import { getActiveSapDatabasesClient, getSapDatabasesClient } from '@/actions/sap-database'

//* databases the current user's role may pick
export function useSapDatabases(dependencies?: any[]) {
  const { execute, executeAsync, isExecuting: isLoading, result } = useAction(getSapDatabasesClient)

  useEffect(() => {
    execute()
  }, [...(dependencies || [])])

  return {
    execute,
    executeAsync,
    isLoading,
    data: result.data ?? [],
    error: { serverError: result.serverError, validationError: result.validationErrors }
  }
}

export function useActiveSapDatabases(dependencies?: any[]) {
  const { execute, executeAsync, isExecuting, isIdle, result } = useAction(getActiveSapDatabasesClient)

  useEffect(() => {
    execute()
  }, [...(dependencies || [])])

  return {
    execute,
    executeAsync,
    isLoading: isIdle || isExecuting, //* idle counts too, the first render comes before the fetch starts
    data: result.data ?? [],
    error: { serverError: result.serverError, validationError: result.validationErrors }
  }
}
