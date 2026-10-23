'use client'

import { useEffect, useState } from 'react'

import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { FULLSCREEN_INDICATOR_COLLAPSE_DELAY_MS } from '@/constants/fullscreen'
import { useFullscreen } from '@/hooks/use-fullscreen'
import { cn } from '@/lib/utils'

//* says the mode is on, names the key, and is the way out for anyone without a keyboard
//! mounted only while fullscreen is on, so it starts wide on every entry
export default function FullscreenIndicator() {
  const { exitFullscreen } = useFullscreen()

  const [isExpanded, setIsExpanded] = useState(true)

  //* keyed on isExpanded so reopening restarts the timer, not just the first mount
  useEffect(() => {
    if (!isExpanded) return

    const timeout = setTimeout(() => setIsExpanded(false), FULLSCREEN_INDICATOR_COLLAPSE_DELAY_MS)
    return () => clearTimeout(timeout)
  }, [isExpanded])

  return (
    //! hover and focus reopen it, a window mousemove listener flickers while someone reads
    <div className='fixed right-4 bottom-4 z-50' onMouseEnter={() => setIsExpanded(true)} onFocus={() => setIsExpanded(true)}>
      <Button type='button' variant='secondary' size='sm' className='shadow-md' onClick={exitFullscreen}>
        <Icons.minimize />
        <span className={cn(!isExpanded && 'hidden')}>Fullscreen mode · F8 to exit</span>
      </Button>
    </div>
  )
}
