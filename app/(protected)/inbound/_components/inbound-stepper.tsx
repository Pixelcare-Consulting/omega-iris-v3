'use client'

import { Icons } from '@/components/icons'
import { cn } from '@/lib/utils'
import { INBOUND_STEP_CONFIG, InboundStep } from '@/constants/inbound'

type InboundStepperProps = {
  steps: InboundStep[]
  currentStep: InboundStep
  completedSteps: InboundStep[]
  summaries: Partial<Record<InboundStep, string>>
  isFreeNavigation?: boolean //* any step opens, not only finished ones
  onStepChange: (step: InboundStep) => void
}

export default function InboundStepper({
  steps,
  currentStep,
  completedSteps,
  summaries,
  isFreeNavigation,
  onStepChange
}: InboundStepperProps) {
  return (
    <nav aria-label='Progress' className='bg-card rounded-xl border px-4 py-3 sm:px-5'>
      <ol className='flex flex-wrap gap-y-3'>
        {steps.map((step, index) => {
          const isCurrent = step === currentStep
          const isDone = completedSteps.includes(step) && !isCurrent
          const isLast = index === steps.length - 1
          const { label, caption } = INBOUND_STEP_CONFIG[step]

          return (
            <li key={step} className='flex min-w-0 flex-[1_1_180px] items-center gap-2.5 pr-2.5'>
              <button
                type='button'
                aria-current={isCurrent ? 'step' : undefined}
                disabled={!isFreeNavigation && !isDone && !isCurrent}
                onClick={() => onStepChange(step)}
                className='flex min-w-0 items-center gap-2.5 text-left disabled:cursor-default'
              >
                <span
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-[13px] font-semibold',
                    isDone && 'border-primary bg-primary text-primary-foreground',
                    isCurrent && 'border-primary text-primary bg-background',
                    !isDone && !isCurrent && 'text-muted-foreground border-border bg-background'
                  )}
                >
                  {isDone ? <Icons.check className='size-3.5' strokeWidth={3} /> : index + 1}
                </span>

                <span className='flex min-w-0 flex-col'>
                  <span className={cn('text-sm font-semibold', !isDone && !isCurrent && 'text-muted-foreground')}>{label}</span>
                  <span className='text-muted-foreground truncate text-xs'>{(isDone && summaries[step]) || caption}</span>
                </span>
              </button>

              {!isLast && <span aria-hidden className={cn('h-0.5 min-w-4 flex-1 rounded-full', isDone ? 'bg-primary' : 'bg-border')} />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
