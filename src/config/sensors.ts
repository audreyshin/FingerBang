import type { SensorDefinition } from '../types/sensor'

export const FLEX_SENSOR_ID = 'flex-a0'
export const IMU_SENSOR_ID = 'imu-lsm303'

// Add future sensors here (imu, pressure, etc) using the same schema.
export const SENSOR_DEFINITIONS: SensorDefinition[] = [
  {
    id: FLEX_SENSOR_ID,
    label: 'Flex Sensor A0',
    type: 'flex',
    fieldMapping: {
      raw: {
        Flex: 'biDirectional',
        Raw: 'raw',
        Min: 'min',
        Max: 'max',
        BiDirectional_Value: 'biDirectional',
      },
      normalized: {},
    },
    calibrationField: 'raw',
  },
  {
    id: IMU_SENSOR_ID,
    label: 'Accelerometer LSM303',
    type: 'imu',
    fieldMapping: {
      raw: {
        X: 'accelX',
        Y: 'accelY',
        Z: 'accelZ',
      },
      normalized: {},
    },
  },
]

export const DEFAULT_BAUD_RATE = 9600
