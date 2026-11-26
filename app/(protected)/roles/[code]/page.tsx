import { notFound, redirect } from 'next/navigation'

import { getRoleByCode } from '@/actions/role'
import ContentContainer from '../../_components/content-container'
import RoleForm from '../_components/role-form'
import { SUPER_USER_ROLE_KEY } from '@/constants/role'
import { getCurrentUserWithAbility } from '@/actions/user'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { UNAUTHORIZED_ROUTE } from '@/constants/common'
import { authorizePage } from '@/lib/authorization'

export default async function RolePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  const isAdd = code === 'add'

  const [role, currentUserWithAbility] = await Promise.all([isAdd ? null : getRoleByCode(parseInt(code)), getCurrentUserWithAbility()])

  if (!isAdd && !role) notFound()

  //* a row-level rule CASL can't express, the super user role is never editable, whatever the ability says
  if (role?.isSystem && role.key === SUPER_USER_ROLE_KEY) redirect(UNAUTHORIZED_ROUTE)

  //* check authorization for create, edit
  const requiredAction = isAdd ? PERMISSIONS_ALLOWED_ACTIONS.CREATE : PERMISSIONS_ALLOWED_ACTIONS.EDIT
  authorizePage(currentUserWithAbility?.ability, requiredAction, PERMISSIONS_CODES.ROLES)

  const pageMetaData = isAdd
    ? { title: 'Add Role', description: 'Fill in the form to create a new role.' }
    : { title: 'Edit Role', description: "Edit the form to update this role's information." }

  return (
    <ContentContainer>
      <RoleForm pageMetaData={pageMetaData} role={role} />
    </ContentContainer>
  )
}
