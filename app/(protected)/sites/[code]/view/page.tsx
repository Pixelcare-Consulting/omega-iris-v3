import { notFound } from 'next/navigation'

import { getCurrentUserWithAbility } from '@/actions/user'
import { getSiteByCode } from '@/actions/site'
import { getCurrentDbCode } from '@/lib/sap/access'
import { decodeCodeParam } from '@/lib/sap/utils'
import ContentContainer from '@/app/(protected)/_components/content-container'
import ViewSite from './_components/view-site'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { authorizePage } from '@/lib/authorization'

export default async function SiteViewPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  const dbCode = await getCurrentDbCode()

  const [site, currentUserWithAbility] = await Promise.all([
    getSiteByCode(dbCode, decodeCodeParam(code).toUpperCase()),
    getCurrentUserWithAbility()
  ])

  //* check authorization for view
  authorizePage(currentUserWithAbility?.ability, PERMISSIONS_ALLOWED_ACTIONS.VIEW, PERMISSIONS_CODES.SITES)

  if (!site) notFound()

  return (
    <ContentContainer>
      <ViewSite site={site} />
    </ContentContainer>
  )
}
