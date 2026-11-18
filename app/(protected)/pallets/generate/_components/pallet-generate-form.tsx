'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useAction } from 'next-safe-action/hooks'
import { FormProvider, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { generatePallets, previewPalletCodesClient } from '@/actions/pallet'
import { PageMetadata } from '@/types/common'
import { PalletGenerateForm as PalletGenerateFormValues, PalletGenerateLine as LineValues, palletGenerateFormSchema } from '@/schema/pallet'
import Header from '@/components/header'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { TooltipWrapper } from '@/components/tooltip-wrapper'
import { FieldGroup } from '@/components/ui/field'
import { Row } from '@/components/row'
import { Column } from '@/components/column'
import ReadOnlyFieldHeader from '@/components/read-only-field-header'
import ReadOnlyField from '@/components/read-only-field'
import ContentWrapper from '@/components/content-wrapper'
import LoadingButton from '@/components/forms/button-field'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { logger } from '@/lib/logger'
import { ComboboxField } from '@/components/forms/combobox-field'
import { renderCodeItem } from '@/components/forms/combobox-item-content'
import { toFormOptions } from '@/lib/form'
import { usePalletLocations } from '@/hooks/safe-actions/pallet'
import { useProjectCategories } from '@/hooks/safe-actions/project-category'
import { useCustomerProjects } from '@/hooks/safe-actions/customer-project'
import { buildPalletPreview, getPalletPrefixParts, PalletScopePreview, toPalletPrefixKey } from '@/lib/pallet'
import PalletGenerateLine from './pallet-generate-line'
import PalletGeneratePreview from './pallet-generate-preview'

const BLANK_LINE: LineValues = { isGeneralPurpose: false, projectCategoryCode: '', customerProjectCode: '', quantity: 1 }

const DEFAULT_VALUES: PalletGenerateFormValues = { locationCode: '', lines: [BLANK_LINE] }

//* wait for typing to settle before asking the server
const PREVIEW_LOOKUP_DELAY = 300

//* a line is ready once it can make a code
const isReadyLine = (line?: Partial<LineValues>) =>
  !!line && Number(line.quantity) > 0 && (line.isGeneralPurpose || (!!line.projectCategoryCode && !!line.customerProjectCode))

export default function PalletGenerateForm({ pageMetaData }: { pageMetaData: PageMetadata }) {
  const router = useRouter()

  const [previewByKey, setPreviewByKey] = useState<Record<string, PalletScopePreview>>({})
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)

  const form = useForm({
    mode: 'onChange',
    defaultValues: DEFAULT_VALUES,
    resolver: zodResolver(palletGenerateFormSchema)
  })

  const lines = useWatch({ control: form.control, name: 'lines' })

  const lineFields = useFieldArray({ control: form.control, name: 'lines' })

  const locations = usePalletLocations()
  const projectCategories = useProjectCategories()
  const customerProjects = useCustomerProjects()
  const generateAction = useAction(generatePallets)
  const previewCodesAction = useAction(previewPalletCodesClient)

  const locationOptions = useMemo(() => toFormOptions(locations.data), [locations.data])
  const categoryOptions = useMemo(() => toFormOptions(projectCategories.data), [projectCategories.data])
  const projectOptions = useMemo(() => toFormOptions(customerProjects.data), [customerProjects.data])

  const readyLines = useMemo(
    //* the line number is kept, so line 2 stays line 2 when line 1 is unfinished
    () =>
      (lines ?? [])
        .map((line, index) => ({ ...line, quantity: Number(line?.quantity), lineNumber: index + 1 }))
        .filter(isReadyLine) as (LineValues & { lineNumber: number })[],
    [lines]
  )

  //* distinct prefixes, the server knows the month and the next numbers
  const prefixes = useMemo(() => {
    const byKey = new Map(readyLines.map((line) => [toPalletPrefixKey(getPalletPrefixParts(line)), getPalletPrefixParts(line)]))
    return [...byKey.values()]
  }, [readyLines])

  const previewLines = useMemo(() => buildPalletPreview(readyLines, previewByKey), [readyLines, previewByKey])

  const totalCount = readyLines.reduce((sum, line) => sum + line.quantity, 0)

  const runError = form.formState.errors.lines?.root?.message ?? form.formState.errors.lines?.message
  const isGenerateDisabled = generateAction.isExecuting || totalCount === 0 || !form.formState.isValid

  const handleSubmit = async (formValues: PalletGenerateFormValues) => {
    try {
      const response = await generateAction.executeAsync(formValues)
      const result = response?.data

      if (!result || result.error) {
        toast.error(result?.message ?? 'Failed to generate pallets!')
        return
      }

      //* the real codes, the preview was an estimate
      const codes = result.data?.codes ?? []
      const range = codes.length > 1 ? `${codes[0]} to ${codes[codes.length - 1]}` : (codes[0] ?? '')

      toast.success(result.message, { description: range })
      router.refresh()
      router.push('/pallets')
    } catch (err: any) {
      logger.error(err, '[PALLET_GENERATE_FORM_HANDLE_SUBMIT_ERROR]:')
      toast.error('Something went wrong! Please try again later.')
    }
  }

  //* fetches the next number per prefix for the preview, debounced
  useEffect(() => {
    if (prefixes.length === 0) {
      setPreviewByKey({})
      setIsPreviewLoading(false)
      return
    }

    //* a newer edit drops the older reply
    let isStale = false

    setIsPreviewLoading(true)

    const timer = setTimeout(async () => {
      try {
        const response = await previewCodesAction.executeAsync({ prefixes })
        const previews = response?.data ?? []

        if (!isStale) {
          setPreviewByKey(
            Object.fromEntries(prefixes.map((parts, index) => [toPalletPrefixKey(parts), previews[index]]).filter(([, preview]) => preview))
          )
        }
      } catch (err: any) {
        logger.error(err, '[PALLET_GENERATE_PREVIEW_ERROR]:')
      } finally {
        if (!isStale) setIsPreviewLoading(false)
      }
    }, PREVIEW_LOOKUP_DELAY)

    return () => {
      isStale = true
      clearTimeout(timer)
    }
  }, [JSON.stringify(prefixes)])

  return (
    <FormProvider {...form}>
      {/* //! only the generate button submits */}
      <form className='flex h-full w-full flex-1 flex-col gap-5' onSubmit={(event) => event.preventDefault()}>
        <Header title={pageMetaData.title} description={pageMetaData.description}>
          <div className='ml-auto flex items-center gap-2'>
            <TooltipWrapper label='Back'>
              <Button type='button' variant='outline' onClick={() => router.push('/pallets')}>
                <Icons.arrowLeft /> Back
              </Button>
            </TooltipWrapper>

            <TooltipWrapper label='Generate'>
              <LoadingButton
                type='button'
                variant='default'
                isLoading={generateAction.isExecuting}
                disabled={isGenerateDisabled}
                onClick={form.handleSubmit(handleSubmit)}
              >
                <Icons.save /> Generate {totalCount > 0 ? totalCount : ''}
              </LoadingButton>
            </TooltipWrapper>
          </div>
        </Header>

        <ContentWrapper>
          <ScrollArea className='m-1 flex-1' type='auto'>
            <FieldGroup className='p-4'>
              <Row gap={5}>
                <Column>
                  <ReadOnlyFieldHeader title='Run' description='Applies to every line' />
                  <Separator className='mt-4' />
                </Column>

                <Column md={6} lg={3}>
                  <ComboboxField
                    control={form.control}
                    type='Basic'
                    name='locationCode'
                    label='Location'
                    data={locationOptions}
                    isLoading={locations.isLoading}
                    searchKeys={['value']}
                    renderItem={renderCodeItem}
                    description='Only locations that allow pallets'
                    isRequired
                  />
                </Column>

                <Column md={6} lg={3}>
                  <ReadOnlyField title='Status' value='Active' description='New pallets start as Active' />
                </Column>

                <Column>
                  <Separator className='mt-3 mb-4' />
                  <div className='flex items-center gap-2'>
                    <ReadOnlyFieldHeader title='Lines' description='Each line picks a project and how many pallets to make' />
                    <Button
                      type='button'
                      variant='outline-primary'
                      className='ml-auto'
                      onClick={() => lineFields.append({ ...BLANK_LINE })}
                    >
                      <Icons.plus /> Add Line
                    </Button>
                  </div>
                  {runError && <p className='text-destructive mt-2 text-sm'>{runError}</p>}
                </Column>

                {lineFields.fields.map((field, index) => (
                  <Column key={field.id}>
                    <PalletGenerateLine
                      index={index}
                      categoryOptions={categoryOptions}
                      projectOptions={projectOptions}
                      isOptionsLoading={projectCategories.isLoading || customerProjects.isLoading}
                      canRemove={lineFields.fields.length > 1}
                      onDuplicate={() => lineFields.insert(index + 1, structuredClone(form.getValues(`lines.${index}`)))}
                      onRemove={() => lineFields.remove(index)}
                    />
                  </Column>
                ))}

                <Column>
                  <Separator className='mt-3 mb-4' />
                  <ReadOnlyFieldHeader title='Preview' description='Every code this will create' />
                </Column>

                <Column>
                  <PalletGeneratePreview lines={previewLines} isLoading={isPreviewLoading} />
                </Column>
              </Row>
            </FieldGroup>
          </ScrollArea>
        </ContentWrapper>
      </form>
    </FormProvider>
  )
}
