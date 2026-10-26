import { Badge } from '@/components/ui/badge'
import { TooltipWrapper } from '@/components/tooltip-wrapper'

//* marks a page that reads and writes sap directly, nothing is kept in the portal
export default function SapLiveBadge() {
  return (
    <TooltipWrapper label='Read and saved directly in SAP, nothing is copied into the portal'>
      <Badge variant='soft-emerald' className='gap-1.5 font-semibold'>
        <span className='relative flex size-2'>
          <span className='absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75' />
          <span className='relative inline-flex size-2 rounded-full bg-emerald-500' />
        </span>
        Live from SAP
      </Badge>
    </TooltipWrapper>
  )
}
