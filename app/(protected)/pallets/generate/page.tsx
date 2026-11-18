import { getCurrentUserWithAbility } from '@/actions/user'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { authorizePage } from '@/lib/authorization'
import ContentContainer from '../../_components/content-container'
import PalletGenerateForm from './_components/pallet-generate-form'

//* static segment, wins over [code]
export default async function PalletGeneratePage() {
  const currentUserWithAbility = await getCurrentUserWithAbility()

  //* check authorization for create
  authorizePage(currentUserWithAbility?.ability, PERMISSIONS_ALLOWED_ACTIONS.CREATE, PERMISSIONS_CODES.PALLETS)

  return (
    <ContentContainer>
      <PalletGenerateForm
        pageMetaData={{ title: 'Generate Pallets', description: 'Pick a location and projects to create many pallets at once.' }}
      />
    </ContentContainer>
  )
}
