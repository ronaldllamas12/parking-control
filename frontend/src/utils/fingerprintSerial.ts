/**
 * ZFM-20 / R307 / AS608 Optical Fingerprint Sensor
 * Communication via Web Serial API (Chrome / Edge 89+)
 *
 * Packet format:
 *   Header(2) + Address(4) + PID(1) + Length(2) + Payload(N) + Checksum(2)
 *   Checksum = sum of PID + Length bytes + Payload bytes
 */

// ── Constants ──────────────────────────────────────────────────────────────────
const HEADER       = [0xEF, 0x01]
const ADDRESS      = [0xFF, 0xFF, 0xFF, 0xFF]
const PID_CMD      = 0x01
const PID_DATA     = 0x02
const PID_ACK      = 0x07
const PID_END      = 0x08

const CMD_GET_IMAGE = 0x01
const CMD_IMG2TZ    = 0x02
const CMD_MATCH     = 0x03
const CMD_REG_MODEL = 0x05
const CMD_UP_CHAR   = 0x08
const CMD_DOWN_CHAR = 0x09

const CC_OK         = 0x00
const CC_NO_FINGER  = 0x02

export const MATCH_THRESHOLD = 40  // ZFM-20 scores 0-200; >40 is a reliable match

// ── Packet builders ────────────────────────────────────────────────────────────
function buildCommand(cmd: number, params: number[] = []): Uint8Array {
  const payload = [cmd, ...params]
  const PL = payload.length + 2
  const body = [PID_CMD, (PL >> 8) & 0xFF, PL & 0xFF, ...payload]
  const sum = body.reduce((s, b) => s + b, 0)
  return new Uint8Array([...HEADER, ...ADDRESS, ...body, (sum >> 8) & 0xFF, sum & 0xFF])
}

function buildDataPkt(pid: number, data: Uint8Array): Uint8Array {
  const PL = data.length + 2
  const body = [pid, (PL >> 8) & 0xFF, PL & 0xFF, ...data]
  const sum = body.reduce((s, b) => s + b, 0)
  return new Uint8Array([...HEADER, ...ADDRESS, ...body, (sum >> 8) & 0xFF, sum & 0xFF])
}

// ── Error class ────────────────────────────────────────────────────────────────
export class FingerprintError extends Error {
  constructor(message: string, public readonly code?: number) {
    super(message)
    this.name = 'FingerprintError'
  }
}

// ── Support check ──────────────────────────────────────────────────────────────
export function isWebSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator
}

// ── Main class ─────────────────────────────────────────────────────────────────
export class FingerprintReader {
  private port: SerialPort | null = null
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null
  private buf: number[] = []

  get connected(): boolean {
    return this.port !== null
  }

  // ── Connection ──────────────────────────────────────────────────────────────
  async connect(baudRate = 57600): Promise<void> {
    if (!isWebSerialSupported()) {
      throw new FingerprintError(
        'Web Serial API no disponible. Usa Google Chrome o Microsoft Edge versión 89+.',
      )
    }
    if (this.connected) await this.disconnect()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serial = (navigator as any).serial as Serial
    try {
      this.port = await serial.requestPort({
        filters: [
          { usbVendorId: 0x10C4 }, // Silicon Labs CP210x
          { usbVendorId: 0x0403 }, // FTDI FT232
          { usbVendorId: 0x1A86 }, // CH340 / CH341
        ],
      })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('cancel') || msg.includes('No port selected')) {
        throw new FingerprintError('Selección cancelada. No se seleccionó ningún puerto.')
      }
      throw new FingerprintError(`No se pudo abrir el puerto: ${msg}`)
    }

