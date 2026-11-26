import { notFound } from 'next/navigation'

import { getCurrentUserWithAbility } from '@/actions/user'
import { getInboundForView } from '@/actions/inbound'
import { getCurrentDbCode } from '@/lib/sap/access'
import { authorizePage } from '@/lib/authorization'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import ContentContainer from '@/app/(protected)/_components/content-container'
import ViewInbound from './_components/view-inbound'

export default async function InboundViewPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  const dbCode = await getCurrentDbCode()

  const currentUserWithAbility = await getCurrentUserWithAbility()
  const ability = currentUserWithAbility?.ability

  //* check authorization for view
  authorizePage(ability, PERMISSIONS_ALLOWED_ACTIONS.VIEW, PERMISSIONS_CODES.INBOUNDS)

  //* someone else's inbound reads as not found without view all
  const inbound = await getInboundForView(dbCode, decodeURIComponent(code), {
    userCode: currentUserWithAbility?.userCode ?? 0,
    canViewAll: !!ability?.can(PERMISSIONS_ALLOWED_ACTIONS.VIEW_ALL, PERMISSIONS_CODES.INBOUNDS)
  })

  if (!inbound) notFound()

  return (
    <ContentContainer>
      <ViewInbound inbound={inbound} />
    </ContentContainer>
  )
}
