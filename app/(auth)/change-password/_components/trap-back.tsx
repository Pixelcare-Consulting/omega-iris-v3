'use client'

import { useEffect } from 'react'

export function TrapBack({ active = true }: { active?: boolean }) {
  useEffect(() => {
    if (!active) return

    history.pushState(null, '', location.href)

    const onPop = () => {
      history.pushState(null, '', location.href)
      window.location.replace('/change-password') //* hard nav, hits middleware every time
    }

    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [active])

  return null
}
