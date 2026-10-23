'use client'

import Link from 'next/link'

import { cn } from '@/lib/utils'

type RelationLinkProps = {
  href: string
  className?: string
  children: React.ReactNode
}

//* a related record shown on a table cell or a read-only field links to its own view page
//* stops propagation so a row-level handler never fires alongside the navigation
export default function RelationLink({ href, className, children }: RelationLinkProps) {
  return (
    <Link
      href={href}
      onClick={(event) => event.stopPropagation()}
      className={cn(
        'hover:text-primary inline-flex max-w-full items-center underline-offset-4 transition-colors hover:underline',
        className
      )}
    >
      {children}
    </Link>
  )
}
