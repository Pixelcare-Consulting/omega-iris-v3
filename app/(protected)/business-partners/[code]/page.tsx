import { notFound } from 'next/navigation'

import { getCurrentUserWithAbility } from '@/actions/user'
import { getBusinessPartnerByCode } from '@/actions/business-partner'
import { getCurrentDbCode } from '@/lib/sap/access'
import { decodeCodeParam } from '@/lib/sap/utils'
import ContentContainer from '../../_components/content-container'
import BusinessPartnerForm from '../_components/business-partner-form'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { authorizePage } from '@/lib/authorization'

export default async function BusinessPartnerPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  const isAdd = code === 'add'

  const [result, currentUserWithAbility] = await Promise.all([
    isAdd ? null : getCurrentDbCode().then((dbCode) => getBusinessPartnerByCode(dbCode, decodeCodeParam(code))),
    getCurrentUserWithAbility()
  ])

  //* check authorization for create, edit
  const requiredAction = isAdd ? PERMISSIONS_ALLOWED_ACTIONS.CREATE : PERMISSIONS_ALLOWED_ACTIONS.EDIT
  authorizePage(currentUserWithAbility?.ability, requiredAction, PERMISSIONS_CODES.BUSINESS_PARTNERS)

  if (!isAdd && (!result || (!result.ok && result.status === 404))) notFound()

  //* any other sap failure goes to the error page instead of an empty form
  if (result && !result.ok) throw new Error(result.message)

  const pageMetaData = isAdd
    ? { title: 'Add Business Partner', description: 'Fill in the form to create a new business partner in SAP.' }
    : { title: 'Edit Business Partner', description: "Edit the form to update this business partner's information in SAP." }

  return (
    <ContentContainer>
      <BusinessPartnerForm pageMetaData={pageMetaData} businessPartner={result?.ok ? result.data : null} />
    </ContentContainer>
  )
}
