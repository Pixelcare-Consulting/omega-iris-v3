'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useAction } from 'next-safe-action/hooks'
import { FormProvider, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { PackagingUnitWithRelations, updatePackagingUnit } from '@/actions/packaging-unit'
import { InboundReferenceOptions } from '@/actions/inbound'
import { PageMetadata } from '@/types/common'
import {
  type PackagingUnitForm as PackagingUnitFormValues,
  type PackagingUnitFormInput,
  packagingUnitFormSchema
} from '@/schema/packaging-unit'
import Header from '@/components/header'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { TooltipWrapper } from '@/components/tooltip-wrapper'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Row } from '@/components/row'
import { Column } from '@/components/column'
import ReadOnlyFieldHeader from '@/components/read-only-field-header'
import InputField from '@/components/forms/input-field'
import TextareaField from '@/components/forms/textarea-field'
import SwitchField from '@/components/forms/switch-field'
import { ComboboxField } from '@/components/forms/combobox-field'
import { renderCodeItem } from '@/components/forms/combobox-item-content'
import ContentWrapper from '@/components/content-wrapper'
import LoadingButton from '@/components/forms/button-field'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import CanView from '@/components/rbac/can-view'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { delay, toCodeName } from '@/lib/utils'
import { toFormOption, withCurrentOption } from '@/lib/form'
import { logger } from '@/lib/logger'

type PackagingUnitFormProps = {
  pageMetaData: PageMetadata
  unit: PackagingUnitWithRelations
  referenceOptions: InboundReferenceOptions
}

type LockedFieldProps = { label: string; value: string | null | undefined; description?: string }

const toQuantityText = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 6 })

const toCodeLabel = (row: { code: string; name: string }) => `${row.code} · ${row.name}`

//* looks like a disabled input field, for values the form doesn't save
function LockedField({ label, value, description }: LockedFieldProps) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Input value={value ?? ''} disabled readOnly />
      {description && <FieldDescription>{description}</FieldDescription>}
    </Field>
  )
}

