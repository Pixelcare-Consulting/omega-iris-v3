type MatchItem = { mpn: string; totalStock: number }

type MatchPoLine = { LineNum: number; ItemCode: string; Quantity: number; OpenQuantity: number }

type PartQty = { mpn: string; receivedQty: number; openQty: number }

const isSamePart = (a: string, b: string) => a.trim().toUpperCase() === b.trim().toUpperCase()

//* compared at 6 decimals, the db scale, so float noise never breaks an exact qty
const toScaled = (value: number) => Math.round(value * 1e6)

const sumScaled = (values: number[]) => values.reduce((total, value) => total + toScaled(value), 0) / 1e6

export function isPartOnPo(mpn: string, poLines: Pick<MatchPoLine, 'ItemCode'>[]) {
  return poLines.some((line) => isSamePart(line.ItemCode, mpn))
}

//* lines with the same p/n add up, null when not on the po
export function getOpenQty(mpn: string, poLines: MatchPoLine[]) {
  const partLines = poLines.filter((line) => isSamePart(line.ItemCode, mpn))
  return partLines.length > 0 ? sumScaled(partLines.map((line) => line.OpenQuantity)) : null
}

export function getOrderedQty(mpn: string, poLines: MatchPoLine[]) {
  const partLines = poLines.filter((line) => isSamePart(line.ItemCode, mpn))
  return partLines.length > 0 ? sumScaled(partLines.map((line) => line.Quantity)) : null
}

export function getReceivedQty(mpn: string, items: MatchItem[]) {
  return sumScaled(items.filter((item) => isSamePart(item.mpn, mpn)).map((item) => item.totalStock))
}

//* what is still open for the part after these packages, null when nothing is left
export function getSuggestedTotalStock(mpn: string, items: MatchItem[], poLines: MatchPoLine[]) {
  const openQty = getOpenQty(mpn, poLines)

  if (openQty === null) return null

  const remaining = toScaled(openQty) - toScaled(getReceivedQty(mpn, items))

  return remaining > 0 ? remaining / 1e6 : null
}

//* parts on the po whose packages add up to more than its open qty
export function getOverReceivedParts(items: MatchItem[], poLines: MatchPoLine[]): PartQty[] {
  const parts = [...new Set(items.map((item) => item.mpn.trim().toUpperCase()))]

  return parts.flatMap((mpn) => {
    const openQty = getOpenQty(mpn, poLines)
    const receivedQty = getReceivedQty(mpn, items)
    return openQty !== null && toScaled(receivedQty) > toScaled(openQty) ? [{ mpn, receivedQty, openQty }] : []
  })
}

//* parts on the po whose packages add up to less than its open qty, none received counts too
export function getShortParts(items: MatchItem[], poLines: MatchPoLine[]): PartQty[] {
  const parts = [...new Set(poLines.map((line) => line.ItemCode.trim().toUpperCase()))]

  return parts.flatMap((mpn) => {
    const openQty = getOpenQty(mpn, poLines) ?? 0
    const receivedQty = getReceivedQty(mpn, items)
    return toScaled(receivedQty) < toScaled(openQty) ? [{ mpn, receivedQty, openQty }] : []
  })
}
