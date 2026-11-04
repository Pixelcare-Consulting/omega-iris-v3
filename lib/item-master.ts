//* the route param of an encoded p/n, a bad escape falls back to the raw value
export function decodeItemMasterCode(code: string) {
  try {
    return decodeURIComponent(code)
  } catch {
    return code
  }
}
