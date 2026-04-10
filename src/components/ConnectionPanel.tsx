import type { ConnectionStatus } from '../types/sensor'

interface ConnectionPanelProps {
  status: ConnectionStatus
  canUseWebSerial: boolean
  baudRate: number
  onConnect: () => Promise<void>
  onDisconnect: () => Promise<void>
}

const getStatusText = (status: ConnectionStatus): string => {
  if (status === 'connected') return 'Linked'
  if (status === 'connecting') return 'Linking...'
  return 'Unlinked'
}

export function ConnectionPanel({
  status,
  canUseWebSerial,
  baudRate,
  onConnect,
  onDisconnect,
}: ConnectionPanelProps) {
  const isConnected = status === 'connected'

  return (
    <section className="panel connection-panel">
      <div className="row">
        <h2>Serial Connection</h2>
        <span className={`status-badge status-${status}`}>{getStatusText(status)}</span>
      </div>
      <p className="muted">
        Baud rate: <strong>{baudRate}</strong>
      </p>
      <p className="muted">Select any available USB serial port (for example: usbmodem or COM).</p>
      {!canUseWebSerial ? (
        <p className="warning">
          Web Serial is unavailable in this browser. Use a Chromium-based browser over HTTPS or localhost.
        </p>
      ) : (
        <div className="row gap-sm">
          <button onClick={() => void onConnect()} disabled={isConnected || status === 'connecting'}>
            Connect Serial Device
          </button>
          <button className="secondary" onClick={() => void onDisconnect()} disabled={!isConnected}>
            Disconnect
          </button>
        </div>
      )}
    </section>
  )
}
