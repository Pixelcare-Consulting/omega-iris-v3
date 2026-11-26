import { notFound } from 'next/navigation'

import { getCurrentUserWithAbility } from '@/actions/user'
import { getInboundByCode, getInboundLocationOptions, getInboundProjectOptions, getInboundReferenceOptions } from '@/actions/inbound'
import { getCurrentDbCode } from '@/lib/sap/access'
import { authorizePage } from '@/lib/authorization'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import ContentContainer from '../../_components/content-container'
import InboundForm from '../_components/inbound-form'

export default async function InboundPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  const dbCode = await getCurrentDbCode()

  const [inbound, currentUserWithAbility] = await Promise.all([getInboundByCode(dbCode, decodeURIComponent(code)), getCurrentUserWithAbility()])

  if (!inbound) notFound()

  //* check authorization for view
  authorizePage(currentUserWithAbility?.ability, PERMISSIONS_ALLOWED_ACTIONS.VIEW, PERMISSIONS_CODES.INBOUNDS)

  const [locationOptions, projectOptions, referenceOptions] = await Promise.all([
    getInboundLocationOptions(dbCode, inbound.session.siteCode),
    getInboundProjectOptions(dbCode),
    getInboundReferenceOptions(dbCode)
  ])

  return (
    <ContentContainer>
      <InboundForm
        inbound={inbound}
        userCode={currentUserWithAbility?.userCode ?? null}
        locationOptions={locationOptions}
        projectOptions={projectOptions}
        referenceOptions={referenceOptions}
      />
    </ContentContainer>
  )
}
