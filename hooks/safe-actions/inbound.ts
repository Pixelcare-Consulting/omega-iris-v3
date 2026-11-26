import { useEffect } from 'react'
import { useAction } from 'next-safe-action/hooks'
import {
  getDataTableInboundItemMastersSvrClient,
  getDataTableInboundsSvrClient,
  getPurchaseOrderClient,
  InboundPurchaseOrder
} from '@/actions/inbound'
import { InboundItemMasterTableParams } from '@/schema/inbound'
import { DataTableParams } from '@/schema/data-table'
import { SafeActionHook } from '@/types/safe-action'

//* the inbound list, paged, sorted and filtered in the database
export function useDataTableInboundsSvr(params: DataTableParams, hook: SafeActionHook, dependencies?: any[]) {
  const { execute, executeAsync, isExecuting: isLoading, result } = useAction(getDataTableInboundsSvrClient)

  //* refetches when paging, sorting or filters change
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
    data: result.data ?? { data: [], rowCount: 0 },
    error: { serverError: result.serverError, validationError: result.validationErrors }
  }
}

//* the mfg p/n picker table, the po's parts first
export function useDataTableInboundItemMastersSvr(params: InboundItemMasterTableParams, hook: SafeActionHook, dependencies?: any[]) {
  const { execute, executeAsync, isExecuting: isLoading, result } = useAction(getDataTableInboundItemMastersSvrClient)

  const filtersKey = JSON.stringify([params.globalFilter, params.columnFilters])

  //* back to page 1 when a filter changes, a narrower result may not reach the current page
  useEffect(() => {
    hook.setPageIndex?.(0)
  }, [filtersKey])

  useEffect(() => {
    execute(params)
  }, [params.page, params.perPage, params.inboundCode, params?.globalFilter, ...(dependencies || [])])

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

//* the saved po with its lines, read fresh from sap, skipped when find already read it
export function usePurchaseOrder(poNum?: string | null, foundPurchaseOrder?: InboundPurchaseOrder | null) {
  const { execute, isExecuting: isLoading, result, reset } = useAction(getPurchaseOrderClient)

  const isFound = !!poNum && foundPurchaseOrder?.DocNum === Number(poNum)

  useEffect(() => {
    if (isFound) return
    if (poNum) execute({ poNum })
    else reset()
  }, [poNum, isFound])

  if (isFound) return { isLoading: false, data: foundPurchaseOrder, isSapError: false }

  return {
    isLoading,
    data: poNum ? (result.data?.purchaseOrder ?? null) : null,
    isSapError: !!poNum && !!result.data?.isSapError
  }
}

//* one po by its number, on find
export function useFindPurchaseOrder() {
  const { executeAsync, isExecuting: isLoading } = useAction(getPurchaseOrderClient)

  const find = async (poNum: string) => {
    const response = await executeAsync({ poNum })
    return response?.data ?? { purchaseOrder: null, isSapError: true }
  }

  return { find, isLoading }
}
