'use server'

import { z } from 'zod'
import { Country, State } from 'country-state-city'

import { action, authenticationMiddleware } from '@/lib/safe-action'
import { FormOptions } from '@/types/common'

//! server only, the package ships several MB of city data
export async function getCountryOptions(): Promise<FormOptions[]> {
  return Country.getAllCountries()
    .map((country) => ({ value: country.isoCode, label: country.name }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

export async function getStateOptions(countryCode?: string | null): Promise<FormOptions[]> {
  if (!countryCode) return []

  return State.getStatesOfCountry(countryCode)
    .map((state) => ({ value: state.isoCode, label: state.name }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

export async function getCountryName(countryCode?: string | null) {
  if (!countryCode) return null
  return Country.getCountryByCode(countryCode)?.name ?? null
}

export async function getStateName(countryCode?: string | null, stateCode?: string | null) {
  if (!countryCode || !stateCode) return null
  return State.getStateByCodeAndCountry(stateCode, countryCode)?.name ?? null
}

export const getStateOptionsClient = action
  .use(authenticationMiddleware)
  .inputSchema(z.object({ countryCode: z.string().trim().min(1) }))
  .action(async ({ parsedInput }) => getStateOptions(parsedInput.countryCode))
