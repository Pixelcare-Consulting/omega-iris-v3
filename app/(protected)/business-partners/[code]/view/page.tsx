import { notFound } from 'next/navigation'

import { getCurrentUserWithAbility } from '@/actions/user'
import { getBusinessPartnerByCode, getBusinessPartnerLookups } from '@/actions/business-partner'
import { getCurrentDbCode } from '@/lib/sap/access'
import { decodeCodeParam } from '@/lib/sap/utils'
import ContentContainer from '@/app/(protected)/_components/content-container'
import ViewBusinessPartner from './_components/view-business-partner'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { authorizePage } from '@/lib/authorization'

export default async function BusinessPartnerViewPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  const dbCode = await getCurrentDbCode()

  const [result, lookups, currentUserWithAbility] = await Promise.all([
    getBusinessPartnerByCode(dbCode, decodeCodeParam(code)),
    dbCode ? getBusinessPartnerLookups(dbCode) : null,
    getCurrentUserWithAbility()
  ])

  //* check authorization for view
  authorizePage(currentUserWithAbility?.ability, PERMISSIONS_ALLOWED_ACTIONS.VIEW, PERMISSIONS_CODES.BUSINESS_PARTNERS)

  if (!result || (!result.ok && result.status === 404)) notFound()

  //* any other sap failure goes to the error page
  if (!result.ok) throw new Error(result.message)

  return (
    <ContentContainer>
      <ViewBusinessPartner businessPartner={result.data} lookups={lookups} />
    </ContentContainer>
  )
}
