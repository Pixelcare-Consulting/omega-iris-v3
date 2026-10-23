import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Icons } from '@/components/icons'
import ExampleTableServer from '../../_components/example-table-server'

export default function ExamplesPage() {
  if (process.env.NODE_ENV === 'production') notFound()

  return (
    <div className='h-full'>
      <div className='my-10 flex flex-col items-center justify-center gap-2'>
        <h1 className='text-center text-4xl font-bold'>Examples DataTable (Server)</h1>
        <p className='text-muted-foreground text-center text-sm'>
          This page contains examples of how to use the data table components in this template. Uses server side pagination, sorting,
          filtering, and global search.
        </p>

        <div className='flex items-center gap-2'>
          <Badge variant='pink'>Tanstack React Table</Badge>

          <Badge variant='soft-slate' asChild>
            <a href='https://ui.shadcn.com' target='_blank'>
              Shadcn <Icons.arrowRight className='inline-block' />
            </a>
          </Badge>
        </div>
      </div>

      <div className='mx-auto h-[calc(100vh-180px)] max-w-7xl px-20 pb-20'>
        <ExampleTableServer />
      </div>
    </div>
  )
}
