import { z } from 'zod'

import { type InboundStep } from '@/constants/inbound'
import { INBOUND_ITEM_IMPORT_MAX_ROWS } from '@/constants/import'
import { optionalNumeric, optionalString as optionalText } from '@/schema/common'
import { dataTableParamsSchema } from '@/schema/data-table'

export const inboundCodeSchema = z.object({
  inboundCode: z.string().min(1)
})

export type InboundCode = z.infer<typeof inboundCodeSchema>

//* the draft save, every field but the code is optional so a step can save half done
export const inboundFormSchema = z.object({
  code: z.string().min(1),
  locationCode: optionalText,
  customerProjectCode: optionalText,
  poNum: optionalText,
  isPartialReceived: z.boolean(),
  notes: optionalText
})

export type InboundForm = z.infer<typeof inboundFormSchema>

//* what the form holds before zod trims and nulls it
export type InboundFormInput = z.input<typeof inboundFormSchema>

//* one schema per step, next checks only the current one
export const inboundLocationStepSchema = z.object({
  locationCode: z.string().trim().min(1, 'Location is required')
})

export const inboundProjectStepSchema = z.object({
  customerProjectCode: z.string().trim().min(1, 'Customer project is required')
})

export const inboundPoStepSchema = z.object({
  poNum: z.string().trim().min(1, 'Purchase order is required'),
  isPartialReceived: z.boolean()
})

//* the lines live in their own table, so the step checks their count
export const inboundItemsStepSchema = z.object({
  itemCount: z.number().int().min(1, 'Add at least one package')
})

export const inboundReviewStepSchema = z.object({
  notes: optionalText
})

export const INBOUND_STEP_SCHEMAS = {
  location: inboundLocationStepSchema,
  project: inboundProjectStepSchema,
  po: inboundPoStepSchema,
  items: inboundItemsStepSchema,
  review: inboundReviewStepSchema
} as const satisfies Record<InboundStep, z.ZodType>

//* every step together, the po rule only when the category needs a po
export const inboundSubmitSchema = (isPoRequired: boolean) =>
  inboundLocationStepSchema
    .extend(inboundProjectStepSchema.shape)
    .extend(isPoRequired ? inboundPoStepSchema.shape : { poNum: optionalText, isPartialReceived: z.boolean() })
    .extend(inboundItemsStepSchema.shape)
    .extend(inboundReviewStepSchema.shape)

//* the auto save, a project or po change that drops packages comes back once to be confirmed
export const saveInboundDraftSchema = inboundFormSchema.extend({
  isClearItems: z.boolean().optional()
})

export type SaveInboundDraft = z.input<typeof saveInboundDraftSchema>

//* a blank cost takes the po line price with the same p/n
export const inboundItemFormSchema = z.object({
  inboundCode: z.string().min(1),
  lineNum: z.number().int().nullish(), //* null on create
  owner: optionalText,
  mpn: z.string().trim().min(1, 'MFG P/N is required'),
  partNumber: optionalText,
  commodityCode: optionalText,
  dateCode: optionalText,
  countryOfOrigin: optionalText,
  lotCode: optionalText,
  packagingTypeCode: optionalText,
  spq: optionalText,
  cost: optionalNumeric(false),
  totalStock: z.coerce.number<number>({ message: 'Received qty is required' }).positive('Received qty must be more than 0'),
  isMandatoryQc: z.boolean(),
  notes: optionalText
})

export type InboundItemForm = z.infer<typeof inboundItemFormSchema>

export type InboundItemFormInput = z.input<typeof inboundItemFormSchema>

export const inboundItemKeySchema = z.object({
  inboundCode: z.string().min(1),
  lineNum: z.number().int()
})

export const inboundItemImportSchema = z.object({
  inboundCode: z.string().min(1),
  rows: z
    .array(z.object({ rowNumber: z.number().int().positive(), values: z.record(z.string(), z.string()) }))
    .min(1)
    .max(INBOUND_ITEM_IMPORT_MAX_ROWS)
})

export type InboundItemImport = z.infer<typeof inboundItemImportSchema>

export const purchaseOrderQuerySchema = z.object({
  poNum: z.string().trim().min(1)
})

export const itemMasterByMpnSchema = z.object({
  mpn: z.string().trim().min(1)
})

//* the mfg p/n picker, flags the parts on the inbound's po
export const inboundItemMasterTableParamsSchema = dataTableParamsSchema.extend({
  inboundCode: z.string().min(1)
})

export type InboundItemMasterTableParams = z.infer<typeof inboundItemMasterTableParamsSchema>

export const createInboundDraftSchema = z.object({
  sessionCode: z.string().min(1)
})
