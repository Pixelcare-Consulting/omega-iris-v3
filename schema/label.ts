import { z } from 'zod'

import { DEFAULT_LABEL_SIZE, LABEL_MAX_COUNT, LABEL_SIZE_KEYS } from '@/constants/label'

//* unknown size falls back to the default
export const labelSizeSchema = z.enum(LABEL_SIZE_KEYS).catch(DEFAULT_LABEL_SIZE)

//* any module's bulk label pdf, ids of the rows to print
export const labelsPdfSchema = z.object({
  ids: z
    .array(z.string().min(1))
    .min(1, { message: 'Select at least one row!' })
    .max(LABEL_MAX_COUNT, { message: `You can print up to ${LABEL_MAX_COUNT.toLocaleString('en-US')} labels at a time!` }),
  size: labelSizeSchema,
  isDownload: z.boolean().default(false)
})

export type LabelsPdf = z.infer<typeof labelsPdfSchema>
