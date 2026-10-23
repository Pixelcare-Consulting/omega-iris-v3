'use client'

import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

export default function Protected401Unathorized() {
  const router = useRouter()

  return (
    <div className='flex h-screen items-center justify-center'>
      <div className='h-full w-full flex-1 px-2 py-4'>
        <div className='m-auto flex h-full w-full items-center justify-center rounded-lg p-6'>
          <div className='flex max-w-120 flex-col items-center justify-center gap-y-4'>
            <h1 className='text-primary w-fit text-7xl font-extrabold dark:text-neutral-200'>401</h1>
            <div className='flex flex-col items-center justify-center gap-y-2'>
              <h2 className='w-fit text-2xl font-semibold'>Unathorized</h2>
              <p className='text-muted-foreground text-center text-base'>Oops!. You are not authorized to access this page.</p>

              <Button className='mt-3' onClick={() => router.push('/')}>
                Back To Home
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
