import { APP_CONFIG } from '@/constants/config'
import { Icons } from '@/components/icons'
import AppLogo from '../_components/app-logo'
import SigninForm from './_components/signin-form'
import { Suspense } from 'react'

export default function SigninPage() {
  return (
    <div className='grid min-h-svh lg:grid-cols-2'>
      {/* mirrors the right panel so both centered blocks line up */}
      <div className='flex flex-col p-6 md:p-10 xl:p-14'>
        <div className='flex flex-1 flex-col items-center justify-center py-10'>
          <div className='w-full max-w-sm'>
            <div className='flex flex-col gap-8 px-10'>
              <AppLogo />

              <div className='flex flex-col items-center gap-1.5 text-center'>
                <h1 className='from-primary to-primary-black bg-linear-to-r bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl'>
                  Welcome Back!
                </h1>
                <p className='text-sm text-balance text-neutral-500'>{APP_CONFIG.signin.subtitle}</p>
              </div>

              <Suspense>
                <SigninForm />
              </Suspense>
            </div>
          </div>
        </div>

        {/* same height as the right footer row */}
        <p className='border-t border-transparent pt-6 text-center text-xs text-neutral-500'>
          © {new Date().getFullYear()} {APP_CONFIG.name} | {APP_CONFIG.company}. All rights reserved.
        </p>
      </div>

      <div className='bg-primary-black relative hidden flex-col overflow-hidden p-10 text-white lg:flex lg:min-h-160 xl:p-14'>
        <img src='/images/signin-hero.jpg' alt='' className='absolute inset-0 size-full object-cover brightness-[0.35]' />

        {/* darken the bottom */}
        <div className='from-primary-black via-primary-black/50 absolute inset-0 bg-linear-to-t to-transparent' />
        <div className='absolute inset-0 bg-[radial-gradient(circle,#ffffff22_1.5px,transparent_1.6px)] mask-[linear-gradient(160deg,#000_10%,transparent_70%)] bg-size-[28px_28px]' />

        {/* centered in the space above the footer row */}
        <div className='relative flex flex-1 flex-col justify-center py-10'>
          <p className='text-xs font-semibold tracking-[0.22em] text-red-300'>{APP_CONFIG.signin.eyebrow}</p>

          <h2 className='mt-5 text-[44px] leading-[0.95] font-extrabold tracking-[-0.035em] xl:text-[50px] 2xl:text-[56px]'>
            <span className='block'>{APP_CONFIG.signin.title}</span>
            <span className='block text-red-500'>{APP_CONFIG.signin.titleHighlight}</span>
          </h2>

          <p className='mt-6 max-w-xl text-base leading-[1.75] text-slate-200 xl:text-lg'>{APP_CONFIG.signin.description}</p>

          <ul className='mt-10 flex max-w-2xl flex-wrap gap-3'>
            {APP_CONFIG.features.map((feature) => (
              <li
                key={feature}
                className='flex items-center gap-2 rounded-full border border-white/15 bg-white/7 px-3.5 py-2 text-sm font-medium backdrop-blur-sm'
              >
                <span className='flex size-5 items-center justify-center rounded-full bg-green-500/20'>
                  <Icons.check className='size-3.5 text-green-500' />
                </span>
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <div className='relative flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6 text-xs font-semibold tracking-[0.12em]'>
          <ul className='flex flex-wrap gap-x-5 gap-y-2 text-slate-300 uppercase'>
            {APP_CONFIG.workflow.map((step) => (
              <li key={step} className='flex items-center gap-1.5'>
                <span className='size-1.5 rounded-full bg-red-500' />
                {step}
              </li>
            ))}
          </ul>

          <p className='tracking-[0.3em] text-red-300'>{APP_CONFIG.tagLine}</p>
        </div>
      </div>
    </div>
  )
}
