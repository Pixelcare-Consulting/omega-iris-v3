'use client'

import { PalletWithRelations } from '@/actions/pallet'
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
import { STORAGE_UNIT_STATUS_LABELS } from '@/constants/storage-unit'
import { formatDate, toCodeName } from '@/lib/utils'
import { QRCodeSVG } from 'qrcode.react'

type PalletOverviewTabProps = { pallet: PalletWithRelations }

export default function PalletOverviewTab({ pallet }: PalletOverviewTabProps) {
  return (
    <ContentWrapper className='h-full'>
      <ScrollArea className='min-h-0 flex-1 p-4' type='auto'>
        <Row className='w-full' gap={5}>
          <Column>
            <ReadOnlyFieldHeader title='Details' description="Pallet's details" />
            <Separator className='mt-4' />
          </Column>

          {/* //* qr tile on the left at its own size, fields take the rest */}
          <Column>
            <div className='flex flex-col gap-5 md:flex-row md:items-start'>
              {/* //* white backing so it still scans in dark mode */}
              <div className='flex w-fit shrink-0 flex-col items-center gap-2 rounded-xl border bg-white p-3 text-black'>
                <QRCodeSVG value={pallet.code} level='M' marginSize={4} size={160} title={pallet.code} />
                <span className='font-mono text-sm font-semibold'>{pallet.code}</span>
              </div>

              <Row className='min-w-0 flex-1' gap={5}>
                <Column md={6}>
                  <ReadOnlyField title='Code' value={pallet.code}>
                    <Copy value={pallet.code} />
                  </ReadOnlyField>
                </Column>

                <Column md={6}>
                  <ReadOnlyField title='Status' value={STORAGE_UNIT_STATUS_LABELS[pallet.status]} />
                </Column>
              </Row>
            </div>
          </Column>

          <Column>
            <Separator className='mt-3 mb-4' />
            <ReadOnlyFieldHeader title='Location' description='Where the pallet is' />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField
              title='Location'
              value={
                <RelationLink href={`/locations/${encodeURIComponent(pallet.location.code)}/view`}>
                  {toCodeName(pallet.location)}
                </RelationLink>
              }
            />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Displacement Count' description='Times the pallet was moved' value={String(pallet.displacementCount)} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField
              title='Last Cycle Count'
              value={pallet.lastCycleCount ? formatDate(new Date(pallet.lastCycleCount), 'MMM d, yyyy h:mm a') : null}
            />
          </Column>

          <Column>
            <Separator className='mt-3 mb-4' />
            <ReadOnlyFieldHeader title='Project' description='Who the pallet is for' />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='General Purpose' value={pallet.isGeneralPurpose ? 'Yes' : 'No'} />
          </Column>

          {!pallet.isGeneralPurpose && (
            <>
              <Column md={6} lg={3}>
                <ReadOnlyField
                  title='Project Category'
                  value={
                    pallet.projectCategory ? (
                      <RelationLink href={`/project-categories/${encodeURIComponent(pallet.projectCategory.code)}/view`}>
                        {toCodeName(pallet.projectCategory)}
                      </RelationLink>
                    ) : null
                  }
                />
              </Column>

              <Column md={6} lg={3}>
                <ReadOnlyField
                  title='Customer Project'
                  value={
                    pallet.customerProject ? (
                      <RelationLink href={`/customer-projects/${encodeURIComponent(pallet.customerProject.code)}/view`}>
                        {toCodeName(pallet.customerProject)}
                      </RelationLink>
                    ) : null
                  }
                />
              </Column>
            </>
          )}

          <Column>
            <Separator className='mt-3 mb-4' />
            <ReadOnlyFieldHeader title='Record Meta Data' description="Pallet's record meta data" />
          </Column>

          <RecordMetaData
            createdAt={pallet.createdAt}
            updatedAt={pallet.updatedAt}
            deletedAt={pallet.deletedAt}
            createdBy={pallet.createdBy}
            updatedBy={pallet.updatedBy}
            deletedBy={pallet.deletedBy}
          />
        </Row>
      </ScrollArea>
    </ContentWrapper>
  )
}
