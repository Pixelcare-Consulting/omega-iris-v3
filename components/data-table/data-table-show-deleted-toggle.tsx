'use client'

import LoadingButton from '@/components/forms/button-field'
import { Icons } from '@/components/icons'
import { TooltipWrapper } from '@/components/tooltip-wrapper'

type DataTableShowDeletedToggleProps = {
  isShowDeleted: boolean
  onToggle: (isShowDeleted: boolean) => void
  isLoading?: boolean
}

//* server-side tables hide soft-deleted rows by default, this flips `isShowDeleted` and refetches
export default function DataTableShowDeletedToggle({ isShowDeleted, onToggle, isLoading }: DataTableShowDeletedToggleProps) {
  return (
    <TooltipWrapper label={isShowDeleted ? 'Hide Deleted' : 'Show Deleted'}>
      <LoadingButton
        type='button'
        size='icon-lg'
        variant={isShowDeleted ? 'secondary' : 'outline'}
        onClick={() => onToggle(!isShowDeleted)}
        isLoading={isLoading}
      >
        {isShowDeleted ? <Icons.eyeOff /> : <Icons.eye />}
      </LoadingButton>
    </TooltipWrapper>
  )
}
