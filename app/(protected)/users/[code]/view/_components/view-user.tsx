'use client'

import { useRouter, useSearchParams } from 'next/navigation'

import { getUserByCode } from '@/actions/user'
import Header from '@/components/header'
import { Icons } from '@/components/icons'
import { TooltipWrapper } from '@/components/tooltip-wrapper'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import UserOverviewTab from './tabs/user-overview-tab'
import ActivityTimeline from '@/components/activity-log/activity-timeline'
import { DEFAULT_TAB } from '@/constants/common'
import { handleTabChange } from '@/lib/event-handler'
import CanView from '@/components/rbac/can-view'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'

type ViewUserProps = { user: NonNullable<Awaited<ReturnType<typeof getUserByCode>>> }

export default function ViewUser({ user }: ViewUserProps) {
  const TABS_TITLE = ['Overview', 'Activity'] as const
  const TABS_CONTENT_VALUE = TABS_TITLE.map((_, index) => String(index))

  const router = useRouter()
  const searchParams = useSearchParams()

  const tabParam = searchParams.get('tab')
  const activeTab = tabParam && TABS_CONTENT_VALUE.includes(tabParam) ? tabParam : DEFAULT_TAB

  return (
    <div className='flex h-full w-full flex-1 flex-col gap-5'>
      <Header title='Users' description='Manage and track your users effectively'>
        <div className='ml-auto flex items-center gap-2'>
          <TooltipWrapper label='Back'>
            <Button type='button' variant='outline' onClick={() => router.push('/users')}>
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
              <CanView subject={PERMISSIONS_CODES.USERS} action={PERMISSIONS_ALLOWED_ACTIONS.CREATE}>
                <DropdownMenuItem onClick={() => router.push('/users/add')}>
                  <Icons.plus /> Add
                </DropdownMenuItem>
              </CanView>

              {/* //* a system user can only be viewed */}
              {!user.isSystem && (
                <CanView subject={PERMISSIONS_CODES.USERS} action={PERMISSIONS_ALLOWED_ACTIONS.EDIT}>
                  <DropdownMenuItem onClick={() => router.push(`/users/${user.code}`)}>
                    <Icons.pencil /> Edit
                  </DropdownMenuItem>
                </CanView>
              )}
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
          <UserOverviewTab user={user} />
        </TabsContent>

        <TabsContent value='1' className='min-h-0 flex-1'>
          <ActivityTimeline module='USERS' entityId={user.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
