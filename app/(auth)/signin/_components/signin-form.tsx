'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAction } from 'next-safe-action/hooks'

import { FieldGroup } from '@/components/ui/field'
import { FormProvider, useForm } from 'react-hook-form'
import { SignInForm, signinFormSchema } from '@/schema/auth'
import InputField from '@/components/forms/input-field'
import LoadingButton from '@/components/forms/button-field'
import { signinUser } from '@/actions/auth'
import Alert from '@/components/alert'
import { logger } from 'better-auth'
import { DEFAULT_SIGNIN_REDIRECT } from '@/constants/routes'

export default function SigninForm() {
  const [error, setError] = useState<string | undefined>()
  const [success, setSuccess] = useState<string | undefined>()

  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl')

  const signinUserAction = useAction(signinUser)

  const form = useForm({
    mode: 'onChange',
    values: { email: '', password: '', callbackUrl },
    resolver: zodResolver(signinFormSchema)
  })

  const handleClearMessage = () => {
    setError('')
    setSuccess('')
  }

  const handleOnSubmit = async (formValues: SignInForm) => {
    handleClearMessage()

    try {
      const response = await signinUserAction.executeAsync(formValues)
      const result = response?.data

      if (result && !result.error) {
        setSuccess(result.message)
        form.reset()

        setTimeout(() => {
          window.location.assign(result?.data?.callbackUrl ?? DEFAULT_SIGNIN_REDIRECT)
        }, 1000)

        return
      }

      setError(result?.message)
    } catch (err: any) {
      logger.error(err, '[SIGNIN_USER_ERROR_CLIENT]')
      setError('Something went wrong! Please try again later.')
    }
  }

  return (
    <FormProvider {...form}>
      <form className='flex flex-col gap-4' onSubmit={form.handleSubmit(handleOnSubmit)}>
        <Alert variant='success' message={success} />
        <Alert variant='error' message={error} />

        <FieldGroup>
          <InputField control={form.control} name='email' label='Email' placeholder='m@example.com' />

          <InputField
            control={form.control}
            name='password'
            label='Password'
            placeholder='************'
            extendedProps={{ inputProps: { type: 'password' } }}
          />

          <LoadingButton type='submit' size='lg'>
            Sign in
          </LoadingButton>
        </FieldGroup>
      </form>
    </FormProvider>
  )
}
