interface SerialPort {
  open(options: { baudRate: number }): Promise<void>
  close(): Promise<void>
  setSignals?(signals: { dataTerminalReady?: boolean; requestToSend?: boolean }): Promise<void>
  readable: ReadableStream<Uint8Array> | null
  writable: WritableStream<Uint8Array> | null
}

interface Serial extends EventTarget {
  requestPort(options?: { filters: Array<{ usbVendorId?: number; usbProductId?: number }> }): Promise<SerialPort>
}

interface Navigator {
  serial?: Serial
}
