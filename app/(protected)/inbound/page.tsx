import { getCurrentUserWithAbility } from '@/actions/user'
import { getInboundFilterOptions } from '@/actions/inbound'
import { getCurrentDbCode } from '@/lib/sap/access'
import { authorizePage } from '@/lib/authorization'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import ContentContainer from '../_components/content-container'
import InboundContent from './_components/inbound-content'

export default async function InboundsPage() {
  const dbCode = await getCurrentDbCode()

  const [currentUserWithAbility, { siteOptions, userOptions, projectOptions }] = await Promise.all([
    getCurrentUserWithAbility(),
    getInboundFilterOptions(dbCode)
  ])

  //* check authorization for view
  authorizePage(currentUserWithAbility?.ability, PERMISSIONS_ALLOWED_ACTIONS.VIEW, PERMISSIONS_CODES.INBOUNDS)

  return (
    <ContentContainer>
      <InboundContent siteOptions={siteOptions} userOptions={userOptions} projectOptions={projectOptions} />
    </ContentContainer>
  )
}
