import { notFound, redirect } from 'next/navigation'
import { UNAUTHORIZED_ROUTE } from '@/constants/common'

import { getCurrentUserWithAbility } from '@/actions/user'
import { getCommodityByCode } from '@/actions/commodity'
import { getCurrentDbCode } from '@/lib/sap/access'
import { decodeCodeParam } from '@/lib/sap/utils'
import ContentContainer from '../../_components/content-container'
import CommodityForm from '../_components/commodity-form'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { authorizePage } from '@/lib/authorization'

export default async function CommodityPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  const isAdd = code === 'add'

  const dbCode = await getCurrentDbCode()

  const [commodity, currentUserWithAbility] = await Promise.all([
    isAdd ? null : getCommodityByCode(dbCode, decodeCodeParam(code).toUpperCase()), //* codes are stored uppercase
    getCurrentUserWithAbility()
  ])

  //* system rows are view only, whatever the ability says
  if (commodity?.isSystem) redirect(UNAUTHORIZED_ROUTE)

  //* check authorization for create, edit
  const requiredAction = isAdd ? PERMISSIONS_ALLOWED_ACTIONS.CREATE : PERMISSIONS_ALLOWED_ACTIONS.EDIT
  authorizePage(currentUserWithAbility?.ability, requiredAction, PERMISSIONS_CODES.COMMODITIES)

  if (!isAdd && !commodity) notFound()

  const pageMetaData = isAdd
    ? { title: 'Add Commodity', description: 'Fill in the form to create a new commodity.' }
    : { title: 'Edit Commodity', description: "Edit the form to update this commodity's information." }

  return (
    <ContentContainer>
      <CommodityForm pageMetaData={pageMetaData} commodity={commodity} />
    </ContentContainer>
  )
}
