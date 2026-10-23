import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Icons } from '@/components/icons'
import ExampleContentCard from '../_components/example-content-card'

export default function ExamplesPage() {
  if (process.env.NODE_ENV === 'production') notFound()

  return (
    <div className='h-full'>
      <div className='my-10 flex flex-col items-center justify-center gap-2'>
        <h1 className='text-center text-4xl font-bold'>Examples Content Card</h1>
        <p className='text-muted-foreground text-center text-sm'>
          This page contains examples of how to use the content card component in this template. Covers the header slots, footer, sizes, and
          the loading state.
        </p>

        <div className='flex items-center gap-2'>
          <Badge variant='pink'>Dashboard Panel</Badge>

          <Badge variant='soft-slate' asChild>
            <a href='https://ui.shadcn.com' target='_blank'>
              Shadcn <Icons.arrowRight className='inline-block' />
            </a>
          </Badge>
        </div>
      </div>

      <div className='mx-auto h-[calc(100vh-210px)] max-w-5xl overflow-auto px-4 pb-20'>
        <ExampleContentCard />
      </div>
    </div>
  )
}
