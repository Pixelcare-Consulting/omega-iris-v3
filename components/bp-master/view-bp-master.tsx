'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'

import { BpMasterRow } from '@/actions/bp-master'
import { syncBpMastersToSap } from '@/actions/bp-master-sync'
import Header from '@/components/header'
import { Icons } from '@/components/icons'
import { TooltipWrapper } from '@/components/tooltip-wrapper'
import { Button } from '@/components/ui/button'
import LoadingButton from '@/components/forms/button-field'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { DEFAULT_TAB } from '@/constants/common'
import { handleTabChange } from '@/lib/event-handler'
import { logger } from '@/lib/logger'
import CanView from '@/components/rbac/can-view'
import { PERMISSIONS_ALLOWED_ACTIONS } from '@/constants/permission'
import { BP_MASTER_CONFIG, BpMasterType } from '@/constants/bp-master'
import BpMasterOverviewTab from './bp-master-overview-tab'
import BpAddressesTab from './bp-addresses-tab'
import BpContactsTab from './bp-contacts-tab'
import ActivityTimeline from '@/components/activity-log/activity-timeline'

type ViewBpMasterProps = { type: BpMasterType; bpMaster: BpMasterRow }

const TABS_TITLE = ['Overview', 'Addresses', 'Contacts', 'Activity'] as const
const TABS_CONTENT_VALUE = TABS_TITLE.map((_, index) => String(index))

export default function ViewBpMaster({ type, bpMaster }: ViewBpMasterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const { label, pluralLabel, route, permission, description, canCreate } = BP_MASTER_CONFIG[type]

  const tabParam = searchParams.get('tab')
  const activeTab = tabParam && TABS_CONTENT_VALUE.includes(tabParam) ? tabParam : DEFAULT_TAB

  const isSynced = bpMaster.syncStatus === 'SYNCED'
  const editUrl = `${route}/${encodeURIComponent(bpMaster.CardCode)}`

  const syncAction = useAction(syncBpMastersToSap)

  //* the first error entry is the one to show, the row keeps sap's message too
  const handleSyncToSap = async () => {
    try {
      const response = await syncAction.executeAsync({ type, ids: [bpMaster.id] })
      const result = response?.data

      if (!result || result.error || !result.data) {
        toast.error(result?.message ?? 'Failed to sync to SAP!')
        return
      }

      const error = result.data.errors[0]

      if (error) toast.error(error.entries.map((entry) => `${entry.field}: ${entry.message}`).join(' '))
      else toast.success(`${label} synced to SAP!`)

      router.refresh()
    } catch (err: any) {
      logger.error(err, '[VIEW_BP_MASTER_SYNC_TO_SAP_ERROR]:')
      toast.error('Something went wrong! Please try again later.')
    }
  }

  return (
    <div className='flex h-full w-full flex-1 flex-col gap-5'>
      <Header title={pluralLabel} description={description}>
        <div className='ml-auto flex items-center gap-2'>
          <TooltipWrapper label='Back'>
            <Button type='button' variant='outline' onClick={() => router.push(route)}>
              <Icons.arrowLeft /> Back
            </Button>
          </TooltipWrapper>

          {canCreate && !isSynced && (
            <CanView subject={permission} action={PERMISSIONS_ALLOWED_ACTIONS.SYNC_TO_SAP}>
              <TooltipWrapper label='Sync to SAP'>
                <LoadingButton type='button' variant='outline-primary' isLoading={syncAction.isExecuting} onClick={handleSyncToSap}>
                  <Icons.upload /> Sync to SAP
                </LoadingButton>
              </TooltipWrapper>
            </CanView>
          )}

          {canCreate && (
            <DropdownMenu>
              <TooltipWrapper label='More Options'>
                <DropdownMenuTrigger asChild>
                  <Button variant='ghost' size='icon-lg'>
                    <Icons.ellipsisVertical />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipWrapper>
              <DropdownMenuContent className='w-auto min-w-20' align='end'>
                <CanView subject={permission} action={PERMISSIONS_ALLOWED_ACTIONS.CREATE}>
                  <DropdownMenuItem onClick={() => router.push(`${route}/add`)}>
                    <Icons.plus /> Add
                  </DropdownMenuItem>
                </CanView>

                <CanView subject={permission} action={PERMISSIONS_ALLOWED_ACTIONS.EDIT}>
                  <DropdownMenuItem onClick={() => router.push(editUrl)}>
                    <Icons.pencil /> Edit
                  </DropdownMenuItem>
                </CanView>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
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
          <BpMasterOverviewTab type={type} bpMaster={bpMaster} />
        </TabsContent>

        <TabsContent value='1' className='min-h-0 flex-1'>
          <BpAddressesTab bpMaster={bpMaster} />
        </TabsContent>

        <TabsContent value='2' className='min-h-0 flex-1'>
          <BpContactsTab bpMaster={bpMaster} />
        </TabsContent>

        <TabsContent value='3' className='min-h-0 flex-1'>
          <ActivityTimeline module={type === 'C' ? 'CUSTOMERS' : 'VENDORS'} entityId={bpMaster.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
