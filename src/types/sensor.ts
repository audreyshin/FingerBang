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

export interface AccelHistory {
  x: number[]
  y: number[]
  z: number[]
}

export interface ImuMotionScores {
  /** 0–100: slow orientation / gravity tilt — mapped to riser in audio */
  tilt: number
  /** 0–100: fast high-pass energy — mapped to stutter chop in audio */
  shake: number
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
  accelHistory: AccelHistory
  /** Low-pass gravity estimate; updated when accel samples arrive */
  imuLowPass: { x: number; y: number; z: number } | null
  tiltHistory: number[]
  shakeHistory: number[]
  imuMotion: ImuMotionScores
  lastUpdatedAt: number | null
}
