import { notFound } from 'next/navigation'

import { getCurrentUserWithAbility } from '@/actions/user'
import { getPackagingUnitByCode } from '@/actions/packaging-unit'
import { getCurrentDbCode } from '@/lib/sap/access'
import { decodeCodeParam } from '@/lib/sap/utils'
import ContentContainer from '@/app/(protected)/_components/content-container'
import ViewPackagingUnit from './_components/view-packaging-unit'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { authorizePage } from '@/lib/authorization'

export default async function PackagingUnitViewPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  const dbCode = await getCurrentDbCode()

  const [unit, currentUserWithAbility] = await Promise.all([
    getPackagingUnitByCode(dbCode, decodeCodeParam(code).toUpperCase()),
    getCurrentUserWithAbility()
  ])

  //* check authorization for view
  authorizePage(currentUserWithAbility?.ability, PERMISSIONS_ALLOWED_ACTIONS.VIEW, PERMISSIONS_CODES.PACKAGING_UNITS)

  if (!unit) notFound()

  return (
    <ContentContainer>
      <ViewPackagingUnit unit={unit} />
    </ContentContainer>
  )
}
