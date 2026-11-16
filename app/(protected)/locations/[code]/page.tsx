import { notFound } from 'next/navigation'

import { getCurrentUserWithAbility } from '@/actions/user'
import { getLocationByCode } from '@/actions/location'
import { getCurrentDbCode } from '@/lib/sap/access'
import { decodeCodeParam } from '@/lib/sap/utils'
import ContentContainer from '../../_components/content-container'
import LocationForm from '../_components/location-form'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { authorizePage } from '@/lib/authorization'

export default async function LocationPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  const isAdd = code === 'add'

  const dbCode = await getCurrentDbCode()

  const [location, currentUserWithAbility] = await Promise.all([
    isAdd ? null : getLocationByCode(dbCode, decodeCodeParam(code).toUpperCase()), //* codes are stored uppercase
    getCurrentUserWithAbility()
  ])

  //* check authorization for create, edit
  const requiredAction = isAdd ? PERMISSIONS_ALLOWED_ACTIONS.CREATE : PERMISSIONS_ALLOWED_ACTIONS.EDIT
  authorizePage(currentUserWithAbility?.ability, requiredAction, PERMISSIONS_CODES.LOCATIONS)

  if (!isAdd && !location) notFound()

  const pageMetaData = isAdd
    ? { title: 'Add Location', description: 'Fill in the form to create a new location.' }
    : { title: 'Edit Location', description: "Edit the form to update this location's information." }

  return (
    <ContentContainer>
      <LocationForm pageMetaData={pageMetaData} location={location} />
    </ContentContainer>
  )
}
