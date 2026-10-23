import { useCallback, useRef, useState } from 'react'

export type SubmitIntent = 'save' | 'save-new'

//* tracks which button fired the submit, both post the same form
export function useSubmitIntent(defaultIntent: SubmitIntent = 'save') {
  const [intent, setIntentState] = useState<SubmitIntent>(defaultIntent)

  //! the submit handler reads the ref, not the state, state is a render behind the click
  const intentRef = useRef<SubmitIntent>(defaultIntent)

  const setIntent = useCallback((next: SubmitIntent) => {
    intentRef.current = next
    setIntentState(next)
  }, [])

  //* reading clears it so a programmatic submit falls back to the default
  const consumeIntent = useCallback(() => {
    const current = intentRef.current
    intentRef.current = defaultIntent
    return current
  }, [defaultIntent])

  return { intent, setIntent, consumeIntent }
}
