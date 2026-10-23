'use client'

import { Row } from '@/components/row'
import { getUserByCode } from '@/actions/user'
import { Column } from '@/components/column'
import ContentWrapper from '@/components/content-wrapper'
import ReadOnlyFieldHeader from '@/components/read-only-field-header'
import { Separator } from '@/components/ui/separator'
import ReadOnlyField from '@/components/read-only-field'
import Copy from '@/components/copy'
import RecordMetaData from '@/components/record-meta-data'
import { ScrollArea } from '@/components/ui/scroll-area'
import RelationLink from '@/components/relation-link'

type UserOverviewTabProps = { user: NonNullable<Awaited<ReturnType<typeof getUserByCode>>> }

export default function UserOverviewTab({ user }: UserOverviewTabProps) {
  return (
    <ContentWrapper className='h-full'>
      <ScrollArea className='min-h-0 flex-1 p-4' type='auto'>
        <Row className='w-full' gap={5}>
          <Column>
            <ReadOnlyFieldHeader title='Overview' description="User's overview information" />
            <Separator className='mt-4' />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='ID' value={user.code}>
              <Copy value={user.code} />
            </ReadOnlyField>
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='First Name' value={user.fname} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Middle Name' value={user.mname} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Last Name' value={user.lname} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Suffix' value={user.suffix} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Username' value={user.username} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Email' value={user.email} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Role' value={<RelationLink href={`/roles/${user.role.code}/view`}>{user.role.name}</RelationLink>} />
          </Column>

          <Column>
            <Separator className='mt-3 mb-4' />
            <ReadOnlyFieldHeader title='Setting' description='User configured settings' />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Active' value={user.isActive ? 'Yes' : 'No'} description='Is this user active?' />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField
              title='Force To Change Password'
              value={user.isActive ? 'Yes' : 'No'}
              description='Required the user to change their password upon next login'
            />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Locked' value={user.isLocked ? 'Yes' : 'No'} description='Locked user cannot sign in' />
          </Column>

          <Column>
            <Separator className='mt-3 mb-4' />
            <ReadOnlyFieldHeader title='Record Meta Data' description="User's record meta data" />
          </Column>

          <RecordMetaData
            createdAt={user.createdAt}
            updatedAt={user.updatedAt}
            deletedAt={user.deletedAt}
            createdBy={user.createdBy}
            updatedBy={user.updatedBy}
            deletedBy={user.deletedBy}
          />
        </Row>
      </ScrollArea>
    </ContentWrapper>
  )
}
