'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem
} from '@/components/ui/sidebar'
import { Icons } from '@/components/icons'
import { MenuGroup, MenuItem } from '@/constants/config'

//* the item's url or a path under it, so /users never claims /usersettings
const getIsActive = (url: string | undefined, pathname: string): boolean => !!url && (pathname === url || pathname.startsWith(`${url}/`))

//* recursively check if any descendant is active
const getHasActiveDescendant = (items: MenuItem[], pathname: string): boolean => {
  return items.some(
    (child) => getIsActive(child.url, pathname) || (child.items?.length ? getHasActiveDescendant(child.items, pathname) : false)
  )
}

//* recursive sub-menu renderer
function SubMenuItems({ items, depth = 0 }: { items: MenuItem[]; depth?: number }) {
  const pathname = usePathname()

  return (
    <>
      {items.map((item, index) => {
        const hasChildren = !!item.items?.length

        //* parents stay exact so a child's path doesn't light both
        const isActive = hasChildren ? pathname === item.url : getIsActive(item.url, pathname)

        //* auto-open when any child is active
        const hasActiveChild = item.items?.length ? getHasActiveDescendant(item.items, pathname) : false

        if (hasChildren) {
          return (
            <SidebarMenuSubItem key={`${depth}-${index}-${item.title}`}>
              <Collapsible defaultOpen={hasActiveChild} className='group/collapsible w-full'>
                <CollapsibleTrigger asChild>
                  <SidebarMenuSubButton isActive={isActive}>
                    {item.icon && <item.icon />}
                    <span className='truncate'>{item.title}</span>
                    <Icons.right className='ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90' />
                  </SidebarMenuSubButton>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <SidebarMenuSub>
                    <SubMenuItems items={item.items!} depth={depth + 1} />
                  </SidebarMenuSub>
                </CollapsibleContent>
              </Collapsible>
            </SidebarMenuSubItem>
          )
        }

        return (
          <SidebarMenuSubItem key={`${depth}-${index}-${item.title}`}>
            <SidebarMenuSubButton asChild isActive={isActive} style={{ paddingLeft: `${(depth + 1) * 4}px` }}>
              <Link className='truncate' href={item.url}>
                {item.icon && <item.icon />}
                <span className='truncate'>{item.title}</span>
              </Link>
            </SidebarMenuSubButton>
          </SidebarMenuSubItem>
        )
      })}
    </>
  )
}

//* top-level menu item (with icon support)
function TopMenuItem({ item }: { item: MenuItem }) {
  const pathname = usePathname()

  const hasChildren = !!item.items?.length
  const isActive = hasChildren ? pathname === item.url : getIsActive(item.url, pathname)
  const hasActiveDescendant = item.items?.length ? getHasActiveDescendant(item.items, pathname) : false

  if (hasChildren) {
    return (
      <Collapsible asChild defaultOpen={hasActiveDescendant} className='group/collapsible'>
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton tooltip={item.title} isActive={isActive}>
              {item.icon && <item.icon />}
              <span className='truncate'>{item.title}</span>
              <Icons.right className='ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90' />
            </SidebarMenuButton>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <SidebarMenuSub>
              <SubMenuItems items={item.items!} depth={0} />
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    )
  }

  //* leaf top-level item (no children)
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip={item.title} isActive={isActive}>
        <Link className='min-w-0' href={item.url}>
          {item.icon && <item.icon />}
          <span className='truncate'>{item.title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

export function AppSidebarContent({ title, menu }: MenuGroup) {
  return (
    <SidebarGroup>
      {title && <SidebarGroupLabel>{title}</SidebarGroupLabel>}

      <SidebarMenu>
        {menu.map((item) => (
          <TopMenuItem key={item.title} item={item} />
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
