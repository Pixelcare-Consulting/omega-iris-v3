import { getCurrentUserWithAbility } from '@/actions/user'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { authorizePage } from '@/lib/authorization'
import ContentContainer from '../_components/content-container'
import ManufacturerContent from './_components/manufacturer-content'

export default async function ManufacturersPage() {
  const currentUserWithAbility = await getCurrentUserWithAbility()

  //* check authorization for view
  authorizePage(currentUserWithAbility?.ability, PERMISSIONS_ALLOWED_ACTIONS.VIEW, PERMISSIONS_CODES.MANUFACTURERS)

  return (
    <ContentContainer>
      <ManufacturerContent />
    </ContentContainer>
  )
}
