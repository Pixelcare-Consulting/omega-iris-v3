//! no server-only and no db singleton here, prisma/seed.ts runs this under plain tsx with its own client
//TODO: scheduled job to delete activity logs older than 2 years
import { formatDate } from '@/lib/utils'
import { Prisma, PrismaClient } from '@/prisma/generated/client'
import { AppAbility } from '@/lib/rbac'
import { PERMISSIONS_ALLOWED_ACTIONS, PERMISSIONS_CODES } from '@/constants/permission'
import { ACTIVITY_ACTIONS, ACTIVITY_MODULES, ACTIVITY_STATUS_KEYS, ActivityAction, ActivityModule } from '@/constants/activity-log'
import type {
  ActivityActor,
  ActivityChanges,
  ActivityChildChange,
  ActivityChildGroup,
  ActivityConfig,
  ActivityFieldChange,
  ActivityFieldConfig
} from '@/types/activity-log'

type DbClient = Prisma.TransactionClient | PrismaClient

export type LogActivityInput = {
  actor: ActivityActor
  module: ActivityModule
  action: ActivityAction
  dbCode?: string | null
  entity?: { id: string; code?: string | number | null; label?: string | null }
  parent?: { module: ActivityModule; id: string }
  changes?: ActivityChanges | null
  summary?: string
  batchId?: string | null
}

export function toActivityText(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (value instanceof Date) return formatDate(value, 'PP p')
  if (Array.isArray(value)) return value.length > 0 ? value.map((v) => toActivityText(v) ?? '').join(', ') : null

  return String(value)
}

function readField<T>(field: ActivityFieldConfig<T>, row: T | null) {
  if (!row) return null
  return toActivityText(field.format ? field.format(row) : (row as Record<string, unknown>)[field.key])
}

function diffFields<T>(fields: ActivityFieldConfig<T>[], before: T | null, after: T | null): ActivityFieldChange[] {
  return fields.flatMap((field) => {
    const from = readField(field, before)
    const to = readField(field, after)
    return from === to ? [] : [{ key: field.key, label: field.label, from, to }]
  })
}

export function diffActivity<T>(config: ActivityConfig<T>, before: T | null, after: T | null): ActivityChanges {
  const fields = diffFields(config.fields, before, after)

  const children = (config.children ?? []).flatMap<ActivityChildGroup>((child) => {
    const beforeRows = before ? child.rows(before) : []
    const afterRows = after ? child.rows(after) : []
    const beforeByKey = new Map(beforeRows.map((row) => [row[child.matchKey], row]))
    const afterKeys = new Set(afterRows.map((row) => row[child.matchKey]))

    const items: ActivityChildChange[] = []

    for (const row of afterRows) {
      const previous = beforeByKey.get(row[child.matchKey]) ?? null
      const rowFields = diffFields(child.fields, previous, row)

      if (!previous) items.push({ op: 'added', label: child.rowLabel(row), fields: rowFields })
      else if (rowFields.length > 0) items.push({ op: 'changed', label: child.rowLabel(row), fields: rowFields })
    }

    //* a removed row keeps its last values
    for (const row of beforeRows) {
      if (!afterKeys.has(row[child.matchKey]))
        items.push({ op: 'removed', label: child.rowLabel(row), fields: diffFields(child.fields, row, null) })
    }

    return items.length > 0 ? [{ key: child.key, label: child.label, noun: child.noun, items }] : []
  })

  return { fields, ...(children.length > 0 && { children }) }
}

