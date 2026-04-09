type SerialConnectionStatus = 'connected' | 'disconnected' | 'connecting'

type LineHandler = (line: string) => void
type StatusHandler = (status: SerialConnectionStatus) => void

const SERIAL_LINE_BREAK = /\r?\n/

export class WebSerialConnection {
  private port: SerialPort | null = null
  private reader: ReadableStreamDefaultReader<Uint8Array<ArrayBufferLike>> | null = null
  private keepReading = false
  private status: SerialConnectionStatus = 'disconnected'
  private lineHandlers = new Set<LineHandler>()
  private statusHandlers = new Set<StatusHandler>()

  getStatus(): SerialConnectionStatus {
    return this.status
  }

  async connect(baudRate: number): Promise<void> {
    if (!navigator.serial) {
      throw new Error('Web Serial API is not available in this browser.')
    }

    if (this.status !== 'disconnected') {
      return
    }

    this.setStatus('connecting')

    try {
      this.port = await navigator.serial.requestPort()
      await this.port.open({ baudRate })
      // Some boards only begin streaming reliably once control signals are asserted.
      if (this.port.setSignals) {
        await this.port
          .setSignals({
            dataTerminalReady: true,
            requestToSend: true,
          })
          .catch(() => undefined)
      }

      if (!this.port.readable) {
        throw new Error(
          'Opened port has no readable serial stream. Select the usbmodem data interface and make sure no other app is holding it.',
        )
      }

      this.setStatus('connected')
      void this.startReadingLoop().catch(async () => {
        if (this.status !== 'disconnected') {
          await this.disconnect()
        }
      })
    } catch (error) {
      this.setStatus('disconnected')
      throw error
    }
  }

  async disconnect(): Promise<void> {
    this.keepReading = false

    if (this.reader) {
      await this.reader.cancel().catch(() => undefined)
      this.reader.releaseLock()
      this.reader = null
    }

    if (this.port) {
      await this.port.close().catch(() => undefined)
      this.port = null
    }

    this.setStatus('disconnected')
  }

  onLine(handler: LineHandler): () => void {
    this.lineHandlers.add(handler)
    return () => {
      this.lineHandlers.delete(handler)
    }
  }

  onStatusChange(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler)
    return () => {
      this.statusHandlers.delete(handler)
    }
  }

  private async startReadingLoop(): Promise<void> {
    if (!this.port?.readable) return

    this.reader = this.port.readable.getReader()
    this.keepReading = true
    const decoder = new TextDecoder()

    let buffer = ''

    while (this.keepReading && this.reader) {
      try {
        const { value, done } = await this.reader.read()
        if (done) {
          break
        }

        if (!value) {
          continue
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split(SERIAL_LINE_BREAK)
        buffer = lines.pop() ?? ''
        lines.forEach((line) => this.emitLine(line))
      } catch {
        break
      }
    }

    if (this.status !== 'disconnected') {
      await this.disconnect()
    }
  }

  private emitLine(line: string): void {
    this.lineHandlers.forEach((handler) => handler(line))
  }

  private setStatus(status: SerialConnectionStatus): void {
    this.status = status
    this.statusHandlers.forEach((handler) => handler(status))
  }
}
