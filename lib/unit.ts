//* pdf points, 72 per inch

export function inchToPt(inch: number) {
  return inch * 72
}

export function mmToPt(mm: number) {
  return (mm * 72) / 25.4
}
