'use client'

import { ItemLookups } from '@/actions/item'
import { SapItem } from '@/types/sap'
import { Row } from '@/components/row'
import { Column } from '@/components/column'
import ContentWrapper from '@/components/content-wrapper'
import ReadOnlyFieldHeader from '@/components/read-only-field-header'
import ReadOnlyField from '@/components/read-only-field'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import Copy from '@/components/copy'
import { isItemActive } from '@/lib/item'
import { fromYesNo, formatSapDateTime } from '@/lib/sap/utils'
import { toOptionLabel } from '@/constants/business-partner'
import { ITEM_TYPE_OPTIONS } from '@/constants/item'

type ItemOverviewTabProps = { item: SapItem; lookups: ItemLookups | null }

export default function ItemOverviewTab({ item, lookups }: ItemOverviewTabProps) {
  const itemGroupName = lookups?.itemGroups.find((g) => g.Number === item.ItemsGroupCode)?.GroupName ?? ''
  const manufacturerName = lookups?.manufacturers.find((m) => m.Code === item.Manufacturer)?.ManufacturerName ?? ''
  const taxGroupName = lookups?.vatGroups.find((v) => v.Code === item.SalesVATGroup)?.Name ?? ''
  const isActive = isItemActive(item)

  return (
    <ContentWrapper className='h-full'>
      <ScrollArea className='min-h-0 flex-1 p-4' type='auto'>
        <Row className='w-full' gap={5}>
          <Column>
            <ReadOnlyFieldHeader title='General' description="Item's general information" />
            <Separator className='mt-4' />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Item No.' value={item.ItemCode}>
              <Copy value={item.ItemCode} />
            </ReadOnlyField>
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Description' value={item.ItemName} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Item Type' value={toOptionLabel(ITEM_TYPE_OPTIONS, item.ItemType)} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Item Group' value={itemGroupName} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Manufacturer' value={manufacturerName} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Tax Group' value={taxGroupName} />
          </Column>

          <Column>
            <Separator className='mt-3 mb-4' />
            <ReadOnlyFieldHeader title='Settings' description='How the item is used in SAP' />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Inventory Item' value={fromYesNo(item.InventoryItem) ? 'Yes' : 'No'} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Sales Item' value={fromYesNo(item.SalesItem) ? 'Yes' : 'No'} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Purchase Item' value={fromYesNo(item.PurchaseItem) ? 'Yes' : 'No'} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Withholding Tax Liable' value={fromYesNo(item.WTLiable) ? 'Yes' : 'No'} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Active' value={isActive ? 'Yes' : 'No'} description='Inactive items are frozen in SAP' />
          </Column>

          <Column>
            <Separator className='mt-3 mb-4' />
            <ReadOnlyFieldHeader title='Record Meta Data' description="Item's record meta data" />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField
              title='Created At'
              value={formatSapDateTime(item.CreateDate, item.CreateTime, 'MM-dd-yyyy hh:mm a', 'MM-dd-yyyy')}
            />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField
              title='Updated At'
              value={formatSapDateTime(item.UpdateDate, item.UpdateTime, 'MM-dd-yyyy hh:mm a', 'MM-dd-yyyy')}
            />
          </Column>
        </Row>
      </ScrollArea>
    </ContentWrapper>
  )
}
