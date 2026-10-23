import { StoreApi, UseBoundStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'

type GenericState = Record<string, any>

//* create a store with selectors for zustand
export const createStoreWithSelectors = <T extends GenericState>(
  store: UseBoundStore<StoreApi<T>>
): (<K extends keyof T>(keys: K[]) => Pick<T, K>) => {
  const useStore: <K extends keyof T>(keys: K[]) => Pick<T, K> = <K extends keyof T>(keys: K[]) => {
    return store(
      useShallow((state) => {
        const x: Partial<T> = {}

        if (Array.isArray(keys)) {
          for (const key of keys) {
            x[key] = state[key]
          }
        }

        return x as Pick<T, K>
      })
    )
  }

  return useStore
}
