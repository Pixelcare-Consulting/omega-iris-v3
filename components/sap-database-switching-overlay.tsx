'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { HashLoader } from 'react-spinners'

import { cn } from '@/lib/utils'
import { Icons } from './icons'
import type { SapDatabaseSwitchStage } from '@/hooks/use-sap-database'
import { SAP_LOGIN_RETRIES } from '@/constants/sap'

type SapDatabaseSwitchingOverlayProps = {
  stage: SapDatabaseSwitchStage
  databaseName: string | null
  retryAttempt?: number | null //* set while the connection check is being retried
}

const STEPS = [
  { stage: 'verifying', label: 'Checking the connection' },
  { stage: 'updating', label: 'Updating your session' },
  { stage: 'preparing', label: 'Preparing your workspace' }
] as const

//! hash loader turns the color into rgba itself, a plain var() breaks it, rgb(from ...) still follows the theme
const PRIMARY_COLOR = 'rgb(from var(--primary) r g b)'

//* how long before we tell the user it is slow rather than stuck
const SLOW_SWITCH_MS = 8_000

export default function SapDatabaseSwitchingOverlay({ stage, databaseName, retryAttempt }: SapDatabaseSwitchingOverlayProps) {
  const [isSlow, setIsSlow] = useState(false)
  const isActive = stage !== null

  //* one timer per switch, not per step, reset once the switch ends
  useEffect(() => {
    if (!isActive) return

    const timer = setTimeout(() => setIsSlow(true), SLOW_SWITCH_MS)

    return () => {
      clearTimeout(timer)
      setIsSlow(false)
    }
  }, [isActive])

  //* stage is only set after a click, so the dom is always there by the time the portal renders
  if (!stage) return null

  //* past the last step on 'done', so every row shows as checked
  const currentIndex = stage === 'done' ? STEPS.length : STEPS.findIndex((step) => step.stage === stage)

  return createPortal(
    <div
      role='status'
      aria-busy
      aria-live='polite'
      className='animate-in fade-in fixed inset-0 z-100 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm duration-200 motion-reduce:animate-none'
    >
      <div className='bg-background animate-in fade-in zoom-in-95 flex w-full max-w-md flex-col items-center rounded-2xl px-12 py-14 text-center shadow-2xl duration-300 motion-reduce:animate-none'>
        <HashLoader color={PRIMARY_COLOR} size={80} />

        {databaseName && (
          <div className='text-muted-foreground mt-8 flex items-center justify-center gap-2 text-sm'>
            <Icons.database className='size-4' />
            <span>Switching company to</span>
          </div>
        )}

        <h1 className={cn('text-primary text-2xl font-bold tracking-tight', databaseName ? 'mt-1.5' : 'mt-8')}>
          {databaseName ?? 'Switching company'}
        </h1>

        <p className='text-muted-foreground mt-2.5 text-sm'>Reconnecting and loading this company&apos;s data.</p>

        {/* //* rows left aligned inside a centered block, ragged rows are harder to scan */}
        <ul className='mx-auto mt-8 w-fit space-y-3.5 text-left'>
          {STEPS.map((step, index) => {
            const isDone = index < currentIndex
            const isActive = index === currentIndex

            return (
              <li key={step.stage} className='flex items-center gap-2.5 text-sm'>
                <span className='flex size-4 shrink-0 items-center justify-center'>
                  {isDone && <Icons.check className='size-4 text-green-500' />}
                  {isActive && <Icons.spinner className='text-primary size-4 animate-spin' />}
                  {!isDone && !isActive && <span className='bg-muted size-1.5 rounded-full' />}
                </span>

                <span className={cn(isActive ? 'text-foreground' : 'text-muted-foreground')}>
                  {step.label}
                  {isActive && step.stage === 'verifying' && retryAttempt && (
                    <span className='block text-xs text-amber-600'>
                      SAP is not answering, retrying ({retryAttempt} of {SAP_LOGIN_RETRIES + 1})…
                    </span>
                  )}
                </span>
              </li>
            )
          })}
        </ul>

        {isSlow && !retryAttempt && (
          <p className='text-muted-foreground mt-7 w-full border-t pt-5 text-sm'>This is taking longer than usual.</p>
        )}
      </div>
    </div>,
    document.body
  )
}
