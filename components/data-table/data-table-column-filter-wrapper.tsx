'use client'

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '../ui/sheet'
import { Icons } from '../icons'
import { Button } from '../ui/button'
import { ScrollArea } from '../ui/scroll-area'
import { useMediaQuery } from 'usehooks-ts'

type DataTableColumnFilterWrapperPros = {
  children?: React.ReactNode
}

export default function DataTableColumnFilterWrapper({ children }: DataTableColumnFilterWrapperPros) {
  //! initializeWithValue false, reading matchMedia on the first render breaks hydration
  const xSmallMedia = useMediaQuery('(max-width: 1024px)', { initializeWithValue: false })

  if (!children) return null

  if (children && xSmallMedia) {
    return (
      <Sheet modal={false}>
        <SheetTrigger asChild>
          <Button variant='outline' className='w-full'>
            <Icons.listFilter /> Filter
          </Button>
        </SheetTrigger>

        <SheetContent className='flex h-full flex-col'>
          <SheetHeader>
            <SheetTitle>Filter Data</SheetTitle>
            <SheetDescription>Filter the data table</SheetDescription>
          </SheetHeader>

          <ScrollArea className='min-h-0 flex-1 p-4' type='auto'>
            <div className='flex flex-col gap-2'>{children}</div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <div className='flex flex-col justify-center gap-1.5 *:w-full md:justify-start lg:flex-row lg:flex-wrap lg:items-center lg:*:w-auto'>
      {children}
    </div>
  )
}
