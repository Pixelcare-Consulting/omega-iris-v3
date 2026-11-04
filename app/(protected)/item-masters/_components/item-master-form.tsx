'use client'

import { useCallback, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useAction } from 'next-safe-action/hooks'
import { FormProvider, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { ItemMasterWithRelations, setItemMasterThumbnail, upsertItemMaster } from '@/actions/item-master'
import { PageMetadata } from '@/types/common'
import { type ItemMasterForm, itemMasterFormSchema } from '@/schema/item-master'
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
import ImageAttachmentField from '@/components/forms/image-attachment-field'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { delay } from '@/lib/utils'
import { logger } from '@/lib/logger'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import CanView from '@/components/rbac/can-view'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { FILE_ATTACHMENT_MODULES } from '@/constants/file-attachment'
import { ComboboxField } from '@/components/forms/combobox-field'
import { toFormOption, toFormOptions, withCurrentOption } from '@/lib/form'
import { uploadFileAttachment } from '@/lib/file-attachment'
import { StagedImages, StagedImagesContext } from '@/contexts/staged-images'
import { useManufacturers } from '@/hooks/safe-actions/manufacturer'
import { useCommodities } from '@/hooks/safe-actions/commodity'

type ItemMasterFormProps = { pageMetaData: PageMetadata; itemMaster: ItemMasterWithRelations | null }

type SavedItemMaster = { id: string; code: string; thumbnail: string | null }

const DEFAULT_VALUES: ItemMasterForm = {
  id: null,
  code: '',
  description: '',
  manufacturerCode: '',
  commodityCode: '',
  notes: '',
  thumbnail: null,
  isActive: true
}

const getReferenceLabel = (reference: { code: string; name: string }) => `${reference.code} - ${reference.name}`

export default function ItemMasterForm({ pageMetaData, itemMaster }: ItemMasterFormProps) {
  const router = useRouter()

  const { code } = useParams() as { code: string }

  const isCreate = code === 'add' || !itemMaster

  const values = useMemo(() => {
    if (itemMaster) {
      const { id, code, description, manufacturerCode, commodityCode, notes, thumbnail, isActive } = itemMaster

      return {
        id,
        code,
        description: description ?? '',
        manufacturerCode: manufacturerCode ?? '',
        commodityCode: commodityCode ?? '',
        notes: notes ?? '',
        thumbnail,
        isActive
      }
    }

    if (isCreate) return DEFAULT_VALUES
  }, [isCreate, itemMaster])

  const manufacturers = useManufacturers()
  const commodities = useCommodities()

  //* the pickers list active rows only, an item already on an inactive or deleted one keeps it selectable
  const manufacturerOptions = useMemo(() => {
    const current = itemMaster?.manufacturer ? toFormOption(itemMaster.manufacturer, getReferenceLabel) : null
    return withCurrentOption(toFormOptions(manufacturers.data, getReferenceLabel), current)
  }, [manufacturers.data, itemMaster])

  const commodityOptions = useMemo(() => {
    const current = itemMaster?.commodity ? toFormOption(itemMaster.commodity, getReferenceLabel) : null
    return withCurrentOption(toFormOptions(commodities.data, getReferenceLabel), current)
  }, [commodities.data, itemMaster])

  const form = useForm({
    mode: 'onChange',
    values,
    resetOptions: { keepDirtyValues: true },
    resolver: zodResolver(itemMasterFormSchema)
  })

  const upsertItemMasterAction = useAction(upsertItemMaster)
  const setItemMasterThumbnailAction = useAction(setItemMasterThumbnail)

  const { intent, setIntent, consumeIntent } = useSubmitIntent()

  //* the picked thumbnail waits here until save
  const [files, setFiles] = useState<Record<string, File>>({})
  const [progress, setProgress] = useState<Record<string, number>>({})
  const [isUploading, setIsUploading] = useState(false)

  const handleStage = useCallback((name: string, file: File | null) => {
    setFiles((prev) => {
      const next = { ...prev }

      if (file) next[name] = file
      else delete next[name]

      return next
    })
  }, [])

  const stagedImages = useMemo<StagedImages>(() => ({ files, progress, onStage: handleStage }), [files, progress, handleStage])

  const isSaving = isUploading || upsertItemMasterAction.isExecuting || setItemMasterThumbnailAction.isExecuting

  //* uploads a picked file or clears a removed one, returns false when it fails
  const saveThumbnail = async (saved: SavedItemMaster, thumbnail: string | null) => {
    const file = files.thumbnail

    try {
      if (file) {
        setIsUploading(true)
        setProgress({ thumbnail: 0 })

        const uploaded = await uploadFileAttachment({
          file,
          moduleName: FILE_ATTACHMENT_MODULES.ITEM_MASTERS,
          referenceId: saved.id,
          onProgress: (percent) => setProgress({ thumbnail: percent })
        })

        thumbnail = uploaded.id
      }

      //* nothing picked and nothing removed
      if (thumbnail === saved.thumbnail) return true

      const response = await setItemMasterThumbnailAction.executeAsync({ id: saved.id, thumbnail })
      const result = response?.data

      if (!result || result.error) throw new Error(result?.message ?? 'Thumbnail was not saved')

      form.setValue('thumbnail', thumbnail)
      setFiles({})

      return true
    } catch (err) {
      logger.error(err, '[ITEM_MASTER_THUMBNAIL_UPLOAD_ERROR]:')

      const message = err instanceof Error ? err.message : 'Upload failed'
      form.setError('thumbnail', { type: 'custom', message })

      return false
    } finally {
      setIsUploading(false)
      setProgress({})
    }
  }

  const handleSubmit = async (formValues: ItemMasterForm) => {
    const submitIntent = consumeIntent()

    try {
      const response = await upsertItemMasterAction.executeAsync(formValues)
      const result = response?.data

      if (result?.error) {
        if (result.status === 401 && result.paths && result.paths.length > 0) {
          result.paths.forEach((path) => {
            const field = path.field as keyof ItemMasterForm
            form.setError(field, { type: 'custom', message: path.message })
          })
        }

        toast.error(result.message)
        return
      }

      const saved = result?.data?.itemMaster

      if (!saved) return

      const isThumbnailSaved = await saveThumbnail(saved, formValues.thumbnail)

      //* the item is saved either way, a create moves to its edit page so the upload can be retried
      if (!isThumbnailSaved) {
        toast.error('Item saved, but the thumbnail did not upload.')

        if (isCreate) router.push(`/item-masters/${encodeURIComponent(saved.code)}`)
        router.refresh()

        return
      }

      toast.success(result?.message)

      //* save and new stays on a blank form, editing hands off to the add page
      if (submitIntent === 'save-new') {
        router.refresh()

        if (isCreate) {
          form.reset(DEFAULT_VALUES, { keepDirtyValues: false })
          setFiles({})
        } else router.push('/item-masters/add')

        return
      }

      await delay(1500)

      //! navigate before refresh, refreshing here 404s when the code was renamed
      if (isCreate) router.push('/item-masters')
      else router.push(`/item-masters/${encodeURIComponent(saved.code)}`)

      router.refresh()
    } catch (err: any) {
      logger.error(err, '[ITEM_MASTER_FORM_HANDLE_SUBMIT_ERROR]:')
      toast.error('Something went wrong! Please try again later.')
    }
  }

  return (
    <FormProvider {...form}>
      <StagedImagesContext.Provider value={stagedImages}>
        <form className='flex h-full w-full flex-1 flex-col gap-5' onSubmit={form.handleSubmit(handleSubmit)}>
          <Header title={pageMetaData.title} description={pageMetaData.description}>
            <div className='ml-auto flex items-center gap-2'>
              <TooltipWrapper label='Back'>
                <Button type='button' variant='outline' onClick={() => router.push('/item-masters')}>
                  <Icons.arrowLeft /> Back
                </Button>
              </TooltipWrapper>

              <CanView subject={PERMISSIONS_CODES.ITEM_MASTERS} action={PERMISSIONS_ALLOWED_ACTIONS.CREATE}>
                <TooltipWrapper label='Save & New'>
                  {/* //* not a submit button, it would become the form's default and take over the enter key */}
                  <LoadingButton
                    type='button'
                    variant='outline-primary'
                    isLoading={isSaving && intent === 'save-new'}
                    disabled={isSaving}
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
                  isLoading={isSaving && intent === 'save'}
                  disabled={isSaving}
                  onClick={() => setIntent('save')}
                >
                  <Icons.save /> Save
                </LoadingButton>
              </TooltipWrapper>

              {itemMaster && (
                <DropdownMenu>
                  <TooltipWrapper label='More Options'>
                    <DropdownMenuTrigger asChild>
                      <Button variant='ghost' size='icon-lg'>
                        <Icons.ellipsisVertical />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipWrapper>

                  <DropdownMenuContent className='w-auto min-w-20' align='end'>
                    <CanView subject={PERMISSIONS_CODES.ITEM_MASTERS} action={PERMISSIONS_ALLOWED_ACTIONS.CREATE}>
                      <DropdownMenuItem onClick={() => router.push('/item-masters/add')}>
                        <Icons.plus /> Add
                      </DropdownMenuItem>
                    </CanView>

                    <CanView subject={PERMISSIONS_CODES.ITEM_MASTERS} action={PERMISSIONS_ALLOWED_ACTIONS.VIEW}>
                      <DropdownMenuItem onClick={() => router.push(`/item-masters/${encodeURIComponent(itemMaster.code)}/view`)}>
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
                    <ReadOnlyFieldHeader title='Details' description='Enter the details of the item' />
                    <Separator className='mt-4' />
                  </Column>

                  {/* //* thumbnail tile on the left, fields on the right */}
                  <Column md={4} lg={3}>
                    <ImageAttachmentField<ItemMasterForm>
                      name='thumbnail'
                      variant='tile'
                      isHideLabel
                      hint='Recommended size: 800×800'
                      isDisabled={isSaving}
                    />
                  </Column>

                  <Column md={8} lg={9}>
                    <Row gap={5}>
                      <Column md={6}>
                        <InputField control={form.control} name='code' label='MFG P/N' description='MFG P/N must be unique' isRequired />
                      </Column>

                      <Column md={6}>
                        <ComboboxField
                          control={form.control}
                          type='Basic'
                          name='manufacturerCode'
                          label='Manufacturer'
                          data={manufacturerOptions}
                          isLoading={manufacturers.isLoading}
                        />
                      </Column>

                      <Column md={6}>
                        <InputField control={form.control} name='description' label='Description' />
                      </Column>

                      <Column md={6}>
                        <ComboboxField
                          control={form.control}
                          type='Basic'
                          name='commodityCode'
                          label='Commodity'
                          data={commodityOptions}
                          isLoading={commodities.isLoading}
                        />
                      </Column>

                      <Column>
                        <TextareaField control={form.control} name='notes' label='Notes' />
                      </Column>
                    </Row>
                  </Column>

                  <Column>
                    <Separator className='mt-3 mb-4' />
                    <ReadOnlyFieldHeader title='Settings' description="Configure the item's setting" />
                  </Column>

                  <Column md={6} lg={3}>
                    <SwitchField
                      control={form.control}
                      name='isActive'
                      label='Active'
                      layout='choice-card'
                      description='Inactive items are hidden from selection'
                      extendedProps={{ switchProps: { disabled: isCreate } }}
                    />
                  </Column>
                </Row>
              </FieldGroup>
            </ScrollArea>
          </ContentWrapper>
        </form>
      </StagedImagesContext.Provider>
    </FormProvider>
  )
}
