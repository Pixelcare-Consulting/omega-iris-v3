import { differenceInSeconds, max, min, secondsToHours, secondsToMinutes } from 'date-fns'

type ActiveTimeInput = {
  startedAt: Date
  endedAt: Date | null
  pauses: { pausedAt: Date; resumedAt: Date | null }[]
}

//* worked seconds, pauses not counted, an open pause stops the clock at its start
export function getActiveSeconds({ startedAt, endedAt, pauses }: ActiveTimeInput, now: Date) {
  const end = endedAt ?? now

  const pausedSeconds = pauses.reduce((total, { pausedAt, resumedAt }) => {
    const pauseEnd = min([resumedAt ?? end, end])
    return total + Math.max(0, differenceInSeconds(pauseEnd, max([pausedAt, startedAt])))
  }, 0)

  return Math.max(0, differenceInSeconds(end, startedAt) - pausedSeconds)
}

//* hours, minutes and seconds left over
function toTimeParts(seconds: number) {
  const hours = secondsToHours(seconds)
  const minutes = secondsToMinutes(seconds) % 60

  return { hours, minutes, seconds: seconds % 60 }
}

const pad = (value: number) => String(value).padStart(2, '0')

//* e.g. 42s, 3m 05s, 1h 02m 05s
export function formatActiveTime(totalSeconds: number) {
  const { hours, minutes, seconds } = toTimeParts(totalSeconds)

  if (hours > 0) return `${hours}h ${pad(minutes)}m ${pad(seconds)}s`
  return minutes > 0 ? `${minutes}m ${pad(seconds)}s` : `${seconds}s`
}

//* e.g. 00:47:23
export function formatClock(totalSeconds: number) {
  const { hours, minutes, seconds } = toTimeParts(totalSeconds)

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

//* the open pause, if any
export function getOpenPause<T extends { resumedAt: Date | null }>(pauses: T[]) {
  return pauses.find((pause) => !pause.resumedAt) ?? null
}
