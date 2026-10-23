import { createContext } from 'react'

export type FullscreenContextValue = {
  isFullscreen: boolean
  toggleFullscreen: () => void
  exitFullscreen: () => void
}

export const FullscreenContext = createContext<FullscreenContextValue>(undefined!)
