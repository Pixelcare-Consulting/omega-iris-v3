import { useEffect } from 'react'
import { useAction } from 'next-safe-action/hooks'

import { getDataTableTestDataClientSideClient, getDataTableTestDataServerSideClient } from '@/actions/example'
import { DataTableParams } from '@/schema/data-table'
import { SafeActionHook } from '@/types/safe-action'

export function useDataTableTestDataClientSide(dependencies?: any[]) {
  const { execute, executeAsync, isExecuting: isLoading, result } = useAction(getDataTableTestDataClientSideClient)

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

export function useDataTableTestDataServerSide(params: DataTableParams, hook: SafeActionHook, dependencies?: any[]) {
  const { execute, executeAsync, isExecuting: isLoading, result } = useAction(getDataTableTestDataServerSideClient)

  useEffect(() => {
    execute(params)
  }, [
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
    data: result?.data ?? { data: [], rowCount: 0 },
    error: { serverError: result.serverError, validationError: result.validationErrors }
  }
}
