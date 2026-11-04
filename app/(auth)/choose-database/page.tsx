import { Suspense } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { auth } from '@/lib/auth'
import { APP_CONFIG } from '@/constants/config'
import { getSapDatabasesByRoleCode } from '@/actions/sap-database'
import AppLogo from '../_components/app-logo'
import ChooseDatabaseForm from './_components/choose-database-form'

export default async function ChooseDatabasePage() {
  //* skip the cookie cache, the layout may have just cleared dbCode
  const session = await auth.api.getSession({ headers: await headers(), query: { disableCookieCache: true } })

  if (!session?.user) redirect('/signin')

  const sapDatabases = await getSapDatabasesByRoleCode(session.user.roleCode)
  const options = sapDatabases.map((sapDb) => ({ value: sapDb.dbCode, label: sapDb.name, dbCode: sapDb.dbCode }))

  return (
    <div className='flex min-h-svh flex-col items-center justify-center gap-4 p-6 md:p-10'>
      <div className='w-full max-w-md'>
        <div className='flex flex-col gap-8 px-10 py-14'>
          <AppLogo />

          <div className='flex flex-col items-center gap-1.5 text-center'>
            <h1 className='from-primary to-primary-black bg-linear-to-r bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl'>
              Choose Company
            </h1>
            <p className='text-sm text-balance text-neutral-500'>Select the company you&apos;ll work in for this session.</p>
          </div>

          <Suspense>
            <ChooseDatabaseForm
              fullName={session.user.name || [session.user.fname, session.user.lname].filter(Boolean).join(' ')}
              email={session.user.email}
              currentDbCode={session.session.dbCode ?? null}
              options={options}
            />
          </Suspense>
        </div>
      </div>

      <p className='text-center text-xs text-neutral-500'>
        © {new Date().getFullYear()} {APP_CONFIG.name} | {APP_CONFIG.company}. All rights reserved.
      </p>
    </div>
  )
}
