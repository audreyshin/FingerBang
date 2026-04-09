import { useEffect, useMemo, useRef, useState } from 'react'
import { ConnectionPanel } from './components/ConnectionPanel'
import { SensorCard } from './components/SensorCard'
import { DEFAULT_BAUD_RATE, SENSOR_DEFINITIONS } from './config/sensors'
import { mapParsedValuesToSensorPacket, parseKeyValueSerialLine } from './parsers/serialLineParser'
import { WebSerialConnection } from './services/webSerialConnection'
import { useSensorStateManager } from './state/sensorStateManager'
import './App.css'

function App() {
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [debugEvents, setDebugEvents] = useState<string[]>([])
  const serialConnectionRef = useRef<WebSerialConnection | null>(null)
  const noDataTimeoutRef = useRef<number | null>(null)
  const hasReceivedSerialRef = useRef(false)

  const hasWebSerial = typeof navigator !== 'undefined' && Boolean(navigator.serial)
  const { state, setSensorConnectionStatus, updateSensorData, resetSensorData } = useSensorStateManager(
    SENSOR_DEFINITIONS,
  )

  const primarySensor = useMemo(() => SENSOR_DEFINITIONS[0], [])
  const primarySensorState = state.sensors[primarySensor.id]
  const pushDebugEvent = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setDebugEvents((prev) => [...prev.slice(-11), `${timestamp} - ${message}`])
  }
  const clearNoDataTimeout = () => {
    if (noDataTimeoutRef.current !== null) {
      window.clearTimeout(noDataTimeoutRef.current)
      noDataTimeoutRef.current = null
    }
  }
  const armNoDataTimeout = () => {
    clearNoDataTimeout()
    hasReceivedSerialRef.current = false
    noDataTimeoutRef.current = window.setTimeout(() => {
      if (hasReceivedSerialRef.current) {
        return
      }

      const warning =
        'Connected, but no serial lines after 15s. Usually wrong serial interface or another app still holding the port.'
      setConnectionError(warning)
      pushDebugEvent(warning)
    }, 15000)
  }

  useEffect(() => {
    const serialConnection = new WebSerialConnection()
    serialConnectionRef.current = serialConnection

    const disposeStatus = serialConnection.onStatusChange((status) => {
      pushDebugEvent(`Status changed to ${status}`)
      setSensorConnectionStatus(primarySensor.id, status)
      if (status === 'disconnected') {
        clearNoDataTimeout()
        hasReceivedSerialRef.current = false
        resetSensorData(primarySensor.id)
      }
    })

    const disposeLine = serialConnection.onLine((line) => {
      if (!hasReceivedSerialRef.current) {
        hasReceivedSerialRef.current = true
        clearNoDataTimeout()
        pushDebugEvent('First serial line received')
      }

      if (line.trim()) {
        pushDebugEvent(`Serial line: ${line.trim()}`)
      }

      const parsed = parseKeyValueSerialLine(line)
      if (!parsed) {
        pushDebugEvent('Ignored line (not key:value format)')
        return
      }

      const packet = mapParsedValuesToSensorPacket(parsed, primarySensor)
      if (Object.keys(packet.rawValues).length === 0 && Object.keys(packet.normalizedValues).length === 0) {
        pushDebugEvent('Parsed line had no mapped sensor fields')
        return
      }

      // Future mapping layer should subscribe to sensor state, not serial lines.
      updateSensorData(primarySensor.id, packet, primarySensor.calibrationField)
    })

    return () => {
      clearNoDataTimeout()
      disposeStatus()
      disposeLine()
      void serialConnection.disconnect()
      serialConnectionRef.current = null
    }
  }, [primarySensor, resetSensorData, setSensorConnectionStatus, updateSensorData])

  const connect = async () => {
    setConnectionError(null)
    pushDebugEvent('Connect button pressed')
    const serialConnection = serialConnectionRef.current
    if (!serialConnection) {
      pushDebugEvent('No serial connection instance available')
      return
    }

    try {
      await serialConnection.connect(DEFAULT_BAUD_RATE)
      armNoDataTimeout()
      pushDebugEvent(`Port open at ${DEFAULT_BAUD_RATE} baud`)
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : 'Unable to connect to serial device.')
      pushDebugEvent(error instanceof Error ? `Connect failed: ${error.message}` : 'Connect failed')
    }
  }

  const disconnect = async () => {
    setConnectionError(null)
    pushDebugEvent('Disconnect button pressed')
    const serialConnection = serialConnectionRef.current
    if (!serialConnection) {
      pushDebugEvent('No serial connection instance available')
      return
    }

    clearNoDataTimeout()
    hasReceivedSerialRef.current = false
    await serialConnection.disconnect()
    resetSensorData(primarySensor.id)
    pushDebugEvent('Disconnected and sensor state reset')
  }

  const appConnectionStatus = primarySensorState?.connectionStatus ?? 'disconnected'

  return (
    <main className="app-shell">
      <header>
        <p className="eyebrow">Fingerbang v1 foundation</p>
        <h1>Sensor Input + Visualization Layer</h1>
        <p className="lead">
          This version only handles generic USB serial connection, data ingestion, and live visualization. No behavior
          mapping is active.
        </p>
      </header>

      <ConnectionPanel
        status={appConnectionStatus}
        canUseWebSerial={hasWebSerial}
        baudRate={DEFAULT_BAUD_RATE}
        onConnect={connect}
        onDisconnect={disconnect}
      />
      {connectionError ? <p className="error">{connectionError}</p> : null}
      <section className="panel notes-panel">
        <h2>Connection Debug</h2>
        <p className="muted">
          If connection is stuck, check the latest events here and confirm Arduino Serial Monitor is closed.
        </p>
        <pre className="muted">{debugEvents.length > 0 ? debugEvents.join('\n') : 'No debug events yet.'}</pre>
      </section>

      <section className="sensor-grid">
        {Object.values(state.sensors).map((sensor) => (
          <SensorCard key={sensor.id} sensor={sensor} />
        ))}
      </section>

      <section className="panel notes-panel">
        <h2>Extension Notes</h2>
        <p>
          To add more sensors, create another sensor definition in <code>src/config/sensors.ts</code> with a unique
          id, type, and field mapping.
        </p>
        <p>
          To add a future mapping layer, subscribe to sensor state updates from the state manager and place all
          behavior logic in a separate module (for example: <code>src/mappings/</code>), keeping input handling
          isolated.
        </p>
      </section>
    </main>
  )
}

export default App
