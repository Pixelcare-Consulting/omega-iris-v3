import { getCurrentUserWithAbility } from '@/actions/user'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { authorizePage } from '@/lib/authorization'
import ContentContainer from '../../_components/content-container'
import LocationGenerateForm from './_components/location-generate-form'

//* static segment, wins over [code]
export default async function LocationGeneratePage() {
  const currentUserWithAbility = await getCurrentUserWithAbility()

  //* check authorization for create
  authorizePage(currentUserWithAbility?.ability, PERMISSIONS_ALLOWED_ACTIONS.CREATE, PERMISSIONS_CODES.LOCATIONS)

  return (
    <ContentContainer>
      <LocationGenerateForm
        pageMetaData={{ title: 'Generate Locations', description: 'Pick bays, levels and racks to create many locations at once.' }}
      />
    </ContentContainer>
  )
}
