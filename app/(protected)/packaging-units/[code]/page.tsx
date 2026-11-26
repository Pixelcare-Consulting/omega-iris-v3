import { notFound } from 'next/navigation'

import { getCurrentUserWithAbility } from '@/actions/user'
import { getPackagingUnitByCode } from '@/actions/packaging-unit'
import { getInboundReferenceOptions } from '@/actions/inbound'
import { getCurrentDbCode } from '@/lib/sap/access'
import { decodeCodeParam } from '@/lib/sap/utils'
import ContentContainer from '../../_components/content-container'
import PackagingUnitForm from '../_components/packaging-unit-form'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { authorizePage } from '@/lib/authorization'

export default async function PackagingUnitPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  const dbCode = await getCurrentDbCode()

  const [unit, currentUserWithAbility, referenceOptions] = await Promise.all([
    getPackagingUnitByCode(dbCode, decodeCodeParam(code).toUpperCase()), //* codes are stored uppercase
    getCurrentUserWithAbility(),
    getInboundReferenceOptions(dbCode)
  ])

  //* check authorization for edit, units are only created by inbound
  authorizePage(currentUserWithAbility?.ability, PERMISSIONS_ALLOWED_ACTIONS.EDIT, PERMISSIONS_CODES.PACKAGING_UNITS)

  if (!unit) notFound()

  const pageMetaData = { title: 'Edit Unique ID', description: "Edit the unique ID's details." }

  return (
    <ContentContainer>
      <PackagingUnitForm pageMetaData={pageMetaData} unit={unit} referenceOptions={referenceOptions} />
    </ContentContainer>
  )
}
