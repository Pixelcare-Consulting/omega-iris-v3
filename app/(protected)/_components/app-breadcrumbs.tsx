'use client'

import Link from 'next/link'
import { Fragment } from 'react'

import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '../../../components/ui/breadcrumb'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../../components/ui/dropdown-menu'
import { usePathname } from 'next/navigation'

type BreadcrumbItemType = { label: string; href?: string }

//* convert pathname to breadcrumbs items
function buildBreadcrumbs(pathname: string): BreadcrumbItemType[] {
  const segments = pathname.split('/').filter(Boolean)

  return segments.map((segment, index) => ({
    label: segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' '), // "user-profile" → "User profile"
    href: '/' + segments.slice(0, index + 1).join('/')
  }))
}

export default function AppBreadcrumbs() {
  const pathname = usePathname()
  const items = buildBreadcrumbs(pathname)

  const MAX_VISIBLE = 4
  const shouldCollapse = items.length > MAX_VISIBLE

  const firstItem = items[0]
  const lastItem = items[items.length - 1]
  const middleItems = shouldCollapse ? items.slice(1, -1) : items.slice(1, -1)
  const collapsedItems = shouldCollapse ? middleItems : []
  const visibleMiddle = shouldCollapse ? [] : middleItems

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {/* //* first */}
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href={firstItem.href ?? '#'}>{firstItem.label}</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>

        {items.length > 1 && <BreadcrumbSeparator />}

        {/* //* collapsed middle */}
        {shouldCollapse && (
          <>
            <BreadcrumbItem>
              <DropdownMenu>
                <DropdownMenuTrigger className='flex items-center gap-1'>
                  <BreadcrumbEllipsis className='size-4' />
                </DropdownMenuTrigger>
                <DropdownMenuContent align='start'>
                  {collapsedItems.map((item, i) => (
                    <DropdownMenuItem key={`${i}-${item.label}`} asChild>
                      {item.href ? <Link href={item.href}>{item.label}</Link> : <div>{item.label}</div>}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </>
        )}

        {/* //* visible middle (not collapsed) */}
        {visibleMiddle.map((item, i) => (
          <Fragment key={`${i}-${item.label}`}>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={item.href ?? '#'}>{item.label}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </Fragment>
        ))}

        {/* //* last item, always BreadcrumbPage */}
        {items.length > 1 && (
          <BreadcrumbItem>
            <BreadcrumbPage>{lastItem.label}</BreadcrumbPage>
          </BreadcrumbItem>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
