import { FormOptions } from '@/types/common'

type OptionRecord = { code: string | number } & Record<string, any>

//* every picker feeds on { label, value }, the row rides along for its other columns
export function toFormOption<T extends OptionRecord>(record: T, getLabel: (record: T) => string = (row) => row.name) {
  return { ...record, label: getLabel(record), value: String(record.code) }
}

//! map through this, `list.map(toFormOption)` passes the index as the label getter
export function toFormOptions<T extends OptionRecord>(records: T[], getLabel?: (record: T) => string) {
  return records.map((record) => toFormOption(record, getLabel))
}

//* a picker lists live rows only, so a record pointing at a deleted or inactive one renders blank
//* this puts it back on top, labelled so it doesn't read as a normal choice
export function withCurrentOption<T extends FormOptions>(options: T[], current: T | null | undefined): T[] {
  if (!current || options.some((option) => option.value === current.value)) return options

  const suffix = current.deletedAt ? ' (Deleted)' : current.isActive === false ? ' (Inactive)' : ''

  return [{ ...current, label: `${current.label}${suffix}` }, ...options]
}

//* the default row's value for a reference, by key
export function getRefDefaultValue<T extends { isDefault: boolean }, K extends keyof T>(data: T[], key: K) {
  return data.find(({ isDefault }) => isDefault)?.[key] ?? null
}
