import { Dispatch, SetStateAction } from 'react'

export type SafeActionHook = {
  setData: Dispatch<SetStateAction<any[]>>
  setRowCount: (rowCount: number) => void
}
