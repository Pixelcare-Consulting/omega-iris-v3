'use client'

import { ItemMasterWithRelations } from '@/actions/item-master'
import RelationLink from '@/components/relation-link'
import { Row } from '@/components/row'
import { Column } from '@/components/column'
import ContentWrapper from '@/components/content-wrapper'
import ReadOnlyFieldHeader from '@/components/read-only-field-header'
import { Separator } from '@/components/ui/separator'
import ReadOnlyField from '@/components/read-only-field'
import Copy from '@/components/copy'
import RecordMetaData from '@/components/record-meta-data'
import { ScrollArea } from '@/components/ui/scroll-area'
import ItemMasterThumbnail from '@/app/(protected)/item-masters/_components/item-master-thumbnail'
import { buildFileAttachmentUrl } from '@/lib/file-attachment'

type ItemMasterOverviewTabProps = { itemMaster: ItemMasterWithRelations }

type Reference = { code: string; name: string; isActive: boolean; deletedAt: Date | null }

//* fills the column as a square, like the form's tile
const THUMBNAIL_TILE_CLASS_NAME = 'bg-muted/50 aspect-square h-auto w-full rounded-xl object-contain'

const toStatusSuffix = (reference: Reference) => (reference.deletedAt ? ' (Deleted)' : !reference.isActive ? ' (Inactive)' : '')

export default function ItemMasterOverviewTab({ itemMaster }: ItemMasterOverviewTabProps) {
  const { manufacturer, commodity, thumbnail } = itemMaster

  return (
    <ContentWrapper className='h-full'>
      <ScrollArea className='min-h-0 flex-1 p-4' type='auto'>
        <Row className='w-full' gap={5}>
          <Column>
            <ReadOnlyFieldHeader title='Overview' description="Item's overview information" />
            <Separator className='mt-4' />
          </Column>

          {/* //* thumbnail tile on the left, fields on the right, same as the form */}
          <Column md={4} lg={3}>
            {/* //* opens the full image, the placeholder has nothing to open */}
            {thumbnail ? (
              <a href={buildFileAttachmentUrl(thumbnail)} target='_blank' rel='noreferrer' className='flex flex-col gap-2'>
                <ItemMasterThumbnail id={thumbnail} alt={itemMaster.code} className={THUMBNAIL_TILE_CLASS_NAME} />
                <span className='text-muted-foreground text-center text-xs'>Click to open the full image</span>
              </a>
            ) : (
              <ItemMasterThumbnail alt={itemMaster.code} className={THUMBNAIL_TILE_CLASS_NAME} />
            )}
          </Column>

          <Column md={8} lg={9}>
            <Row gap={5}>
              <Column md={6}>
                <ReadOnlyField title='MFG P/N' value={itemMaster.code}>
                  <Copy value={itemMaster.code} />
                </ReadOnlyField>
              </Column>

              <Column md={6}>
                <ReadOnlyField
                  title='Manufacturer'
                  value={
                    manufacturer ? (
                      <RelationLink href={`/manufacturers/${manufacturer.code}/view`}>
                        {manufacturer.code} - {manufacturer.name}
                        {toStatusSuffix(manufacturer)}
                      </RelationLink>
                    ) : (
                      ''
                    )
                  }
                />
              </Column>

              <Column md={6}>
                <ReadOnlyField title='Description' value={itemMaster.description} />
              </Column>

              <Column md={6}>
                <ReadOnlyField
                  title='Commodity'
                  value={
                    commodity ? (
                      <RelationLink href={`/commodities/${commodity.code}/view`}>
                        {commodity.code} - {commodity.name}
                        {toStatusSuffix(commodity)}
                      </RelationLink>
                    ) : (
                      ''
                    )
                  }
                />
              </Column>

              <Column>
                <ReadOnlyField title='Notes' value={itemMaster.notes} />
              </Column>
            </Row>
          </Column>

          <Column>
            <Separator className='mt-3 mb-4' />
            <ReadOnlyFieldHeader title='Settings' description="Item's setting" />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField
              title='Active'
              description='Inactive items are hidden from selection'
              value={itemMaster.isActive ? 'Yes' : 'No'}
            />
          </Column>

          <Column>
            <Separator className='mt-3 mb-4' />
            <ReadOnlyFieldHeader title='Record Meta Data' description="Item's record meta data" />
          </Column>

          <RecordMetaData
            createdAt={itemMaster.createdAt}
            updatedAt={itemMaster.updatedAt}
            deletedAt={itemMaster.deletedAt}
            createdBy={itemMaster.createdBy}
            updatedBy={itemMaster.updatedBy}
            deletedBy={itemMaster.deletedBy}
          />
        </Row>
      </ScrollArea>
    </ContentWrapper>
  )
}
