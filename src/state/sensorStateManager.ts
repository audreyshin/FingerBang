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
        historySource === undefined
          ? current.history
          : [...current.history, historySource].slice(-MAX_HISTORY_POINTS)

      const ax = action.packet.rawValues.accelX
      const ay = action.packet.rawValues.accelY
      const az = action.packet.rawValues.accelZ
      const accelHistory =
        ax !== undefined && ay !== undefined && az !== undefined
          ? {
              x: [...current.accelHistory.x, ax].slice(-MAX_HISTORY_POINTS),
              y: [...current.accelHistory.y, ay].slice(-MAX_HISTORY_POINTS),
              z: [...current.accelHistory.z, az].slice(-MAX_HISTORY_POINTS),
            }
          : current.accelHistory

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
