import { useEffect } from 'react'
import { useAction } from 'next-safe-action/hooks'

import { BusinessPartnerTableLookups, BusinessPartnerTableParams } from '@/schema/business-partner'
import { SafeActionHook } from '@/types/safe-action'
import {
  getBusinessPartnerAddressesClient,
  getBusinessPartnerContactsClient,
  getBusinessPartnerLookupsClient,
  getDataTableBusinessPartnersSvrClient,
  getStatesByCountryClient
} from '@/actions/business-partner'

export function useBusinessPartnerLookups(dependencies?: any[]) {
  const { execute, executeAsync, isExecuting: isLoading, result } = useAction(getBusinessPartnerLookupsClient)

  useEffect(() => {
    execute()
  }, [...(dependencies || [])])

  return {
    execute,
    executeAsync,
    isLoading,
    isLoaded: !!result.data,
    data: result.data ?? { groups: [], currencies: [], salesPersons: [], countries: [] },
    error: { serverError: result.serverError, validationError: result.validationErrors }
  }
}

export function useStatesByCountry(country?: string | null, dependencies?: any[]) {
  const { execute, executeAsync, isExecuting: isLoading, result } = useAction(getStatesByCountryClient)

  useEffect(() => {
    execute({ country })
  }, [country, ...(dependencies || [])])

  return {
    execute,
    executeAsync,
    isLoading,
    data: result.data ?? [],
    error: { serverError: result.serverError, validationError: result.validationErrors }
  }
}

//* shows loading until the page's lookups arrive, every request then reuses them
export function useDataTableBusinessPartnersSvr(
  params: Omit<BusinessPartnerTableParams, 'lookups'> & { lookups?: BusinessPartnerTableLookups },
  hook: SafeActionHook,
  dependencies?: any[]
) {
  const { execute, executeAsync, isExecuting, result } = useAction(getDataTableBusinessPartnersSvrClient)

  const hasLookups = !!params.lookups
  const isLoading = isExecuting || !hasLookups

  const filtersKey = JSON.stringify([params.globalFilter, params.columnFilters])

  //* back to page 1 when a filter changes, a narrower result may not reach the current page
  useEffect(() => {
    hook.setPageIndex?.(0)
  }, [filtersKey])

  useEffect(() => {
    if (!params.lookups) return
    execute({ ...params, lookups: params.lookups })
  }, [
    hasLookups,
    params.page,
    params.perPage,
    params?.globalFilter,
    JSON.stringify(params?.sorting),
    JSON.stringify(params?.columnFilters),
    ...(dependencies || [])
  ])

  //* set data and row count when data is available
  useEffect(() => {
    const { data } = result
    hook.setData(data?.data ?? [])
    hook.setRowCount(data?.rowCount ?? 0)
  }, [JSON.stringify(result?.data)])

  return {
    execute,
    executeAsync,
    isLoading,
    data: result?.data ?? { data: [], rowCount: 0, error: null },
    error: { serverError: result.serverError, validationError: result.validationErrors }
  }
}

export function useBusinessPartnerAddresses(code: string, dependencies?: any[]) {
  const { execute, executeAsync, isExecuting: isLoading, result } = useAction(getBusinessPartnerAddressesClient)

  useEffect(() => {
    execute({ code })
  }, [code, ...(dependencies || [])])

  return {
    execute,
    executeAsync,
    isLoading,
    data: result.data ?? { addresses: [], error: null },
    error: { serverError: result.serverError, validationError: result.validationErrors }
  }
}

export function useBusinessPartnerContacts(code: string, dependencies?: any[]) {
  const { execute, executeAsync, isExecuting: isLoading, result } = useAction(getBusinessPartnerContactsClient)

  useEffect(() => {
    execute({ code })
  }, [code, ...(dependencies || [])])

  return {
    execute,
    executeAsync,
    isLoading,
    data: result.data ?? { contacts: [], error: null },
    error: { serverError: result.serverError, validationError: result.validationErrors }
  }
}
