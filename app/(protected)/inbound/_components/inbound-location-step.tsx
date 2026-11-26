'use client'

import { useFormContext } from 'react-hook-form'

import { ComboboxField } from '@/components/forms/combobox-field'
import { renderCodeItem } from '@/components/forms/combobox-item-content'
import ReadOnlyField from '@/components/read-only-field'
import { InboundOption } from '@/actions/inbound'

type InboundLocationStepProps = {
  siteName: string
  locationOptions: InboundOption[]
}

export default function InboundLocationStep({ siteName, locationOptions }: InboundLocationStepProps) {
  const { control } = useFormContext()

  return (
    <div className='flex flex-col gap-5'>
      <div className='flex flex-col gap-1'>
        <h2 className='text-base font-semibold'>Location</h2>
        <p className='text-muted-foreground text-sm'>Where the goods arrive. Only locations at this session&apos;s site are listed.</p>
      </div>

      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        <ReadOnlyField title='Site' value={siteName} />

        <ComboboxField
          control={control}
          type='Basic'
          name='locationCode'
          label='Receiving location'
          data={locationOptions}
          searchKeys={['value', 'name']}
          renderItem={renderCodeItem}
          isRequired
        />
      </div>
    </div>
  )
}
