import { useMediaQuery } from 'usehooks-ts'

const MOBILE_BREAKPOINT = 768

//! initializeWithValue false, reading matchMedia on the first render breaks hydration
export function useIsMobile() {
  return useMediaQuery(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`, { initializeWithValue: false })
}
