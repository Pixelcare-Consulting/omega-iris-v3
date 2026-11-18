'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useAction } from 'next-safe-action/hooks'
import { FormProvider, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { generateLocations, getExistingLocationCodesClient } from '@/actions/location'
import { PageMetadata } from '@/types/common'
import {
  LocationGenerateForm as LocationGenerateFormValues,
  LocationGenerateLine as LineValues,
  locationGenerateFormSchema
} from '@/schema/location'
import Header from '@/components/header'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { TooltipWrapper } from '@/components/tooltip-wrapper'
import { FieldGroup } from '@/components/ui/field'
import { Row } from '@/components/row'
import { Column } from '@/components/column'
import ReadOnlyFieldHeader from '@/components/read-only-field-header'
import ContentWrapper from '@/components/content-wrapper'
import LoadingButton from '@/components/forms/button-field'
import ReadOnlyField from '@/components/read-only-field'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { logger } from '@/lib/logger'
import { ComboboxField } from '@/components/forms/combobox-field'
import { renderCodeItem } from '@/components/forms/combobox-item-content'
import { toFormOptions } from '@/lib/form'
import { useSites } from '@/hooks/safe-actions/site'
import { useProcessZones } from '@/hooks/safe-actions/process-zone'
import { expandLocationRun } from '@/lib/location'
import { LOCATION_GENERATE_MAX_ROWS } from '@/constants/location'
import LocationGenerateLine from './location-generate-line'
import LocationGeneratePreview, { getPreviewStatus } from './location-generate-preview'

const BLANK_LINE: LineValues = {
  type: null,
  processZoneCode: '',
  bayCodes: [],
  levelCodes: [],
  rackCodes: [],
  isPalletAllowed: false
}

const DEFAULT_VALUES: LocationGenerateFormValues = { siteCode: '', lines: [BLANK_LINE], excludedCodes: [] }

//* wait for picking to settle before asking the server
const EXISTING_LOOKUP_DELAY = 400

export default function LocationGenerateForm({ pageMetaData }: { pageMetaData: PageMetadata }) {
  const router = useRouter()

  const [existing, setExisting] = useState<Map<string, Date | null>>(new Map())
  const [isChecking, setIsChecking] = useState(false)

  const form = useForm({
    mode: 'onChange',
    defaultValues: DEFAULT_VALUES,
    resolver: zodResolver(locationGenerateFormSchema)
  })

  //* watched apart, so an untick doesn't rebuild the run
  const [siteCode, lines] = useWatch({ control: form.control, name: ['siteCode', 'lines'] })
  const excludedCodes = useWatch({ control: form.control, name: 'excludedCodes' })

  const lineFields = useFieldArray({ control: form.control, name: 'lines' })

  const sites = useSites()
  const processZones = useProcessZones()
  const generateAction = useAction(generateLocations)
  const existingCodesAction = useAction(getExistingLocationCodesClient)

  const siteOptions = useMemo(() => toFormOptions(sites.data), [sites.data])
  const zoneOptions = useMemo(() => toFormOptions(processZones.data), [processZones.data])

  //* nothing to preview until the parts are picked
  const rows = useMemo(() => {
    if (!siteCode) return []
    const readyLines = (lines ?? []).filter((line) => line?.processZoneCode && line.bayCodes?.length > 0)
    return expandLocationRun(siteCode, readyLines as LineValues[])
  }, [siteCode, lines])

  const lookupKey = useMemo(() => rows.filter((row) => !row.isRepeated).map((row) => row.code), [rows])

  const toCreateCount = useMemo(() => {
    const excluded = new Set(excludedCodes ?? [])
    return rows.filter((row) => getPreviewStatus(row, existing, excluded) === 'CREATE').length
  }, [rows, existing, excludedCodes])

  const runError = form.formState.errors.lines?.root?.message ?? form.formState.errors.lines?.message
  const isGenerateDisabled = generateAction.isExecuting || isChecking || toCreateCount === 0 || !form.formState.isValid

  const handleSubmit = async (formValues: LocationGenerateFormValues) => {
    try {
      const response = await generateAction.executeAsync(formValues)
      const result = response?.data

      if (!result || result.error) {
        toast.error(result?.message ?? 'Failed to generate locations!')
        return
      }

      toast.success(result.message)
      router.refresh()
      router.push('/locations')
    } catch (err: any) {
      logger.error(err, '[LOCATION_GENERATE_FORM_HANDLE_SUBMIT_ERROR]:')
      toast.error('Something went wrong! Please try again later.')
    }
  }

  //* checks which codes already exist, debounced
  useEffect(() => {
    if (lookupKey.length === 0 || lookupKey.length > LOCATION_GENERATE_MAX_ROWS) {
      setExisting(new Map())
      setIsChecking(false)
      return
    }

    //* a newer pick drops the older reply
    let isStale = false

    setIsChecking(true)

    const timer = setTimeout(async () => {
      try {
        const response = await existingCodesAction.executeAsync({ codes: lookupKey })
        if (!isStale) setExisting(new Map((response?.data ?? []).map((row) => [row.code, row.deletedAt])))
      } catch (err: any) {
        logger.error(err, '[LOCATION_GENERATE_EXISTING_CODES_ERROR]:')
      } finally {
        if (!isStale) setIsChecking(false)
      }
    }, EXISTING_LOOKUP_DELAY)

    return () => {
      isStale = true
      clearTimeout(timer)
    }
  }, [JSON.stringify(lookupKey)])

  //* drop unticks for codes no longer in the run
  useEffect(() => {
    const codes = new Set(rows.map((row) => row.code))
    const kept = (excludedCodes ?? []).filter((code) => codes.has(code))
    if (kept.length !== (excludedCodes ?? []).length) form.setValue('excludedCodes', kept)
  }, [rows, excludedCodes, form])

  return (
    <FormProvider {...form}>
      {/* //! only the generate button submits, the preview table has its own buttons and search */}
      <form className='flex h-full w-full flex-1 flex-col gap-5' onSubmit={(event) => event.preventDefault()}>
        <Header title={pageMetaData.title} description={pageMetaData.description}>
          <div className='ml-auto flex items-center gap-2'>
            <TooltipWrapper label='Back'>
              <Button type='button' variant='outline' onClick={() => router.push('/locations')}>
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
                <Icons.save /> Generate {toCreateCount > 0 ? toCreateCount : ''}
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
                    name='siteCode'
                    label='Site'
                    data={siteOptions}
                    isLoading={sites.isLoading}
                    searchKeys={['value']}
                    renderItem={renderCodeItem}
                    isRequired
                  />
                </Column>

                <Column md={6} lg={3}>
                  <ReadOnlyField title='Active' value='Yes' description='New locations start as Active, change it later on the edit form' />
                </Column>

                <Column>
                  <Separator className='mt-3 mb-4' />
                  <div className='flex items-center gap-2'>
                    <ReadOnlyFieldHeader
                      title='Lines'
                      description='Each line is one process zone with the bays, levels and racks you pick'
                    />
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
                    <LocationGenerateLine
                      index={index}
                      zoneOptions={zoneOptions}
                      isZonesLoading={processZones.isLoading}
                      canRemove={lineFields.fields.length > 1}
                      onDuplicate={() => lineFields.insert(index + 1, structuredClone(form.getValues(`lines.${index}`)))}
                      onRemove={() => lineFields.remove(index)}
                    />
                  </Column>
                ))}

                <Column>
                  <Separator className='mt-3 mb-4' />
                  <ReadOnlyFieldHeader title='Preview' description="Untick any code you don't want to create" />
                </Column>

                <Column>
                  <LocationGeneratePreview
                    rows={rows}
                    existing={existing}
                    excludedCodes={excludedCodes ?? []}
                    isChecking={isChecking}
                    onExcludedChange={(codes) => form.setValue('excludedCodes', codes)}
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
