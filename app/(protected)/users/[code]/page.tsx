import { notFound, redirect } from 'next/navigation'
import { UNAUTHORIZED_ROUTE } from '@/constants/common'

import { getCurrentUserWithAbility, getUserByCode } from '@/actions/user'
import ContentContainer from '../../_components/content-container'
import UserForm from '../_components/user-form'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { authorizePage } from '@/lib/authorization'

export default async function UserPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  const isAdd = code === 'add'

  const [user, currentUserWithAbility] = await Promise.all([isAdd ? null : getUserByCode(parseInt(code)), getCurrentUserWithAbility()])

  if (!isAdd && !user) notFound()

  //* system users are view only, whatever the ability says
  if (user?.isSystem) redirect(UNAUTHORIZED_ROUTE)

  //* check authorization for create, edit
  const requiredAction = isAdd ? PERMISSIONS_ALLOWED_ACTIONS.CREATE : PERMISSIONS_ALLOWED_ACTIONS.EDIT
  authorizePage(currentUserWithAbility?.ability, requiredAction, PERMISSIONS_CODES.USERS)

  const pageMetaData = isAdd
    ? { title: 'Add User', description: 'Fill in the form to create a new user.' }
    : { title: 'Edit User', description: "Edit the form to update this user's information." }

  return (
    <ContentContainer>
      <UserForm pageMetaData={pageMetaData} user={user} />
    </ContentContainer>
  )
}
