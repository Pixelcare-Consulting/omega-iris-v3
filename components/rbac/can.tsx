import { AbilityContext } from '@/contexts/ability'
import { createContextualCan } from '@casl/react'

export default createContextualCan(AbilityContext.Consumer)
