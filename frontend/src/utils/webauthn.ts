// Helpers for WebAuthn conversion between base64url and ArrayBuffer
export function base64UrlToBuffer(base64url: string): Uint8Array {
  // Pad base64 string
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const pad = base64.length % 4
  if (pad === 2) base64 += '=='
  else if (pad === 3) base64 += '='
  else if (pad !== 0) base64 += '==='

  const binary = atob(base64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function bufferToBase64Url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  let base64 = btoa(binary)
  // Convert to base64url
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export default null
