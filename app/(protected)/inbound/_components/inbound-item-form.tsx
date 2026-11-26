'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useAction } from 'next-safe-action/hooks'
import { FormProvider, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import {
  InboundItemMasterRow,
  InboundItemWithInclude,
  InboundPurchaseOrder,
  InboundReferenceOptions,
  upsertInboundItem
} from '@/actions/inbound'
import { type InboundItemForm as InboundItemFormValues, type InboundItemFormInput, inboundItemFormSchema } from '@/schema/inbound'
import Modal from '@/components/modal'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import InputField from '@/components/forms/input-field'
import TextareaField from '@/components/forms/textarea-field'
import SwitchField from '@/components/forms/switch-field'
import { ComboboxField } from '@/components/forms/combobox-field'
import { renderCodeItem } from '@/components/forms/combobox-item-content'
import LoadingButton from '@/components/forms/button-field'
import ReadOnlyField from '@/components/read-only-field'
import { Icons } from '@/components/icons'
import { useSubmitIntent } from '@/hooks/use-submit-intent'
import { logger } from '@/lib/logger'
import { cn } from '@/lib/utils'
import { getSuggestedTotalStock } from '@/lib/inbound'
import ItemMasterPickerModal from './item-master-picker-modal'

type InboundItemFormProps = {
  isOpen: boolean
  inboundCode: string
  inboundItem: InboundItemWithInclude | null
  isPoRequired: boolean
  isMandatoryQc: boolean
  items: InboundItemWithInclude[]
  purchaseOrder: InboundPurchaseOrder | null
  referenceOptions: InboundReferenceOptions
  onClose: () => void
}

type PickedPart = Pick<InboundItemMasterRow, 'ItemName' | 'FirmName'>

export default function InboundItemForm({
  isOpen,
  inboundCode,
  inboundItem,
  isPoRequired,
  isMandatoryQc,
  items,
  purchaseOrder,
  referenceOptions,
  onClose
}: InboundItemFormProps) {
  const router = useRouter()

  const isCreate = !inboundItem

  //* mandatory qc starts from the project's category
  const defaultValues = useMemo<InboundItemFormInput>(
    () => ({
      inboundCode,
      lineNum: null,
      owner: '',
      mpn: '',
      partNumber: '',
      commodityCode: '',
      dateCode: '',
      countryOfOrigin: '',
      lotCode: '',
      packagingTypeCode: '',
      spq: '',
      cost: '',
      totalStock: '' as unknown as number,
      isMandatoryQc,
      notes: ''
    }),
    [inboundCode, isMandatoryQc]
  )

  const values = useMemo<InboundItemFormInput>(() => {
    if (!inboundItem) return defaultValues

    return {
      inboundCode,
      lineNum: inboundItem.lineNum,
      owner: inboundItem.owner ?? '',
      mpn: inboundItem.mpn,
      partNumber: inboundItem.partNumber ?? '',
      commodityCode: inboundItem.commodityCode ?? '',
      dateCode: inboundItem.dateCode ?? '',
      countryOfOrigin: inboundItem.countryOfOrigin ?? '',
      lotCode: inboundItem.lotCode ?? '',
      packagingTypeCode: inboundItem.packagingTypeCode ?? '',
      spq: inboundItem.spq ?? '',
      cost: inboundItem.cost ?? '',
      totalStock: inboundItem.totalStock,
      isMandatoryQc: inboundItem.isMandatoryQc,
      notes: inboundItem.notes ?? ''
    }
  }, [inboundItem, inboundCode, defaultValues])

  const form = useForm({
    mode: 'onChange',
    values,
    resolver: zodResolver(inboundItemFormSchema)
  })

  const mpn = useWatch({ control: form.control, name: 'mpn' })

  const upsertInboundItemAction = useAction(upsertInboundItem)
  const { intent, setIntent, consumeIntent } = useSubmitIntent()

  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [pickedPart, setPickedPart] = useState<PickedPart | null>(inboundItem?.itemMaster ?? null)

  const mpnError = form.formState.errors.mpn?.message

  //* a part on the po fills the cost and qty from its lines
  const handlePickPart = (row: InboundItemMasterRow) => {
    const poLines = purchaseOrder?.DocumentLines ?? []
    const poLine = poLines.find((line) => line.ItemCode.toUpperCase() === row.ItemCode.toUpperCase())

    //* the package being edited doesn't count against its own part
    const otherItems = items.filter((item) => item.id !== inboundItem?.id)
    const suggestedQty = getSuggestedTotalStock(row.ItemCode, otherItems, poLines)

    form.setValue('mpn', row.ItemCode, { shouldDirty: true, shouldValidate: true })
    if (poLine) form.setValue('cost', poLine.Price, { shouldDirty: true, shouldValidate: true })
    if (suggestedQty !== null) form.setValue('totalStock', suggestedQty, { shouldDirty: true, shouldValidate: true })
    setPickedPart(row)
    setIsPickerOpen(false)
  }

  const handleClose = () => {
    if (upsertInboundItemAction.isExecuting) return

    form.reset(defaultValues)
    setPickedPart(null)
    onClose()
  }

  const handleSubmit = async (formValues: InboundItemFormValues) => {
    const submitIntent = consumeIntent()

    try {
      const response = await upsertInboundItemAction.executeAsync(formValues)
      const result = response?.data

      if (!result || result.error) {
        result?.paths?.forEach((path) => form.setError(path.field as keyof InboundItemFormValues, { message: path.message }))
        toast.error(result?.message ?? 'Something went wrong! Please try again later.')
        return
      }

      toast.success(result.message)
      router.refresh()

      if (submitIntent === 'save-new') {
        form.reset(defaultValues)
        setPickedPart(null)
        return
      }

      handleClose()
    } catch (err: any) {
      logger.error(err, '[INBOUND_ITEM_FORM_ERROR]:')
      toast.error('Something went wrong! Please try again later.')
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      title={isCreate ? 'Add Package' : `Edit Line ${inboundItem.lineNum}`}
      description={isCreate ? `New line on ${inboundCode}` : `${inboundItem.mpn} on ${inboundCode}`}
      size='lg'
      //! a modal dialog blocks clicks on the portalled combobox lists
      isModal={false}
      isCloseOnOutsideClick={false}
      onClose={handleClose}
      footer={
        <>
          <Button type='button' variant='outline' onClick={handleClose} disabled={upsertInboundItemAction.isExecuting}>
            Cancel
          </Button>

          {isCreate && (
            <LoadingButton
              type='button'
              variant='outline-primary'
              isLoading={upsertInboundItemAction.isExecuting && intent === 'save-new'}
              disabled={upsertInboundItemAction.isExecuting}
              onClick={() => {
                setIntent('save-new')
                form.handleSubmit(handleSubmit)()
              }}
            >
              <Icons.plus /> Save & New
            </LoadingButton>
          )}

          <LoadingButton
            type='button'
            isLoading={upsertInboundItemAction.isExecuting && intent === 'save'}
            disabled={upsertInboundItemAction.isExecuting}
            onClick={() => {
              setIntent('save')
              form.handleSubmit(handleSubmit)()
            }}
          >
            <Icons.save /> Save
          </LoadingButton>
        </>
      }
    >
      <FormProvider {...form}>
        <ScrollArea className='-mx-6 max-h-[65vh] px-6'>
          <div className='grid grid-cols-1 gap-3 pb-1 sm:grid-cols-2'>
            <InputField control={form.control} name='owner' label='Owner' />

            {/* //* the field opens the item master picker */}
            <Field data-invalid={!!mpnError}>
              <FieldLabel>
                MFG P/N <span className='text-destructive'>*</span>
              </FieldLabel>

              <button
                type='button'
                onClick={() => setIsPickerOpen(true)}
                className={cn(
                  'border-input bg-background flex h-9 w-full items-center gap-2 rounded-md border px-3 text-left text-sm shadow-xs',
                  'hover:border-primary focus-visible:ring-ring/50 outline-none focus-visible:ring-3',
                  mpnError && 'border-destructive'
                )}
              >
                <Icons.search className='text-muted-foreground size-4 shrink-0' />
                {mpn ? <span className='truncate font-mono'>{mpn}</span> : <span className='text-muted-foreground'>Select a part</span>}
              </button>

              {mpnError && <FieldError>{mpnError}</FieldError>}
            </Field>

            <InputField control={form.control} name='partNumber' label='Part Number' />
            <ReadOnlyField title='Manufacturer' value={pickedPart?.FirmName ?? '—'} />

            <div className='sm:col-span-2'>
              <ReadOnlyField title='Description' value={pickedPart?.ItemName ?? '—'} />
            </div>

            <ComboboxField
              control={form.control}
              type='Basic'
              name='commodityCode'
              label='Commodity'
              data={referenceOptions.commodityOptions}
              searchKeys={['value', 'name']}
              renderItem={renderCodeItem}
            />
            <InputField control={form.control} name='dateCode' label='DC' />
            <InputField control={form.control} name='countryOfOrigin' label='COO' />
            <InputField control={form.control} name='lotCode' label='Lot Code' />
            <ComboboxField
              control={form.control}
              type='Basic'
              name='packagingTypeCode'
              label='Packaging Type'
              data={referenceOptions.packagingTypeOptions}
              searchKeys={['value', 'name']}
              renderItem={renderCodeItem}
            />
            <InputField control={form.control} name='spq' label='SPQ' />

            <InputField
              control={form.control}
              name='cost'
              label='Cost'
              description={isPoRequired ? 'Filled from the PO line' : undefined}
              extendedProps={{ inputProps: { type: 'number', min: 0, step: 'any', disabled: isPoRequired } }}
            />

            <InputField
              control={form.control}
              name='totalStock'
              label='Received Qty'
              isRequired
              extendedProps={{ inputProps: { type: 'number', min: 0, step: 'any' } }}
            />

            <div className='sm:col-span-2'>
              <TextareaField control={form.control} name='notes' label='Notes' />
            </div>

            <div className='sm:col-span-2'>
              <SwitchField
                control={form.control}
                name='isMandatoryQc'
                label='Mandatory QC'
                layout='choice-card'
                description="This package needs to be QC'd"
              />
            </div>
          </div>
        </ScrollArea>
      </FormProvider>

      <ItemMasterPickerModal
        isOpen={isPickerOpen}
        inboundCode={inboundCode}
        isPoRequired={isPoRequired}
        selectedMpn={mpn || null}
        onSelect={handlePickPart}
        onClose={() => setIsPickerOpen(false)}
      />
    </Modal>
  )
}
