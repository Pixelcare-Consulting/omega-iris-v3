import { z } from 'zod'

import { optionalNumeric, optionalString } from '@/schema/common'

//* the details save to the unit's inbound item, placement stays with the movement modules
export const packagingUnitFormSchema = z.object({
  code: z.string().min(1),
  owner: optionalString,
  partNumber: optionalString,
  commodityCode: optionalString,
  dateCode: optionalString,
  countryOfOrigin: optionalString,
  lotCode: optionalString,
  packagingTypeCode: optionalString,
  spq: optionalString,
  cost: optionalNumeric(false).refine((value) => value === null || value >= 0, 'Cost cannot be negative'),
  isMandatoryQc: z.boolean(),
  notes: optionalString
})

export type PackagingUnitForm = z.infer<typeof packagingUnitFormSchema>

export type PackagingUnitFormInput = z.input<typeof packagingUnitFormSchema>
