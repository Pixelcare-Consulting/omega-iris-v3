'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useAction } from 'next-safe-action/hooks'

import { completeSession, OpenSession, pauseSession, resumeSession } from '@/actions/session'
import { createInboundDraft } from '@/actions/inbound'
import { SESSION_STATUS_CONFIG, SESSION_TYPE_CONFIG } from '@/constants/session'
import { formatClock, getActiveSeconds, getOpenPause } from '@/lib/session'
import { logger } from '@/lib/logger'
import { cn } from '@/lib/utils'
import LoadingButton from '@/components/forms/button-field'
import { Badge } from '@/components/ui/badge'
import { Icons } from '@/components/icons'
import AlertModal from '@/components/alert-modal'
import CancelSessionModal from './cancel-session-modal'

type SessionBarProps = { session: OpenSession | null }

type MutationResult = { error: boolean; message: string; data?: { inboundCode?: string | null } } | undefined

export default function SessionBar({ session }: SessionBarProps) {
  const router = useRouter()

  const [now, setNow] = useState(() => new Date())
  const [isCancelOpen, setIsCancelOpen] = useState(false)
  const [isCompleteOpen, setIsCompleteOpen] = useState(false)

  const pauseSessionAction = useAction(pauseSession)
  const resumeSessionAction = useAction(resumeSession)
  const completeSessionAction = useAction(completeSession)
  const createInboundDraftAction = useAction(createInboundDraft)

  const isPaused = session?.status === 'PAUSED'

  const activeSeconds = useMemo(() => (session ? getActiveSeconds(session, now) : 0), [session, now])

  const pausedSeconds = useMemo(() => {
    const openPause = session ? getOpenPause(session.pauses) : null
    return openPause ? Math.max(0, Math.floor((+now - +new Date(openPause.pausedAt)) / 1000)) : 0
  }, [session, now])

  //* the session's drafts, oldest first
  const draftCodes = useMemo(() => session?.inbounds.map((row) => row.code) ?? [], [session])

  const isBusy =
    pauseSessionAction.isExecuting ||
    resumeSessionAction.isExecuting ||
    completeSessionAction.isExecuting ||
    createInboundDraftAction.isExecuting

  //* shared toast and refresh for every bar action
  //! a full load after navigating, in the prod build a push right after an action can drop and leave the old bar
  const handleResult = (result: MutationResult, href?: string) => {
    if (!result || result.error) {
      toast.error(result?.message ?? 'Something went wrong! Please try again later.')
      return false
    }

    toast.success(result.message)
    if (href) window.location.assign(href)
    else router.refresh()
    return true
  }

  const handleTogglePause = async () => {
    if (!session) return

    try {
      const action = isPaused ? resumeSessionAction : pauseSessionAction
      const response = await action.executeAsync({ sessionCode: session.code })
      handleResult(response?.data)
    } catch (err: any) {
      logger.error(err, '[SESSION_BAR_TOGGLE_PAUSE_ERROR]:')
      toast.error('Something went wrong! Please try again later.')
    }
  }

  const handleComplete = async () => {
    if (!session) return

    try {
      const response = await completeSessionAction.executeAsync({ sessionCode: session.code })
      setIsCompleteOpen(false)
      handleResult(response?.data, '/sessions')
    } catch (err: any) {
      logger.error(err, '[SESSION_BAR_COMPLETE_ERROR]:')
      toast.error('Something went wrong! Please try again later.')
    }
  }

  //* an open draft comes first, a new one only when none is left
  const handleInbound = async () => {
    if (!session) return

    const draftCode = draftCodes[0]

    if (draftCode) {
      router.push(`/inbound/${draftCode}`)
      return
    }

    try {
      const response = await createInboundDraftAction.executeAsync({ sessionCode: session.code })
      const result = response?.data

      handleResult(result, result?.data?.inboundCode ? `/inbound/${result.data.inboundCode}` : undefined)
    } catch (err: any) {
      logger.error(err, '[SESSION_BAR_NEW_INBOUND_ERROR]:')
      toast.error('Something went wrong! Please try again later.')
    }
  }

  //* tick only while the clock runs
  useEffect(() => {
    setNow(new Date())

    if (!session) return

    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [session])

  if (!session) return null

  const { label, icon: TypeIcon } = SESSION_TYPE_CONFIG[session.type]
  const status = SESSION_STATUS_CONFIG[session.status]
  const isInbound = session.type === 'INBOUND'
  const draftCode = draftCodes[0]

  return (
    <>
      <div
        className={cn(
          'flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 border-b px-4 py-2 sm:px-6',
          isPaused ? 'border-amber-200 bg-amber-50' : 'border-primary/15 bg-primary/5'
        )}
      >
        <div className='flex min-w-0 items-center gap-2.5'>
          <span className={cn('size-2 shrink-0 rounded-full', isPaused ? 'bg-amber-500' : 'animate-pulse bg-blue-600')} />

          <span className='text-primary flex size-7 shrink-0 items-center justify-center rounded-md border bg-white'>
            <TypeIcon className='size-4' />
          </span>

          <div className='flex min-w-0 flex-col'>
            <span className='text-sm font-semibold'>{label} session</span>
            <span className='text-muted-foreground truncate text-xs'>
              {session.code} · {session.site.name}
            </span>
          </div>
        </div>

        <div className='flex items-center gap-2.5 sm:border-l sm:pl-5'>
          <div className='flex flex-col'>
            <span className='text-muted-foreground text-[11px] font-medium tracking-wide uppercase'>Active time</span>
            {/* //* the server and the browser render a second apart */}
            <span className='font-mono text-lg leading-tight font-semibold tabular-nums' suppressHydrationWarning>
              {formatClock(activeSeconds)}
            </span>
          </div>

          <Badge variant={status.variant}>{status.label}</Badge>

          {isPaused && (
            <span className='text-xs text-amber-800' suppressHydrationWarning>
              paused for {formatClock(pausedSeconds)}
            </span>
          )}
        </div>

        <div className='flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto'>
          <LoadingButton
            type='button'
            variant='ghost'
            size='sm'
            className='text-destructive hover:text-destructive'
            disabled={isBusy}
            onClick={() => setIsCancelOpen(true)}
          >
            <Icons.x /> Cancel session
          </LoadingButton>

          {isInbound && (
            <LoadingButton
              type='button'
              variant='outline'
              size='sm'
              disabled={isBusy || isPaused}
              isLoading={createInboundDraftAction.isExecuting}
              loadingText='Starting'
              onClick={handleInbound}
            >
              {draftCode ? <Icons.arrowRight /> : <Icons.plus />} {draftCode ? `Open ${draftCode}` : 'New inbound'}
            </LoadingButton>
          )}

          <LoadingButton
            type='button'
            variant='outline'
            size='sm'
            disabled={isBusy}
            isLoading={pauseSessionAction.isExecuting || resumeSessionAction.isExecuting}
            loadingText={isPaused ? 'Resuming' : 'Pausing'}
            onClick={handleTogglePause}
          >
            {isPaused ? <Icons.play /> : <Icons.pause />} {isPaused ? 'Resume' : 'Pause'}
          </LoadingButton>

          <LoadingButton
            type='button'
            size='sm'
            disabled={isBusy}
            isLoading={completeSessionAction.isExecuting}
            loadingText='Completing'
            onClick={() => setIsCompleteOpen(true)}
          >
            <Icons.circleCheck /> Complete session
          </LoadingButton>
        </div>
      </div>

      <AlertModal
        isOpen={isCompleteOpen}
        title={`Complete session ${session.code}?`}
        description="The timer stops and the session closes. You can't undo this."
        onConfirmText='Complete'
        onCancelText='Keep working'
        onConfirm={handleComplete}
        onCancel={() => setIsCompleteOpen(false)}
        isLoading={completeSessionAction.isExecuting}
        loadingText='Completing'
        extendedProps={{ alertDialogActionProps: { variant: 'default' } }}
      />

      <CancelSessionModal
        isOpen={isCancelOpen}
        sessionCode={session.code}
        draftInboundCodes={draftCodes}
        onClose={() => setIsCancelOpen(false)}
      />
    </>
  )
}
