import type { ActivitySource } from '@/prisma/generated/enums'

export type ActivityTone = 'green' | 'blue' | 'red' | 'gray'

export type ActivityActor = { userCode: number | null; userName: string; source: ActivitySource }

export type ActivityFieldChange = { key: string; label: string; from: string | null; to: string | null }

export type ActivityChildOp = 'added' | 'changed' | 'removed'

export type ActivityChildChange = { op: ActivityChildOp; label: string; fields: ActivityFieldChange[] }

export type ActivityChildGroup = { key: string; label: string; noun: string; items: ActivityChildChange[] }

export type ActivityChanges = {
  fields: ActivityFieldChange[]
  children?: ActivityChildGroup[]
  meta?: Record<string, string | number>
}

//* format reads the value off the row, so a lookup can read row.role?.name
export type ActivityFieldConfig<T> = { key: string; label: string; format?: (row: T) => unknown }

export type ActivityChildConfig<T> = {
  key: string
  label: string
  noun: string
  rows: (row: T) => any[]
  matchKey: string
  rowLabel: (child: any) => string
  fields: ActivityFieldConfig<any>[]
}

//* only listed fields are logged
export type ActivityConfig<T> = { fields: ActivityFieldConfig<T>[]; children?: ActivityChildConfig<T>[] }
