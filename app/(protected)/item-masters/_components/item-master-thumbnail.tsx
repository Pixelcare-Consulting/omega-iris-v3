'use client'

import { useState } from 'react'

import { buildFileAttachmentUrl } from '@/lib/file-attachment'
import { cn } from '@/lib/utils'
import { ITEM_MASTER_PLACEHOLDER_IMAGE } from '@/constants/item-master'

type ItemMasterThumbnailProps = {
  id?: string | null
  alt?: string
  className?: string
}

export default function ItemMasterThumbnail({ id, alt = 'Thumbnail', className }: ItemMasterThumbnailProps) {
  //* remembers which id broke, so a new id gets a fresh try
  const [brokenId, setBrokenId] = useState<string | null>(null)

  const src = id && brokenId !== id ? buildFileAttachmentUrl(id) : ITEM_MASTER_PLACEHOLDER_IMAGE

  return (
    <img
      src={src}
      alt={alt}
      loading='lazy'
      className={cn('bg-muted size-12 shrink-0 rounded-md border object-cover', className)}
      onError={() => id && setBrokenId(id)}
    />
  )
}
