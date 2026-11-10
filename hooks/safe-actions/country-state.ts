import { useEffect } from 'react'
import { useAction } from 'next-safe-action/hooks'

import { getStateOptionsClient } from '@/actions/country-state'

export function useStateOptions(countryCode?: string | null) {
  const { execute, reset, isExecuting: isLoading, result } = useAction(getStateOptionsClient)

  useEffect(() => {
    if (countryCode) execute({ countryCode })
    else reset()
  }, [countryCode])

  return { data: countryCode ? (result.data ?? []) : [], isLoading }
}
