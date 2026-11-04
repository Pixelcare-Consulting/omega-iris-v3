'use client'

import { ProjectCategory } from '@/prisma/generated/client'
import { Row } from '@/components/row'
import { Column } from '@/components/column'
import ContentWrapper from '@/components/content-wrapper'
import ReadOnlyFieldHeader from '@/components/read-only-field-header'
import { Separator } from '@/components/ui/separator'
import ReadOnlyField from '@/components/read-only-field'
import Copy from '@/components/copy'
import RecordMetaData from '@/components/record-meta-data'
import { ScrollArea } from '@/components/ui/scroll-area'

type ProjectCategoryOverviewTabProps = { projectCategory: ProjectCategory }

export default function ProjectCategoryOverviewTab({ projectCategory }: ProjectCategoryOverviewTabProps) {
  return (
    <ContentWrapper className='h-full'>
      <ScrollArea className='min-h-0 flex-1 p-4' type='auto'>
        <Row className='w-full' gap={5}>
          <Column>
            <ReadOnlyFieldHeader title='Overview' description="Project category's overview information" />
            <Separator className='mt-4' />
          </Column>

          <Column md={6} lg={4}>
            <ReadOnlyField title='Code' value={projectCategory.code}>
              <Copy value={projectCategory.code} />
            </ReadOnlyField>
          </Column>

          <Column md={6} lg={4}>
            <ReadOnlyField title='Name' value={projectCategory.name} />
          </Column>

          <Column md={6} lg={4}>
            <ReadOnlyField title='Active' value={projectCategory.isActive ? 'Yes' : 'No'} />
          </Column>

          <Column md={6} lg={4}>
            <ReadOnlyField title='System' description='System generated, view only' value={projectCategory.isSystem ? 'Yes' : 'No'} />
          </Column>

          <Column>
            <ReadOnlyField title='Description' value={projectCategory.description} />
          </Column>

          <Column>
            <Separator className='mt-3 mb-4' />
            <ReadOnlyFieldHeader title='Record Meta Data' description="Project category's record meta data" />
          </Column>

          <RecordMetaData
            createdAt={projectCategory.createdAt}
            updatedAt={projectCategory.updatedAt}
            deletedAt={projectCategory.deletedAt}
            createdBy={projectCategory.createdBy}
            updatedBy={projectCategory.updatedBy}
            deletedBy={projectCategory.deletedBy}
          />
        </Row>
      </ScrollArea>
    </ContentWrapper>
  )
}
