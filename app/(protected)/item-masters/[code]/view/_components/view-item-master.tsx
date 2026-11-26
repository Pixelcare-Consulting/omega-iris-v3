'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'

import { syncItemMastersToSap } from '@/actions/item-master-sync'
import LoadingButton from '@/components/forms/button-field'
import { logger } from '@/lib/logger'
import { ItemMasterRow } from '@/actions/item-master'
import Header from '@/components/header'
import { Icons } from '@/components/icons'
import { TooltipWrapper } from '@/components/tooltip-wrapper'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import ItemMasterOverviewTab from './tabs/item-master-overview-tab'
import { DEFAULT_TAB } from '@/constants/common'
import { handleTabChange } from '@/lib/event-handler'
import CanView from '@/components/rbac/can-view'
import ActivityTimeline from '@/components/activity-log/activity-timeline'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'

type ViewItemMasterProps = { itemMaster: ItemMasterRow }

export default function ViewItemMaster({ itemMaster }: ViewItemMasterProps) {
  const TABS_TITLE = ['Overview', 'Activity'] as const
  const TABS_CONTENT_VALUE = TABS_TITLE.map((_, index) => String(index))

  const router = useRouter()
  const searchParams = useSearchParams()

  const tabParam = searchParams.get('tab')
  const activeTab = tabParam && TABS_CONTENT_VALUE.includes(tabParam) ? tabParam : DEFAULT_TAB

  const syncAction = useAction(syncItemMastersToSap)

  //* the first error entry is the one to show, the row keeps sap's message too
  const handleSyncToSap = async () => {
    try {
      const response = await syncAction.executeAsync({ ids: [itemMaster.id] })
      const result = response?.data

      if (!result || result.error || !result.data) {
        toast.error(result?.message ?? 'Failed to sync to SAP!')
        return
      }

      const error = result.data.errors[0]

      if (error) toast.error(error.entries.map((entry) => `${entry.field}: ${entry.message}`).join(' '))
      else toast.success('Item master synced to SAP!')

      router.refresh()
    } catch (err: any) {
      logger.error(err, '[VIEW_ITEM_MASTER_SYNC_TO_SAP_ERROR]:')
      toast.error('Something went wrong! Please try again later.')
    }
  }

  return (
    <div className='flex h-full w-full flex-1 flex-col gap-5'>
      <Header title='Item Master' description='Manage your items and their link with SAP'>
        <div className='ml-auto flex items-center gap-2'>
          <TooltipWrapper label='Back'>
            <Button type='button' variant='outline' onClick={() => router.push('/item-masters')}>
              <Icons.arrowLeft /> Back
            </Button>
          </TooltipWrapper>

          {itemMaster.syncStatus !== 'SYNCED' && (
            <CanView subject={PERMISSIONS_CODES.ITEM_MASTERS} action={PERMISSIONS_ALLOWED_ACTIONS.SYNC_TO_SAP}>
              <TooltipWrapper label='Sync to SAP'>
                <LoadingButton type='button' variant='outline-primary' isLoading={syncAction.isExecuting} onClick={handleSyncToSap}>
                  <Icons.upload /> Sync to SAP
                </LoadingButton>
              </TooltipWrapper>
            </CanView>
          )}

          <DropdownMenu>
            <TooltipWrapper label='More Options'>
              <DropdownMenuTrigger asChild>
                <Button variant='ghost' size='icon-lg'>
                  <Icons.ellipsisVertical />
                </Button>
              </DropdownMenuTrigger>
            </TooltipWrapper>
            <DropdownMenuContent className='w-auto min-w-20' align='end'>
              <CanView subject={PERMISSIONS_CODES.ITEM_MASTERS} action={PERMISSIONS_ALLOWED_ACTIONS.CREATE}>
                <DropdownMenuItem onClick={() => router.push('/item-masters/add')}>
                  <Icons.plus /> Add
                </DropdownMenuItem>
              </CanView>

              <CanView subject={PERMISSIONS_CODES.ITEM_MASTERS} action={PERMISSIONS_ALLOWED_ACTIONS.EDIT}>
                <DropdownMenuItem onClick={() => router.push(`/item-masters/${encodeURIComponent(itemMaster.ItemCode)}`)}>
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
          <ItemMasterOverviewTab itemMaster={itemMaster} />
        </TabsContent>

        <TabsContent value='1' className='min-h-0 flex-1'>
          <ActivityTimeline module='ITEM_MASTERS' entityId={itemMaster.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
