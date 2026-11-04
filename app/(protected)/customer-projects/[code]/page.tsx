import { notFound, redirect } from 'next/navigation'
import { UNAUTHORIZED_ROUTE } from '@/constants/common'

import { getCurrentUserWithAbility } from '@/actions/user'
import { getCustomerProjectByCode } from '@/actions/customer-project'
import { getCurrentDbCode } from '@/lib/sap/access'
import { decodeCodeParam } from '@/lib/sap/utils'
import ContentContainer from '../../_components/content-container'
import CustomerProjectForm from '../_components/customer-project-form'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { authorizePage } from '@/lib/authorization'

export default async function CustomerProjectPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  const isAdd = code === 'add'

  const dbCode = await getCurrentDbCode()

  const [customerProject, currentUserWithAbility] = await Promise.all([
    isAdd ? null : getCustomerProjectByCode(dbCode, decodeCodeParam(code).toUpperCase()), //* codes are stored uppercase
    getCurrentUserWithAbility()
  ])

  //* system rows are view only, whatever the ability says
  if (customerProject?.isSystem) redirect(UNAUTHORIZED_ROUTE)

  //* check authorization for create, edit
  const requiredAction = isAdd ? PERMISSIONS_ALLOWED_ACTIONS.CREATE : PERMISSIONS_ALLOWED_ACTIONS.EDIT
  authorizePage(currentUserWithAbility?.ability, requiredAction, PERMISSIONS_CODES.CUSTOMER_PROJECTS)

  if (!isAdd && !customerProject) notFound()

  const pageMetaData = isAdd
    ? { title: 'Add Customer Project', description: 'Fill in the form to create a new customer project.' }
    : { title: 'Edit Customer Project', description: "Edit the form to update this customer project's information." }

  return (
    <ContentContainer>
      <CustomerProjectForm pageMetaData={pageMetaData} customerProject={customerProject} />
    </ContentContainer>
  )
}
