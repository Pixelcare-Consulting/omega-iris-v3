'use client'

import { useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useAction } from 'next-safe-action/hooks'
import { FormProvider, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { upsertItem } from '@/actions/item'
import { PageMetadata } from '@/types/common'
import { SapItem } from '@/types/sap'
import { type ItemForm as ItemFormValues, itemFormSchema } from '@/schema/item'
import { ITEM_TYPE_OPTIONS, NO_MANUFACTURER_CODE, canBeInventoryItem } from '@/constants/item'
import { useItemLookups, useItemSeries } from '@/hooks/safe-actions/item'
import { useSubmitIntent } from '@/hooks/use-submit-intent'
import { withCurrentOption } from '@/lib/form'
import { toItemFormValues } from '@/lib/item'
import { delay } from '@/lib/utils'
import { logger } from '@/lib/logger'
import Header from '@/components/header'
import SapLiveBadge from '@/components/sap-live-badge'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { TooltipWrapper } from '@/components/tooltip-wrapper'
import { FieldGroup } from '@/components/ui/field'
import { Row } from '@/components/row'
import { Column } from '@/components/column'
import ReadOnlyFieldHeader from '@/components/read-only-field-header'
import ReadOnlyField from '@/components/read-only-field'
import InputField from '@/components/forms/input-field'
import ContentWrapper from '@/components/content-wrapper'
import LoadingButton from '@/components/forms/button-field'
import { ComboboxField } from '@/components/forms/combobox-field'
import SwitchField from '@/components/forms/switch-field'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import CanView from '@/components/rbac/can-view'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'

type ItemFormProps = { pageMetaData: PageMetadata; item: SapItem | null }

const DEFAULT_VALUES: ItemFormValues = {
  ItemCode: '',
  Series: null,
  ItemName: '',
  ItemType: 'itItems',
  ItemsGroupCode: 0,
  InventoryItem: false,
  SalesItem: true,
  PurchaseItem: true,
  WTLiable: true,
  Manufacturer: NO_MANUFACTURER_CODE,
  SalesVATGroup: '',
  isActive: true
}

export default function ItemForm({ pageMetaData, item }: ItemFormProps) {
  const router = useRouter()

  const { code } = useParams() as { code: string }

  const isCreate = code === 'add' || !item

  const itemSeries = useItemSeries()

  //* a new item starts on sap's default series once the list arrives
  const createValues = useMemo(() => ({ ...DEFAULT_VALUES, Series: itemSeries.data.defaultSeries }), [itemSeries.data.defaultSeries])

  const values = useMemo(() => {
    if (item) return toItemFormValues(item)
    if (isCreate) return createValues
  }, [isCreate, item, createValues])

  const form = useForm({
    mode: 'onChange',
    values,
    resetOptions: { keepDirtyValues: true },
    resolver: zodResolver(itemFormSchema)
  })

  const upsertItemAction = useAction(upsertItem)

  const { intent, setIntent, consumeIntent } = useSubmitIntent()

  const lookups = useItemLookups()

  const itemTypeOptions = useMemo(() => ITEM_TYPE_OPTIONS.map((o) => ({ ...o })), [])

  const itemType = useWatch({ control: form.control, name: 'ItemType' })
  const isInventoryAllowed = canBeInventoryItem(itemType)

  //* labor, travel and fixed assets cannot be inventory items in sap
  const handleItemTypeChange = (nextItemType?: string) => {
    if (!canBeInventoryItem(nextItemType as ItemFormValues['ItemType'])) form.setValue('InventoryItem', false)
  }

  const seriesOptions = useMemo(
    () => itemSeries.data.series.map((s) => ({ value: String(s.Series), label: s.Name, code: s.Series })),
    [itemSeries.data.series]
  )

  const itemGroupOptions = useMemo(
    () => lookups.data.itemGroups.map((g) => ({ value: String(g.Number), label: g.GroupName, code: g.Number })),
    [lookups.data.itemGroups]
  )

  const manufacturerOptions = useMemo(
    () => lookups.data.manufacturers.map((m) => ({ value: String(m.Code), label: m.ManufacturerName, code: m.Code })),
    [lookups.data.manufacturers]
  )

  //* the picker lists active tax groups only, an item already on an inactive one keeps it selectable
  const taxGroupOptions = useMemo(() => {
    const toOption = (v: (typeof lookups.data.vatGroups)[number]) => ({
      value: v.Code,
      label: v.Name,
      code: v.Code,
      isActive: v.Inactive !== 'tYES'
    })

    const current = lookups.data.vatGroups.find((v) => v.Code === item?.SalesVATGroup)
    const active = lookups.data.vatGroups.filter((v) => v.Inactive !== 'tYES').map(toOption)

    return withCurrentOption(active, current ? toOption(current) : null)
  }, [lookups.data.vatGroups, item])

  const handleSubmit = async (formValues: ItemFormValues) => {
    const submitIntent = consumeIntent()

    try {
      const response = await upsertItemAction.executeAsync(formValues)
      const result = response?.data

      if (!result || result.error) {
        if (result && 'paths' in result) {
          result.paths?.forEach((path) => form.setError(path.field as keyof ItemFormValues, { type: 'custom', message: path.message }))
        }
        toast.error(result?.message ?? 'Something went wrong! Please try again later.')
        return
      }

      toast.success(result.message)

      const savedCode = result.data?.item?.ItemCode

      if (savedCode) {
        router.refresh()

        //* save and new stays on a blank form, editing hands off to the add page
        if (submitIntent === 'save-new') {
          //* overrides the form-level option so the fields clear
          //* the series list is fetched again, its next number just moved on
          if (isCreate) {
            form.reset(createValues, { keepDirtyValues: false })
            itemSeries.execute()
          } else router.push('/items/add')

          return
        }

        await delay(1500)

        if (isCreate) router.push('/items')
        else router.push(`/items/${encodeURIComponent(savedCode)}`)
      }
    } catch (err: any) {
      logger.error(err, '[ITEM_FORM_HANDLE_SUBMIT_ERROR]:')
      toast.error('Something went wrong! Please try again later.')
    }
  }

  return (
    <FormProvider {...form}>
      <form className='flex h-full w-full flex-1 flex-col gap-5' onSubmit={form.handleSubmit(handleSubmit)}>
        <Header title={pageMetaData.title} description={pageMetaData.description} badge={<SapLiveBadge />}>
          <div className='ml-auto flex items-center gap-2'>
            <TooltipWrapper label='Back'>
              <Button type='button' variant='outline' onClick={() => router.push('/items')}>
                <Icons.arrowLeft /> Back
              </Button>
            </TooltipWrapper>

            <CanView subject={PERMISSIONS_CODES.ITEMS} action={PERMISSIONS_ALLOWED_ACTIONS.CREATE}>
              <TooltipWrapper label='Save & New'>
                {/* //* not a submit button, it would become the form's default and take over the enter key */}
                <LoadingButton
                  type='button'
                  variant='outline-primary'
                  isLoading={upsertItemAction.isExecuting && intent === 'save-new'}
                  disabled={upsertItemAction.isExecuting}
                  onClick={() => {
                    setIntent('save-new')
                    form.handleSubmit(handleSubmit)()
                  }}
                >
                  <Icons.plus /> Save & New
                </LoadingButton>
              </TooltipWrapper>
            </CanView>

            <TooltipWrapper label='Save'>
              <LoadingButton
                type='submit'
                variant='default'
                isLoading={upsertItemAction.isExecuting && intent === 'save'}
                disabled={upsertItemAction.isExecuting}
                onClick={() => setIntent('save')}
              >
                <Icons.save /> Save
              </LoadingButton>
            </TooltipWrapper>

            {item && (
              <DropdownMenu>
                <TooltipWrapper label='More Options'>
                  <DropdownMenuTrigger asChild>
                    <Button type='button' variant='ghost' size='icon-lg'>
                      <Icons.ellipsisVertical />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipWrapper>

                <DropdownMenuContent className='w-auto min-w-20' align='end'>
                  <CanView subject={PERMISSIONS_CODES.ITEMS} action={PERMISSIONS_ALLOWED_ACTIONS.CREATE}>
                    <DropdownMenuItem onClick={() => router.push('/items/add')}>
                      <Icons.plus /> Add
                    </DropdownMenuItem>
                  </CanView>

                  <CanView subject={PERMISSIONS_CODES.ITEMS} action={PERMISSIONS_ALLOWED_ACTIONS.VIEW}>
                    <DropdownMenuItem onClick={() => router.push(`/items/${encodeURIComponent(item.ItemCode)}/view`)}>
                      <Icons.eye /> View
                    </DropdownMenuItem>
                  </CanView>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </Header>

        <ContentWrapper>
          <ScrollArea className='m-1 flex-1' type='auto'>
            <FieldGroup className='p-4'>
              <Row gap={5}>
                <Column>
                  <ReadOnlyFieldHeader title='General' description='Enter the details of the item' />
                  <Separator className='mt-4' />
                </Column>

                <Column md={6} lg={3}>
                  {isCreate ? (
                    <ComboboxField
                      control={form.control}
                      type='Basic'
                      name='Series'
                      label='Series'
                      data={seriesOptions}
                      isLoading={itemSeries.isLoading}
                      isRequired
                    />
                  ) : (
                    <ReadOnlyField title='Item No.' value={item?.ItemCode} />
                  )}
                </Column>

                <Column md={6} lg={3}>
                  <InputField control={form.control} name='ItemName' label='Description' isRequired />
                </Column>

                <Column md={6} lg={3}>
                  <ComboboxField
                    control={form.control}
                    type='Basic'
                    name='ItemType'
                    label='Item Type'
                    data={itemTypeOptions}
                    isRequired
                    callback={(args) => handleItemTypeChange(args?.item?.value)}
                  />
                </Column>

                <Column md={6} lg={3}>
                  <ComboboxField
                    control={form.control}
                    type='Basic'
                    name='ItemsGroupCode'
                    label='Item Group'
                    data={itemGroupOptions}
                    isLoading={lookups.isLoading}
                    isRequired
                  />
                </Column>

                <Column md={6} lg={3}>
                  <ComboboxField
                    control={form.control}
                    type='Basic'
                    name='Manufacturer'
                    label='Manufacturer'
                    data={manufacturerOptions}
                    isLoading={lookups.isLoading}
                  />
                </Column>

                <Column md={6} lg={3}>
                  <ComboboxField
                    control={form.control}
                    type='Basic'
                    name='SalesVATGroup'
                    label='Tax Group'
                    data={taxGroupOptions}
                    isLoading={lookups.isLoading}
                  />
                </Column>

                <Column>
                  <Separator className='mt-3 mb-4' />
                  <ReadOnlyFieldHeader title='Settings' description='How the item is used in SAP' />
                </Column>

                <Column md={6} lg={3}>
                  <SwitchField
                    control={form.control}
                    name='InventoryItem'
                    label='Inventory Item'
                    layout='choice-card'
                    description={isInventoryAllowed ? undefined : 'Only the Items type can be an inventory item'}
                    extendedProps={{ switchProps: { disabled: !isInventoryAllowed } }}
                  />
                </Column>

                <Column md={6} lg={3}>
                  <SwitchField control={form.control} name='SalesItem' label='Sales Item' layout='choice-card' />
                </Column>

                <Column md={6} lg={3}>
                  <SwitchField control={form.control} name='PurchaseItem' label='Purchase Item' layout='choice-card' />
                </Column>

                <Column md={6} lg={3}>
                  <SwitchField control={form.control} name='WTLiable' label='Withholding Tax Liable' layout='choice-card' />
                </Column>

                <Column md={6} lg={3}>
                  <SwitchField
                    control={form.control}
                    name='isActive'
                    label='Active'
                    layout='choice-card'
                    description='Inactive items are frozen in SAP'
                  />
                </Column>
              </Row>
            </FieldGroup>
          </ScrollArea>
        </ContentWrapper>
      </form>
    </FormProvider>
  )
}
