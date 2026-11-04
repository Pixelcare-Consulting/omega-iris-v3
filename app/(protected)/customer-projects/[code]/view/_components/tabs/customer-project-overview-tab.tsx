'use client'

import { CustomerProjectWithRelations } from '@/actions/customer-project'
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

type CustomerProjectOverviewTabProps = { customerProject: CustomerProjectWithRelations }

export default function CustomerProjectOverviewTab({ customerProject }: CustomerProjectOverviewTabProps) {
  return (
    <ContentWrapper className='h-full'>
      <ScrollArea className='min-h-0 flex-1 p-4' type='auto'>
        <Row className='w-full' gap={5}>
          <Column>
            <ReadOnlyFieldHeader title='Overview' description="Customer project's overview information" />
            <Separator className='mt-4' />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Code' value={customerProject.code}>
              <Copy value={customerProject.code} />
            </ReadOnlyField>
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Name' value={customerProject.name} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField
              title='Category'
              value={
                customerProject.category ? (
                  <RelationLink href={`/project-categories/${customerProject.category.code}/view`}>
                    {customerProject.category.code} - {customerProject.category.name}
                    {customerProject.category.deletedAt ? ' (Deleted)' : !customerProject.category.isActive ? ' (Inactive)' : ''}
                  </RelationLink>
                ) : (
                  ''
                )
              }
            />
          </Column>

          <Column>
            <ReadOnlyField title='Description' value={customerProject.description} />
          </Column>

          <Column>
            <Separator className='mt-3 mb-4' />
            <ReadOnlyFieldHeader title='Settings' description="Customer project's setting" />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField
              title='Active'
              description='Inactive projects are hidden from selection'
              value={customerProject.isActive ? 'Yes' : 'No'}
            />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='System' description='System generated, view only' value={customerProject.isSystem ? 'Yes' : 'No'} />
          </Column>

          <Column>
            <Separator className='mt-3 mb-4' />
            <ReadOnlyFieldHeader title='Record Meta Data' description="Customer project's record meta data" />
          </Column>

          <RecordMetaData
            createdAt={customerProject.createdAt}
            updatedAt={customerProject.updatedAt}
            deletedAt={customerProject.deletedAt}
            createdBy={customerProject.createdBy}
            updatedBy={customerProject.updatedBy}
            deletedBy={customerProject.deletedBy}
          />
        </Row>
      </ScrollArea>
    </ContentWrapper>
  )
}
