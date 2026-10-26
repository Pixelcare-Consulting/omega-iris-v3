import { useEffect } from 'react'
import { useAction } from 'next-safe-action/hooks'

import { ItemTableLookups, ItemTableParams } from '@/schema/item'
import { SafeActionHook } from '@/types/safe-action'
import { getDataTableItemsSvrClient, getItemLookupsClient, getItemSeriesClient } from '@/actions/item'

export function useItemLookups(dependencies?: any[]) {
  const { execute, executeAsync, isExecuting: isLoading, result } = useAction(getItemLookupsClient)

  useEffect(() => {
    execute()
  }, [...(dependencies || [])])

  return {
    execute,
    executeAsync,
    isLoading,
    isLoaded: !!result.data,
    data: result.data ?? { itemGroups: [], manufacturers: [], vatGroups: [] },
    error: { serverError: result.serverError, validationError: result.validationErrors }
  }
}

export function useItemSeries(dependencies?: any[]) {
  const { execute, executeAsync, isExecuting: isLoading, result } = useAction(getItemSeriesClient)

  useEffect(() => {
    execute()
  }, [...(dependencies || [])])

  return {
    execute,
    executeAsync,
    isLoading,
    data: result.data ?? { series: [], defaultSeries: null },
    error: { serverError: result.serverError, validationError: result.validationErrors }
  }
}

//* shows loading until the page's lookups arrive, every request then reuses them
export function useDataTableItemsSvr(
  params: Omit<ItemTableParams, 'lookups'> & { lookups?: ItemTableLookups },
  hook: SafeActionHook,
  dependencies?: any[]
) {
  const { execute, executeAsync, isExecuting, result } = useAction(getDataTableItemsSvrClient)

  const hasLookups = !!params.lookups
  const isLoading = isExecuting || !hasLookups

  const filtersKey = JSON.stringify([params.globalFilter, params.columnFilters])

  //* back to page 1 when a filter changes, a narrower result may not reach the current page
  useEffect(() => {
    hook.setPageIndex?.(0)
  }, [filtersKey])

  useEffect(() => {
    if (!params.lookups) return
    execute({ ...params, lookups: params.lookups })
  }, [
    hasLookups,
    params.page,
    params.perPage,
    params?.globalFilter,
    JSON.stringify(params?.sorting),
    JSON.stringify(params?.columnFilters),
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
    data: result?.data ?? { data: [], rowCount: 0, error: null },
    error: { serverError: result.serverError, validationError: result.validationErrors }
  }
}
