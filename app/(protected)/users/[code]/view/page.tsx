import { notFound } from 'next/navigation'

import { getCurrentUserWithAbility, getUserByCode } from '@/actions/user'
import ContentContainer from '@/app/(protected)/_components/content-container'
import ViewUser from './_components/view-user'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { authorizePage } from '@/lib/authorization'

export default async function UserViewPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  const [user, currentUserWithAbility] = await Promise.all([getUserByCode(parseInt(code)), getCurrentUserWithAbility()])

  if (!user) notFound()

  //* check authorization for view
  authorizePage(currentUserWithAbility?.ability, PERMISSIONS_ALLOWED_ACTIONS.VIEW, PERMISSIONS_CODES.USERS)

  return (
    <ContentContainer>
      <ViewUser user={user} />
    </ContentContainer>
  )
}
