import { z } from 'zod'

import { optionalString } from './common'
import {
  LOCATION_BAY_OPTIONS,
  LOCATION_GENERATE_MAX_LINES,
  LOCATION_GENERATE_MAX_ROWS,
  LOCATION_LEVEL_OPTIONS,
  LOCATION_RACK_OPTIONS,
  LOCATION_TYPES
} from '@/constants/location'
import { expandLocationRun } from '@/lib/location'

//* optional for now, a cleared picker sends ''
const locationTypeSchema = z.preprocess((value) => value || null, z.enum(LOCATION_TYPES, { message: 'Pick a valid type' }).nullable())

const pickedValues = (options: string[], message: string) =>
  z.array(z.string()).refine((values) => values.every((value) => options.includes(value)), { message })

export const locationFormSchema = z.object({
  id: optionalString,
  code: optionalString, //* display only, the server builds it
  type: locationTypeSchema,
  siteCode: z.string().trim().min(1, { message: 'Site is required' }),
  processZoneCode: z.string().trim().min(1, { message: 'Process zone is required' }),
  bayCode: z
    .string()
    .min(1, { message: 'Bay is required' })
    .refine((value) => LOCATION_BAY_OPTIONS.includes(value), { message: 'Pick a valid bay' }),
  levelCode: optionalString.refine((value) => !value || LOCATION_LEVEL_OPTIONS.includes(value), { message: 'Pick a valid level' }),
  rackCode: optionalString.refine((value) => !value || LOCATION_RACK_OPTIONS.includes(value), { message: 'Pick a valid rack' }),
  name: optionalString,
  isActive: z.boolean(),
  isPalletAllowed: z.boolean()
})

export type LocationForm = z.infer<typeof locationFormSchema>

//* levels and racks are optional, empty means none
export const locationGenerateLineSchema = z.object({
  type: locationTypeSchema,
  processZoneCode: z.string().trim().min(1, { message: 'Process zone is required' }),
  bayCodes: pickedValues(LOCATION_BAY_OPTIONS, 'Pick a valid bay').refine((values) => values.length > 0, {
    message: 'Pick at least one bay'
  }),
  levelCodes: pickedValues(LOCATION_LEVEL_OPTIONS, 'Pick a valid level'),
  rackCodes: pickedValues(LOCATION_RACK_OPTIONS, 'Pick a valid rack'),
  isPalletAllowed: z.boolean()
})

export type LocationGenerateLine = z.infer<typeof locationGenerateLineSchema>

export const locationGenerateFormSchema = z
  .object({
    siteCode: z.string().trim().min(1, { message: 'Site is required' }),
    //* caps keep a crafted request from blowing up the expand
    lines: z
      .array(locationGenerateLineSchema)
      .min(1, { message: 'Add at least one line' })
      .max(LOCATION_GENERATE_MAX_LINES, { message: `A run can have at most ${LOCATION_GENERATE_MAX_LINES} lines` }),
    excludedCodes: z.array(z.string()).max(LOCATION_GENERATE_MAX_ROWS)
  })
  .superRefine((data, ctx) => {
    if (expandLocationRun(data.siteCode, data.lines).length > LOCATION_GENERATE_MAX_ROWS) {
      ctx.addIssue({ code: 'custom', path: ['lines'], message: `A run can make at most ${LOCATION_GENERATE_MAX_ROWS} locations` })
    }
  })

export type LocationGenerateForm = z.infer<typeof locationGenerateFormSchema>

export const existingLocationCodesSchema = z.object({
  codes: z.array(z.string()).max(LOCATION_GENERATE_MAX_ROWS)
})
