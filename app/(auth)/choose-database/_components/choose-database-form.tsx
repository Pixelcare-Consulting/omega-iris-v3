'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { FormProvider, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'

import { authClient } from '@/lib/auth-client'
import { logger } from '@/lib/logger'
import { ChooseSapDatabaseForm, chooseSapDatabaseFormSchema } from '@/schema/sap-database'
import { useSapDatabase } from '@/hooks/use-sap-database'
import { FormOptions } from '@/types/common'
import { FieldGroup } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { ComboboxField } from '@/components/forms/combobox-field'
import LoadingButton from '@/components/forms/button-field'
import ReadOnlyField from '@/components/read-only-field'
import Alert from '@/components/alert'
import SapDatabaseSwitchingOverlay from '@/components/sap-database-switching-overlay'

type ChooseDatabaseFormProps = {
  fullName: string
  email: string
  currentDbCode: string | null
  options: FormOptions[]
}

export default function ChooseDatabaseForm({ fullName, email, currentDbCode, options }: ChooseDatabaseFormProps) {
  const [isSigningOut, setIsSigningOut] = useState(false)
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl')

  const { stage, targetDbCode, retryAttempt, isSwitching, switchDatabase } = useSapDatabase()

  const form = useForm({
    mode: 'onChange',
    values: { dbCode: currentDbCode && options.some((option) => option.value === currentDbCode) ? currentDbCode : '' },
    resolver: zodResolver(chooseSapDatabaseFormSchema)
  })

  const selectedDbCode = useWatch({ control: form.control, name: 'dbCode' })
  const targetName = options.find((option) => option.value === targetDbCode)?.label ?? targetDbCode

  const handleOnSubmit = async ({ dbCode }: ChooseSapDatabaseForm) => {
    //* switchDatabase navigates on success
    const { isSwitched, message } = await switchDatabase(dbCode, callbackUrl)

    if (!isSwitched) {
      toast.error(message)
      form.setError('dbCode', { type: 'custom', message: message ?? 'Could not connect to this database' })
    }
  }

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true)
      await authClient.signOut()
      window.location.assign('/signin')
    } catch (err: any) {
      logger.error(err, '[CHOOSE_DATABASE_SIGNOUT_ERROR]:')
      toast.error('Something went wrong! Please try again later.')
      setIsSigningOut(false)
    }
  }

  return (
    <FormProvider {...form}>
      <SapDatabaseSwitchingOverlay stage={stage} databaseName={targetName} retryAttempt={retryAttempt} />

      <form className='flex flex-col gap-4' onSubmit={form.handleSubmit(handleOnSubmit)}>
        <FieldGroup>
          <ReadOnlyField title='Full Name' value={fullName} />
          <ReadOnlyField title='Email' value={email} />

          {options.length < 1 && <Alert variant='warning' message='Your role has no company assigned. Please contact an administrator.' />}

          {options.length > 0 && (
            <>
              <ComboboxField
                control={form.control}
                type='Basic'
                name='dbCode'
                label='Company'
                placeholder='Select a company'
                data={options}
                searchKeys={['dbCode']}
                isRequired
              />

              <LoadingButton type='submit' size='lg' isLoading={isSwitching} loadingText='Proceeding' disabled={!selectedDbCode}>
                Proceed
              </LoadingButton>
            </>
          )}

          <Button type='button' variant='outline-primary' onClick={handleSignOut} disabled={isSigningOut || isSwitching}>
            Sign out
          </Button>
        </FieldGroup>
      </form>
    </FormProvider>
  )
}
