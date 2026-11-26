'use client'

import { QRCodeSVG } from 'qrcode.react'

import { PackagingUnitWithRelations } from '@/actions/packaging-unit'
import { Row } from '@/components/row'
import { Column } from '@/components/column'
import ContentWrapper from '@/components/content-wrapper'
import ReadOnlyFieldHeader from '@/components/read-only-field-header'
import { Separator } from '@/components/ui/separator'
import ReadOnlyField from '@/components/read-only-field'
import Copy from '@/components/copy'
import RecordMetaData from '@/components/record-meta-data'
import RelationLink from '@/components/relation-link'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatDate, toCodeName } from '@/lib/utils'
import { getAgingDays, getPackagingUnitTransaction } from '@/lib/packaging-unit'
import ItemMasterThumbnail from '@/app/(protected)/item-masters/_components/item-master-thumbnail'

type PackagingUnitOverviewTabProps = { unit: PackagingUnitWithRelations }

const toNumberText = (value: number | null, minimumFractionDigits = 0) =>
  value === null ? null : value.toLocaleString('en-US', { minimumFractionDigits, maximumFractionDigits: 6 })

export default function PackagingUnitOverviewTab({ unit }: PackagingUnitOverviewTabProps) {
  const { inboundItem: item } = unit
  const { itemMaster } = item
  const transaction = getPackagingUnitTransaction(unit)

  return (
    <ContentWrapper className='h-full'>
      <ScrollArea className='min-h-0 flex-1 p-4' type='auto'>
        <Row className='w-full' gap={5}>
          <Column>
            <ReadOnlyFieldHeader title='Item Master' description='The part in this package' />
            <Separator className='mt-4' />
          </Column>

          <Column>
            <div className='flex flex-col gap-5 md:flex-row md:items-start'>
              <ItemMasterThumbnail id={itemMaster.thumbnail} alt={itemMaster.ItemCode} className='size-40 rounded-xl' />

              <Row className='min-w-0 flex-1' gap={5}>
                <Column md={6}>
                  <ReadOnlyField
                    title='MFG P/N'
                    value={
                      <RelationLink href={`/item-masters/${encodeURIComponent(itemMaster.ItemCode)}/view`}>
                        {itemMaster.ItemCode}
                      </RelationLink>
                    }
                  />
                </Column>

                <Column md={6}>
                  <ReadOnlyField title='Description' value={itemMaster.ItemName} />
                </Column>

                <Column md={6}>
                  <ReadOnlyField title='Manufacturer' value={itemMaster.FirmName} />
                </Column>

                <Column md={6}>
                  <ReadOnlyField title='Group' value={itemMaster.ItmsGrpNam} />
                </Column>
              </Row>
            </div>
          </Column>

          <Column>
            <Separator className='mt-3 mb-4' />
            <ReadOnlyFieldHeader title='Unique ID' description='What came in with this package' />
          </Column>

          {/* //* qr tile on the left at its own size, fields take the rest */}
          <Column>
            <div className='flex flex-col gap-5 md:flex-row md:items-start'>
              {/* //* white backing so it still scans in dark mode */}
              <div className='flex w-fit shrink-0 flex-col items-center gap-2 rounded-xl border bg-white p-3 text-black'>
                <QRCodeSVG value={unit.code} level='M' marginSize={4} size={160} title={unit.code} />
                <span className='font-mono text-sm font-semibold'>{unit.code}</span>
              </div>

              <Row className='min-w-0 flex-1' gap={5}>
                <Column md={6}>
                  <ReadOnlyField title='Code' value={unit.code}>
                    <Copy value={unit.code} />
                  </ReadOnlyField>
                </Column>

                <Column md={6}>
                  <ReadOnlyField
                    title='Project'
                    value={
                      <RelationLink href={`/customer-projects/${encodeURIComponent(unit.customerProject.code)}/view`}>
                        {toCodeName(unit.customerProject)}
                      </RelationLink>
                    }
                  />
                </Column>

                <Column md={6}>
                  <ReadOnlyField
                    title='Project Category'
                    value={
                      <RelationLink href={`/project-categories/${encodeURIComponent(unit.projectCategory.code)}/view`}>
                        {toCodeName(unit.projectCategory)}
                      </RelationLink>
                    }
                  />
                </Column>

                <Column md={6}>
                  <ReadOnlyField title='PO Number' value={item.inbound.poNum} />
                </Column>
              </Row>
            </div>
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Owner' value={item.owner} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Part Number' value={item.partNumber} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Commodity' value={toCodeName(item.commodity)} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='DC' value={item.dateCode} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='COO' value={item.countryOfOrigin} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Lot Code' value={item.lotCode} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Packaging Type' value={toCodeName(item.packagingType)} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='SPQ' value={item.spq} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Cost' value={toNumberText(item.cost, 4)} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Quantity' description={`Received ${toNumberText(item.totalStock)}`} value={toNumberText(unit.quantity)} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Mandatory QC' value={item.isMandatoryQc ? 'Yes' : 'No'} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Aging Days' value={toNumberText(getAgingDays(unit.receivedAt))} />
          </Column>

          <Column>
            <ReadOnlyField title='Notes' value={item.notes} />
          </Column>

          <Column>
            <Separator className='mt-3 mb-4' />
            <ReadOnlyFieldHeader title='Location' description='Where the package is' />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField
              title='Site'
              value={
                <RelationLink href={`/sites/${encodeURIComponent(unit.location.site.code)}/view`}>
                  {toCodeName(unit.location.site)}
                </RelationLink>
              }
            />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField
              title='Location'
              value={
                <RelationLink href={`/locations/${encodeURIComponent(unit.location.code)}/view`}>{toCodeName(unit.location)}</RelationLink>
              }
            />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField
              title='Pallet'
              value={
                unit.palletCode ? (
                  <RelationLink href={`/pallets/${encodeURIComponent(unit.palletCode)}/view`}>{unit.palletCode}</RelationLink>
                ) : null
              }
            />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField
              title='Container'
              value={
                unit.containerCode ? (
                  <RelationLink href={`/containers/${encodeURIComponent(unit.containerCode)}/view`}>{unit.containerCode}</RelationLink>
                ) : null
              }
            />
          </Column>

          <Column>
            <Separator className='mt-3 mb-4' />
            <ReadOnlyFieldHeader title='Received' description='When and how it came in' />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Date Received' value={formatDate(new Date(unit.receivedAt), 'MMM d, yyyy h:mm a')} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField
              title='Received By'
              value={<RelationLink href={`/users/${unit.receivedByUser.code}/view`}>{unit.receivedByUser.name}</RelationLink>}
            />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField
              title='Session'
              value={
                <RelationLink href={`/sessions/${encodeURIComponent(transaction.sessionCode)}/view`}>
                  {transaction.sessionCode}
                </RelationLink>
              }
            />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Transaction' value={<RelationLink href={transaction.href}>{transaction.code}</RelationLink>} />
          </Column>

          <Column>
            <Separator className='mt-3 mb-4' />
            <ReadOnlyFieldHeader title='Record Meta Data' description="Unique ID's record meta data" />
          </Column>

          <RecordMetaData createdAt={unit.createdAt} updatedAt={unit.updatedAt} createdBy={unit.createdBy} updatedBy={unit.updatedBy} />
        </Row>
      </ScrollArea>
    </ContentWrapper>
  )
}