export function hasActivityChanges(changes: ActivityChanges | null | undefined) {
  return !!changes && (changes.fields.length > 0 || (changes.children ?? []).some((group) => group.items.length > 0))
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

export function toActivitySummary(action: ActivityAction, changes?: ActivityChanges | null, module?: ActivityModule) {
  const moduleLabel = module ? ACTIVITY_MODULES[module].label.toLowerCase() : 'record'

  if (action === 'UPDATE' && changes) {
    const parts = [
      ...(changes.fields.length > 0 ? [plural(changes.fields.length, 'field')] : []),
      ...(changes.children ?? []).map((group) => plural(group.items.length, `${group.noun} change`))
    ]

    return parts.length > 0 ? `Updated ${parts.join(', ')}` : ACTIVITY_ACTIONS.UPDATE.label
  }

  if (action === 'STATUS' && changes?.fields[0]) {
    const { label, from, to } = changes.fields[0]
    return `${label} ${from ?? '—'} → ${to ?? '—'}`
  }

  if (action === 'IMPORT' && changes?.meta) {
    const { created = 0, updated = 0, failed = 0, fileName } = changes.meta
    const total = Number(created) + Number(updated) + Number(failed)
    const counts = [
      ...(Number(created) > 0 ? [`${created} created`] : []),
      ...(Number(updated) > 0 ? [`${updated} updated`] : []),
      ...(Number(failed) > 0 ? [`${failed} failed`] : [])
    ]

    return `Imported ${plural(total, moduleLabel)}${fileName ? ` from ${fileName}` : ''}${counts.length > 0 ? `: ${counts.join(', ')}` : ''}`
  }

  if (action === 'BULK_CREATE' && changes?.meta) return `Generated ${plural(Number(changes.meta.created ?? 0), moduleLabel)}`

  if (action === 'BULK_DELETE' && changes?.meta) return `Deleted ${plural(Number(changes.meta.deleted ?? 0), moduleLabel)}`

  return ACTIVITY_ACTIONS[action].label
}

//* null when there is nothing to log
function toActivityRow(input: LogActivityInput): Prisma.ActivityLogCreateManyInput | null {
  const { actor, module, dbCode, entity, parent, changes, batchId } = input
  let action = input.action

  if (action === 'UPDATE') {
    const hasChanges = hasActivityChanges(changes)

    //* an explicit summary keeps it, for writes with no stored before values, e.g. sap or other third party
    if (!hasChanges && !input.summary) return null

    //* an update that only flips isActive or status reads as a status change
    const isStatusOnly =
      hasChanges && !changes!.children?.length && changes!.fields.every((field) => ACTIVITY_STATUS_KEYS.includes(field.key))
    if (isStatusOnly) action = 'STATUS'
  }

  return {
    dbCode: dbCode ?? null,
    module,
    entityId: entity?.id ?? null,
    entityCode: entity?.code !== null && entity?.code !== undefined ? String(entity.code) : null,
    entityLabel: entity?.label ?? null,
    parentModule: parent?.module ?? null,
    parentId: parent?.id ?? null,
    action,
    summary: input.summary ?? toActivitySummary(action, changes, module),
    changes: changes ? (changes as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
    source: actor.source,
    userCode: actor.userCode,
    userName: actor.userName,
    batchId: batchId ?? null
  }
}

export async function logActivity(client: DbClient, input: LogActivityInput) {
  const row = toActivityRow(input)
  if (row) await client.activityLog.create({ data: row })
}

//* a child module has no permission of its own, its parent's view decides
export function canViewActivityModule(ability: AppAbility, module: ActivityModule): boolean {
  const config: { label: string; permission?: string; parent?: readonly string[] } = ACTIVITY_MODULES[module]

  if (config.permission) return !!ability?.can(PERMISSIONS_ALLOWED_ACTIONS.VIEW, config.permission)
  if (config.parent) return config.parent.some((parent) => canViewActivityModule(ability, parent as ActivityModule))

  //* modules with no permission, like sign-in, belong to the audit logs page
  return !!ability?.can(PERMISSIONS_ALLOWED_ACTIONS.VIEW, PERMISSIONS_CODES.AUDIT_LOGS)
}

//* the rows logActivities would write, for a caller that adds them to its own batch transaction
export function toActivityRows(inputs: LogActivityInput[]) {
  return inputs.flatMap((input) => toActivityRow(input) ?? [])
}

//* one insert for a whole chunk, used by imports and bulk generate
export async function logActivities(client: DbClient, inputs: LogActivityInput[]) {
  const rows = toActivityRows(inputs)
  if (rows.length > 0) await client.activityLog.createMany({ data: rows })
}
