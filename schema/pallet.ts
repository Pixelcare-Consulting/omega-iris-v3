import { z } from 'zod'

import { optionalString } from './common'
import { PALLET_GENERATE_MAX_LINES, PALLET_GENERATE_MAX_ROWS } from '@/constants/pallet'
import { STORAGE_UNIT_STATUSES } from '@/constants/storage-unit'

const palletProjectShape = {
  isGeneralPurpose: z.boolean(),
  projectCategoryCode: optionalString,
  customerProjectCode: optionalString
}

type PalletProjectValues = { isGeneralPurpose: boolean; projectCategoryCode?: string | null; customerProjectCode?: string | null }

//* both are required unless general purpose
const refinePalletProject = (data: PalletProjectValues, ctx: z.RefinementCtx) => {
  if (data.isGeneralPurpose) return

  if (!data.projectCategoryCode) ctx.addIssue({ code: 'custom', path: ['projectCategoryCode'], message: 'Project category is required' })
  if (!data.customerProjectCode) ctx.addIssue({ code: 'custom', path: ['customerProjectCode'], message: 'Customer project is required' })
}

export const palletFormSchema = z
  .object({
    id: optionalString,
    code: optionalString, //* display only, the server assigns it
    locationCode: z.string().trim().min(1, { message: 'Location is required' }),
    status: z.enum(STORAGE_UNIT_STATUSES, { message: 'Pick a valid status' }),
    ...palletProjectShape
  })
  .superRefine(refinePalletProject)

export type PalletForm = z.infer<typeof palletFormSchema>

export const palletGenerateLineSchema = z
  .object({
    ...palletProjectShape,
    quantity: z.coerce.number<number>().int({ message: 'Whole numbers only' }).min(1, { message: 'At least 1' })
  })
  .superRefine(refinePalletProject)

export type PalletGenerateLine = z.infer<typeof palletGenerateLineSchema>

export const palletGenerateFormSchema = z
  .object({
    locationCode: z.string().trim().min(1, { message: 'Location is required' }),
    //* caps keep a crafted request from making too many
    lines: z
      .array(palletGenerateLineSchema)
      .min(1, { message: 'Add at least one line' })
      .max(PALLET_GENERATE_MAX_LINES, { message: `A run can have at most ${PALLET_GENERATE_MAX_LINES} lines` })
  })
  .superRefine((data, ctx) => {
    const total = data.lines.reduce((sum, line) => sum + line.quantity, 0)

    if (total > PALLET_GENERATE_MAX_ROWS) {
      ctx.addIssue({ code: 'custom', path: ['lines'], message: `A run can make at most ${PALLET_GENERATE_MAX_ROWS} pallets` })
    }
  })

export type PalletGenerateForm = z.infer<typeof palletGenerateFormSchema>

//* [] is general purpose, otherwise [category, project], kept apart since codes can hold '-'
export const palletPrefixesSchema = z.object({ prefixes: z.array(z.array(z.string()).max(2)).max(PALLET_GENERATE_MAX_LINES) })
