import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import NextTopLoader from 'nextjs-toploader'

import '../styles/globals.css'
import { TooltipProvider } from '@/components/ui/tooltip'
import TailwindIndicatorProvider from '@/components/providers/tailwind-indicator-provider'
import ToastProvider from '@/components/providers/toast-provider'
import { ThemeProvider } from '@/components/providers/theme-provider'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin']
})

export const metadata: Metadata = {
  title: 'Next.js 16 Project Template',
  description: 'Ultimate project template Next.js 16 with Shadcn UI'
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang='en' className='h-full scroll-smooth' data-scroll-behavior='smooth' suppressHydrationWarning>
      <body className={`${geistSans.className} h-full overflow-hidden antialiased`}>
        <ThemeProvider attribute='class' forcedTheme='light' disableTransitionOnChange>
          <TooltipProvider>
            <ToastProvider>
              <NextTopLoader
                color='var(--primary)'
                initialPosition={0.08}
                crawlSpeed={200}
                height={4}
                crawl={true}
                showSpinner={false}
                easing='ease'
                speed={200}
                zIndex={1600}
                showAtBottom={false}
              />

              {children}
              <TailwindIndicatorProvider />
            </ToastProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
