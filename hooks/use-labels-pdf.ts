'use client'

import { useState } from 'react'
import axios from 'axios'
import { toast } from 'sonner'

import { logger } from '@/lib/logger'
import { LABEL_MAX_COUNT, LABEL_PDF_URL_TTL_MINUTES, LabelSize } from '@/constants/label'
import type { LabelsPdf } from '@/schema/label'

const OBJECT_URL_TTL_MS = LABEL_PDF_URL_TTL_MINUTES * 60_000
const FALLBACK_FILE_NAME = 'LABELS.pdf'
const GENERIC_ERROR_MESSAGE = 'Something went wrong! Please try again later.'

//* filename*=UTF-8''<encoded> from the route
const getFileName = (disposition?: string) => {
  const match = disposition?.match(/filename\*=UTF-8''([^;]+)/)
  return match ? decodeURIComponent(match[1]) : FALLBACK_FILE_NAME
}

//* the error body comes back as a blob too, read its json message
const getErrorMessage = async (err: unknown) => {
  if (!axios.isAxiosError(err) || !(err.response?.data instanceof Blob)) return null

  try {
    return JSON.parse(await err.response.data.text())?.message ?? null
  } catch {
    return null
  }
}

//* posts the ticked ids to a module's labels route, too many for a url, then shows or saves the pdf
export function useLabelsPdf(endpoint: string) {
  const [isLoading, setIsLoading] = useState(false)

  const open = async (ids: string[], size: LabelSize, isDownload: boolean) => {
    if (ids.length > LABEL_MAX_COUNT) {
      toast.error(`You can print up to ${LABEL_MAX_COUNT.toLocaleString('en-US')} labels at a time!`)
      return false
    }

    //! open the tab before the await, or the popup blocker stops it
    const tab = isDownload ? null : window.open('', '_blank')

    setIsLoading(true)

    try {
      const body: LabelsPdf = { ids, size, isDownload }

      const response = await axios.post<Blob>(endpoint, body, { responseType: 'blob' })

      const url = URL.createObjectURL(response.data)

      if (tab) {
        tab.location.href = url
      } else {
        const link = document.createElement('a')
        link.href = url
        link.download = getFileName(response.headers['content-disposition'])
        link.click()
      }

      setTimeout(() => URL.revokeObjectURL(url), OBJECT_URL_TTL_MS)

      return true
    } catch (err: any) {
      tab?.close()

      const message = await getErrorMessage(err)

      if (!message) logger.error(err, '[LABELS_PDF_ERROR]:')

      toast.error(message ?? GENERIC_ERROR_MESSAGE)
      return false
    } finally {
      setIsLoading(false)
    }
  }

  return { open, isLoading }
}
