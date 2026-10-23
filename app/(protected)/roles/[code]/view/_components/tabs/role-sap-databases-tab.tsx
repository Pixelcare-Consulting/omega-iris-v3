'use client'

import { getRoleByCode } from '@/actions/role'
import { Row } from '@/components/row'
import { Column } from '@/components/column'
import ContentWrapper from '@/components/content-wrapper'
import ReadOnlyFieldHeader from '@/components/read-only-field-header'
import EmptyState from '@/components/empty-state'
import Alert from '@/components/alert'
import { Icons } from '@/components/icons'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SUPER_USER_ROLE_KEY } from '@/constants/role'

type RoleSapDatabasesTabProps = { role: NonNullable<Awaited<ReturnType<typeof getRoleByCode>>> }

export default function RoleSapDatabasesTab({ role }: RoleSapDatabasesTabProps) {
  const isSuperUser = role.key === SUPER_USER_ROLE_KEY

  return (
    <ContentWrapper className='h-full'>
      <ScrollArea className='min-h-0 flex-1 p-4' type='auto'>
        <Row className='w-full' gap={5}>
          <Column>
            <ReadOnlyFieldHeader title='SAP Databases' description='Databases users with this role can pick after signing in' />
            <Separator className='mt-4' />
          </Column>

          {isSuperUser && (
            <Column>
              <Alert variant='default' message='This role always has access to every SAP database.' />
            </Column>
          )}

          {!isSuperUser && role.roleSapDatabases.length < 1 && (
            <Column>
              <EmptyState
                title='No SAP databases'
                description='Users with this role cannot pick a company yet.'
                icon={<Icons.database />}
              />
            </Column>
          )}

          {!isSuperUser &&
            role.roleSapDatabases.map(({ sapDatabase }) => (
              <Column key={sapDatabase.dbCode} md={6} lg={4}>
                <div className='flex items-center gap-3 rounded-md border p-3'>
                  <Icons.database className='text-muted-foreground size-5 shrink-0' />

                  <div className='flex min-w-0 flex-col'>
                    <span className='truncate text-sm font-medium'>{sapDatabase.name}</span>
                    <span className='text-muted-foreground truncate text-xs'>{sapDatabase.dbCode}</span>
                  </div>

                  {!sapDatabase.isActive && (
                    <Badge variant='secondary' className='ml-auto'>
                      Inactive
                    </Badge>
                  )}
                </div>
              </Column>
            ))}
        </Row>
      </ScrollArea>
    </ContentWrapper>
  )
}
