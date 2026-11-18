'use client'

import { useMemo } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'

import { PalletGenerateForm } from '@/schema/pallet'
import { FormOptions } from '@/types/common'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { TooltipWrapper } from '@/components/tooltip-wrapper'
import { Row } from '@/components/row'
import { Column } from '@/components/column'
import { ComboboxField } from '@/components/forms/combobox-field'
import { renderCodeItem } from '@/components/forms/combobox-item-content'
import SwitchField from '@/components/forms/switch-field'
import InputField from '@/components/forms/input-field'

type PalletGenerateLineProps = {
  index: number
  categoryOptions: FormOptions[]
  projectOptions: FormOptions[]
  isOptionsLoading: boolean
  canRemove: boolean
  onDuplicate: () => void
  onRemove: () => void
}

export default function PalletGenerateLine({
  index,
  categoryOptions,
  projectOptions,
  isOptionsLoading,
  canRemove,
  onDuplicate,
  onRemove
}: PalletGenerateLineProps) {
  const form = useFormContext<PalletGenerateForm>()

  const [isGeneralPurpose, projectCategoryCode] = useWatch({
    control: form.control,
    name: [`lines.${index}.isGeneralPurpose`, `lines.${index}.projectCategoryCode`]
  })

  //* only the picked category's projects
  const lineProjectOptions = useMemo(
    () => projectOptions.filter((project) => project.categoryCode === projectCategoryCode),
    [projectOptions, projectCategoryCode]
  )

  return (
    <Card>
      <CardHeader className='flex flex-row items-center gap-2'>
        <CardTitle className='text-base'>Line {index + 1}</CardTitle>

        <div className='ml-auto flex items-center gap-1'>
          <TooltipWrapper label='Duplicate Line'>
            <Button type='button' variant='ghost' size='icon-sm' onClick={onDuplicate}>
              <Icons.copy className='size-4' />
            </Button>
          </TooltipWrapper>

          {canRemove && (
            <TooltipWrapper label='Remove Line'>
              <Button type='button' variant='ghost' size='icon-sm' onClick={onRemove}>
                <Icons.trash className='text-destructive size-4' />
              </Button>
            </TooltipWrapper>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <Row gap={5}>
          <Column md={6} lg={3}>
            <SwitchField
              control={form.control}
              name={`lines.${index}.isGeneralPurpose`}
              label='General Purpose'
              layout='choice-card'
              description='Not tied to a customer project'
              callback={({ value }: { value: boolean }) => {
                if (!value) return
                form.setValue(`lines.${index}.projectCategoryCode`, '', { shouldValidate: true })
                form.setValue(`lines.${index}.customerProjectCode`, '', { shouldValidate: true })
              }}
            />
          </Column>

          {!isGeneralPurpose && (
            <>
              <Column md={6} lg={3}>
                <ComboboxField
                  control={form.control}
                  type='Basic'
                  name={`lines.${index}.projectCategoryCode`}
                  label='Project Category'
                  data={categoryOptions}
                  isLoading={isOptionsLoading}
                  searchKeys={['value']}
                  renderItem={renderCodeItem}
                  isRequired
                  //* a new category clears the project
                  callback={() => form.setValue(`lines.${index}.customerProjectCode`, '')}
                />
              </Column>

              <Column md={6} lg={3}>
                <ComboboxField
                  control={form.control}
                  type='Basic'
                  name={`lines.${index}.customerProjectCode`}
                  label='Customer Project'
                  data={lineProjectOptions}
                  isLoading={isOptionsLoading}
                  searchKeys={['value']}
                  renderItem={renderCodeItem}
                  isRequired
                  description={projectCategoryCode ? undefined : 'Pick a project category first'}
                  extendedProps={{ comboboxInputProps: { disabled: !projectCategoryCode } }}
                />
              </Column>
            </>
          )}

          <Column md={6} lg={3}>
            <InputField
              control={form.control}
              name={`lines.${index}.quantity`}
              label='No. of Pallets'
              isRequired
              extendedProps={{ inputProps: { type: 'number', min: 1, step: 1, inputMode: 'numeric' } }}
            />
          </Column>
        </Row>
      </CardContent>
    </Card>
  )
}
