'use client'

import { FormProvider, useForm, useFormState } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { getUserByCode, updateBasicInfo } from '@/actions/user'
import { BasicInfoForm, basicInfoFormSchema } from '@/schema/user'
import { toUsernameInput } from '@/lib/user'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import logger from '@/lib/logger'
import { FieldGroup } from '@/components/ui/field'
import Header from '@/components/header'
import { TooltipWrapper } from '@/components/tooltip-wrapper'
import { Icons } from '@/components/icons'
import LoadingButton from '@/components/forms/button-field'
import { isEmpty } from 'radash'
import { Row } from '@/components/row'
import { Column } from '@/components/column'

import InputField from '@/components/forms/input-field'

type ProfileBasicInfoFormProps = { user: NonNullable<Awaited<ReturnType<typeof getUserByCode>>> }

export default function ProfileBasicInfoForm({ user }: ProfileBasicInfoFormProps) {
  const router = useRouter()

  const form = useForm({
    mode: 'onChange',
    values: {
      code: user.code,
      fname: user.fname,
      mname: user.mname,
      lname: user.lname,
      suffix: user.suffix,
      username: user.username,
      email: user.email,
      roleCode: user.roleCode,
      roleKey: user.role.key,
      isActive: user.isActive
    },
    resolver: zodResolver(basicInfoFormSchema)
  })

  const formState = useFormState({ control: form.control })

  const updateBasicInfoAction = useAction(updateBasicInfo)

  const handleSubmit = async (formData: BasicInfoForm) => {
    try {
      const response = await updateBasicInfoAction.executeAsync(formData)
      const result = response?.data

      if (result?.error) {
        if (result.status === 401 && result.paths && result.paths.length > 0) {
          result.paths.forEach((path) => {
            const field = path.field as keyof BasicInfoForm
            form.setError(field, { type: 'custom', message: path.message })
          })
        }

        toast.error(result.message)
        return
      }

      toast.success(result?.message)

      if (result?.data && result?.data?.user && 'id' in result?.data?.user) {
        //* the header/sidebar now read the user from the server layout, so refreshing the route is enough to pick up the change
        router.refresh()

        setTimeout(() => {
          router.push(`/users/${result.data.user.code}/profile`)
        }, 1500)
      }
    } catch (error) {
      logger.error(error, '[BASIC_INFO_HANDLE_SUBMIT_ERROR]:')
      toast.error('Something went wrong! Please try again later.')
    }
  }

  const handleCancel = () => {
    form.reset()
    setTimeout(() => form.clearErrors(), 100)
  }

  return (
    <FormProvider {...form}>
      <form className='flex h-full w-full flex-1 flex-col gap-5' onSubmit={form.handleSubmit(handleSubmit)}>
        <div className='flex flex-col overflow-hidden rounded-md border bg-white shadow-xs'>
          <Header
            title='Basic Info'
            description='User basic information'
            titleClassName='!text-base'
            className='rounded-none border-0 border-b shadow-none'
          >
            <div className='ml-auto flex items-center gap-2'>
              <TooltipWrapper label='Back'>
                <LoadingButton
                  type='button'
                  variant='outline'
                  onClick={handleCancel}
                  isLoading={updateBasicInfoAction.isExecuting}
                  disabled={isEmpty(formState.dirtyFields)}
                >
                  <Icons.x /> Cancel
                </LoadingButton>
              </TooltipWrapper>

              <TooltipWrapper label='Save'>
                <LoadingButton
                  type='submit'
                  variant='default'
                  isLoading={updateBasicInfoAction.isExecuting}
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
                <InputField control={form.control} name='fname' label='First Name' isRequired />
              </Column>

              <Column md={6} lg={3}>
                <InputField control={form.control} name='mname' label='Middle Name' />
              </Column>

              <Column md={6} lg={3}>
                <InputField control={form.control} name='lname' label='Last Name' isRequired />
              </Column>

              <Column md={6} lg={3}>
                <InputField control={form.control} name='suffix' label='Suffix' description='e.g. Jr., Sr., III' />
              </Column>

              <Column md={6} lg={3}>
                <InputField control={form.control} name='username' label='Username' isRequired transform={toUsernameInput} />
              </Column>

              <Column md={6} lg={3}>
                <InputField control={form.control} name='email' label='Email' isRequired />
              </Column>
            </Row>
          </FieldGroup>
        </div>
      </form>
    </FormProvider>
  )
}
