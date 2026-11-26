'use client'

import { useState } from 'react'
import { toast } from 'sonner'

import Modal from '@/components/modal'
import LoadingButton from '@/components/forms/button-field'
import BatchProgress from '@/components/batch-progress'
import BatchResult from '@/components/batch-result'
import { Icons } from '@/components/icons'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  FileUpload,
  FileUploadDropzone,
  FileUploadItem,
  FileUploadItemDelete,
  FileUploadItemMetadata,
  FileUploadItemPreview,
  FileUploadList,
  FileUploadTrigger
} from '@/components/ui/file-upload'
import { useBatchRun } from '@/hooks/use-batch-run'
import { useLastBatchResult } from '@/hooks/use-last-batch-result'
import { parseExcelFile } from '@/lib/xlsx'
import { logger } from '@/lib/logger'
import { IMPORT_BATCH_SIZE, IMPORT_GENERIC_ERROR_ENTRY } from '@/constants/import'
import { BatchStepResult } from '@/types/batch'
import { ImportRow } from '@/types/import'

type ImportModalProps = {
  isOpen: boolean
  userCode: number | null
  title: string
  description: string
  moduleName: string //* key for the saved last result
  entityName: string
  headers: readonly string[]
  templatePath: string
  batchSize?: number //* an all or nothing import sends the whole file in one batch
  importBatch: (rows: ImportRow[]) => Promise<BatchStepResult | undefined>
  onClose: () => void
  onImported: () => void
}

export default function ImportModal({
  isOpen,
  userCode,
  title,
  description,
  moduleName,
  entityName,
  headers,
  templatePath,
  batchSize = IMPORT_BATCH_SIZE,
  importBatch,
  onClose,
  onImported
}: ImportModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isHideLastImport, setIsHideLastImport] = useState(false)

  const { lastResult, save: saveLastResult, clear: clearLastResult } = useLastBatchResult(`import:${moduleName}`, userCode)
  const { stats, status, run, reset } = useBatchRun()

  const isProcessing = status === 'processing'

  //* the saved result shows when idle, until the user picks import another
  const savedResult = isHideLastImport ? null : lastResult
  const result = status === 'idle' ? savedResult?.stats : stats
  const isShowResult = status === 'completed' || (status === 'idle' && !!savedResult)

  const handleClose = () => {
    if (isProcessing) return

    setFile(null)
    setIsHideLastImport(false)
    reset()
    onClose()
  }

  const handleImport = async () => {
    if (!file) return

    try {
      const parsedData = await parseExcelFile({ file, header: [...headers], isRaw: false })

      //* blank rows are already skipped, __rowNum__ is the row's 0-based sheet position
      const rows: ImportRow[] = parsedData.map((data) => ({
        rowNumber: data.__rowNum__ + 1,
        values: Object.fromEntries(headers.map((header) => [header, String(data?.[header] ?? '').trim()]))
      }))

      if (rows.length === 0) {
        toast.error('The file has no rows to import')
        return
      }

      const steps = Math.ceil(rows.length / batchSize)
      const toBatch = (index: number) => rows.slice(index * batchSize, (index + 1) * batchSize)

      const finalStats = await run({
        total: rows.length,
        steps,
        stepSize: (index) => toBatch(index).length,
        runStep: async (index) => {
          const batchResult = await importBatch(toBatch(index))
          if (!batchResult) throw new Error(IMPORT_GENERIC_ERROR_ENTRY.message)
          return batchResult
        },
        failStep: (index, message) =>
          toBatch(index).map((row) => ({
            key: String(row.rowNumber),
            label: `Row ${row.rowNumber}`,
            entries: [{ ...IMPORT_GENERIC_ERROR_ENTRY, message }]
          }))
      })

      setFile(null)

      //* keep only a result with errors
      if (finalStats.errors.length > 0) saveLastResult({ finishedAt: new Date().toISOString(), stats: finalStats })
      else clearLastResult()

      if (finalStats.succeeded > 0) onImported()

      const message = `${finalStats.succeeded} of ${finalStats.total} ${entityName} imported`

      if (finalStats.errors.length > 0) toast.warning(message)
      else toast.success(message)
    } catch (err: any) {
      logger.error(err, '[IMPORT_ERROR]:')
      toast.error(err?.message || 'Failed to import file')
      reset()
    }
  }

  const handleClear = () => {
    clearLastResult()
    reset()
  }

  //* the saved result stays in storage, only the view moves on
  const handleImportAnother = () => {
    setIsHideLastImport(true)
    reset()
  }

  return (
    <Modal
      isOpen={isOpen}
      title={title}
      description={description}
      size='xl'
      isHideCloseButton={isProcessing}
      isCloseOnOutsideClick={!isProcessing}
      isCloseOnEscape={!isProcessing}
      onClose={handleClose}
    >
      <div className='flex min-w-0 flex-col gap-4'>
        {status === 'idle' && !savedResult && (
          <>
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <div className='text-muted-foreground text-sm'>
                Columns, in order: <span className='text-foreground font-medium'>{headers.join(', ')}</span>
              </div>

              {/* //* skip the top loader, a download never navigates */}
              <a
                href={templatePath}
                download
                onClick={(e) => e.stopPropagation()}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                <Icons.download /> Download template
              </a>
            </div>

            {/* //* one file at a time, a new pick replaces the current one */}
            <FileUpload
              className='w-full'
              value={file ? [file] : []}
              onValueChange={(next) => setFile(next.at(-1) ?? null)}
              accept='.xlsx'
              multiple={false}
            >
              <FileUploadDropzone>
                <div className='flex flex-col items-center gap-1 text-center'>
                  <div className='flex items-center justify-center rounded-full border p-2.5'>
                    <Icons.upload className='text-muted-foreground size-6' />
                  </div>
                  <p className='text-sm font-medium'>Drag & drop the .xlsx file here</p>
                  <p className='text-muted-foreground text-xs'>Or click to browse, one file only</p>
                </div>
                <FileUploadTrigger asChild>
                  <Button variant='outline' size='sm' className='mt-2 w-fit'>
                    Browse files
                  </Button>
                </FileUploadTrigger>
              </FileUploadDropzone>

              {file && (
                <FileUploadList>
                  <FileUploadItem value={file}>
                    <FileUploadItemPreview />
                    <FileUploadItemMetadata />
                    <FileUploadItemDelete asChild>
                      <Button variant='ghost' size='icon' className='size-7'>
                        <Icons.x />
                      </Button>
                    </FileUploadItemDelete>
                  </FileUploadItem>
                </FileUploadList>
              )}
            </FileUpload>

            <div className='flex justify-end'>
              <LoadingButton type='button' onClick={handleImport} disabled={!file}>
                <Icons.upload /> Import
              </LoadingButton>
            </div>
          </>
        )}

        {isProcessing && <BatchProgress stats={stats} succeededLabel='Imported' preparingLabel='Reading file…' />}

        {isShowResult && result && (
          <BatchResult
            stats={result}
            entityName={entityName}
            verb='imported'
            labelTitle='Row'
            finishedAt={status === 'idle' ? savedResult?.finishedAt : null}
            actions={
              <>
                {lastResult && (
                  <Button type='button' variant='outline' size='sm' onClick={handleClear}>
                    <Icons.trash /> Clear
                  </Button>
                )}

                <Button type='button' size='sm' onClick={handleImportAnother}>
                  <Icons.upload /> Import another
                </Button>
              </>
            }
          />
        )}
      </div>
    </Modal>
  )
}