export default function PackagingUnitForm({ pageMetaData, unit, referenceOptions }: PackagingUnitFormProps) {
  const router = useRouter()

  const { inboundItem: item } = unit
  const { itemMaster, inbound } = item

  const values = useMemo<PackagingUnitFormInput>(
    () => ({
      code: unit.code,
      owner: item.owner ?? '',
      partNumber: item.partNumber ?? '',
      commodityCode: item.commodityCode ?? '',
      dateCode: item.dateCode ?? '',
      countryOfOrigin: item.countryOfOrigin ?? '',
      lotCode: item.lotCode ?? '',
      packagingTypeCode: item.packagingTypeCode ?? '',
      spq: item.spq ?? '',
      cost: item.cost ?? '',
      isMandatoryQc: item.isMandatoryQc,
      notes: item.notes ?? ''
    }),
    [unit.code, item]
  )

  const form = useForm({
    mode: 'onChange',
    values,
    resetOptions: { keepDirtyValues: true },
    resolver: zodResolver(packagingUnitFormSchema)
  })

  const updatePackagingUnitAction = useAction(updatePackagingUnit)

  //* pickers list usable rows only, an old record keeps its own
  const commodityOptions = useMemo(() => {
    const current = item.commodity ? toFormOption(item.commodity, toCodeLabel) : null
    return withCurrentOption(referenceOptions.commodityOptions, current)
  }, [referenceOptions.commodityOptions, item.commodity])

  const packagingTypeOptions = useMemo(() => {
    const current = item.packagingType ? toFormOption(item.packagingType, toCodeLabel) : null
    return withCurrentOption(referenceOptions.packagingTypeOptions, current)
  }, [referenceOptions.packagingTypeOptions, item.packagingType])

  const handleSubmit = async (formValues: PackagingUnitFormValues) => {
    try {
      const response = await updatePackagingUnitAction.executeAsync(formValues)
      const result = response?.data

      if (!result || result.error) {
        result?.paths?.forEach((path) => form.setError(path.field as keyof PackagingUnitFormValues, { message: path.message }))
        toast.error(result?.message ?? 'Something went wrong! Please try again later.')
        return
      }

      toast.success(result.message)
      router.refresh()

      await delay(1500)

      router.push('/packaging-units')
    } catch (err: any) {
      logger.error(err, '[PACKAGING_UNIT_FORM_HANDLE_SUBMIT_ERROR]:')
      toast.error('Something went wrong! Please try again later.')
    }
  }

  return (
    <FormProvider {...form}>
      <form className='flex h-full w-full flex-1 flex-col gap-5' onSubmit={form.handleSubmit(handleSubmit)}>
        <Header title={pageMetaData.title} description={pageMetaData.description}>
          <div className='ml-auto flex items-center gap-2'>
            <TooltipWrapper label='Back'>
              <Button type='button' variant='outline' onClick={() => router.push('/packaging-units')}>
                <Icons.arrowLeft /> Back
              </Button>
            </TooltipWrapper>

            <TooltipWrapper label='Save'>
              <LoadingButton
                type='submit'
                variant='default'
                isLoading={updatePackagingUnitAction.isExecuting}
                disabled={updatePackagingUnitAction.isExecuting}
              >
                <Icons.save /> Save
              </LoadingButton>
            </TooltipWrapper>

            <DropdownMenu>
              <TooltipWrapper label='More Options'>
                <DropdownMenuTrigger asChild>
                  <Button variant='ghost' size='icon-lg'>
                    <Icons.ellipsisVertical />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipWrapper>

              <DropdownMenuContent className='w-auto min-w-20' align='end'>
                <CanView subject={PERMISSIONS_CODES.PACKAGING_UNITS} action={PERMISSIONS_ALLOWED_ACTIONS.VIEW}>
                  <DropdownMenuItem onClick={() => router.push(`/packaging-units/${encodeURIComponent(unit.code)}/view`)}>
                    <Icons.eye /> View
                  </DropdownMenuItem>
                </CanView>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </Header>

        <ContentWrapper>
          <ScrollArea className='m-1 flex-1' type='auto'>
            <FieldGroup className='p-4'>
              <Row gap={5}>
                <Column>
                  <ReadOnlyFieldHeader title='Details' description='Enter the details of the unique ID' />
                  <Separator className='mt-4' />
                </Column>

                <Column md={6} lg={3}>
                  <InputField
                    control={form.control}
                    name='code'
                    label='Code'
                    description='Code cannot be changed'
                    extendedProps={{ inputProps: { disabled: true } }}
                  />
                </Column>

                <Column md={6} lg={3}>
                  <LockedField label='MFG P/N' value={itemMaster.ItemCode} description='MFG P/N cannot be changed' />
                </Column>

                <Column md={6} lg={3}>
                  <LockedField label='Manufacturer' value={itemMaster.FirmName} />
                </Column>

                <Column md={6} lg={3}>
                  <LockedField
                    label='Quantity'
                    value={toQuantityText(unit.quantity)}
                    description={`Received ${toQuantityText(item.totalStock)}`}
                  />
                </Column>

                <Column>
                  <LockedField label='Description' value={itemMaster.ItemName} />
                </Column>

                <Column md={6} lg={3}>
                  <InputField control={form.control} name='owner' label='Owner' />
                </Column>

                <Column md={6} lg={3}>
                  <InputField control={form.control} name='partNumber' label='Part Number' />
                </Column>

                <Column md={6} lg={3}>
                  <ComboboxField
                    control={form.control}
                    type='Basic'
                    name='commodityCode'
                    label='Commodity'
                    data={commodityOptions}
                    searchKeys={['value', 'name']}
                    renderItem={renderCodeItem}
                  />
                </Column>

                <Column md={6} lg={3}>
                  <ComboboxField
                    control={form.control}
                    type='Basic'
                    name='packagingTypeCode'
                    label='Packaging Type'
                    data={packagingTypeOptions}
                    searchKeys={['value', 'name']}
                    renderItem={renderCodeItem}
                  />
                </Column>

                <Column md={6} lg={3}>
                  <InputField control={form.control} name='dateCode' label='DC' />
                </Column>

                <Column md={6} lg={3}>
                  <InputField control={form.control} name='countryOfOrigin' label='COO' />
                </Column>

                <Column md={6} lg={3}>
                  <InputField control={form.control} name='lotCode' label='Lot Code' />
                </Column>

                <Column md={6} lg={3}>
                  <InputField control={form.control} name='spq' label='SPQ' />
                </Column>

                <Column md={6} lg={3}>
                  <InputField
                    control={form.control}
                    name='cost'
                    label='Cost'
                    extendedProps={{ inputProps: { type: 'number', min: 0, step: 'any' } }}
                  />
                </Column>

                <Column md={6} lg={3}>
                  <SwitchField
                    control={form.control}
                    name='isMandatoryQc'
                    label='Mandatory QC'
                    layout='choice-card'
                    description="This package needs to be QC'd"
                  />
                </Column>

                <Column>
                  <TextareaField control={form.control} name='notes' label='Notes' />
                </Column>

                <Column>
                  <Separator className='mt-3 mb-4' />
                  <ReadOnlyFieldHeader title='Project' description='Who the package is for, cannot be changed' />
                </Column>

                <Column md={6} lg={4}>
                  <LockedField label='Project Category' value={toCodeName(unit.projectCategory)} />
                </Column>

                <Column md={6} lg={5}>
                  <LockedField label='Customer Project' value={toCodeName(unit.customerProject)} />
                </Column>

                <Column md={6} lg={3}>
                  <LockedField label='PO Number' value={inbound.poNum} />
                </Column>

                <Column>
                  <Separator className='mt-3 mb-4' />
                  <ReadOnlyFieldHeader title='Location' description='Can only change by moving the package' />
                </Column>

                <Column md={6} lg={3}>
                  <LockedField label='Site' value={toCodeName(unit.location.site)} />
                </Column>

                <Column md={6} lg={3}>
                  <LockedField label='Location' value={toCodeName(unit.location)} />
                </Column>

                <Column md={6} lg={3}>
                  <LockedField label='Pallet' value={unit.palletCode} />
                </Column>

                <Column md={6} lg={3}>
                  <LockedField label='Container' value={unit.containerCode} />
                </Column>
              </Row>
            </FieldGroup>
          </ScrollArea>
        </ContentWrapper>
      </form>
    </FormProvider>
  )
}
