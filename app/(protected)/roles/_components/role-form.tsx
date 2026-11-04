'use client'

import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useAction } from 'next-safe-action/hooks'
import { FormProvider, useForm, useWatch } from 'react-hook-form'
import { useEffect, useMemo, useRef } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'

import { getRoleByCode, upsertRole } from '@/actions/role'
import { PageMetadata } from '@/types/common'
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
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { delay } from '@/lib/utils'
import { logger } from '@/lib/logger'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { type RoleForm, roleFormSchema } from '@/schema/role'
import TextareaField from '@/components/forms/textarea-field'
import { useRolePermissions } from '@/hooks/safe-actions/role-permission'
import { usePermissions } from '@/hooks/safe-actions/permission'
import { useRoleReports } from '@/hooks/safe-actions/role-report'
import { useSubmitIntent } from '@/hooks/use-submit-intent'
import { useReports } from '@/hooks/safe-actions/report'
import { useActiveSapDatabases } from '@/hooks/safe-actions/sap-database'
import CheckboxGroupField from '@/components/forms/checkbox-group-field'
import Alert from '@/components/alert'
import { SUPER_USER_ROLE_KEY } from '@/constants/role'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useFieldArray } from 'react-hook-form'
import { buildPermissionTree, getAssignablePermissions } from '@/lib/permissions'
import { PermissionTreeNode } from './role-permission-tree-node'
import { Checkbox } from '@/components/ui/checkbox'
import CanView from '@/components/rbac/can-view'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { ColorPickerField } from '@/components/forms/color-picker-field'
import { BadgeColor } from '@/constants/color'
import { formatBadgeColorLabel } from '@/lib/color'
import { Badge } from '@/components/ui/badge'

type RoleFormProps = { pageMetaData: PageMetadata; role: Awaited<ReturnType<typeof getRoleByCode>> }

