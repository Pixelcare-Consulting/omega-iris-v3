'use client'

import { FormProvider, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import Modal from '@/components/modal'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import LoadingButton from '@/components/forms/button-field'
import { ComboboxField } from '@/components/forms/combobox-field'
import { Badge } from '@/components/ui/badge'
import { DEFAULT_LABEL_SIZE, LABEL_PDF_URL_TTL_MINUTES, LABEL_SIZE_KEYS, LABEL_SIZE_OPTIONS, LabelSize } from '@/constants/label'
import { FormOptions } from '@/types/common'

const labelSizeFormSchema = z.object({ size: z.enum(LABEL_SIZE_KEYS, { message: 'Label Size is required' }) })

type LabelSizeForm = z.infer<typeof labelSizeFormSchema>

//* the size, plus a badge on the default one
function renderLabelSizeItem(item: FormOptions) {
  return (
    <>
      <span className='truncate'>{item.label}</span>
      {item.defaultLabel && (
        <Badge variant='soft-sky' className='ml-auto'>
          {item.defaultLabel}
        </Badge>
      )}
    </>
  )
}

type LabelSizeModalProps = {
  isOpen: boolean
  title: string
  description?: string
  isLoading?: boolean
  //* bulk opens a temporary blob tab, so it gets the reload note
  isBulk?: boolean
  onClose: () => void
  onView: (size: LabelSize) => void
  onDownload: (size: LabelSize) => void
}

//* picks a label size, then views or downloads the pdf
export default function LabelSizeModal({
  isOpen,
  title,
  description,
  isLoading,
  isBulk,
  onClose,
  onView,
  onDownload
}: LabelSizeModalProps) {
  const form = useForm<LabelSizeForm>({
    mode: 'onChange',
    values: { size: DEFAULT_LABEL_SIZE },
    resolver: zodResolver(labelSizeFormSchema)
  })

  const handleView = form.handleSubmit(({ size }) => onView(size))
  const handleDownload = form.handleSubmit(({ size }) => onDownload(size))

  return (
    <Modal
      isOpen={isOpen}
      title={title}
      description={description}
      size='sm'
      isModal={false}
      onClose={onClose}
      footer={
        <>
          <Button type='button' variant='outline' onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <LoadingButton type='button' variant='outline-primary' isLoading={isLoading} onClick={handleDownload}>
            <Icons.download /> Download
          </LoadingButton>
          <LoadingButton type='button' isLoading={isLoading} onClick={handleView}>
            <Icons.eye /> View
          </LoadingButton>
        </>
      }
    >
      <FormProvider {...form}>
        <form onSubmit={handleView}>
          <ComboboxField
            control={form.control}
            type='Basic'
            name='size'
            label='Label Size'
            data={LABEL_SIZE_OPTIONS}
            searchKeys={['defaultLabel']}
            renderItem={renderLabelSizeItem}
            description='One label per page, pick the size of your label roll'
            isRequired
          />
        </form>

        {isBulk && (
          <p className='text-muted-foreground mt-3 flex gap-2 text-xs'>
            <Icons.info className='mt-0.5 size-3.5 shrink-0' />
            The PDF opens in a temporary tab that can be reloaded for {LABEL_PDF_URL_TTL_MINUTES} minutes. After that, print again from the
            list.
          </p>
        )}
      </FormProvider>
    </Modal>
  )
}
