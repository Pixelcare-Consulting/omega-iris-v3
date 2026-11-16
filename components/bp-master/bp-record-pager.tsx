'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Icons } from '@/components/icons'
import { TooltipWrapper } from '@/components/tooltip-wrapper'
import SapSyncStatusBadge from '@/components/sap-sync-status-badge'
import type { SapSyncStatus } from '@/prisma/generated/enums'

type BpRecordPagerProps = {
  title: string
  syncStatus?: SapSyncStatus | null
  position: number
  count: number
  isDefault: boolean
  isDisabled?: boolean
  onAdd: () => void
  onRemove: () => void
  onPrev: () => void
  onNext: () => void
}

export default function BpRecordPager({
  title,
  syncStatus,
  position,
  count,
  isDefault,
  isDisabled,
  onAdd,
  onRemove,
  onPrev,
  onNext
}: BpRecordPagerProps) {
  const hasRecord = count > 0

  return (
    <div className='flex flex-wrap items-center gap-3'>
      <div className='flex items-center gap-2'>
        <h3 className='text-base font-semibold'>{hasRecord ? `${title} #${position + 1}` : title}</h3>
        {hasRecord && syncStatus && <SapSyncStatusBadge status={syncStatus} />}
        {hasRecord && isDefault && <Badge variant='soft-blue'>Default</Badge>}
      </div>

      <div className='ml-auto flex items-center gap-2'>
        <span className='text-sm font-semibold'>{hasRecord ? `${position + 1} / ${count}` : '0 / 0'}</span>

        <TooltipWrapper label='Add'>
          <Button type='button' variant='outline' size='icon-sm' aria-label={`Add ${title}`} onClick={onAdd} disabled={isDisabled}>
            <Icons.plus />
          </Button>
        </TooltipWrapper>

        <TooltipWrapper label='Delete'>
          <Button
            type='button'
            variant='outline'
            size='icon-sm'
            aria-label={`Delete ${title}`}
            onClick={onRemove}
            disabled={isDisabled || !hasRecord}
          >
            <Icons.trash className='text-destructive' />
          </Button>
        </TooltipWrapper>

        <Separator orientation='vertical' className='h-6' />

        <TooltipWrapper label='Previous'>
          <Button type='button' variant='outline' size='icon-sm' aria-label={`Previous ${title}`} onClick={onPrev} disabled={position <= 0}>
            <Icons.left />
          </Button>
        </TooltipWrapper>

        <TooltipWrapper label='Next'>
          <Button
            type='button'
            variant='outline'
            size='icon-sm'
            aria-label={`Next ${title}`}
            onClick={onNext}
            disabled={position >= count - 1}
          >
            <Icons.right />
          </Button>
        </TooltipWrapper>
      </div>
    </div>
  )
}
