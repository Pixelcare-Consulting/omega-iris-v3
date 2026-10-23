import { useAction } from 'next-safe-action/hooks'
import { useEffect } from 'react'

import { getRolePermissionsClient } from '@/actions/role-permission'

export function useRolePermissions(roleCode: number, dependencies?: any[]) {
  const { execute, executeAsync, isExecuting: isLoading, result } = useAction(getRolePermissionsClient)

  useEffect(() => {
    execute({ roleCode })
  }, [roleCode, ...(dependencies || [])])

  return {
    execute,
    executeAsync,
    isLoading,
    data: result.data ?? [],
    error: { serverError: result.serverError, validationError: result.validationErrors }
  }
}
