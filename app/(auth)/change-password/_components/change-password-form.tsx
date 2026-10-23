'use client'

import { FormProvider, useForm, useFormState } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAction } from 'next-safe-action/hooks'
import { isEmpty } from 'radash'
import { toast } from 'sonner'

import { authClient } from '@/lib/auth-client'
import { type ChangePasswordForm, changePasswordFormSchema } from '@/schema/user'
import { changePassword } from '@/actions/user'
import { FieldGroup } from '@/components/ui/field'
import { Column } from '@/components/column'
import { Row } from '@/components/row'
import InputField from '@/components/forms/input-field'
import LoadingButton from '@/components/forms/button-field'
import { Icons } from '@/components/icons'
import logger from '@/lib/logger'
import { DEFAULT_USER_PASSWORD } from '@/constants/user'

export default function ChangePasswordForm() {
  const { data: session } = authClient.useSession()

  const form = useForm({
    mode: 'onChange',
    values: {
      code: session?.user?.code,
      oldPassword: DEFAULT_USER_PASSWORD,
      newPassword: '',
      newConfirmPassword: ''
    },
    resolver: zodResolver(changePasswordFormSchema)
  })

  const changePasswordAction = useAction(changePassword)
  const formState = useFormState({ control: form.control })

  const handleSubmit = async (formData: ChangePasswordForm) => {
    try {
      const response = await changePasswordAction.executeAsync(formData)
      const result = response?.data

      if (result?.error) {
        if ([400, 409].includes(result.status) && result.path === 'oldPassword') {
          form.setError('oldPassword', { type: 'custom', message: result.message })
        }

        if ([409].includes(result.status) && result.path === 'newPassword') {
          form.setError('newPassword', { type: 'custom', message: result.message })
        }

        toast.error(result.message)
        return
      }

      toast.success(result?.message)

      if (result?.data && result?.data?.user && 'id' in result?.data?.user) {
        await authClient.signOut()

        setTimeout(() => {
          form.clearErrors()
        }, 500)

        setTimeout(() => {
          window.location.replace('/signin')
        }, 1000)
      }
    } catch (error) {
      logger.error(error, '[CHANGE_PASSWORD_HANDLE_SUBMIT_ERROR]:')
      toast.error('Something went wrong! Please try again later.')
    }
  }

  return (
    <FormProvider {...form}>
      <form className='flex h-full w-full flex-1 flex-col gap-5' onSubmit={form.handleSubmit(handleSubmit)}>
        <FieldGroup className='p-4'>
          <Row gap={5}>
            <Column>
              <InputField
                control={form.control}
                name='newPassword'
                label='New Password'
                isRequired
                extendedProps={{ inputProps: { type: 'password' } }}
              />
            </Column>

            <Column>
              <InputField
                control={form.control}
                name='newConfirmPassword'
                label='New Confirm Password'
                isRequired
                extendedProps={{ inputProps: { type: 'password' } }}
              />
            </Column>

            <Column>
              <LoadingButton
                type='submit'
                variant='default'
                isLoading={changePasswordAction.isExecuting}
                isField
                disabled={isEmpty(formState.dirtyFields)}
              >
                <Icons.save /> Change Password
              </LoadingButton>
            </Column>
          </Row>
        </FieldGroup>
      </form>
    </FormProvider>
  )
}
