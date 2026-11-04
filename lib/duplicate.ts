//* a deleted match tells the user to restore it instead
export function toDuplicateMessage(label: string, deletedAt: Date | null) {
  return deletedAt ? `${label} already exists on a deleted record, restore it instead!` : `${label} already exists!`
}

export function isUniqueConstraintError(err: unknown) {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002'
}
