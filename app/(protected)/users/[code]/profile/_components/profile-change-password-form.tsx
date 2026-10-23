'use client'

import { FormProvider, useForm, useFormState, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { changePassword, getUserByCode } from '@/actions/user'
import { ChangePasswordForm, changePasswordFormSchema } from '@/schema/user'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { FieldGroup } from '@/components/ui/field'
import Header from '@/components/header'
import { TooltipWrapper } from '@/components/tooltip-wrapper'
import { Icons } from '@/components/icons'
import LoadingButton from '@/components/forms/button-field'
import { isEmpty } from 'radash'
import { Row } from '@/components/row'
import { Column } from '@/components/column'

import InputField from '@/components/forms/input-field'
import { authClient } from '@/lib/auth-client'
import { useEffect } from 'react'

type ProfileChangePasswordFormProps = { user: NonNullable<Awaited<ReturnType<typeof getUserByCode>>> }

export default function ProfileChangePasswordForm({ user }: ProfileChangePasswordFormProps) {
  const form = useForm({
    mode: 'onChange',
    values: {
      code: user.code,
      oldPassword: '',
      newPassword: '',
      newConfirmPassword: ''
    },
    resolver: zodResolver(changePasswordFormSchema)
  })

  const formState = useFormState({ control: form.control })

  const changePasswordAction = useAction(changePassword)

  const oldPassword = useWatch({ control: form.control, name: 'oldPassword' })

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
      console.error(error)
      toast.error('Something went wrong! Please try again later.')
    }
  }

  const handleCancel = () => {
    form.reset()
    setTimeout(() => form.clearErrors(), 100)
  }

  //* clear password fields when old password is empty
  useEffect(() => {
    if (!oldPassword) {
      form.setValue('newPassword', '')
      form.setValue('newConfirmPassword', '')
      form.clearErrors(['newPassword', 'newConfirmPassword'])
    }
  }, [oldPassword])

  return (
    <FormProvider {...form}>
      <form className='flex h-full w-full flex-1 flex-col gap-5 pt-5' onSubmit={form.handleSubmit(handleSubmit)}>
        <div className='flex flex-col overflow-hidden rounded-md border bg-white shadow-xs'>
          <Header
            title='Change Password'
            description='Change your password'
            titleClassName='!text-base'
            className='rounded-none border-0 border-b shadow-none'
          >
            <div className='ml-auto flex items-center gap-2'>
              <TooltipWrapper label='Back'>
                <LoadingButton
                  type='button'
                  variant='outline'
                  onClick={handleCancel}
                  isLoading={changePasswordAction.isExecuting}
                  disabled={isEmpty(formState.dirtyFields)}
                >
                  <Icons.x /> Cancel
                </LoadingButton>
              </TooltipWrapper>

              <TooltipWrapper label='Save'>
                <LoadingButton
                  type='submit'
                  variant='default'
                  isLoading={changePasswordAction.isExecuting}
                  disabled={isEmpty(formState.dirtyFields)}
                >
                  <Icons.save /> Save
                </LoadingButton>
              </TooltipWrapper>
            </div>
          </Header>

          <FieldGroup className='w-full p-4'>
            <Row gap={5}>
              <Column md={6} lg={3}>
                <InputField
                  control={form.control}
                  name='oldPassword'
                  label='Old Password'
                  isRequired
                  extendedProps={{ inputProps: { type: 'password' } }}
                />
              </Column>

              <Column md={6} lg={3}>
                <InputField
                  control={form.control}
                  name='newPassword'
                  label='New Password'
                  isRequired
                  extendedProps={{ inputProps: { type: 'password' } }}
                />
              </Column>

              <Column md={6} lg={3}>
                <InputField
                  control={form.control}
                  name='newConfirmPassword'
                  label='New Confirm Password'
                  isRequired
                  extendedProps={{ inputProps: { type: 'password' } }}
                />
              </Column>
            </Row>
          </FieldGroup>
        </div>
      </form>
    </FormProvider>
  )
}
