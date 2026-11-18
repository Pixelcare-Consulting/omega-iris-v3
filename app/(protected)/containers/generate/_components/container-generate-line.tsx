'use client'

import { useMemo } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'

import { ContainerGenerateForm } from '@/schema/container'
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
import { CONTAINER_TYPE_OPTIONS } from '@/constants/container'

type ActivePallet = {
  code: string
  locationCode: string
  isGeneralPurpose: boolean
  projectCategoryCode: string | null
  customerProjectCode: string | null
}

type ContainerGenerateLineProps = {
  index: number
  locationCode: string
  isPalletAllowed: boolean
  categoryOptions: FormOptions[]
  projectOptions: FormOptions[]
  pallets: ActivePallet[]
  isOptionsLoading: boolean
  canRemove: boolean
  onDuplicate: () => void
  onRemove: () => void
}

export default function ContainerGenerateLine({
  index,
  locationCode,
  isPalletAllowed,
  categoryOptions,
  projectOptions,
  pallets,
  isOptionsLoading,
  canRemove,
  onDuplicate,
  onRemove
}: ContainerGenerateLineProps) {
  const form = useFormContext<ContainerGenerateForm>()

  const [isGeneralPurpose, projectCategoryCode, customerProjectCode] = useWatch({
    control: form.control,
    name: [`lines.${index}.isGeneralPurpose`, `lines.${index}.projectCategoryCode`, `lines.${index}.customerProjectCode`]
  })

  //* only the picked category's projects
  const lineProjectOptions = useMemo(
    () => projectOptions.filter((project) => project.categoryCode === projectCategoryCode),
    [projectOptions, projectCategoryCode]
  )

  //! active pallets at the location picked above that match the line, general purpose only sees general purpose pallets
  const palletOptions = useMemo(
    () =>
      pallets
        .filter((pallet) => pallet.locationCode === locationCode)
        .filter((pallet) =>
          isGeneralPurpose
            ? pallet.isGeneralPurpose
            : pallet.projectCategoryCode === projectCategoryCode && pallet.customerProjectCode === customerProjectCode
        )
        .map((pallet) => ({ label: pallet.code, value: pallet.code })),
    [pallets, locationCode, isGeneralPurpose, projectCategoryCode, customerProjectCode]
  )

  //* why the pallet picker is off, or what it lists
  const palletNote = useMemo(() => {
    if (!locationCode) return 'Pick a location above first'
    if (!isPalletAllowed) return "The location above doesn't allow pallets"
    if (!isGeneralPurpose && !customerProjectCode) return 'Pick a customer project first'
    if (isGeneralPurpose) return 'Optional, general purpose pallets at the location above'
    return "Optional, this project's pallets at the location above"
  }, [locationCode, isPalletAllowed, isGeneralPurpose, customerProjectCode])

  const isPalletDisabled = !locationCode || !isPalletAllowed || (!isGeneralPurpose && !customerProjectCode)

  //! a picked pallet may not fit the new project, so it is cleared
  const handleClearPallet = () => form.setValue(`lines.${index}.palletCode`, '', { shouldValidate: true })

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
                //* either way the pallet list changes
                handleClearPallet()
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
                  //* a new category clears the project and the pallet
                  callback={() => {
                    form.setValue(`lines.${index}.customerProjectCode`, '')
                    handleClearPallet()
                  }}
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
                  //* a new project clears the pallet
                  callback={handleClearPallet}
                  extendedProps={{ comboboxInputProps: { disabled: !projectCategoryCode } }}
                />
              </Column>
            </>
          )}

          <Column md={6} lg={3}>
            <ComboboxField
              control={form.control}
              type='Basic'
              name={`lines.${index}.palletCode`}
              label='Pallet'
              data={palletOptions}
              isLoading={isOptionsLoading}
              description={palletNote}
              extendedProps={{ comboboxInputProps: { disabled: isPalletDisabled } }}
            />
          </Column>

          <Column md={6} lg={3}>
            <ComboboxField
              control={form.control}
              type='Basic'
              name={`lines.${index}.type`}
              label='Type'
              data={CONTAINER_TYPE_OPTIONS}
              isRequired
            />
          </Column>

          <Column md={6} lg={3}>
            <InputField
              control={form.control}
              name={`lines.${index}.quantity`}
              label='No. of Containers'
              isRequired
              extendedProps={{ inputProps: { type: 'number', min: 1, step: 1, inputMode: 'numeric' } }}
            />
          </Column>
        </Row>
      </CardContent>
    </Card>
  )
}
