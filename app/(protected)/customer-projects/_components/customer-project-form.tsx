'use client'

import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useAction } from 'next-safe-action/hooks'
import { FormProvider, useForm } from 'react-hook-form'
import { useMemo } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'

import { getCustomerProjectByCode, upsertCustomerProject } from '@/actions/customer-project'
import { PageMetadata } from '@/types/common'
import { type CustomerProjectForm, customerProjectFormSchema } from '@/schema/customer-project'
import Header from '@/components/header'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { TooltipWrapper } from '@/components/tooltip-wrapper'
import { FieldGroup } from '@/components/ui/field'
import { Row } from '@/components/row'
import { Column } from '@/components/column'
import ReadOnlyFieldHeader from '@/components/read-only-field-header'
import InputField from '@/components/forms/input-field'
import TextareaField from '@/components/forms/textarea-field'
import ContentWrapper from '@/components/content-wrapper'
import LoadingButton from '@/components/forms/button-field'
import { useSubmitIntent } from '@/hooks/use-submit-intent'
import SwitchField from '@/components/forms/switch-field'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { delay } from '@/lib/utils'
import { logger } from '@/lib/logger'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import CanView from '@/components/rbac/can-view'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { ComboboxField } from '@/components/forms/combobox-field'
import { renderCodeItem } from '@/components/forms/combobox-item-content'
import { toFormOption, toFormOptions, withCurrentOption } from '@/lib/form'
import { useProjectCategories } from '@/hooks/safe-actions/project-category'

type CustomerProjectFormProps = { pageMetaData: PageMetadata; customerProject: Awaited<ReturnType<typeof getCustomerProjectByCode>> }

