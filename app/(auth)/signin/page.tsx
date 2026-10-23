import { APP_CONFIG } from '@/constants/config'
import { cn } from '@/lib/utils'
import SigninForm from './_components/signin-form'
import { Suspense } from 'react'

//* logo dots, empty slot drawn as a dashed ring
const LOGO_DOTS = ['bg-teal-300', 'bg-blue-500', 'bg-blue-600', 'border-2 border-dashed border-blue-300', 'bg-indigo-500', 'bg-indigo-400']

const FEATURE_DOT_COLORS = ['bg-teal-300', 'bg-blue-400', 'bg-indigo-400']

export default function SigninPage() {
  return (
    <div className='grid min-h-svh lg:grid-cols-2'>
      <div className='flex flex-col gap-4 p-6 md:p-10'>
        <div className='flex flex-1'>
          <div className='flex flex-1 flex-col items-center justify-center gap-4'>
            <div className='w-full max-w-sm'>
              <div className='flex flex-col gap-8 px-10 py-14'>
                <img src='/images/logo.png' alt={APP_CONFIG.company} className='mx-auto h-12 w-auto' />

                <div className='flex flex-col items-center gap-1.5 text-center'>
                  <h1 className='bg-linear-to-r from-blue-500 to-blue-800/80 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl'>
                    Welcome Back!
                  </h1>
                  <p className='text-sm text-balance text-neutral-500'>Enter your credentials to access your account</p>
                </div>

                <Suspense>
                  <SigninForm />
                </Suspense>
              </div>
            </div>

            <p className='text-center text-xs text-neutral-500'>
              © {new Date().getFullYear()} {APP_CONFIG.name} | {APP_CONFIG.company}. All rights reserved.
            </p>
          </div>
        </div>
      </div>

      <div className='relative hidden flex-col overflow-hidden bg-[radial-gradient(120%_90%_at_100%_0%,var(--primary)_0%,#0b1d5c_45%,#07103a_100%)] p-10 text-white lg:flex lg:min-h-160 lg:justify-end xl:p-14'>
        <div className='absolute inset-0 [background-image:radial-gradient(circle,#ffffff22_1.5px,transparent_1.6px)] [mask-image:linear-gradient(160deg,#000_10%,transparent_70%)] [background-size:28px_28px]' />

        <div className='absolute top-10 right-10 grid -rotate-14 grid-cols-3 gap-3 xl:top-12 xl:right-12 2xl:gap-4'>
          {LOGO_DOTS.map((dot, i) => (
            <span key={i} className={cn('size-10 rounded-full xl:size-12 2xl:size-14', dot)} />
          ))}
        </div>

        {/* eyebrow lines up with the form's welcome heading */}
        <div className='absolute inset-x-10 top-[calc(50%-110px)] xl:inset-x-14'>
          <p className='text-xs font-semibold tracking-[0.22em] text-blue-300'>{APP_CONFIG.signin.eyebrow}</p>

          <h2 className='mt-4 text-[44px] leading-[1.05] font-extrabold tracking-[-0.035em] xl:text-[50px] 2xl:text-[56px]'>
            <span className='block'>{APP_CONFIG.signin.title}</span>
            <span className='block text-blue-400'>{APP_CONFIG.signin.titleHighlight}</span>
          </h2>

          <p className='mt-5 max-w-120 text-base leading-[1.65] text-slate-300 xl:text-lg'>{APP_CONFIG.signin.description}</p>

          <ul className='mt-7 flex max-w-xl flex-wrap gap-2.5'>
            {APP_CONFIG.features.map((feature, i) => (
              <li
                key={feature}
                className='flex items-center gap-2 rounded-full border border-white/15 bg-white/7 px-3.5 py-2 text-sm font-medium backdrop-blur-sm'
              >
                <span className={cn('size-2 rounded-full', FEATURE_DOT_COLORS[i % FEATURE_DOT_COLORS.length])} />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <div className='relative flex flex-wrap items-center justify-between gap-4 text-xs font-semibold tracking-[0.12em]'>
          <ul className='flex gap-5 text-slate-400 uppercase'>
            {APP_CONFIG.offices.map((office) => (
              <li key={office} className='flex items-center gap-1.5'>
                <span className='size-1.5 rounded-full bg-teal-300' />
                {office}
              </li>
            ))}
          </ul>

          <p className='tracking-[0.3em] text-blue-300'>{APP_CONFIG.tagLine}</p>
        </div>
      </div>
    </div>
  )
}
