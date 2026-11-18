'use client'

import { useRouter, useSearchParams } from 'next/navigation'

import { PalletWithRelations } from '@/actions/pallet'
import Header from '@/components/header'
import { Icons } from '@/components/icons'
import { TooltipWrapper } from '@/components/tooltip-wrapper'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import PalletOverviewTab from './tabs/pallet-overview-tab'
import { DEFAULT_TAB } from '@/constants/common'
import { handleTabChange } from '@/lib/event-handler'
import CanView from '@/components/rbac/can-view'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { LabelSize } from '@/constants/label'
import { getPalletLabelPdfHref } from '@/lib/pallet'
import { useDisclosure } from '@/hooks/use-disclosure'
import LabelSizeModal from '@/components/label-size-modal'

type ViewPalletProps = { pallet: PalletWithRelations }

export default function ViewPallet({ pallet }: ViewPalletProps) {
  const TABS_TITLE = ['Overview'] as const
  const TABS_CONTENT_VALUE = TABS_TITLE.map((_, index) => String(index))

  const router = useRouter()
  const searchParams = useSearchParams()

  const tabParam = searchParams.get('tab')
  const activeTab = tabParam && TABS_CONTENT_VALUE.includes(tabParam) ? tabParam : DEFAULT_TAB

  const labelModal = useDisclosure()

  const handleLabelView = (size: LabelSize) => {
    window.open(getPalletLabelPdfHref(pallet.code, size), '_blank')
    labelModal.onClose()
  }

  const handleLabelDownload = (size: LabelSize) => {
    window.location.assign(getPalletLabelPdfHref(pallet.code, size, true))
    labelModal.onClose()
  }

  return (
    <div className='flex h-full w-full flex-1 flex-col gap-5'>
      <Header title='Pallets' description='Manage and track your pallets'>
        <div className='ml-auto flex items-center gap-2'>
          <TooltipWrapper label='Back'>
            <Button type='button' variant='outline' onClick={() => router.push('/pallets')}>
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
              <CanView subject={PERMISSIONS_CODES.PALLETS} action={PERMISSIONS_ALLOWED_ACTIONS.CREATE}>
                <DropdownMenuItem onClick={() => router.push('/pallets/add')}>
                  <Icons.plus /> Add
                </DropdownMenuItem>
              </CanView>

              <CanView subject={PERMISSIONS_CODES.PALLETS} action={PERMISSIONS_ALLOWED_ACTIONS.EDIT}>
                <DropdownMenuItem onClick={() => router.push(`/pallets/${encodeURIComponent(pallet.code)}`)}>
                  <Icons.pencil /> Edit
                </DropdownMenuItem>
              </CanView>

              <CanView subject={PERMISSIONS_CODES.PALLETS} action={PERMISSIONS_ALLOWED_ACTIONS.VIEW}>
                <DropdownMenuItem onClick={labelModal.onOpen}>
                  <Icons.qrCode /> Print Label
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
          <PalletOverviewTab pallet={pallet} />
        </TabsContent>
      </Tabs>

      <LabelSizeModal
        isOpen={labelModal.isOpen}
        title='Print Label'
        description={`QR label for "${pallet.code}"`}
        onClose={labelModal.onClose}
        onView={handleLabelView}
        onDownload={handleLabelDownload}
      />
    </div>
  )
}
