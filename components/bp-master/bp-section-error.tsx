'use client'

type BpSectionErrorProps = { label: string; numbers: number[] }

//* the pager hides records off screen, so their errors are listed here
export default function BpSectionError({ label, numbers }: BpSectionErrorProps) {
  if (numbers.length === 0) return null

  return (
    <div className='bg-destructive w-fit rounded-sm px-2 py-1 text-xs font-medium text-white'>
      Please fix the issues found in {label}: {numbers.map((n) => `#${n}`).join(', ')}
    </div>
  )
}
