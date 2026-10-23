'use client'

import LoadingButton from '@/components/forms/button-field'
import { Icons } from '@/components/icons'
import { TooltipWrapper } from '@/components/tooltip-wrapper'

type DataTableExportButtonProps = {
  onExport: () => void
  isLoading?: boolean
}

export default function DataTableExportButton({ onExport, isLoading }: DataTableExportButtonProps) {
  return (
    <TooltipWrapper label='Export'>
      <LoadingButton type='button' size='icon-lg' variant='outline' onClick={onExport} isLoading={isLoading}>
        <Icons.download />
      </LoadingButton>
    </TooltipWrapper>
  )
}
