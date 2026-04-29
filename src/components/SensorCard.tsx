import { LiveBar } from './LiveBar'
import type { SensorRuntimeState } from '../types/sensor'

interface SensorCardProps {
  sensor: SensorRuntimeState
}

const formatNumber = (value: number | null | undefined, digits = 2): string => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '--'
  }

  return value.toFixed(digits)
}

const ACCEL_GRAPH_W = 520
const ACCEL_GRAPH_H = 160

const seriesToPoints = (values: number[], className: string): { points: string; className: string } | null => {
  if (values.length < 2) {
    return null
  }

  let min = Math.min(...values)
  let max = Math.max(...values)
  if (max - min < 0.02) {
    min -= 0.1
    max += 0.1
  }

  const span = max - min
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * ACCEL_GRAPH_W
      const t = (v - min) / span
      const y = ACCEL_GRAPH_H - t * (ACCEL_GRAPH_H - 8) - 4
      return `${x},${y}`
    })
    .join(' ')

  return { points: pts, className }
}

function ImuSensorCard({ sensor }: { sensor: SensorRuntimeState }) {
  const x = sensor.rawValues.accelX
  const y = sensor.rawValues.accelY
  const z = sensor.rawValues.accelZ
  const h = sensor.accelHistory

  const serialStrip =
    x !== undefined && y !== undefined && z !== undefined
      ? `X:${x.toFixed(2)}  Y:${y.toFixed(2)}  Z:${z.toFixed(2)}`
      : 'Waiting for X:, Y:, Z: on the serial line…'

  const xLine = seriesToPoints(h.x, 'accel-trend-x')
  const yLine = seriesToPoints(h.y, 'accel-trend-y')
  const zLine = seriesToPoints(h.z, 'accel-trend-z')

  return (
    <section className="panel sensor-card sensor-card--imu">
      <div className="row">
        <h2>{sensor.label}</h2>
        <span className={`status-dot status-${sensor.connectionStatus}`}>
          {sensor.connectionStatus === 'connected' ? 'linked' : sensor.connectionStatus === 'connecting' ? 'linking...' : 'unlinked'}
        </span>
      </div>
      <p className="imu-serial-strip" title="Live acceleration (m/s²), same idea as Serial Monitor before mapping">
        {serialStrip}
      </p>
      <div className="metrics-grid imu-metrics">
        <article>
          <h3>X (m/s²)</h3>
          <p>{formatNumber(x, 2)}</p>
        </article>
        <article>
          <h3>Y (m/s²)</h3>
          <p>{formatNumber(y, 2)}</p>
        </article>
        <article>
          <h3>Z (m/s²)</h3>
          <p>{formatNumber(z, 2)}</p>
        </article>
      </div>
      <div className="viz-group">
        <h3>Axis fluctuation (each line scaled to its own min/max in the window)</h3>
        <div className="accel-trend-legend">
          <span className="accel-legend accel-legend-x">X</span>
          <span className="accel-legend accel-legend-y">Y</span>
          <span className="accel-legend accel-legend-z">Z</span>
        </div>
        <svg className="accel-trend-graph" viewBox={`0 0 ${ACCEL_GRAPH_W} ${ACCEL_GRAPH_H}`} preserveAspectRatio="none">
          <line className="accel-trend-midline" x1="0" y1={ACCEL_GRAPH_H / 2} x2={ACCEL_GRAPH_W} y2={ACCEL_GRAPH_H / 2} />
          {xLine ? <polyline className={xLine.className} points={xLine.points} /> : null}
          {yLine ? <polyline className={yLine.className} points={yLine.points} /> : null}
          {zLine ? <polyline className={zLine.className} points={zLine.points} /> : null}
        </svg>
      </div>
    </section>
  )
}

export function SensorCard({ sensor }: SensorCardProps) {
  if (sensor.type === 'imu') {
    return <ImuSensorCard sensor={sensor} />
  }

  const bendPercent = sensor.normalizedValues.bendPercent ?? 0
  const biDirectionalValue = sensor.rawValues.biDirectional ?? 0

  return (
    <section className="panel sensor-card">
      <div className="row">
        <h2>{sensor.label}</h2>
        <span className={`status-dot status-${sensor.connectionStatus}`}>
          {sensor.connectionStatus === 'connected' ? 'linked' : sensor.connectionStatus === 'connecting' ? 'linking...' : 'unlinked'}
        </span>
      </div>
      <div className="metrics-grid">
        <article>
          <h3>Raw</h3>
          <p>{formatNumber(sensor.rawValues.raw, 0)}</p>
        </article>
        <article>
          <h3>Min</h3>
          <p>{formatNumber(sensor.rawValues.min, 0)}</p>
        </article>
        <article>
          <h3>Max</h3>
          <p>{formatNumber(sensor.rawValues.max, 0)}</p>
        </article>
        <article>
          <h3>Direction</h3>
          <p>{formatNumber(biDirectionalValue, 0)}</p>
        </article>
        <article>
          <h3>Bend %</h3>
          <p className="large">{formatNumber(bendPercent, 1)}</p>
        </article>
      </div>

      <div className="calibration-grid">
        <div>
          <span className="cal-label">Min Detected</span>
          <strong>{formatNumber(sensor.calibration.minDetected, 0)}</strong>
        </div>
        <div>
          <span className="cal-label">Max Detected</span>
          <strong>{formatNumber(sensor.calibration.maxDetected, 0)}</strong>
        </div>
      </div>

      <div className="viz-group">
        <h3>Bidirectional Bend (-100 to 100)</h3>
        <LiveBar value={biDirectionalValue} />
      </div>
    </section>
  )
}