export default function RoleForm({ pageMetaData, role }: RoleFormProps) {
  const router = useRouter()

  const { code } = useParams() as { code: string }

  const isCreate = code === 'add' || !role
  const isReportingDisabled = process.env.NEXT_PUBLIC_DISABLE_REPORTING === 'true'

  //! permissions are seeded by their own effect, so they start empty here
  const defaultValues = useMemo(
    () => ({
      code: -1,
      key: '',
      name: '',
      description: undefined,
      color: undefined,
      permissions: [],
      roles: [],
      sapDatabases: []
    }),
    []
  )

  const permissions = usePermissions()
  const rolePermissions = useRolePermissions(role?.code ?? -1)
  const reports = useReports()
  const roleReports = useRoleReports(role?.code)
  const activeSapDatabases = useActiveSapDatabases()

  const upsertRoleAction = useAction(upsertRole)

  const { intent, setIntent, consumeIntent } = useSubmitIntent()

  const values = useMemo(() => {
    if (role) {
      return {
        code: role.code,
        key: role.key,
        name: role.name,
        description: role.description,
        color: role.color,
        permissions: [],
        roles: [],
        sapDatabases: role.roleSapDatabases.map((rsd) => rsd.sapDatabaseCode)
      }
    }

    if (isCreate) return defaultValues
  }, [isCreate, role, defaultValues])

  const form = useForm({
    values,
    mode: 'onChange',
    resetOptions: { keepDirtyValues: true },
    resolver: zodResolver(roleFormSchema)
  })

  const { fields, replace, update } = useFieldArray({
    control: form.control,
    name: 'permissions',
    keyName: '_fieldId'
  })

  const seededRef = useRef<string | null>(null)

  const name = useWatch({ control: form.control, name: 'name' }) || ''
  const color = useWatch({ control: form.control, name: 'color' })
  const permissionsFormData = useWatch({ control: form.control, name: 'permissions' }) || []
  const roles = useWatch({ control: form.control, name: 'roles' }) || []

  const isSystem = role?.isSystem ?? false

  const isAdmin = useMemo(() => {
    return name === SUPER_USER_ROLE_KEY
  }, [name])

  const permissionTree = useMemo(() => buildPermissionTree(permissions.data ?? []), [permissions.data])
  const allLeafPermissions = useMemo(() => getAssignablePermissions(permissionTree), [permissionTree])

  //* map of permissions to their selected actions
  const selectedActionsMap = useMemo(() => {
    const map = new Map<string, string[]>()
    permissionsFormData.forEach((p) => map.set(p.code, p.actions ?? []))
    return map
  }, [permissionsFormData])

  //* toggle a leaf's action
  const handleToggleAction = (code: string, action: string) => {
    const index = fields.findIndex((f) => f.code === code)
    if (index === -1) return

    const current = form.getValues(`permissions.${index}.actions`) ?? []
    const next = current.includes(action) ? current.filter((a) => a !== action) : [...current, action]

    update(index, { code, actions: next })
  }

  //* toggles a node's own actions and cascades to every descendant
  const handleToggleNodeSelectAll = (node: (typeof permissionTree)[number]) => {
    const leaves = getAssignablePermissions([node])
    const allSelected = leaves.every((l) => l.allowedActions.every((a) => (selectedActionsMap.get(l.code) ?? []).includes(a)))
    const shouldSelect = !allSelected

    const next = fields.map((f) => {
      const leaf = leaves.find((l) => l.code === f.code)
      if (!leaf) return { code: f.code, actions: f.actions }
      return { code: f.code, actions: shouldSelect ? leaf.allowedActions : [] }
    })

    replace(next)
  }

  const isAllSelected =
    allLeafPermissions.length > 0 &&
    allLeafPermissions.every((p) => p.allowedActions.every((a) => (selectedActionsMap.get(p.code) ?? []).includes(a)))

  const isSomeSelected = allLeafPermissions.some((p) => (selectedActionsMap.get(p.code) ?? []).length > 0)

  //* toggles every permission's actions
  const handleToggleSelectAll = () => {
    const shouldSelect = !isAllSelected
    const next = fields.map((f) => {
      const leaf = allLeafPermissions.find((p) => p.code === f.code)
      if (!leaf) return { code: f.code, actions: f.actions }
      return { code: f.code, actions: shouldSelect ? leaf.allowedActions : [] }
    })
    replace(next)
  }

  const handleSubmit = async (formValues: RoleForm) => {
    const submitIntent = consumeIntent()

    if (formValues.key === SUPER_USER_ROLE_KEY) {
      toast.success('Role updated successfully!')
      return
    }

    try {
      const response = await upsertRoleAction.executeAsync(formValues)
      const result = response?.data

      if (result?.error) {
        if (result.status === 401) form.setError('key', { type: 'custom', message: result.message })
        toast.error(result.message)
        return
      }

      toast.success(result?.message)

      if (result?.data && result?.data?.role && 'code' in result?.data?.role) {
        router.refresh()

        //* save and new stays on a blank form, editing hands off to the add page
        if (submitIntent === 'save-new') {
          if (isCreate) {
            //* the seeding effect won't run again, so hand reset the cleared permission rows
            const blankPermissions = (permissions.data ?? []).map((permission) => ({ code: permission.code, actions: [] }))
            form.reset({ ...defaultValues, permissions: blankPermissions }, { keepDirtyValues: false })
          } else router.push('/roles/add')

          return
        }

        await delay(1500)

        if (isCreate) router.push('/roles')
        else router.push(`/roles/${result?.data?.role?.code}`)
      }
    } catch (err: any) {
      logger.error(err, '[ROLE_FORM_HANDLE_SUBMIT_ERROR]:')
      toast.error('Something went wrong! Please try again later.')
    }
  }

  //* seed the form with existing permissions
  useEffect(() => {
    if (permissions.isLoading) return
    if (!isCreate && rolePermissions.isLoading) return

    const seedKey = `${role?.code ?? 'new'}-${permissions.data?.length ?? 0}`
    if (seededRef.current === seedKey) return
    seededRef.current = seedKey

    const initial = (permissions.data ?? []).map((p) => {
      const existing = rolePermissions.data?.find((rp) => rp.permissionCode === p.code)
      return { code: p.code, actions: existing?.actions ?? [] }
    })

    replace(initial)
  }, [permissions.isLoading, rolePermissions.isLoading, role?.code, permissions.data?.length])

  //* linked inactive databases stay listed, so saving does not silently drop them
  const sapDatabaseOptions = useMemo(() => {
    //* wait for the list, or every linked database shows as inactive for a moment
    if (activeSapDatabases.isLoading) return []

    const options = activeSapDatabases.data.map((sapDb) => ({ value: sapDb.dbCode, label: `${sapDb.name} (${sapDb.dbCode})` }))

    const linkedInactive = (role?.roleSapDatabases ?? [])
      .filter((rsd) => !options.some((option) => option.value === rsd.sapDatabaseCode))
      .map((rsd) => ({ value: rsd.sapDatabaseCode, label: `${rsd.sapDatabase.name} (${rsd.sapDatabaseCode}) (Inactive)` }))

    return [...options, ...linkedInactive]
  }, [activeSapDatabases.isLoading, activeSapDatabases.data, role?.roleSapDatabases])

  //* update role key based on name
  useEffect(() => {
    const result = name ? name.toLowerCase().replaceAll(' ', '-') : ''
    form.setValue('key', result)
  }, [name])

  return (
    <FormProvider {...form}>
      <form className='flex h-full w-full flex-1 flex-col gap-5' onSubmit={form.handleSubmit(handleSubmit)}>
        <Header title={pageMetaData.title} description={pageMetaData.description}>
          <div className='ml-auto flex items-center gap-2'>
            <TooltipWrapper label='Back'>
              <Button type='button' variant='outline' onClick={() => router.push('/roles')}>
                <Icons.arrowLeft /> Back
              </Button>
            </TooltipWrapper>

            <CanView subject={PERMISSIONS_CODES.ROLES} action={PERMISSIONS_ALLOWED_ACTIONS.CREATE}>
              <TooltipWrapper label='Save & New'>
                <LoadingButton
                  type='button'
                  variant='outline-primary'
                  isLoading={upsertRoleAction.isExecuting && intent === 'save-new'}
                  disabled={isAdmin || upsertRoleAction.isExecuting}
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
                isLoading={upsertRoleAction.isExecuting && intent === 'save'}
                disabled={isAdmin || upsertRoleAction.isExecuting}
                onClick={() => setIntent('save')}
              >
                <Icons.save /> Save
              </LoadingButton>
            </TooltipWrapper>

            {role && (
              <DropdownMenu>
                <TooltipWrapper label='More Options'>
                  <DropdownMenuTrigger asChild>
                    <Button variant='ghost' size='icon-lg'>
                      <Icons.ellipsisVertical />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipWrapper>
                <DropdownMenuContent className='w-auto min-w-20' align='end'>
                  <CanView subject={PERMISSIONS_CODES.ROLES} action={PERMISSIONS_ALLOWED_ACTIONS.CREATE}>
                    <DropdownMenuItem onClick={() => router.push('/roles/add')}>
                      <Icons.plus /> Add
                    </DropdownMenuItem>
                  </CanView>

                  <CanView subject={PERMISSIONS_CODES.ROLES} action={PERMISSIONS_ALLOWED_ACTIONS.VIEW}>
                    <DropdownMenuItem onClick={() => router.push(`/roles/${role.code}/view`)}>
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
                  <ReadOnlyFieldHeader title='Details' description='Enter the details of the role' />
                  <Separator className='mt-4' />
                </Column>

                <Column md={6} lg={3}>
                  <InputField
                    control={form.control}
                    name='name'
                    label='Name'
                    isRequired
                    extendedProps={{ inputProps: { disabled: isSystem } }}
                  />
                </Column>

                <Column md={6} lg={3}>
                  <InputField
                    control={form.control}
                    name='key'
                    label='Key'
                    isRequired
                    description='Key must be unique'
                    extendedProps={{ inputProps: { disabled: true } }}
                  />
                </Column>

                <Column md={6} lg={3}>
                  <ColorPickerField control={form.control} name='color' label='Color' description='Color of badge when displayed' />
                </Column>

                <Column md={6} lg={3} className='flex items-center justify-start'>
                  <div className='flex items-center gap-2'>
                    <span className='text-sm font-medium'>Preview:</span>

                    {color ? (
                      <Badge variant={color as BadgeColor}>{name || formatBadgeColorLabel(color)}</Badge>
                    ) : (
                      <span className='text-muted-foreground text-sm'>No color selected</span>
                    )}
                  </div>
                </Column>

                <Column>
                  <TextareaField
                    control={form.control}
                    name='description'
                    label='Description'
                    extendedProps={{ textareaProps: { disabled: isSystem } }}
                  />
                </Column>

                <Separator className='col-span-12' />

                <Column>
                  {/* //* Permissions tab - supports multi level nested permissions */}
                  <Tabs defaultValue='1' className='flex min-h-0 w-full flex-1 flex-col'>
                    <ScrollArea className='w-full shrink-0 pb-2.5 **:data-[orientation=vertical]:hidden' type='auto'>
                      <TabsList className='w-max'>
                        <TabsTrigger value='1' className='shrink-0'>
                          Permissions
                        </TabsTrigger>

                        {!isReportingDisabled && (
                          <TabsTrigger value='2' className='shrink-0'>
                            Reports
                          </TabsTrigger>
                        )}

                        <TabsTrigger value='3' className='shrink-0'>
                          SAP Databases
                        </TabsTrigger>
                      </TabsList>
                    </ScrollArea>

                    <TabsContent value='1' className='min-h-0 flex-1'>
                      <div className='col-span-12 grid grid-cols-12 divide-y'>
                        {permissions.isLoading && (
                          <div className='relative col-span-12 flex h-60 w-full items-center justify-center gap-2'>
                            <Icons.spinner className='text-primary size-5 animate-spin' /> <span>Loading permissions...</span>
                          </div>
                        )}

                        {!permissions.isLoading && allLeafPermissions.length > 0 && (
                          <div className='col-span-12 flex items-center gap-2 p-2'>
                            <Checkbox
                              checked={isSomeSelected ? (isAllSelected ? true : 'indeterminate') : false}
                              onCheckedChange={handleToggleSelectAll}
                            />
                            <span className='text-sm font-medium'>Select All Permissions</span>
                          </div>
                        )}

                        {!permissions.isLoading &&
                          permissionTree.map((node) => (
                            <PermissionTreeNode
                              key={node.code}
                              node={node}
                              selectedActionsMap={selectedActionsMap}
                              onToggleAction={handleToggleAction}
                              onToggleNode={handleToggleNodeSelectAll}
                            />
                          ))}
                      </div>
                    </TabsContent>

                    {!isReportingDisabled && <TabsContent value='2' className='min-h-0 flex-1'></TabsContent>}

                    <TabsContent value='3' className='min-h-0 flex-1'>
                      <div className='flex flex-col gap-4 p-2'>
                        {isAdmin && <Alert variant='default' message='This role always has access to every SAP database.' />}

                        {!activeSapDatabases.isLoading && sapDatabaseOptions.length < 1 && (
                          <p className='text-muted-foreground text-sm'>No SAP databases yet. Add them with pnpm db:seed:sap-database.</p>
                        )}

                        <CheckboxGroupField
                          control={form.control}
                          name='sapDatabases'
                          label='SAP Databases'
                          description='Databases users with this role can pick after signing in.'
                          direction='vertical'
                          data={sapDatabaseOptions}
                          isLoading={activeSapDatabases.isLoading}
                          extendedProps={{ checkboxProps: { disabled: isAdmin } }}
                        />
                      </div>
                    </TabsContent>
                  </Tabs>
                </Column>
              </Row>
            </FieldGroup>
          </ScrollArea>
        </ContentWrapper>
      </form>
    </FormProvider>
  )
}
