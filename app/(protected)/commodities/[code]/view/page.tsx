import { notFound } from 'next/navigation'

import { getCurrentUserWithAbility } from '@/actions/user'
import { getCommodityByCode } from '@/actions/commodity'
import { getCurrentDbCode } from '@/lib/sap/access'
import { decodeCodeParam } from '@/lib/sap/utils'
import ContentContainer from '@/app/(protected)/_components/content-container'
import ViewCommodity from './_components/view-commodity'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { authorizePage } from '@/lib/authorization'

export default async function CommodityViewPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  const dbCode = await getCurrentDbCode()

  const [commodity, currentUserWithAbility] = await Promise.all([
    getCommodityByCode(dbCode, decodeCodeParam(code).toUpperCase()),
    getCurrentUserWithAbility()
  ])

  //* check authorization for view
  authorizePage(currentUserWithAbility?.ability, PERMISSIONS_ALLOWED_ACTIONS.VIEW, PERMISSIONS_CODES.COMMODITIES)

  if (!commodity) notFound()

  return (
    <ContentContainer>
      <ViewCommodity commodity={commodity} />
    </ContentContainer>
  )
}
