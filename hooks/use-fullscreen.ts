'use client'

import { useContext } from 'react'

import { FullscreenContext } from '@/contexts/fullscreen'

export function useFullscreen() {
  const context = useContext(FullscreenContext)

  if (!context) throw new Error('useFullscreen must be used within a FullscreenProvider.')

  return context
}
