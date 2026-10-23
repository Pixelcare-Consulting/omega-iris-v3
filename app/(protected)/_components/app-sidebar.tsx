'use client'

import Link from 'next/link'
import { useContext, useMemo } from 'react'

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail
} from '@/components/ui/sidebar'
import { APP_CONFIG, MENU_GROUPS } from '@/constants/config'
import { AppSidebarContent } from './app-sidebar-content'
import { AbilityContext } from '@/contexts/ability'
import { filterMenuGroupsByAbility } from '@/lib/config'

export default function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const ability = useContext(AbilityContext)

  //* the filtered menu groups come straight from the ability, no effect or state needed
  const menuGroups = useMemo(() => {
    if (!ability) return []
    return filterMenuGroupsByAbility(MENU_GROUPS, ability)
  }, [ability])

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size='lg' className='h-12 group-data-[collapsible=icon]:justify-center' asChild>
              <Link href=''>
                {/* white tile, cropped to the dot mark on the left of the logo */}
                <div className='flex size-9 shrink-0 items-center justify-center rounded-lg bg-white transition-[width,height] duration-200 ease-linear group-data-[collapsible=icon]:size-8'>
                  <div className='h-6 w-5.5 overflow-hidden'>
                    <img src='/images/logo.png' alt={APP_CONFIG.fullName} className='h-full w-auto max-w-none' />
                  </div>
                </div>
                <div className='flex min-w-0 flex-col overflow-hidden leading-tight transition-[width,opacity] duration-200 ease-linear group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:opacity-0'>
                  <span className='truncate text-sm font-semibold'>{APP_CONFIG.sidebar.title}</span>
                  <span className='truncate text-xs opacity-65'>{APP_CONFIG.sidebar.subtitle}</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {menuGroups.map((mg, i) => (
          <AppSidebarContent key={`${mg.title}-${i}`} {...mg} />
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
