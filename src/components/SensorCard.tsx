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

export function SensorCard({ sensor }: SensorCardProps) {
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
