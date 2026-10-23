'use client'

import AppSidebar from '@/app/(protected)/_components/app-sidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import FullscreenProvider from '@/components/providers/fullscreen-provider'
import { useFullscreen } from '@/hooks/use-fullscreen'
import AppHeader from './app-header'
import { AuthSessionUser } from '@/types/auth'

type AppPanelLayoutProps = {
  children: React.ReactNode
  user: AuthSessionUser | null
  dbCode: string | null
}

//! a client component, `children` still arrives rendered so the pages stay server components
export default function AppPanelLayout({ children, user, dbCode }: AppPanelLayoutProps) {
  return (
    <FullscreenProvider>
      <AppPanelShell user={user} dbCode={dbCode}>
        {children}
      </AppPanelShell>
    </FullscreenProvider>
  )
}

//* split out because the provider has to wrap whoever reads it
function AppPanelShell({ children, user, dbCode }: AppPanelLayoutProps) {
  const { isFullscreen } = useFullscreen()

  return (
    <SidebarProvider>
      {/* //* ctrl+b needs no handling, its listener lives in SidebarProvider and nothing reads the state while this is unrendered */}
      {!isFullscreen && <AppSidebar collapsible='icon' />}

      <SidebarInset>
        {/* //* h-svh sizes this to the smallest viewport height */}
        <div className='flex h-svh flex-col bg-neutral-100'>
          {!isFullscreen && <AppHeader user={user} dbCode={dbCode} />}

          {/* //! never scrolls, a page taller than the viewport scrolls inside itself so the header stays put */}
          <div className='min-h-0 flex-1 overflow-hidden'>{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
