import { notFound } from 'next/navigation'

import { getCurrentUserWithAbility } from '@/actions/user'
import { getProcessZoneByCode } from '@/actions/process-zone'
import { getCurrentDbCode } from '@/lib/sap/access'
import { decodeCodeParam } from '@/lib/sap/utils'
import ContentContainer from '@/app/(protected)/_components/content-container'
import ViewProcessZone from './_components/view-process-zone'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { authorizePage } from '@/lib/authorization'

export default async function ProcessZoneViewPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  const dbCode = await getCurrentDbCode()

  const [processZone, currentUserWithAbility] = await Promise.all([
    getProcessZoneByCode(dbCode, decodeCodeParam(code).toUpperCase()),
    getCurrentUserWithAbility()
  ])

  //* check authorization for view
  authorizePage(currentUserWithAbility?.ability, PERMISSIONS_ALLOWED_ACTIONS.VIEW, PERMISSIONS_CODES.PROCESS_ZONES)

  if (!processZone) notFound()

  return (
    <ContentContainer>
      <ViewProcessZone processZone={processZone} />
    </ContentContainer>
  )
}
