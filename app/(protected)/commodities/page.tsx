import { getCurrentUserWithAbility } from '@/actions/user'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { authorizePage } from '@/lib/authorization'
import ContentContainer from '../_components/content-container'
import CommodityContent from './_components/commodity-content'

export default async function CommoditiesPage() {
  const currentUserWithAbility = await getCurrentUserWithAbility()

  //* check authorization for view
  authorizePage(currentUserWithAbility?.ability, PERMISSIONS_ALLOWED_ACTIONS.VIEW, PERMISSIONS_CODES.COMMODITIES)

  return (
    <ContentContainer>
      <CommodityContent />
    </ContentContainer>
  )
}
