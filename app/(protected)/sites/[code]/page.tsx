import { notFound } from 'next/navigation'

import { getCurrentUserWithAbility } from '@/actions/user'
import { getSiteByCode } from '@/actions/site'
import { getCurrentDbCode } from '@/lib/sap/access'
import { decodeCodeParam } from '@/lib/sap/utils'
import ContentContainer from '../../_components/content-container'
import SiteForm from '../_components/site-form'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { authorizePage } from '@/lib/authorization'

export default async function SitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  const isAdd = code === 'add'

  const dbCode = await getCurrentDbCode()

  const [site, currentUserWithAbility] = await Promise.all([
    isAdd ? null : getSiteByCode(dbCode, decodeCodeParam(code).toUpperCase()), //* codes are stored uppercase
    getCurrentUserWithAbility()
  ])

  //* check authorization for create, edit
  const requiredAction = isAdd ? PERMISSIONS_ALLOWED_ACTIONS.CREATE : PERMISSIONS_ALLOWED_ACTIONS.EDIT
  authorizePage(currentUserWithAbility?.ability, requiredAction, PERMISSIONS_CODES.SITES)

  if (!isAdd && !site) notFound()

  const pageMetaData = isAdd
    ? { title: 'Add Site', description: 'Fill in the form to create a new site.' }
    : { title: 'Edit Site', description: "Edit the form to update this site's information." }

  return (
    <ContentContainer>
      <SiteForm pageMetaData={pageMetaData} site={site} />
    </ContentContainer>
  )
}
