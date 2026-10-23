'use client'

import { useRouter, useSearchParams } from 'next/navigation'

import { getRoleByCode } from '@/actions/role'
import Header from '@/components/header'
import { Icons } from '@/components/icons'
import { TooltipWrapper } from '@/components/tooltip-wrapper'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import RoleOverviewTab from './tabs/role-overview-tab'
import { usePermissions } from '@/hooks/safe-actions/permission'
import { useRolePermissions } from '@/hooks/safe-actions/role-permission'
import RolePermissionsTab from './tabs/role-permissions-tab'
import RoleSapDatabasesTab from './tabs/role-sap-databases-tab'
import { DEFAULT_TAB } from '@/constants/common'
import { handleTabChange } from '@/lib/event-handler'
import CanView from '@/components/rbac/can-view'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'

type ViewRoleProps = { role: NonNullable<Awaited<ReturnType<typeof getRoleByCode>>> }

export default function ViewRole({ role }: ViewRoleProps) {
  const TABS_TITLE = ['Overview', 'Permissions', 'SAP Databases'] as const
  const TABS_CONTENT_VALUE = TABS_TITLE.map((_, index) => String(index))

  const router = useRouter()
  const searchParams = useSearchParams()

  const permissions = usePermissions()
  const rolePermissions = useRolePermissions(role.code)

  const tabParam = searchParams.get('tab')
  const activeTab = tabParam && TABS_CONTENT_VALUE.includes(tabParam) ? tabParam : DEFAULT_TAB

  return (
    <div className='flex h-full w-full flex-1 flex-col gap-5'>
      <Header title='Roles' description='Manage and track your roles effectively'>
        <div className='ml-auto flex items-center gap-2'>
          <TooltipWrapper label='Back'>
            <Button type='button' variant='outline' onClick={() => router.push('/roles')}>
              <Icons.arrowLeft /> Back
            </Button>
          </TooltipWrapper>

          <DropdownMenu>
            <TooltipWrapper label='More Options'>
              <DropdownMenuTrigger asChild>
                <Button variant='ghost' size='icon-lg'>
                  <Icons.ellipsisVertical />
                </Button>
              </DropdownMenuTrigger>
            </TooltipWrapper>
            <DropdownMenuContent className='w-auto min-w-20' align='end'>
              <CanView subject={PERMISSIONS_CODES.ROLES} action={PERMISSIONS_ALLOWED_ACTIONS.CREATE}>
                <DropdownMenuItem onClick={() => router.push('/roles/add')}>
                  <Icons.plus /> Add
                </DropdownMenuItem>
              </CanView>

              <CanView subject={PERMISSIONS_CODES.ROLES} action={PERMISSIONS_ALLOWED_ACTIONS.EDIT}>
                <DropdownMenuItem onClick={() => router.push(`/roles/${role.code}`)}>
                  <Icons.pencil /> Edit
                </DropdownMenuItem>
              </CanView>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Header>

      <Tabs
        value={activeTab}
        onValueChange={(value) => handleTabChange(router, searchParams, value)}
        className='flex min-h-0 w-full flex-1 flex-col'
      >
        <ScrollArea className='w-full shrink-0 pb-2.5 **:data-[orientation=vertical]:hidden' type='auto'>
          <TabsList className='w-max'>
            {TABS_TITLE.map((title, index) => (
              <TabsTrigger key={title} value={String(index)} className='shrink-0'>
                {title}
              </TabsTrigger>
            ))}
          </TabsList>
        </ScrollArea>

        <TabsContent value='0' className='min-h-0 flex-1'>
          <RoleOverviewTab role={role} />
        </TabsContent>

        <TabsContent value='1' className='min-h-0 flex-1'>
          <RolePermissionsTab permissions={permissions} rolePermissions={rolePermissions} />
        </TabsContent>

        <TabsContent value='2' className='min-h-0 flex-1'>
          <RoleSapDatabasesTab role={role} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
