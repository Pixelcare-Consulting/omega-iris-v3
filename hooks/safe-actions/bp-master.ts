import { useEffect } from 'react'
import { useAction } from 'next-safe-action/hooks'

import { getDataTableBpMastersSvrClient } from '@/actions/bp-master'
import { BpMasterTableParams } from '@/schema/bp-master'
import { SafeActionHook } from '@/types/safe-action'

export function useDataTableBpMastersSvr(params: BpMasterTableParams, hook: SafeActionHook, dependencies?: any[]) {
  const { execute, executeAsync, isExecuting: isLoading, result } = useAction(getDataTableBpMastersSvrClient)

  useEffect(() => {
    execute(params)
  }, [
    params.type,
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
    data: result?.data ?? { data: [], rowCount: 0 },
    error: { serverError: result.serverError, validationError: result.validationErrors }
  }
}
