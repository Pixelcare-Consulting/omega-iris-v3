//* a deleted match tells the user to restore it instead
export function toDuplicateMessage(label: string, deletedAt: Date | null) {
  return deletedAt ? `${label} already exists on a deleted record, restore it instead!` : `${label} already exists!`
}

//* 'A', 'A and B', 'A, B and C', then the verb that fits the count
//* e.g. toFieldListMessage(fields, 'already exists!', 'already exist!')
export function toFieldListMessage(fields: { name: string }[], singular: string, plural: string) {
  const names = fields.map((f) => f.name)
  const joined = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : (names[0] ?? '')

  return `${joined} ${names.length > 1 ? plural : singular}`
}

//! insensitive equals runs as ILIKE, so a % or _ in the value also matches other rows
//* query with findMany, then this keeps only the row that really has the same text
export function findSameText<T>(rows: T[], getText: (row: T) => string, text: string) {
  return rows.find((row) => getText(row).toLowerCase() === text.toLowerCase()) ?? null
}

export function isUniqueConstraintError(err: unknown) {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002'
}
