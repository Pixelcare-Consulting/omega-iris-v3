'use client'

import LoadingButton from '@/components/forms/button-field'
import { Icons } from '@/components/icons'
import { TooltipWrapper } from '@/components/tooltip-wrapper'

type DataTableRefreshButtonProps = {
  onRefresh: () => void
  isLoading?: boolean
}

export default function DataTableRefreshButton({ onRefresh, isLoading }: DataTableRefreshButtonProps) {
  return (
    <TooltipWrapper label='Refresh'>
      <LoadingButton type='button' size='icon-lg' variant='outline' onClick={onRefresh} isLoading={isLoading}>
        <Icons.refresh />
      </LoadingButton>
    </TooltipWrapper>
  )
}
