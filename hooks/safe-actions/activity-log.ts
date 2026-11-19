import { useCallback, useEffect, useRef, useState } from 'react'
import type { ColumnFiltersState } from '@tanstack/react-table'
import { useAction } from 'next-safe-action/hooks'

import { getActivityTimelineClient, getDataTableActivityLogsSvrClient } from '@/actions/activity-log'
import { DataTableParams } from '@/schema/data-table'
import { SafeActionHook } from '@/types/safe-action'
import type { ActivityModule } from '@/constants/activity-log'
import type { ActivityLog } from '@/prisma/generated/client'

export function useDataTableActivityLogsSvr(params: DataTableParams, hook: SafeActionHook, dependencies?: any[]) {
  const { execute, executeAsync, isExecuting: isLoading, result } = useAction(getDataTableActivityLogsSvrClient)

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

type ActivityTimelineFilters = { search: string; columnFilters: ColumnFiltersState }

//* each page appends to the list, the cursor is the last row's id
//* a filter change starts over from the newest row
export function useActivityTimeline(module: ActivityModule, entityId: string, filters: ActivityTimelineFilters) {
  const { executeAsync, isExecuting: isLoading } = useAction(getActivityTimelineClient)

  const [items, setItems] = useState<ActivityLog[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)

  //! a slow older response must not land over a newer one
  const requestIdRef = useRef(0)

  const filtersKey = JSON.stringify(filters)

  const fetchPage = useCallback(
    async (cursor: string | null) => {
      const requestId = ++requestIdRef.current
      const { search, columnFilters } = JSON.parse(filtersKey) as ActivityTimelineFilters

      const result = await executeAsync({ module, entityId, cursor, search, columnFilters })
      if (requestId !== requestIdRef.current) return

      const page = result?.data ?? { items: [], nextCursor: null }

      setItems((previous) => (cursor ? [...previous, ...page.items] : page.items))
      setNextCursor(page.nextCursor)
    },
    [executeAsync, module, entityId, filtersKey]
  )

  useEffect(() => {
    fetchPage(null)
  }, [fetchPage])

  return {
    items,
    isLoading,
    hasMore: !!nextCursor,
    loadMore: () => nextCursor && fetchPage(nextCursor),
    refresh: () => fetchPage(null)
  }
}
