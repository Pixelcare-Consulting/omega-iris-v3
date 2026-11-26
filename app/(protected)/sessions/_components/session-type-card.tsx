'use client'

import { Icons } from '@/components/icons'
import { cn } from '@/lib/utils'
import { SESSION_TYPE_CONFIG } from '@/constants/session'
import type { SessionType } from '@/prisma/generated/enums'

type SessionTypeCardProps = {
  type: SessionType
  isSelected: boolean
  isDisabled: boolean
  disabledReason?: string
  onSelect: (type: SessionType) => void
}

export default function SessionTypeCard({ type, isSelected, isDisabled, disabledReason, onSelect }: SessionTypeCardProps) {
  const { label, description, icon: Icon } = SESSION_TYPE_CONFIG[type]

  return (
    <button
      type='button'
      disabled={isDisabled}
      aria-pressed={isSelected}
      onClick={() => onSelect(type)}
      className={cn(
        'bg-card relative flex min-h-34 flex-col items-start gap-3 rounded-xl border p-4 text-left transition-[border-color,box-shadow,background-color]',
        'enabled:hover:border-primary focus-visible:ring-ring/50 outline-none focus-visible:ring-3',
        isSelected && 'border-primary ring-primary/15 bg-primary/5 ring-3',
        isDisabled && 'bg-muted/40 cursor-not-allowed border-dashed opacity-60'
      )}
    >
      <span
        className={cn(
          'flex size-10 items-center justify-center rounded-lg',
          isDisabled ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary',
          isSelected && 'bg-primary text-primary-foreground'
        )}
      >
        <Icon className='size-5' />
      </span>

      <span className='flex flex-col gap-1'>
        <span className='text-sm font-semibold'>{label}</span>
        <span className='text-muted-foreground text-[13px] leading-snug'>{description}</span>
      </span>

      {isSelected && (
        <span className='bg-primary text-primary-foreground absolute top-3 right-3 flex size-5 items-center justify-center rounded-full'>
          <Icons.check className='size-3' strokeWidth={3} />
        </span>
      )}

      {isDisabled && disabledReason && (
        <span className='bg-muted text-muted-foreground absolute top-3 right-3 rounded-full px-2 py-0.5 text-[11px] font-medium'>
          {disabledReason}
        </span>
      )}
    </button>
  )
}
