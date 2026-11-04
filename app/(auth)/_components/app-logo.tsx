import { APP_CONFIG } from '@/constants/config'

export default function AppLogo() {
  return (
    //* w-max lets the row overflow evenly instead of squashing the bar
    <div className='flex w-max items-center gap-4 self-center'>
      <img src='/images/logo.png' alt={APP_CONFIG.company} className='h-16 w-auto shrink-0' />

      <div className='border-primary-black flex flex-col border-l-2 py-1 pl-4'>
        <span className='text-primary text-3xl leading-none font-bold tracking-tight'>{APP_CONFIG.name}</span>
        <span className='mt-0.5 text-sm leading-tight whitespace-nowrap text-slate-500'>{APP_CONFIG.signin.logoSubtitle}</span>
      </div>
    </div>
  )
}
