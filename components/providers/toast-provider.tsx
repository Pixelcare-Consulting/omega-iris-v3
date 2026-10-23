import React from 'react'
import { Toaster } from 'sonner'

import { TOAST_DURATION } from '@/constants/toast'

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster position='top-center' duration={TOAST_DURATION} />
    </>
  )
}
