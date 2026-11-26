'use client'

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import SapLiveBadge from '@/components/sap-live-badge'
import { InboundPurchaseOrder } from '@/actions/inbound'
import PoSummary from './po-summary'

type InboundPoDetailsSheetProps = {
  isOpen: boolean
  purchaseOrder: InboundPurchaseOrder | null
  onClose: () => void
}

export default function InboundPoDetailsSheet({ isOpen, purchaseOrder, onClose }: InboundPoDetailsSheetProps) {
  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      {/* //! the sheet's own max width uses the side variant, so the override needs it too */}
      <SheetContent side='right' className='gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-5xl'>
        <SheetHeader className='border-b'>
          <SheetTitle className='flex items-center gap-2'>
            PO {purchaseOrder?.DocNum ?? ''} <SapLiveBadge />
          </SheetTitle>
          <SheetDescription>Read only</SheetDescription>
        </SheetHeader>

        {/* //! a radix scroll area lets wide content push the sheet sideways, a plain overflow box keeps the table inside */}
        <div className='min-h-0 min-w-0 flex-1 overflow-y-auto p-4'>{purchaseOrder && <PoSummary purchaseOrder={purchaseOrder} />}</div>
      </SheetContent>
    </Sheet>
  )
}
