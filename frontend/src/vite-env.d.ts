/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_API_TARGET: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface SerialPort {
  readable: ReadableStream<Uint8Array> | null
  writable: WritableStream<Uint8Array> | null
  open(options: {
    baudRate: number
    dataBits?: number
    stopBits?: number
    parity?: 'none' | 'even' | 'odd'
  }): Promise<void>
  close(): Promise<void>
}

interface Serial {
  requestPort(options?: {
    filters?: Array<{
      usbVendorId?: number
      usbProductId?: number
    }>
  }): Promise<SerialPort>
}
