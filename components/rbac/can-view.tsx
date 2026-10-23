'use client'

import { AbilityContext } from '@/contexts/ability'
import { useContext } from 'react'

type CanViewProps = {
  children?: React.ReactNode
  action?: string | string[]
  subject?: string | string[]
  isReturnBoolean?: boolean
}

//* returns the children, or a boolean when the caller wants the answer instead
export default function CanView({ children, action, subject, isReturnBoolean }: CanViewProps) {
  const ability = useContext(AbilityContext)

  if (!ability) return null

  const actions = Array.isArray(action) ? action : [action]
  const subjects = Array.isArray(subject) ? subject : [subject]

  //* check if user can perform at least one action on at least one subject
  const canView = actions.some((act) => subjects.some((sub) => ability.can(act, sub)))

  if (isReturnBoolean) return canView

  if ((!canView || !children) && action && subject) return null

  return <>{children}</>
}
