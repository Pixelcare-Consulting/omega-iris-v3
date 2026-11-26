import { notFound } from 'next/navigation'

import { getCurrentUserWithAbility } from '@/actions/user'
import { getSessionByCode } from '@/actions/session'
import { getInboundsBySession } from '@/actions/inbound'
import { getCurrentDbCode } from '@/lib/sap/access'
import { decodeCodeParam } from '@/lib/sap/utils'
import { authorizePage } from '@/lib/authorization'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import ContentContainer from '@/app/(protected)/_components/content-container'
import ViewSession from './_components/view-session'

export default async function SessionViewPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  const dbCode = await getCurrentDbCode()

  const sessionCode = decodeCodeParam(code).toUpperCase()

  const [session, inbounds, currentUserWithAbility] = await Promise.all([
    getSessionByCode(dbCode, sessionCode),
    getInboundsBySession(dbCode, sessionCode),
    getCurrentUserWithAbility()
  ])

  //* check authorization for view
  authorizePage(currentUserWithAbility?.ability, PERMISSIONS_ALLOWED_ACTIONS.VIEW, PERMISSIONS_CODES.SESSIONS)

  if (!session) notFound()

  return (
    <ContentContainer>
      <ViewSession session={session} inbounds={inbounds} />
    </ContentContainer>
  )
}
