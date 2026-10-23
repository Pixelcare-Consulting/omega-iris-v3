'use client'

import { Row } from '@/components/row'
import { getRoleByCode } from '@/actions/role'
import { Column } from '@/components/column'
import ContentWrapper from '@/components/content-wrapper'
import ReadOnlyFieldHeader from '@/components/read-only-field-header'
import { Separator } from '@/components/ui/separator'
import ReadOnlyField from '@/components/read-only-field'
import Copy from '@/components/copy'
import RecordMetaData from '@/components/record-meta-data'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { formatBadgeColorLabel, toBadgeVariant } from '@/lib/color'

type RoleOverviewTabProps = { role: NonNullable<Awaited<ReturnType<typeof getRoleByCode>>> }

export default function RoleOverviewTab({ role }: RoleOverviewTabProps) {
  return (
    <ContentWrapper className='h-full'>
      <ScrollArea className='min-h-0 flex-1 p-4' type='auto'>
        <Row className='w-full' gap={5}>
          <Column>
            <ReadOnlyFieldHeader title='Overview' description="Role's overview information" />
            <Separator className='mt-4' />
          </Column>

          <Column md={6} lg={4}>
            <ReadOnlyField title='ID' value={role.code}>
              <Copy value={role.code} />
            </ReadOnlyField>
          </Column>

          <Column md={6} lg={4}>
            <ReadOnlyField title='Name' value={role.name} />
          </Column>

          <Column md={6} lg={4}>
            <ReadOnlyField title='Key' value={role.key} />
          </Column>

          <Column md={6} lg={4}>
            <ReadOnlyField
              title='Color'
              description='Color of badge when displayed'
              value={role.color ? <Badge variant={toBadgeVariant(role.color)}>{formatBadgeColorLabel(role.color)}</Badge> : ''}
            />
          </Column>

          <Column>
            <ReadOnlyField title='Description' value={role.description} />
          </Column>

          <Column>
            <Separator className='mt-3 mb-4' />
            <ReadOnlyFieldHeader title='Record Meta Data' description="Role's record meta data" />
          </Column>

          <RecordMetaData
            createdAt={role.createdAt}
            updatedAt={role.updatedAt}
            deletedAt={role.deletedAt}
            createdBy={role.createdBy}
            updatedBy={role.updatedBy}
            deletedBy={role.deletedBy}
          />
        </Row>
      </ScrollArea>
    </ContentWrapper>
  )
}