export default function CustomerProjectForm({ pageMetaData, customerProject }: CustomerProjectFormProps) {
  const router = useRouter()

  const { code } = useParams() as { code: string }

  const isCreate = code === 'add' || !customerProject

  const defaultValues = useMemo(() => ({ id: null, code: '', name: '', description: '', categoryCode: '', isActive: true }), [])

  const values = useMemo(() => {
    if (customerProject) {
      const { id, code, name, description, categoryCode, isActive } = customerProject
      return { id, code, name, description: description ?? '', categoryCode, isActive }
    }

    if (isCreate) return defaultValues
  }, [isCreate, customerProject, defaultValues])

  const projectCategories = useProjectCategories()

  //* the picker lists active categories only, a project already on an inactive or deleted one keeps it selectable
  const categoryOptions = useMemo(() => {
    const current = customerProject?.category ? toFormOption(customerProject.category) : null

    return withCurrentOption(toFormOptions(projectCategories.data), current)
  }, [projectCategories.data, customerProject])

  const form = useForm({
    mode: 'onChange',
    values,
    resetOptions: { keepDirtyValues: true },
    resolver: zodResolver(customerProjectFormSchema)
  })

  const upsertCustomerProjectAction = useAction(upsertCustomerProject)

  const { intent, setIntent, consumeIntent } = useSubmitIntent()

  const handleSubmit = async (formValues: CustomerProjectForm) => {
    const submitIntent = consumeIntent()

    try {
      const response = await upsertCustomerProjectAction.executeAsync(formValues)
      const result = response?.data

      if (result?.error) {
        if (result.status === 401 && result.paths && result.paths.length > 0) {
          result.paths.forEach((path) => {
            const field = path.field as keyof CustomerProjectForm
            form.setError(field, { type: 'custom', message: path.message })
          })
        }

        toast.error(result.message)
        return
      }

      toast.success(result?.message)

      if (result?.data?.customerProject) {
        router.refresh()

        //* save and new stays on a blank form, editing hands off to the add page
        if (submitIntent === 'save-new') {
          if (isCreate) form.reset(defaultValues, { keepDirtyValues: false })
          else router.push('/customer-projects/add')

          return
        }

        await delay(1500)

        if (isCreate) router.push('/customer-projects')
        else router.push(`/customer-projects/${result.data.customerProject.code}`)
      }
    } catch (err: any) {
      logger.error(err, '[CUSTOMER_PROJECT_FORM_HANDLE_SUBMIT_ERROR]:')
      toast.error('Something went wrong! Please try again later.')
    }
  }

  return (
    <FormProvider {...form}>
      <form className='flex h-full w-full flex-1 flex-col gap-5' onSubmit={form.handleSubmit(handleSubmit)}>
        <Header title={pageMetaData.title} description={pageMetaData.description}>
          <div className='ml-auto flex items-center gap-2'>
            <TooltipWrapper label='Back'>
              <Button type='button' variant='outline' onClick={() => router.push('/customer-projects')}>
                <Icons.arrowLeft /> Back
              </Button>
            </TooltipWrapper>

            <CanView subject={PERMISSIONS_CODES.CUSTOMER_PROJECTS} action={PERMISSIONS_ALLOWED_ACTIONS.CREATE}>
              <TooltipWrapper label='Save & New'>
                {/* //* not a submit button, it would become the form's default and take over the enter key */}
                <LoadingButton
                  type='button'
                  variant='outline-primary'
                  isLoading={upsertCustomerProjectAction.isExecuting && intent === 'save-new'}
                  disabled={upsertCustomerProjectAction.isExecuting}
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
                isLoading={upsertCustomerProjectAction.isExecuting && intent === 'save'}
                disabled={upsertCustomerProjectAction.isExecuting}
                onClick={() => setIntent('save')}
              >
                <Icons.save /> Save
              </LoadingButton>
            </TooltipWrapper>

            {customerProject && (
              <DropdownMenu>
                <TooltipWrapper label='More Options'>
                  <DropdownMenuTrigger asChild>
                    <Button variant='ghost' size='icon-lg'>
                      <Icons.ellipsisVertical />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipWrapper>

                <DropdownMenuContent className='w-auto min-w-20' align='end'>
                  <CanView subject={PERMISSIONS_CODES.CUSTOMER_PROJECTS} action={PERMISSIONS_ALLOWED_ACTIONS.CREATE}>
                    <DropdownMenuItem onClick={() => router.push('/customer-projects/add')}>
                      <Icons.plus /> Add
                    </DropdownMenuItem>
                  </CanView>

                  <CanView subject={PERMISSIONS_CODES.CUSTOMER_PROJECTS} action={PERMISSIONS_ALLOWED_ACTIONS.VIEW}>
                    <DropdownMenuItem onClick={() => router.push(`/customer-projects/${customerProject.code}/view`)}>
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
                  <ReadOnlyFieldHeader title='Details' description='Enter the details of the customer project' />
                  <Separator className='mt-4' />
                </Column>

                <Column md={6} lg={3}>
                  <InputField
                    control={form.control}
                    name='code'
                    label='Code'
                    description={isCreate ? 'At least 4 letters, numbers or dashes, cannot be changed later' : 'Code cannot be changed'}
                    isRequired
                    transform={(value) => value.toUpperCase()}
                    extendedProps={{ inputProps: { disabled: !isCreate } }}
                  />
                </Column>

                <Column md={6} lg={3}>
                  <InputField control={form.control} name='name' label='Name' description='Name must be unique' isRequired />
                </Column>

                <Column md={6} lg={3}>
                  <ComboboxField
                    control={form.control}
                    type='Basic'
                    name='categoryCode'
                    label='Category'
                    isRequired
                    data={categoryOptions}
                    isLoading={projectCategories.isLoading}
                    searchKeys={['value']}
                    renderItem={renderCodeItem}
                    description={isCreate ? 'Cannot be changed later' : 'Category cannot be changed'}
                    extendedProps={{ comboboxInputProps: { disabled: !isCreate } }}
                  />
                </Column>

                <Column>
                  <TextareaField control={form.control} name='description' label='Description' />
                </Column>

                <Column>
                  <Separator className='mt-3 mb-4' />
                  <ReadOnlyFieldHeader title='Settings' description="Configure the customer project's setting" />
                </Column>

                <Column md={6} lg={3}>
                  <SwitchField
                    control={form.control}
                    name='isActive'
                    label='Active'
                    layout='choice-card'
                    description='Inactive projects are hidden from selection'
                    extendedProps={{ switchProps: { disabled: isCreate } }}
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
