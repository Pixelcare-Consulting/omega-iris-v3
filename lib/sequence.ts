import 'server-only'

import { TZDate } from '@date-fns/tz'
import { format } from 'date-fns'
import { createId } from '@paralleldrive/cuid2'

import db from '@/lib/db'
import { Prisma } from '@/prisma/generated/client'
import { BUSINESS_TIME_ZONE, DEFAULT_PADDING_LENGTH } from '@/constants/common'

export type SequenceDefinition<TContext = void> = {
  key: string
  //* reset bucket, return '' to never reset
  scope: (ctx: TContext, date: TZDate) => string
  format: (value: number, scope: string, ctx: TContext) => string
}

export function defineSequence<TContext = void>(definition: SequenceDefinition<TContext>) {
  return definition
}

export function padSequence(value: number, length = DEFAULT_PADDING_LENGTH) {
  return String(value).padStart(length, '0')
}

export function toBusinessDate(date = new Date(), timeZone = BUSINESS_TIME_ZONE) {
  return new TZDate(date, timeZone)
}

//* year and month letter, A is january, e.g. 26K
export function toYearMonthCode(date: TZDate) {
  return `${format(date, 'yy')}${String.fromCharCode(65 + date.getMonth())}`
}

//* e.g. 261019
export function toYearMonthDayCode(date: TZDate) {
  return format(date, 'yyMMdd')
}

//! run inside the record's transaction, a rollback then gives the number back
export async function nextSequence<TContext>(
  tx: Prisma.TransactionClient,
  definition: SequenceDefinition<TContext>,
  ctx: TContext,
  date = new Date()
) {
  const scope = definition.scope(ctx, toBusinessDate(date))

  //* raw upsert, prisma upsert can race on the first insert of a scope
  const [row] = await tx.$queryRaw<{ current: number }[]>`
    INSERT INTO "SequenceCounter" ("id", "key", "scope", "current")
    VALUES (${createId()}, ${definition.key}, ${scope}, 1)
    ON CONFLICT ("key", "scope")
    DO UPDATE SET "current" = "SequenceCounter"."current" + 1, "updatedAt" = now()
    RETURNING "current"`

  return definition.format(row.current, scope, ctx)
}

//* takes count numbers in one write, returns the first, e.g. 11 for 11 to 20
//! run inside the record's transaction, a rollback then gives the numbers back
export async function reserveSequence<TContext>(
  tx: Prisma.TransactionClient,
  definition: SequenceDefinition<TContext>,
  ctx: TContext,
  count: number,
  date = new Date()
) {
  const scope = definition.scope(ctx, toBusinessDate(date))

  const [row] = await tx.$queryRaw<{ current: number }[]>`
    INSERT INTO "SequenceCounter" ("id", "key", "scope", "current")
    VALUES (${createId()}, ${definition.key}, ${scope}, ${count})
    ON CONFLICT ("key", "scope")
    DO UPDATE SET "current" = "SequenceCounter"."current" + ${count}, "updatedAt" = now()
    RETURNING "current"`

  return { scope, first: row.current - count + 1 }
}

//* next number and its scope, for a preview that counts on from it
export async function previewSequenceValue<TContext>(definition: SequenceDefinition<TContext>, ctx: TContext, date = new Date()) {
  const scope = definition.scope(ctx, toBusinessDate(date))

  const counter = await db.sequenceCounter.findUnique({
    where: { key_scope: { key: definition.key, scope } },
    select: { current: true }
  })

  return { scope, value: (counter?.current ?? 0) + 1 }
}

//* next code for display only, another save can still take it first
export async function previewSequence<TContext>(definition: SequenceDefinition<TContext>, ctx: TContext, date = new Date()) {
  const scope = definition.scope(ctx, toBusinessDate(date))

  const counter = await db.sequenceCounter.findUnique({
    where: { key_scope: { key: definition.key, scope } },
    select: { current: true }
  })

  return definition.format((counter?.current ?? 0) + 1, scope, ctx)
}
