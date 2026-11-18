import 'server-only'

import QRCode from 'qrcode'

//* one svg path covering every black square, offset by the quiet zone
export function getQrPath(value: string, quietZone: number) {
  const { modules } = QRCode.create(value, { errorCorrectionLevel: 'M' })
  const commands: string[] = []

  for (let row = 0; row < modules.size; row++) {
    for (let col = 0; col < modules.size; col++) {
      if (modules.get(row, col)) commands.push(`M${col + quietZone} ${row + quietZone}h1v1h-1z`)
    }
  }

  return { viewSize: modules.size + quietZone * 2, d: commands.join('') }
}
