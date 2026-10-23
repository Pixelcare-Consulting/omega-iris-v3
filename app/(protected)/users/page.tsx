import { getCurrentUserWithAbility } from '@/actions/user'
import { getRoleOptions } from '@/actions/role'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { authorizePage } from '@/lib/authorization'
import ContentContainer from '../_components/content-container'
import UserContent from './_components/user-content'

export default async function UsersPage() {
  const [currentUserWithAbility, roleOptions] = await Promise.all([getCurrentUserWithAbility(), getRoleOptions()])

  //* check authorization for view
  authorizePage(currentUserWithAbility?.ability, PERMISSIONS_ALLOWED_ACTIONS.VIEW, PERMISSIONS_CODES.USERS)

  return (
    <ContentContainer>
      <UserContent roleOptions={roleOptions} />
    </ContentContainer>
  )
}
