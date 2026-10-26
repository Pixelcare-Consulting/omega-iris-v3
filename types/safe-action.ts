import { Dispatch, SetStateAction } from 'react'

export type SafeActionHook = {
  setData: Dispatch<SetStateAction<any[]>>
  setRowCount: (rowCount: number) => void
  setPageIndex?: (pageIndex: number) => void //* lets the hook go back to page 1 when filters change
}
