import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { ReadonlyURLSearchParams } from 'next/navigation'

export const handleTabChange = (router: AppRouterInstance, searchParams: ReadonlyURLSearchParams, value: string) => {
  const params = new URLSearchParams(searchParams.toString())
  params.set('tab', value)
  router.replace(`?${params.toString()}`, { scroll: false })
}
