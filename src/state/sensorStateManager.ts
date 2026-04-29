import { useCallback, useReducer } from 'react'
import type {
  ConnectionStatus,
  SensorDataPacket,
  SensorDefinition,
  SensorRuntimeState,
} from '../types/sensor'

interface SensorStateStore {
  sensors: Record<string, SensorRuntimeState>
}

type SensorAction =
  | { type: 'initialize'; sensors: SensorDefinition[] }
  | { type: 'setConnectionStatus'; sensorId: string; status: ConnectionStatus }
  | { type: 'updateSensorData'; sensorId: string; packet: SensorDataPacket; calibrationField?: string }
  | { type: 'resetSensorData'; sensorId: string }

const MAX_HISTORY_POINTS = 180

/* IMU tilt/shake derivation (disabled — was for audio mapping; re-enable with App.tsx IMU FX)
const TILT_LOW_PASS_ALPHA = 0.11
const deriveImuMotionScores = (...) => { ... }
*/

const createInitialSensorState = (sensor: SensorDefinition): SensorRuntimeState => ({
  id: sensor.id,
  label: sensor.label,
  type: sensor.type,
  connectionStatus: 'disconnected',
  rawValues: {},
  normalizedValues: {},
  calibration: {
    minDetected: null,
    maxDetected: null,
  },
  history: [],
  accelHistory: { x: [], y: [], z: [] },
  imuLowPass: null,
  tiltHistory: [],
  shakeHistory: [],
  imuMotion: { tilt: 0, shake: 0 },
  lastUpdatedAt: null,
})

const reducer = (state: SensorStateStore, action: SensorAction): SensorStateStore => {
  switch (action.type) {
    case 'initialize': {
      const sensors = action.sensors.reduce<Record<string, SensorRuntimeState>>((acc, sensorDefinition) => {
        acc[sensorDefinition.id] = createInitialSensorState(sensorDefinition)
        return acc
      }, {})

      return { sensors }
    }

    case 'setConnectionStatus': {
      const current = state.sensors[action.sensorId]
      if (!current) {
        return state
      }

      return {
        sensors: {
          ...state.sensors,
          [action.sensorId]: {
            ...current,
            connectionStatus: action.status,
          },
        },
      }
    }

    case 'updateSensorData': {
      const current = state.sensors[action.sensorId]
      if (!current) {
        return state
      }

      const calibrationValue =
        action.calibrationField !== undefined ? action.packet.rawValues[action.calibrationField] : undefined
      const nextMin =
        calibrationValue === undefined
          ? current.calibration.minDetected
          : current.calibration.minDetected === null
            ? calibrationValue
            : Math.min(current.calibration.minDetected, calibrationValue)
      const nextMax =
        calibrationValue === undefined
          ? current.calibration.maxDetected
          : current.calibration.maxDetected === null
            ? calibrationValue
            : Math.max(current.calibration.maxDetected, calibrationValue)
      const historySource = action.packet.rawValues.biDirectional ?? action.packet.normalizedValues.bendPercent
      const history =
        current.type === 'flex' && historySource !== undefined
          ? [...current.history, historySource].slice(-MAX_HISTORY_POINTS)
          : current.history

      const mergedRaw = { ...current.rawValues, ...action.packet.rawValues }
      const ax = mergedRaw.accelX
      const ay = mergedRaw.accelY
      const az = mergedRaw.accelZ

      let accelHistory = current.accelHistory
      const imuLowPass = current.imuLowPass
      const tiltHistory = current.tiltHistory
      const shakeHistory = current.shakeHistory
      const imuMotion = current.imuMotion

      const packetTouchesAccel =
        action.packet.rawValues.accelX !== undefined ||
        action.packet.rawValues.accelY !== undefined ||
        action.packet.rawValues.accelZ !== undefined

      if (packetTouchesAccel && ax !== undefined && ay !== undefined && az !== undefined) {
        accelHistory = {
          x: [...current.accelHistory.x, ax].slice(-MAX_HISTORY_POINTS),
          y: [...current.accelHistory.y, ay].slice(-MAX_HISTORY_POINTS),
          z: [...current.accelHistory.z, az].slice(-MAX_HISTORY_POINTS),
        }
        // const derived = deriveImuMotionScores(ax, ay, az, current.imuLowPass)
        // imuLowPass = derived.imuLowPass
        // imuMotion = { tilt: derived.tilt, shake: derived.shake }
        // tiltHistory = [...current.tiltHistory, derived.tilt].slice(-MAX_HISTORY_POINTS)
        // shakeHistory = [...current.shakeHistory, derived.shake].slice(-MAX_HISTORY_POINTS)
      }

      return {
        sensors: {
          ...state.sensors,
          [action.sensorId]: {
            ...current,
            rawValues: {
              ...current.rawValues,
              ...action.packet.rawValues,
            },
            normalizedValues: {
              ...current.normalizedValues,
              ...action.packet.normalizedValues,
            },
            calibration: {
              minDetected: nextMin,
              maxDetected: nextMax,
            },
            history,
            accelHistory,
            imuLowPass,
            tiltHistory,
            shakeHistory,
            imuMotion,
            lastUpdatedAt: Date.now(),
          },
        },
      }
    }

    case 'resetSensorData': {
      const current = state.sensors[action.sensorId]
      if (!current) {
        return state
      }

      return {
        sensors: {
          ...state.sensors,
          [action.sensorId]: {
            ...current,
            rawValues: {},
            normalizedValues: {},
            calibration: {
              minDetected: null,
              maxDetected: null,
            },
            history: [],
            accelHistory: { x: [], y: [], z: [] },
            imuLowPass: null,
            tiltHistory: [],
            shakeHistory: [],
            imuMotion: { tilt: 0, shake: 0 },
            lastUpdatedAt: null,
          },
        },
      }
    }

    default:
      return state
  }
}

export interface SensorStateManager {
  state: SensorStateStore
  setSensorConnectionStatus: (sensorId: string, status: ConnectionStatus) => void
  updateSensorData: (sensorId: string, packet: SensorDataPacket, calibrationField?: string) => void
  resetSensorData: (sensorId: string) => void
}

export const useSensorStateManager = (sensorDefinitions: SensorDefinition[]): SensorStateManager => {
  const [state, dispatch] = useReducer(reducer, { sensors: {} }, () => ({
    sensors: sensorDefinitions.reduce<Record<string, SensorRuntimeState>>((acc, definition) => {
      acc[definition.id] = createInitialSensorState(definition)
      return acc
    }, {}),
  }))

  const setSensorConnectionStatus = useCallback((sensorId: string, status: ConnectionStatus) => {
    dispatch({ type: 'setConnectionStatus', sensorId, status })
  }, [])

  const updateSensorData = useCallback((sensorId: string, packet: SensorDataPacket, calibrationField?: string) => {
    dispatch({ type: 'updateSensorData', sensorId, packet, calibrationField })
  }, [])

  const resetSensorData = useCallback((sensorId: string) => {
    dispatch({ type: 'resetSensorData', sensorId })
  }, [])

  return {
    state,
    setSensorConnectionStatus,
    updateSensorData,
    resetSensorData,
  }
}