    await this.port.open({ baudRate, dataBits: 8, stopBits: 1, parity: 'none' })
    this.reader = this.port.readable!.getReader()
    this.writer = this.port.writable!.getWriter()
    this.buf = []
  }

  async disconnect(): Promise<void> {
    try { this.reader?.releaseLock() } catch { /* ignore */ }
    try { this.writer?.releaseLock() } catch { /* ignore */ }
    try { await this.port?.close() } catch { /* ignore */ }
    this.port = null; this.reader = null; this.writer = null; this.buf = []
  }

  // ── Low-level I/O ───────────────────────────────────────────────────────────
  private async readBytes(n: number, timeoutMs = 4000): Promise<Uint8Array> {
    const deadline = Date.now() + timeoutMs
    while (this.buf.length < n) {
      if (Date.now() > deadline) {
        throw new FingerprintError('Tiempo de espera agotado. Verifica la conexión del lector.')
      }
      const { value, done } = await this.reader!.read()
      if (done) throw new FingerprintError('Puerto cerrado inesperadamente.')
      for (const b of value) this.buf.push(b)
    }
    return new Uint8Array(this.buf.splice(0, n))
  }

  /** Read one ACK packet from the sensor. */
  private async readAck(): Promise<{ confirmCode: number; data: Uint8Array }> {
    // Sync to header 0xEF 0x01
    for (let i = 0; i < 64; i++) {
      const b1 = (await this.readBytes(1))[0]
      if (b1 !== 0xEF) continue
      const b2 = (await this.readBytes(1))[0]
      if (b2 !== 0x01) continue
      await this.readBytes(4)                          // address (discard)
      const pidB  = (await this.readBytes(1))[0]
      if (pidB !== PID_ACK) continue
      const lenB = await this.readBytes(2)
      const PL = (lenB[0] << 8) | lenB[1]
      const body = await this.readBytes(PL)            // payload + checksum(2)
      const confirmCode = body[0]
      const data = body.slice(1, PL - 2)
      return { confirmCode, data }
    }
    throw new FingerprintError('No se recibió respuesta válida del lector.')
  }

  /** Read one data or end-of-data packet. */
  private async readDataPkt(timeoutMs = 5000): Promise<{ pid: number; data: Uint8Array }> {
    for (let i = 0; i < 64; i++) {
      const b1 = (await this.readBytes(1, timeoutMs))[0]
      if (b1 !== 0xEF) continue
      const b2 = (await this.readBytes(1))[0]
      if (b2 !== 0x01) continue
      await this.readBytes(4)
      const pid = (await this.readBytes(1))[0]
      const lenB = await this.readBytes(2)
      const PL = (lenB[0] << 8) | lenB[1]
      const body = await this.readBytes(PL)
      const data = body.slice(0, PL - 2)               // exclude checksum
      return { pid, data }
    }
    throw new FingerprintError('No se recibió paquete de datos del lector.')
  }

  // ── Commands ────────────────────────────────────────────────────────────────
  private async sendCmd(
    cmd: number,
    params: number[] = [],
  ): Promise<{ confirmCode: number; data: Uint8Array }> {
    await this.writer!.write(buildCommand(cmd, params))
    return this.readAck()
  }

  /** Wait for a finger and capture its image into the sensor buffer. */
  async getImage(timeoutMs = 12000): Promise<void> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      const { confirmCode } = await this.sendCmd(CMD_GET_IMAGE)
      if (confirmCode === CC_OK) return
      if (confirmCode === CC_NO_FINGER) {
        await new Promise((r) => setTimeout(r, 250))
        continue
      }
      throw new FingerprintError(`Error capturando imagen: 0x${confirmCode.toString(16)}`, confirmCode)
    }
    throw new FingerprintError('Tiempo agotado esperando el dedo. Coloca el dedo sobre el sensor.')
  }

  /** Convert last captured image to template → stored in sensor CharBuffer 1 or 2. */
  async img2Tz(buffer: 1 | 2): Promise<void> {
    const { confirmCode } = await this.sendCmd(CMD_IMG2TZ, [buffer])
    if (confirmCode !== CC_OK) {
      throw new FingerprintError(
        'Huella poco clara. Presiona el dedo firmemente sobre el sensor e intenta de nuevo.',
        confirmCode,
      )
    }
  }

  /** Generate fingerprint model from CharBuffer1 + CharBuffer2 into CharBuffer1. */
  async regModel(): Promise<void> {
    const { confirmCode } = await this.sendCmd(CMD_REG_MODEL)
    if (confirmCode !== CC_OK) {
      throw new FingerprintError(
        'Las dos capturas no coinciden. Retira el dedo e intenta de nuevo con el mismo dedo.',
        confirmCode,
      )
    }
  }

  /** Upload template bytes from sensor CharBuffer to this computer. */
  async upChar(buffer: 1 | 2): Promise<Uint8Array> {
    const { confirmCode } = await this.sendCmd(CMD_UP_CHAR, [buffer])
    if (confirmCode !== CC_OK) {
      throw new FingerprintError(`Error subiendo template: 0x${confirmCode.toString(16)}`, confirmCode)
    }
    const chunks: number[] = []
    for (;;) {
      const { pid, data } = await this.readDataPkt()
      chunks.push(...data)
      if (pid === PID_END) break
      if (pid !== PID_DATA) throw new FingerprintError(`PID inesperado: 0x${pid.toString(16)}`)
    }
    return new Uint8Array(chunks)
  }

  /** Download template bytes from this computer to sensor CharBuffer. */
  async downChar(buffer: 1 | 2, template: Uint8Array): Promise<void> {
    const { confirmCode } = await this.sendCmd(CMD_DOWN_CHAR, [buffer])
    if (confirmCode !== CC_OK) {
      throw new FingerprintError(`Error iniciando descarga: 0x${confirmCode.toString(16)}`)
    }
    const CHUNK = 128
    for (let off = 0; off < template.length; off += CHUNK) {
      const slice = template.slice(off, off + CHUNK)
      const isLast = off + CHUNK >= template.length
      await this.writer!.write(buildDataPkt(isLast ? PID_END : PID_DATA, slice))
    }
    await new Promise((r) => setTimeout(r, 100))
    const { confirmCode: ack } = await this.readAck()
    if (ack !== CC_OK) throw new FingerprintError(`Error en descarga: 0x${ack.toString(16)}`)
  }

  /** Compare CharBuffer1 vs CharBuffer2 on the sensor. Returns match score or 0. */
  async match(): Promise<number> {
    const { confirmCode, data } = await this.sendCmd(CMD_MATCH)
    if (confirmCode === 0x08) return 0  // no match
    if (confirmCode !== CC_OK) throw new FingerprintError(`Error en comparación: 0x${confirmCode.toString(16)}`)
    return (data[0] << 8) | data[1]
  }

  // ── High-level operations ───────────────────────────────────────────────────

  /**
   * Enrollment step 1: capture first impression → stores in CharBuffer1.
   * Call this, show "remove finger" in UI, then call enrollStep2().
   */
  async enrollStep1(): Promise<void> {
    await this.getImage()
    await this.img2Tz(1)
  }

  /**
   * Enrollment step 2: capture second impression → creates model → returns template bytes.
   * Store the returned bytes (base64-encoded) in your database.
   */
  async enrollStep2(): Promise<Uint8Array> {
    await this.getImage()
    await this.img2Tz(2)
    await this.regModel()
    return this.upChar(1)
  }

  /**
   * Capture one fingerprint and return its raw template bytes.
   * After this call, CharBuffer1 on the sensor holds the template.
   */
  async captureOnce(): Promise<Uint8Array> {
    await this.getImage()
    await this.img2Tz(1)
    return this.upChar(1)
  }

  /**
   * Search all stored templates for the finger currently on the sensor.
   * Prerequisite: captureOnce() must have been called (CharBuffer1 loaded).
   *
   * @param templates  list of {uid, templateBytes} from the database
   * @param onProgress callback(0-100) for a progress bar
   * @returns best match {uid, score} or null if none exceeded MATCH_THRESHOLD
   */
  async identifyFromBuffer(
    templates: Array<{ uid: string; templateBytes: Uint8Array }>,
    onProgress?: (pct: number) => void,
  ): Promise<{ uid: string; score: number } | null> {
    let best: { uid: string; score: number } | null = null
    for (let i = 0; i < templates.length; i++) {
      onProgress?.(Math.round((i / templates.length) * 100))
      await this.downChar(2, templates[i].templateBytes)
      const score = await this.match()
      if (score >= MATCH_THRESHOLD && (!best || score > best.score)) {
        best = { uid: templates[i].uid, score }
      }
    }
    onProgress?.(100)
    return best
  }
}
