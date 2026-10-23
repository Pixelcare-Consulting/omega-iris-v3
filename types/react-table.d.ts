import '@tanstack/react-table'

declare module '@tanstack/react-table' {
  interface ColumnMeta<TData extends RowData, TValue> {
    title?: string
    options?: FilterOption[]
    exportValue?: (row: TData) => string | number | boolean | null | undefined
  }
}
