import { useEffect } from 'react'
import { useAction } from 'next-safe-action/hooks'

import { getBpMasterLookupsClient, getDataTableBpMastersSvrClient, getStatesByCountryClient } from '@/actions/bp-master'
import { BpMasterTableParams } from '@/schema/bp-master'
import { BpMasterType } from '@/constants/bp-master'
import { SafeActionHook } from '@/types/safe-action'

const EMPTY_LOOKUPS = { groups: [], currencies: [], paymentTerms: [], countries: [], accountTypes: [], isError: false }

export function useBpMasterLookups(type: BpMasterType) {
  const { execute, executeAsync, isExecuting: isLoading, result } = useAction(getBpMasterLookupsClient)

  useEffect(() => {
    execute({ type })
  }, [type])

  return {
    execute,
    executeAsync,
    isLoading,
    isLoaded: !!result.data,
    data: result.data ?? EMPTY_LOOKUPS,
    error: { serverError: result.serverError, validationError: result.validationErrors }
  }
}

export function useStatesByCountry(country?: string | null) {
  const { execute, isExecuting: isLoading, result, reset } = useAction(getStatesByCountryClient)

  useEffect(() => {
    if (country) execute({ country })
    else reset()
  }, [country])

  return { isLoading, data: country ? (result.data ?? []) : [] }
}

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
