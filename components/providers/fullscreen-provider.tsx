'use client'

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'

import { FullscreenContext, FullscreenContextValue } from '@/contexts/fullscreen'
import { FULLSCREEN_SHORTCUT_KEY, FULLSCREEN_STORAGE_EVENT, FULLSCREEN_STORAGE_KEY } from '@/constants/fullscreen'
import { logger } from '@/lib/logger'
import FullscreenIndicator from '@/components/fullscreen-indicator'

//* sessionStorage throws in private mode safari
const readStoredState = () => {
  try {
    return window.sessionStorage.getItem(FULLSCREEN_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

const writeStoredState = (next: boolean) => {
  try {
    window.sessionStorage.setItem(FULLSCREEN_STORAGE_KEY, String(next))
  } catch (err) {
    logger.error(err, '[FULLSCREEN_STORAGE_ERROR]:')
  }

  window.dispatchEvent(new Event(FULLSCREEN_STORAGE_EVENT))
}

const subscribeToStoredState = (onStoreChange: () => void) => {
  window.addEventListener(FULLSCREEN_STORAGE_EVENT, onStoreChange)
  return () => window.removeEventListener(FULLSCREEN_STORAGE_EVENT, onStoreChange)
}

//* the server has no sessionStorage, react uses this until hydration finishes
const getServerState = () => false

//* F8 hides the sidebar and header, the flag survives a refresh but not a new tab
export default function FullscreenProvider({ children }: { children: React.ReactNode }) {
  //! sessionStorage is the store, reading it through here avoids seeding state in an effect
  const isFullscreen = useSyncExternalStore(subscribeToStoredState, readStoredState, getServerState)

  const setFullscreen = useCallback((next: boolean) => {
    writeStoredState(next)

    //! requested on the root element, portaled menus and toasts vanish when a child goes fullscreen
    if (next) {
      document.documentElement.requestFullscreen().catch((err) => logger.error(err, '[FULLSCREEN_ERROR]:'))
      return
    }

    if (document.fullscreenElement) document.exitFullscreen().catch((err) => logger.error(err, '[FULLSCREEN_ERROR]:'))
  }, [])

  const toggleFullscreen = useCallback(() => setFullscreen(!isFullscreen), [isFullscreen, setFullscreen])

  const exitFullscreen = useCallback(() => setFullscreen(false), [setFullscreen])

  //! escape is left alone, radix uses it to close dialogs and comboboxes
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== FULLSCREEN_SHORTCUT_KEY) return

      event.preventDefault()

      //* a held key repeats, without this fullscreen turns on and off over and over
      if (event.repeat) return

      toggleFullscreen()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleFullscreen])

  //! the browser can leave fullscreen on its own, without this the sidebar and header stay hidden
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (document.fullscreenElement) return

      writeStoredState(false)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const value = useMemo<FullscreenContextValue>(
    () => ({ isFullscreen, toggleFullscreen, exitFullscreen }),
    [isFullscreen, toggleFullscreen, exitFullscreen]
  )

  //* mounted only while on, so it opens wide on every entry without an effect resetting it
  return (
    <FullscreenContext.Provider value={value}>
      {children}
      {isFullscreen && <FullscreenIndicator />}
    </FullscreenContext.Provider>
  )
}
