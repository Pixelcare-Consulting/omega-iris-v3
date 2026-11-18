import { useEffect } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { getDataTableContainersSvrClient } from '@/actions/container'
import { getActiveLocationsClient } from '@/actions/location'
import { getActivePalletsClient } from '@/actions/pallet'
import { DataTableParams } from '@/schema/data-table'
import { SafeActionHook } from '@/types/safe-action'

export function useActiveLocations(dependencies?: any[]) {
  const { execute, executeAsync, isExecuting: isLoading, result } = useAction(getActiveLocationsClient)

  //* loads the live active locations once
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

export function useActivePallets(dependencies?: any[]) {
  const { execute, executeAsync, isExecuting: isLoading, result } = useAction(getActivePalletsClient)

  //* loads the live active pallets once
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

export function useDataTableContainersSvr(params: DataTableParams, hook: SafeActionHook, dependencies?: any[]) {
  const { execute, executeAsync, isExecuting: isLoading, result } = useAction(getDataTableContainersSvrClient)

  //* refetches when paging, sorting or filters change
  useEffect(() => {
    execute(params)
  }, [
    params.page,
    params.perPage,
    params?.globalFilter,
    JSON.stringify(params?.sorting),
    JSON.stringify(params?.columnFilters),
    params?.isShowDeleted,
    ...(dependencies || [])
  ])

  //* set data and row count when data is available
  useEffect(() => {
    const { data } = result
    hook.setData(data?.data ?? [])
    hook.setRowCount(data?.rowCount ?? 0)
  }, [JSON.stringify(result?.data)])

  return {
    execute,
    executeAsync,
    isLoading,
    data: result.data ?? { data: [], rowCount: 0 },
    error: { serverError: result.serverError, validationError: result.validationErrors }
  }
}
