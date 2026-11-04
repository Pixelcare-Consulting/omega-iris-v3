import { useAction } from 'next-safe-action/hooks'
import { useEffect } from 'react'

import { DataTableParams } from '@/schema/data-table'
import { SafeActionHook } from '@/types/safe-action'
import { getDataTableFileAttachmentsSvrClient, getFileAttachmentByIdClient, getFileAttachmentsClient } from '@/actions/file-attachment'

export function useFileAttachments(moduleName?: string | null, referenceId?: string | null, dependencies?: any[]) {
  const { execute, executeAsync, isExecuting: isLoading, result } = useAction(getFileAttachmentsClient)

  useEffect(() => {
    execute({ moduleName, referenceId })
  }, [moduleName, referenceId, ...(dependencies || [])])

  return {
    execute,
    executeAsync,
    isLoading,
    data: result.data ?? [],
    error: { serverError: result.serverError, validationError: result.validationErrors }
  }
}

export function useFileAttachmentById(id?: string | null, dependencies?: any[]) {
  const { execute, executeAsync, isExecuting: isLoading, result } = useAction(getFileAttachmentByIdClient)

  useEffect(() => {
    execute({ id })
  }, [id, ...(dependencies || [])])

  return {
    execute,
    executeAsync,
    isLoading,
    data: result.data ?? null,
    error: { serverError: result.serverError, validationError: result.validationErrors }
  }
}

export function useDataTableFileAttachmentSvr(
  moduleName: string,
  referenceId: string,
  params: DataTableParams,
  hook: SafeActionHook,
  dependencies?: any[]
) {
  const { execute, executeAsync, isExecuting: isLoading, result } = useAction(getDataTableFileAttachmentsSvrClient)

  useEffect(() => {
    execute({ moduleName, referenceId, ...params })
  }, [
    moduleName,
    referenceId,
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
