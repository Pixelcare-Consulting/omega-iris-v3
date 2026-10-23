'use client'

import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Icons } from '@/components/icons'
import { TooltipWrapper } from '@/components/tooltip-wrapper'
import KeyboardShortcuts from '@/components/keyboard-shortcuts'
import SapDatabaseSwitcher from '@/components/sap-database-switcher'
import { useFullscreen } from '@/hooks/use-fullscreen'
import UserButton from './user-button'
import AppBreadcrumbs from './app-breadcrumbs'
import { AuthSessionUser } from '@/types/auth'

export default function AppHeader({ user, dbCode }: { user: AuthSessionUser | null; dbCode: string | null }) {
  const { toggleFullscreen } = useFullscreen()

  return (
    <header className='flex h-16 shrink-0 items-center gap-2 border-b bg-white px-4'>
      <TooltipWrapper label='Toggle Sidebar (Ctrl+B)'>
        <SidebarTrigger className='-ml-1' />
      </TooltipWrapper>

      <Separator orientation='vertical' className='my-auto mr-2 data-[orientation=vertical]:h-4' />

      <AppBreadcrumbs />

      <div className='ml-auto flex items-center gap-2.5'>
        <TooltipWrapper label='Fullscreen (F8)'>
          <Button variant='ghost' size='icon-sm' onClick={toggleFullscreen}>
            <Icons.maximize className='text-muted-foreground size-5' />
          </Button>
        </TooltipWrapper>

        <KeyboardShortcuts />

        <SapDatabaseSwitcher dbCode={dbCode} />

        <UserButton user={user} />
      </div>
    </header>
  )
}
