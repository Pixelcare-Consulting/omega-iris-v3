import type { BadgeVariants } from '@/components/ui/badge'
import type { ActivityTone } from '@/types/activity-log'
import { ACTIVITY_ACTIONS, ActivityAction } from '@/constants/activity-log'

//* the one map the dot, the action badge and the op badges read from
export const ACTIVITY_TONE_STYLES: Record<ActivityTone, { badge: BadgeVariants['variant']; dot: string }> = {
  green: { badge: 'soft-green', dot: 'bg-green-600' },
  blue: { badge: 'soft-blue', dot: 'bg-blue-600' },
  red: { badge: 'soft-red', dot: 'bg-red-600' },
  gray: { badge: 'soft-neutral', dot: 'bg-neutral-400' }
}

//* an unknown action from an older row falls back to gray
export function getActionTone(action: string): ActivityTone {
  return ACTIVITY_ACTIONS[action as ActivityAction]?.tone ?? 'gray'
}

export function getActionLabel(action: string) {
  return ACTIVITY_ACTIONS[action as ActivityAction]?.label ?? action
}
