'use client'

import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useAction } from 'next-safe-action/hooks'
import { FormProvider, useForm } from 'react-hook-form'
import { useMemo } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'

import { getUserByCode, upsertUser } from '@/actions/user'
import { PageMetadata } from '@/types/common'
import { type UserForm, userFormSchema } from '@/schema/user'
import { toUsernameInput } from '@/lib/user'
import Header from '@/components/header'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { TooltipWrapper } from '@/components/tooltip-wrapper'
import { FieldGroup } from '@/components/ui/field'
import { Row } from '@/components/row'
import { Column } from '@/components/column'
import ReadOnlyFieldHeader from '@/components/read-only-field-header'
import InputField from '@/components/forms/input-field'
import ContentWrapper from '@/components/content-wrapper'
import LoadingButton from '@/components/forms/button-field'
import { useRoles } from '@/hooks/safe-actions/role'
import { useSubmitIntent } from '@/hooks/use-submit-intent'
import { toFormOption, toFormOptions, withCurrentOption } from '@/lib/form'
import { ComboboxField } from '@/components/forms/combobox-field'
import SwitchField from '@/components/forms/switch-field'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { delay } from '@/lib/utils'
import { logger } from '@/lib/logger'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import CanView from '@/components/rbac/can-view'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'

type UserFormProps = { pageMetaData: PageMetadata; user: Awaited<ReturnType<typeof getUserByCode>> }

