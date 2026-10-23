'use client'

import { formatBytes } from 'bytes-formatter'

import { Card } from '@/components/ui/card'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { TooltipWrapper } from '@/components/tooltip-wrapper'
import { WordsHighlighter } from '@/components/words-highlighter'
import RelativeDate from '@/components/relative-date'
import { buildFileAttachmentUrl, isImageMimeType } from '@/lib/file-attachment'
import { FileAttachmentWithInclude } from '@/actions/file-attachment'

type FileAttachmentCardProps = {
  fileAttachment: FileAttachmentWithInclude
  canDelete: boolean
  onDelete: () => void
  highlight?: string
}

export default function FileAttachmentCard({ fileAttachment, canDelete, onDelete, highlight }: FileAttachmentCardProps) {
  const { id, originalName, mimeType, size, uploadedAt, uploadedByUser } = fileAttachment

  const isImage = isImageMimeType(mimeType)

  return (
    <Card className='flex flex-col items-center gap-3 border p-3 text-center shadow-sm ring-0 transition-all hover:border-primary hover:ring-1 hover:ring-primary sm:flex-row sm:text-left'>
      <div className='bg-muted flex size-12 shrink-0 items-center justify-center overflow-hidden rounded'>
        {isImage ? (
          <img src={buildFileAttachmentUrl(id)} alt={originalName} className='size-full object-cover' />
        ) : (
          <Icons.fileText className='text-muted-foreground size-5' />
        )}
      </div>

      <div className='flex w-full min-w-0 flex-1 flex-col items-center gap-0.5 sm:items-start'>
        <p className='max-w-full truncate text-sm font-medium' title={originalName}>
          <WordsHighlighter value={originalName} highlight={highlight} />
        </p>

        <div className='text-muted-foreground flex max-w-full flex-col items-center gap-x-2 text-[13px] sm:flex-row sm:flex-wrap sm:items-center'>
          <span className='flex items-center gap-x-2'>
            <span>{formatBytes(size)}</span>
            <span className='hidden sm:inline'>·</span>
          </span>

          <span className='flex max-w-full items-center gap-x-2'>
            <span className='truncate'>
              {uploadedByUser?.name ? <WordsHighlighter value={uploadedByUser.name} highlight={highlight} /> : '—'}
            </span>
            <span>·</span>
            <RelativeDate value={uploadedAt} />
          </span>
        </div>
      </div>

      <div className='flex shrink-0 items-center gap-1'>
        <TooltipWrapper label='View'>
          <Button asChild type='button' variant='ghost' size='icon-sm'>
            <a href={buildFileAttachmentUrl(id)} target='_blank' rel='noreferrer'>
              <Icons.eye />
            </a>
          </Button>
        </TooltipWrapper>

        <TooltipWrapper label='Download'>
          <Button asChild type='button' variant='ghost' size='icon-sm'>
            <a href={buildFileAttachmentUrl(id, true)} target='_self'>
              <Icons.download />
            </a>
          </Button>
        </TooltipWrapper>

        {canDelete && (
          <TooltipWrapper label='Delete'>
            <Button type='button' variant='ghost' size='icon-sm' onClick={onDelete}>
              <Icons.trash className='text-destructive' />
            </Button>
          </TooltipWrapper>
        )}
      </div>
    </Card>
  )
}
