import ChangePasswordForm from './_components/change-password-form'
import { TrapBack } from './_components/trap-back'

export default function ChangePasswordPage() {
  return (
    <div className='bg-primary-black/5 flex min-h-svh items-center justify-center'>
      <div className='flex flex-col gap-7 rounded-md bg-white px-10 py-14 shadow-md'>
        <div className='flex flex-col items-center gap-1.5 text-center'>
          <h1 className='text-primary text-3xl font-bold tracking-tight sm:text-4xl'>Change Password</h1>
          <p className='text-sm text-balance text-neutral-500'>Change a strong password to protect your account.</p>
        </div>

        <TrapBack />
        <ChangePasswordForm />
      </div>
    </div>
  )
}