export default function UserForm({ pageMetaData, user }: UserFormProps) {
  const router = useRouter()

  const { code } = useParams() as { code: string }

  const isCreate = code === 'add' || !user

  const defaultValues = useMemo(
    () => ({
      code: -1,
      fname: '',
      mname: '',
      lname: '',
      suffix: '',
      username: '',
      email: '',
      employeeId: '',
      isInternal: false,
      password: '',
      confirmPassword: '',
      roleCode: 0,
      roleKey: '',
      isActive: true,
      newPassword: '',
      newConfirmPassword: '',
      isForceToChangePassword: false,
      isLocked: false
    }),
    []
  )

  const values = useMemo(() => {
    if (user) {
      return {
        ...user,
        roleKey: user.role.key,
        employeeId: user.employeeId ?? '',
        password: '',
        confirmPassword: '',
        newPassword: '',
        newConfirmPassword: '',
        isForceToChangePassword: user.isDefaultPasswordChanged ? false : true
      }
    }

    if (isCreate) return defaultValues
  }, [isCreate, user, defaultValues])

  const form = useForm({
    mode: 'onChange',
    values,
    resetOptions: { keepDirtyValues: true },
    resolver: zodResolver(userFormSchema)
  })

  const upsertUserAction = useAction(upsertUser)

  const { intent, setIntent, consumeIntent } = useSubmitIntent()

  const roles = useRoles()

  //* the picker lists live roles only, a user already on a deleted role keeps it selectable
  const rolesOptions = useMemo(
    () => withCurrentOption(toFormOptions(roles.data), user?.role ? toFormOption(user.role) : null),
    [roles, user]
  )

  const handleSubmit = async (formValues: UserForm) => {
    const submitIntent = consumeIntent()

    try {
      const response = await upsertUserAction.executeAsync(formValues)
      const result = response?.data

      if (result?.error) {
        if (result.status === 401 && result.paths && result.paths.length > 0) {
          result.paths.forEach((path) => {
            const field = path.field as keyof UserForm
            form.setError(field, { type: 'custom', message: path.message })
          })
        }

        toast.error(result.message)
        return
      }

      toast.success(result?.message)

      if (result?.data && result?.data?.user && 'code' in result?.data?.user) {
        router.refresh()

        //* save and new stays on a blank form, editing hands off to the add page
        if (submitIntent === 'save-new') {
          //* overrides the form-level option so the fields clear
          if (isCreate) form.reset(defaultValues, { keepDirtyValues: false })
          else router.push('/users/add')

          return
        }

        await delay(1500)

        if (isCreate) router.push('/users')
        else router.push(`/users/${result?.data?.user?.code}`)
      }
    } catch (err: any) {
      logger.error(err, '[USER_FORM_HANDLE_SUBMIT_ERROR]:')
      toast.error('Something went wrong! Please try again later.')
    }
  }

  return (
    <FormProvider {...form}>
      <form className='flex h-full w-full flex-1 flex-col gap-5' onSubmit={form.handleSubmit(handleSubmit)}>
        <Header title={pageMetaData.title} description={pageMetaData.description}>
          <div className='ml-auto flex items-center gap-2'>
            <TooltipWrapper label='Back'>
              <Button type='button' variant='outline' onClick={() => router.push('/users')}>
                <Icons.arrowLeft /> Back
              </Button>
            </TooltipWrapper>

            <CanView subject={PERMISSIONS_CODES.USERS} action={PERMISSIONS_ALLOWED_ACTIONS.CREATE}>
              <TooltipWrapper label='Save & New'>
                {/* //* not a submit button, it would become the form's default and take over the enter key */}
                <LoadingButton
                  type='button'
                  variant='outline-primary'
                  isLoading={upsertUserAction.isExecuting && intent === 'save-new'}
                  disabled={upsertUserAction.isExecuting}
                  onClick={() => {
                    setIntent('save-new')
                    form.handleSubmit(handleSubmit)()
                  }}
                >
                  <Icons.plus /> Save & New
                </LoadingButton>
              </TooltipWrapper>
            </CanView>

            <TooltipWrapper label='Save'>
              <LoadingButton
                type='submit'
                variant='default'
                isLoading={upsertUserAction.isExecuting && intent === 'save'}
                disabled={upsertUserAction.isExecuting}
                onClick={() => setIntent('save')}
              >
                <Icons.save /> Save
              </LoadingButton>
            </TooltipWrapper>

            {user && (
              <DropdownMenu>
                <TooltipWrapper label='More Options'>
                  <DropdownMenuTrigger asChild>
                    <Button variant='ghost' size='icon-lg'>
                      <Icons.ellipsisVertical />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipWrapper>

                <DropdownMenuContent className='w-auto min-w-20' align='end'>
                  <CanView subject={PERMISSIONS_CODES.USERS} action={PERMISSIONS_ALLOWED_ACTIONS.CREATE}>
                    <DropdownMenuItem onClick={() => router.push('/users/add')}>
                      <Icons.plus /> Add
                    </DropdownMenuItem>
                  </CanView>

                  <CanView subject={PERMISSIONS_CODES.USERS} action={PERMISSIONS_ALLOWED_ACTIONS.VIEW}>
                    <DropdownMenuItem onClick={() => router.push(`/users/${user.code}/view`)}>
                      <Icons.eye /> View
                    </DropdownMenuItem>
                  </CanView>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </Header>

        <ContentWrapper>
          <ScrollArea className='m-1 flex-1' type='auto'>
            <FieldGroup className='p-4'>
              <Row gap={5}>
                <Column>
                  <ReadOnlyFieldHeader title='Details' description='Enter the details of the user' />
                  <Separator className='mt-4' />
                </Column>

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
                  <InputField
                    control={form.control}
                    name='username'
                    label='Username'
                    description='Username must be unique'
                    isRequired
                    transform={toUsernameInput}
                  />
                </Column>

                <Column md={6} lg={3}>
                  <InputField control={form.control} name='email' label='Email' description='Email must be unique' isRequired />
                </Column>

                <Column md={6} lg={3}>
                  <InputField control={form.control} name='employeeId' label='Employee ID' description='Employee ID must be unique' />
                </Column>

                <Column md={6} lg={3}>
                  <ComboboxField
                    control={form.control}
                    type='Basic'
                    name='roleCode'
                    label='Role'
                    data={rolesOptions}
                    isLoading={roles.isLoading}
                    isRequired
                    callback={(args) => form.setValue('roleKey', args?.item?.key)}
                  />
                </Column>

                {isCreate ? (
                  <>
                    <Column md={6} lg={3}>
                      <InputField
                        control={form.control}
                        name='password'
                        label='Password'
                        isRequired
                        extendedProps={{ inputProps: { type: 'password' } }}
                      />
                    </Column>

                    <Column md={6} lg={3}>
                      <InputField
                        control={form.control}
                        name='confirmPassword'
                        label='Confirm Password'
                        isRequired
                        extendedProps={{ inputProps: { type: 'password' } }}
                      />
                    </Column>
                  </>
                ) : (
                  <>
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
                  </>
                )}

                <Column>
                  <Separator className='mt-3 mb-4' />
                  <ReadOnlyFieldHeader title='Settings' description="Configure the user's setting" />
                </Column>

                <Column md={6} lg={3}>
                  <SwitchField
                    control={form.control}
                    name='isActive'
                    label='Active'
                    layout='choice-card'
                    description='Is this user active?'
                    extendedProps={{ switchProps: { disabled: isCreate } }}
                  />
                </Column>

                <Column md={6} lg={3}>
                  <SwitchField
                    control={form.control}
                    name='isInternal'
                    label='Internal'
                    layout='choice-card'
                    description='Is this user Omega personnel?'
                  />
                </Column>

                <Column md={6} lg={3}>
                  <SwitchField
                    control={form.control}
                    name='isForceToChangePassword'
                    label='Force To change Password'
                    layout='choice-card'
                    description='Required the user to change their password upon next login'
                  />
                </Column>

                <Column md={6} lg={3}>
                  <SwitchField
                    control={form.control}
                    name='isLocked'
                    label='Locked'
                    layout='choice-card'
                    description='Locked user cannot sign in'
                  />
                </Column>
              </Row>
            </FieldGroup>
          </ScrollArea>
        </ContentWrapper>
      </form>
    </FormProvider>
  )
}
