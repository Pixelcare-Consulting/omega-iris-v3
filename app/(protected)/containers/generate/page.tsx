import { getCurrentUserWithAbility } from '@/actions/user'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { authorizePage } from '@/lib/authorization'
import ContentContainer from '../../_components/content-container'
import ContainerGenerateForm from './_components/container-generate-form'

//* static segment, wins over [code]
export default async function ContainerGeneratePage() {
  const currentUserWithAbility = await getCurrentUserWithAbility()

  //* check authorization for create
  authorizePage(currentUserWithAbility?.ability, PERMISSIONS_ALLOWED_ACTIONS.CREATE, PERMISSIONS_CODES.CONTAINERS)

  return (
    <ContentContainer>
      <ContainerGenerateForm
        pageMetaData={{ title: 'Generate Containers', description: 'Pick a location and projects to create many containers at once.' }}
      />
    </ContentContainer>
  )
}
