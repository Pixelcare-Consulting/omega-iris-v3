'use client'

import { useEffect, useState } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'

import SwitchField from '@/components/forms/switch-field'
import LoadingButton from '@/components/forms/button-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Icons } from '@/components/icons'
import { useFindPurchaseOrder, usePurchaseOrder } from '@/hooks/safe-actions/inbound'
import { InboundPurchaseOrder } from '@/actions/inbound'
import PoSummary from './po-summary'

type InboundPoStepProps = { isReadOnly: boolean }

export default function InboundPoStep({ isReadOnly }: InboundPoStepProps) {
  const { control, setValue, formState } = useFormContext()

  const [poNum, isPartialReceived] = useWatch({ control, name: ['poNum', 'isPartialReceived'] })

  const [poNumInput, setPoNumInput] = useState<string>(poNum ?? '')
  const [foundPurchaseOrder, setFoundPurchaseOrder] = useState<InboundPurchaseOrder | null>(null)
  const [findError, setFindError] = useState<string | null>(null)

  const findPurchaseOrder = useFindPurchaseOrder()
  const purchaseOrder = usePurchaseOrder(poNum || null, foundPurchaseOrder)

  const poError = (formState.errors.poNum?.message as string | undefined) ?? findError ?? undefined

  const handleInputChange = (value: string) => {
    setPoNumInput(value.replace(/\D/g, ''))
    setFindError(null)
  }

  //* only an open po sets the field, the auto save takes it from there and asks first when packages would go
  const handleFind = async () => {
    if (!poNumInput || isReadOnly) return

    const result = await findPurchaseOrder.find(poNumInput)

    if (result.isSapError) {
      setFindError(`Could not load PO ${poNumInput}, SAP is unreachable right now. Try again in a moment.`)
      return
    }

    if (!result.purchaseOrder) {
      setFindError(`PO ${poNumInput} was not found or is not open in SAP.`)
      return
    }

    setFoundPurchaseOrder(result.purchaseOrder)
    setValue('poNum', String(result.purchaseOrder.DocNum), { shouldDirty: true, shouldValidate: true })
  }

  //! enter would submit the inbound form, so it finds instead
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    handleFind()
  }

  const handleClear = () => {
    setValue('poNum', '', { shouldDirty: true })
  }

  //* follows the saved po, so keep current po and clear put the input back
  useEffect(() => {
    setPoNumInput(poNum ?? '')
    setFindError(null)
  }, [poNum])

  return (
    <div className='flex flex-col gap-5'>
      <div className='flex flex-col gap-1'>
        <h2 className='text-base font-semibold'>Purchase order</h2>
        <p className='text-muted-foreground text-sm'>Enter an open PO number from SAP. Its lines are what this inbound receives against.</p>
      </div>

      {/* //* the po and how strictly it is matched sit side by side */}
      <div className='grid grid-cols-1 items-start gap-4 md:grid-cols-2'>
        <Field data-invalid={!!poError}>
          <FieldLabel htmlFor='poNumInput'>
            Purchase order <span className='text-destructive'>*</span>
          </FieldLabel>

          <div className='flex items-center gap-2'>
            <div className='relative flex-1'>
              <Input
                id='poNumInput'
                inputMode='numeric'
                autoComplete='off'
                placeholder='Enter PO No.'
                className='pr-9'
                value={poNumInput}
                disabled={isReadOnly}
                aria-invalid={!!poError}
                onChange={(event) => handleInputChange(event.target.value)}
                onKeyDown={handleKeyDown}
              />

              {poNum && !isReadOnly && (
                <Button
                  type='button'
                  variant='ghost'
                  size='icon-sm'
                  aria-label='Clear PO'
                  className='absolute top-1/2 right-1 -translate-y-1/2'
                  onClick={handleClear}
                >
                  <Icons.x />
                </Button>
              )}
            </div>

            <LoadingButton
              type='button'
              variant='outline'
              isLoading={findPurchaseOrder.isLoading}
              loadingText='Finding'
              disabled={!poNumInput || isReadOnly}
              onClick={handleFind}
            >
              <Icons.search /> Find
            </LoadingButton>
          </div>

          {poError && <FieldError>{poError}</FieldError>}
        </Field>

        <SwitchField
          control={control}
          name='isPartialReceived'
          label='Partial receiving'
          layout='choice-card'
          description={
            isPartialReceived
              ? 'On: quantities may be less than the PO, every MFG P/N must still be on it.'
              : "Off: each MFG P/N's packages must add up to exactly its open qty, and every MFG P/N on the PO must be received."
          }
        />
      </div>

      {purchaseOrder.isLoading && (
        <div className='text-muted-foreground flex items-center gap-2 text-sm'>
          <Icons.spinner className='size-4 animate-spin' /> Loading PO from SAP...
        </div>
      )}

      {purchaseOrder.data && <PoSummary purchaseOrder={purchaseOrder.data} />}

      {!purchaseOrder.isLoading && poNum && purchaseOrder.isSapError && (
        <p className='text-destructive text-sm'>Could not load PO {poNum}, SAP is unreachable right now. Try again in a moment.</p>
      )}

      {!purchaseOrder.isLoading && poNum && !purchaseOrder.data && !purchaseOrder.isSapError && (
        <p className='text-destructive text-sm'>PO {poNum} is not open in SAP anymore. Enter another one.</p>
      )}
    </div>
  )
}
