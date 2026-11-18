import { useState } from 'react'

import { LastBatchResult } from '@/types/batch'

//* the last result with errors per batch key and user, kept in localStorage
//! storage can be blocked or hold junk, so every call is wrapped and a failure just means no saved result
export function useLastBatchResult(key: string, userCode: number | null) {
  const storageKey = userCode ? `omega:batch:${key}:${userCode}` : null

  const [lastResult, setLastResult] = useState<LastBatchResult | null>(() => {
    if (!storageKey || typeof window === 'undefined') return null

    try {
      const value = localStorage.getItem(storageKey)
      const parsed = value ? (JSON.parse(value) as LastBatchResult) : null

      //* drop anything that isn't a saved result
      const isValid = Array.isArray(parsed?.stats?.errors) && !isNaN(new Date(parsed?.finishedAt ?? '').getTime())
      return isValid ? parsed : null
    } catch {
      return null
    }
  })

  const save = (value: LastBatchResult) => {
    setLastResult(value)

    try {
      if (storageKey) localStorage.setItem(storageKey, JSON.stringify(value))
    } catch {}
  }

  const clear = () => {
    setLastResult(null)

    try {
      if (storageKey) localStorage.removeItem(storageKey)
    } catch {}
  }

  return { lastResult, save, clear }
}
