import { getRoleByCode } from '@/actions/role'
import ContentContainer from '@/app/(protected)/_components/content-container'
import { notFound } from 'next/navigation'
import ViewRole from './_components/view-role'
import { getCurrentUserWithAbility } from '@/actions/user'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { authorizePage } from '@/lib/authorization'

export default async function RoleViewPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  const [role, currentUserWithAbility] = await Promise.all([getRoleByCode(parseInt(code)), getCurrentUserWithAbility()])

  if (!role) notFound()

  //* check authorization for view
  authorizePage(currentUserWithAbility?.ability, PERMISSIONS_ALLOWED_ACTIONS.VIEW, PERMISSIONS_CODES.ROLES)

  return (
    <ContentContainer>
      <ViewRole role={role} />
    </ContentContainer>
  )
}
