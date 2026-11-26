'use client'

import { useFormContext } from 'react-hook-form'

import TextareaField from '@/components/forms/textarea-field'
import { Icons } from '@/components/icons'
import { InboundWithInclude } from '@/actions/inbound'

type InboundReviewStepProps = { inbound: InboundWithInclude; isReadOnly: boolean }

function SummaryItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className='flex min-w-0 flex-col gap-0.5'>
      <span className='text-muted-foreground text-xs'>{label}</span>
      <span className='truncate text-sm font-medium'>{value}</span>
    </div>
  )
}

export default function InboundReviewStep({ inbound, isReadOnly }: InboundReviewStepProps) {
  const { control } = useFormContext()

  const totalQty = inbound.items.reduce((total, item) => total + item.totalStock, 0)
  const isPoRequired = !!inbound.customerProject?.category.isPoRequired

  return (
    <div className='flex flex-col gap-5'>
      <div className='flex flex-col gap-1'>
        <h2 className='text-base font-semibold'>Review &amp; submit</h2>
        <p className='text-muted-foreground text-sm'>Check everything once. Submit locks the lines and creates the unique IDs.</p>
      </div>

      <div className='grid grid-cols-1 gap-4 rounded-lg border p-3.5 sm:grid-cols-2 lg:grid-cols-5'>
        <SummaryItem label='Location' value={inbound.location ? `${inbound.location.code} · ${inbound.location.name}` : '—'} />
        <SummaryItem
          label='Customer project'
          value={inbound.customerProject ? `${inbound.customerProject.code} · ${inbound.customerProject.category.name}` : '—'}
        />{' '}
        {/* prettier-ignore */}
        <SummaryItem label='Purchase order' value={isPoRequired ? (inbound.poNum ? `PO ${inbound.poNum}` : '—') : 'Not needed'} />
        <SummaryItem
          label='Partial receiving'
          value={isPoRequired ? (inbound.isPartialReceived ? 'Allowed' : 'Off, must match the PO') : '—'}
        />
        <SummaryItem label='Packages' value={`${inbound.items.length} · ${totalQty.toLocaleString('en-US')} pcs`} />
      </div>

      <TextareaField control={control} name='notes' label='Notes' placeholder='Anything the next person should know' />

      {!isReadOnly && (
        <div className='flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900'>
          <Icons.info className='mt-0.5 size-4 shrink-0' />
          <span>
            Submit creates {inbound.items.length} unique {inbound.items.length === 1 ? 'ID' : 'IDs'} with QR codes and locks the lines. A
            confirm dialog shows first.
          </span>
        </div>
      )}
    </div>
  )
}
