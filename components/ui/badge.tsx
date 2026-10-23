import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!',
  {
    variants: {
      variant: {
        //* defualts
        default: 'bg-primary text-primary-foreground [a]:hover:bg-primary/80',
        secondary: 'bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80',
        destructive:"bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20", // prettier-ignore
        outline: 'border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground',
        ghost: 'hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50',
        link: 'text-primary underline-offset-4 hover:underline',

        //* solid
        black: 'bg-black text-white ring-black/10 [a]:hover:bg-black/80',
        slate: 'bg-slate-500 text-slate-50 ring-slate-500/10 [a]:hover:bg-slate-500/80',
        neutral: 'bg-neutral-500 text-neutral-50 ring-neutral-500/10 [a]:hover:bg-neutral-500/80',
        red: 'bg-red-500 text-red-50 ring-red-500/10 [a]:hover:bg-red-500/80',
        orange: 'bg-orange-500 text-orange-50 ring-orange-500/10 [a]:hover:bg-orange-500/80',
        amber: 'bg-amber-500 text-amber-50 ring-amber-500/10 [a]:hover:bg-amber-500/80',
        yellow: 'bg-yellow-500 text-yellow-50 ring-yellow-500/10 [a]:hover:bg-yellow-500/80',
        lime: 'bg-lime-500 text-lime-50 ring-lime-500/10 [a]:hover:bg-lime-500/80',
        green: 'bg-green-500 text-green-50 ring-green-500/10 [a]:hover:bg-green-500/80',
        emerald: 'bg-emerald-500 text-emerald-50 ring-emerald-500/10 [a]:hover:bg-emerald-500/80',
        teal: 'bg-teal-500 text-teal-50 ring-teal-500/10 [a]:hover:bg-teal-500/80',
        cyan: 'bg-cyan-500 text-cyan-50 ring-cyan-500/10 [a]:hover:bg-cyan-500/80',
        sky: 'bg-sky-500 text-sky-50 ring-sky-500/10 [a]:hover:bg-sky-500/80',
        blue: 'bg-blue-500 text-blue-50 ring-blue-500/10 [a]:hover:bg-blue-500/80',
        indigo: 'bg-indigo-500 text-indigo-50 ring-indigo-500/10 [a]:hover:bg-indigo-500/80',
        violet: 'bg-violet-500 text-violet-50 ring-violet-500/10 [a]:hover:bg-violet-500/80',
        purple: 'bg-purple-500 text-purple-50 ring-purple-500/10 [a]:hover:bg-purple-500/80',
        fuchsia: 'bg-fuchsia-500 text-fuchsia-50 ring-fuchsia-500/10 [a]:hover:bg-fuchsia-500/80',
        pink: 'bg-pink-500 text-pink-50 ring-pink-500/10 [a]:hover:bg-pink-500/80',
        rose: 'bg-rose-500 text-rose-50 ring-rose-500/10 [a]:hover:bg-rose-500/80',

        //* soft
        //* black has no tailwind scale, neutral-100 stands in for the tint and the text stays true black
        'soft-black': 'bg-neutral-100 text-black ring-black/10 [a]:hover:bg-black/15',
        'soft-slate': 'bg-slate-100 text-slate-600 ring-slate-500/10 [a]:hover:bg-slate-500/25',
        'soft-neutral': 'bg-neutral-100 text-neutral-600 ring-neutral-500/10 [a]:hover:bg-neutral-500/25',
        'soft-red': 'bg-red-100 text-red-600 ring-red-500/10 [a]:hover:bg-red-500/25',
        'soft-orange': 'bg-orange-100 text-orange-600 ring-orange-500/10 [a]:hover:bg-orange-500/25',
        'soft-amber': 'bg-amber-100 text-amber-600 ring-amber-500/10 [a]:hover:bg-amber-500/25',
        'soft-yellow': 'bg-yellow-100 text-yellow-600 ring-yellow-500/10 [a]:hover:bg-yellow-500/25',
        'soft-lime': 'bg-lime-100 text-lime-600 ring-lime-500/10 [a]:hover:bg-lime-500/25',
        'soft-green': 'bg-green-100 text-green-600 ring-green-500/10 [a]:hover:bg-green-500/25',
        'soft-emerald': 'bg-emerald-100 text-emerald-600 ring-emerald-500/10 [a]:hover:bg-emerald-500/25',
        'soft-teal': 'bg-teal-100 text-teal-600 ring-teal-500/10 [a]:hover:bg-teal-500/25',
        'soft-cyan': 'bg-cyan-100 text-cyan-600 ring-cyan-500/10 [a]:hover:bg-cyan-500/25',
        'soft-sky': 'bg-sky-100 text-sky-600 ring-sky-500/10 [a]:hover:bg-sky-500/25',
        'soft-blue': 'bg-blue-100 text-blue-600 ring-blue-500/10 [a]:hover:bg-blue-500/25',
        'soft-indigo': 'bg-indigo-100 text-indigo-600 ring-indigo-500/10 [a]:hover:bg-indigo-500/25',
        'soft-violet': 'bg-violet-100 text-violet-600 ring-violet-500/10 [a]:hover:bg-violet-500/25',
        'soft-purple': 'bg-purple-100 text-purple-600 ring-purple-500/10 [a]:hover:bg-purple-500/25',
        'soft-fuchsia': 'bg-fuchsia-100 text-fuchsia-600 ring-fuchsia-500/10 [a]:hover:bg-fuchsia-500/25',
        'soft-pink': 'bg-pink-100 text-pink-600 ring-pink-500/10 [a]:hover:bg-pink-500/25',
        'soft-rose': 'bg-rose-100 text-rose-600 ring-rose-500/10 [a]:hover:bg-rose-500/25'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
)

export type BadgeVariants = VariantProps<typeof badgeVariants>

function Badge({
  className,
  variant = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & BadgeVariants & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'span'

  return <Comp data-slot='badge' data-variant={variant} className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
