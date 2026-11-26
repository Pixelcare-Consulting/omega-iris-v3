'use client'

import { useFormContext } from 'react-hook-form'

import { ComboboxField } from '@/components/forms/combobox-field'
import { renderCodeItem } from '@/components/forms/combobox-item-content'
import { Badge } from '@/components/ui/badge'
import { InboundProjectOption } from '@/actions/inbound'

type InboundProjectStepProps = {
  projectOptions: InboundProjectOption[]
  project: InboundProjectOption | null
}

export default function InboundProjectStep({ projectOptions, project }: InboundProjectStepProps) {
  const { control, setValue } = useFormContext()

  //* a new project drops the po picked for the old one
  const handleProjectChange = () => {
    setValue('poNum', '', { shouldDirty: true })
  }

  return (
    <div className='flex flex-col gap-5'>
      <div className='flex flex-col gap-1'>
        <h2 className='text-base font-semibold'>Project</h2>
        <p className='text-muted-foreground text-sm'>The customer project decides whether a PO is needed and whether QC is mandatory.</p>
      </div>

      <div className='max-w-xl'>
        <ComboboxField
          control={control}
          type='Basic'
          name='customerProjectCode'
          label='Customer project'
          data={projectOptions}
          searchKeys={['value', 'name', 'category.name']}
          renderItem={renderCodeItem}
          callback={handleProjectChange}
          isRequired
        />
      </div>

      {project && (
        <div className='bg-muted/40 flex flex-wrap items-center gap-2.5 rounded-lg border px-3.5 py-3 text-sm'>
          <span className='text-muted-foreground'>Category</span>
          <span className='font-medium'>{project.category.name}</span>
          <span className='bg-border h-4 w-px' />
          {project.category.isPoRequired ? (
            <Badge variant='soft-red'>PO required</Badge>
          ) : (
            <Badge variant='soft-neutral'>No PO needed</Badge>
          )}
          {project.category.isMandatoryQc && <Badge variant='soft-red'>Mandatory QC</Badge>}
        </div>
      )}
    </div>
  )
}
