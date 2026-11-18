import { getCurrentUserWithAbility } from '@/actions/user'
import { getSiteOptions } from '@/actions/site'
import { getProcessZoneOptions } from '@/actions/process-zone'
import { getCurrentDbCode } from '@/lib/sap/access'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { authorizePage } from '@/lib/authorization'
import ContentContainer from '../_components/content-container'
import LocationContent from './_components/location-content'

export default async function LocationsPage() {
  const dbCode = await getCurrentDbCode()

  const [currentUserWithAbility, siteOptions, processZoneOptions] = await Promise.all([
    getCurrentUserWithAbility(),
    getSiteOptions(dbCode),
    getProcessZoneOptions(dbCode)
  ])

  //* check authorization for view
  authorizePage(currentUserWithAbility?.ability, PERMISSIONS_ALLOWED_ACTIONS.VIEW, PERMISSIONS_CODES.LOCATIONS)

  return (
    <ContentContainer>
      <LocationContent siteOptions={siteOptions} processZoneOptions={processZoneOptions} />
    </ContentContainer>
  )
}
