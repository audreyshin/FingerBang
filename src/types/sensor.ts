export type SensorType = 'flex' | 'imu' | 'pressure' | 'custom'

export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting'

export interface SensorFieldMapping {
  raw: Record<string, string>
  normalized: Record<string, string>
}

export interface SensorDefinition {
  id: string
  label: string
  type: SensorType
  fieldMapping: SensorFieldMapping
  calibrationField?: string
}

export interface SensorDataPacket {
  rawValues: Record<string, number>
  normalizedValues: Record<string, number>
}

export interface SensorCalibration {
  minDetected: number | null
  maxDetected: number | null
}

export interface SensorRuntimeState {
  id: string
  label: string
  type: SensorType
  connectionStatus: ConnectionStatus
  rawValues: Record<string, number>
  normalizedValues: Record<string, number>
  calibration: SensorCalibration
  history: number[]
  lastUpdatedAt: number | null
}
