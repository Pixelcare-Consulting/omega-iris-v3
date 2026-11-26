'use client'

import { useRouter, useSearchParams } from 'next/navigation'

import { InboundWithInclude } from '@/actions/inbound'
import Header from '@/components/header'
import { Icons } from '@/components/icons'
import { TooltipWrapper } from '@/components/tooltip-wrapper'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import ActivityTimeline from '@/components/activity-log/activity-timeline'
import InboundOverviewTab from './tabs/inbound-overview-tab'
import InboundPackagesTab from './tabs/inbound-packages-tab'
import { DEFAULT_TAB } from '@/constants/common'
import { handleTabChange } from '@/lib/event-handler'

type ViewInboundProps = { inbound: InboundWithInclude }

export default function ViewInbound({ inbound }: ViewInboundProps) {
  const TABS_TITLE = ['Overview', 'Packages', 'Activity'] as const
  const TABS_CONTENT_VALUE = TABS_TITLE.map((_, index) => String(index))

  const router = useRouter()
  const searchParams = useSearchParams()

  const tabParam = searchParams.get('tab')
  const activeTab = tabParam && TABS_CONTENT_VALUE.includes(tabParam) ? tabParam : DEFAULT_TAB

  return (
    <div className='flex h-full w-full flex-1 flex-col gap-5'>
      <Header title='Inbounds' description='Inbound transactions received across sessions'>
        <div className='ml-auto flex items-center gap-2'>
          <TooltipWrapper label='Back'>
            <Button type='button' variant='outline' onClick={() => router.push('/inbound')}>
              <Icons.arrowLeft /> Back
            </Button>
          </TooltipWrapper>
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
          <InboundOverviewTab inbound={inbound} />
        </TabsContent>

        <TabsContent value='1' className='min-h-0 flex-1'>
          <InboundPackagesTab inbound={inbound} />
        </TabsContent>

        <TabsContent value='2' className='min-h-0 flex-1'>
          <ActivityTimeline module='INBOUNDS' entityId={inbound.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
