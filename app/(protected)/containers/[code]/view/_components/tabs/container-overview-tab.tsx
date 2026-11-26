'use client'

import { ContainerWithRelations } from '@/actions/container'
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
import { CONTAINER_TYPE_LABELS } from '@/constants/container'
import { formatDate, toCodeName } from '@/lib/utils'
import { QRCodeSVG } from 'qrcode.react'

type ContainerOverviewTabProps = { container: ContainerWithRelations }

export default function ContainerOverviewTab({ container }: ContainerOverviewTabProps) {
  return (
    <ContentWrapper className='h-full'>
      <ScrollArea className='min-h-0 flex-1 p-4' type='auto'>
        <Row className='w-full' gap={5}>
          <Column>
            <ReadOnlyFieldHeader title='Details' description="Container's details" />
            <Separator className='mt-4' />
          </Column>

          {/* //* qr tile on the left at its own size, fields take the rest */}
          <Column>
            <div className='flex flex-col gap-5 md:flex-row md:items-start'>
              {/* //* white backing so it still scans in dark mode */}
              <div className='flex w-fit shrink-0 flex-col items-center gap-2 rounded-xl border bg-white p-3 text-black'>
                <QRCodeSVG value={container.code} level='M' marginSize={4} size={160} title={container.code} />
                <span className='font-mono text-sm font-semibold'>{container.code}</span>
              </div>

              <Row className='min-w-0 flex-1' gap={5}>
                <Column md={6}>
                  <ReadOnlyField title='Code' value={container.code}>
                    <Copy value={container.code} />
                  </ReadOnlyField>
                </Column>

                <Column md={6}>
                  <ReadOnlyField title='Status' value={STORAGE_UNIT_STATUS_LABELS[container.status]} />
                </Column>

                <Column md={6}>
                  <ReadOnlyField title='Type' value={CONTAINER_TYPE_LABELS[container.type]} />
                </Column>
              </Row>
            </div>
          </Column>

          <Column>
            <Separator className='mt-3 mb-4' />
            <ReadOnlyFieldHeader title='Location' description='Where the container is' />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField
              title='Location'
              value={
                <RelationLink href={`/locations/${encodeURIComponent(container.location.code)}/view`}>
                  {toCodeName(container.location)}
                </RelationLink>
              }
            />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Pallet Allowed' value={container.location.isPalletAllowed ? 'Yes' : 'No'} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField
              title='Last Cycle Count'
              value={container.lastCycleCount ? formatDate(new Date(container.lastCycleCount), 'MMM d, yyyy h:mm a') : null}
            />
          </Column>

          <Column>
            <Separator className='mt-3 mb-4' />
            <ReadOnlyFieldHeader title='Project' description='Who the container is for' />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='General Purpose' value={container.isGeneralPurpose ? 'Yes' : 'No'} />
          </Column>

          {!container.isGeneralPurpose && (
            <>
              <Column md={6} lg={3}>
                <ReadOnlyField
                  title='Project Category'
                  value={
                    container.projectCategory ? (
                      <RelationLink href={`/project-categories/${encodeURIComponent(container.projectCategory.code)}/view`}>
                        {toCodeName(container.projectCategory)}
                      </RelationLink>
                    ) : null
                  }
                />
              </Column>

              <Column md={6} lg={3}>
                <ReadOnlyField
                  title='Customer Project'
                  value={
                    container.customerProject ? (
                      <RelationLink href={`/customer-projects/${encodeURIComponent(container.customerProject.code)}/view`}>
                        {toCodeName(container.customerProject)}
                      </RelationLink>
                    ) : null
                  }
                />
              </Column>
            </>
          )}

          <Column>
            <Separator className='mt-3 mb-4' />
            <ReadOnlyFieldHeader title='Pallet' description='The pallet the container sits on' />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField
              title='Pallet'
              value={
                container.palletCode ? (
                  <RelationLink href={`/pallets/${encodeURIComponent(container.palletCode)}/view`}>{container.palletCode}</RelationLink>
                ) : null
              }
            />
          </Column>

          <Column>
            <Separator className='mt-3 mb-4' />
            <ReadOnlyFieldHeader title='Record Meta Data' description="Container's record meta data" />
          </Column>

          <RecordMetaData
            createdAt={container.createdAt}
            updatedAt={container.updatedAt}
            deletedAt={container.deletedAt}
            createdBy={container.createdBy}
            updatedBy={container.updatedBy}
            deletedBy={container.deletedBy}
          />
        </Row>
      </ScrollArea>
    </ContentWrapper>
  )
}
