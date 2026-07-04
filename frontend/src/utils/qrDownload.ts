import QRCode from 'qrcode'

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('No se pudo cargar el QR generado'))
    image.src = src
  })
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text

  let result = text
  while (result.length > 0 && ctx.measureText(`${result}...`).width > maxWidth) {
    result = result.slice(0, -1)
  }
  return `${result.trimEnd()}...`
}

export function qrFileName(nombre: string, uid: string): string {
  const safeName =
    nombre
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'propietario'

  return `qr-${safeName}-${uid}.png`
}

export async function createOwnerQrDataUrl(uid: string, nombre: string): Promise<string> {
  const qrDataUrl = await QRCode.toDataURL(uid, {
    width: 320,
    margin: 2,
    errorCorrectionLevel: 'M',
  })
  const qrImage = await loadImage(qrDataUrl)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('No se pudo preparar la imagen del QR')
  }

  canvas.width = 420
  canvas.height = 500

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.fillStyle = '#0f172a'
  ctx.font = '700 24px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('QR de acceso', canvas.width / 2, 46)

  ctx.fillStyle = '#2563eb'
  ctx.font = '700 22px Arial, sans-serif'
  ctx.fillText(fitText(ctx, nombre, 360), canvas.width / 2, 82)

  ctx.fillStyle = '#475569'
  ctx.font = '600 14px Arial, sans-serif'
  ctx.fillText(`UID: ${uid}`, canvas.width / 2, 110)

  ctx.drawImage(qrImage, 50, 132, 320, 320)

  ctx.fillStyle = '#64748b'
  ctx.font = '500 13px Arial, sans-serif'
  ctx.fillText('La información codificada es únicamente el UID.', canvas.width / 2, 478)

  return canvas.toDataURL('image/png')
}
