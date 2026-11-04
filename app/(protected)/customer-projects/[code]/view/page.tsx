import { notFound } from 'next/navigation'

import { getCurrentUserWithAbility } from '@/actions/user'
import { getCustomerProjectByCode } from '@/actions/customer-project'
import { getCurrentDbCode } from '@/lib/sap/access'
import { decodeCodeParam } from '@/lib/sap/utils'
import ContentContainer from '@/app/(protected)/_components/content-container'
import ViewCustomerProject from './_components/view-customer-project'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { authorizePage } from '@/lib/authorization'

export default async function CustomerProjectViewPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  const [customerProject, currentUserWithAbility] = await Promise.all([
    getCurrentDbCode().then((dbCode) => getCustomerProjectByCode(dbCode, decodeCodeParam(code).toUpperCase())),
    getCurrentUserWithAbility()
  ])

  //* check authorization for view
  authorizePage(currentUserWithAbility?.ability, PERMISSIONS_ALLOWED_ACTIONS.VIEW, PERMISSIONS_CODES.CUSTOMER_PROJECTS)

  if (!customerProject) notFound()

  return (
    <ContentContainer>
      <ViewCustomerProject customerProject={customerProject} />
    </ContentContainer>
  )
}
