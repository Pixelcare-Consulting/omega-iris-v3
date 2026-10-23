import { useState, useCallback } from 'react'

type ConfirmActionState<T> = {
  target: T | null
  isOpen: boolean
}

export function useConfirmAction<T>() {
  const [state, setState] = useState<ConfirmActionState<T>>({ target: null, isOpen: false })

  const open = useCallback((target: T) => {
    setState({ target, isOpen: true })
  }, [])

  const close = useCallback(() => {
    //* only flip isOpen, keep `target` intact through the close animation
    setState((prev) => ({ ...prev, isOpen: false }))
  }, [])

  return { target: state.target, isOpen: state.isOpen, open, close }
}
