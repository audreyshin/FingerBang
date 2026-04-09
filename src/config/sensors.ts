import type { SensorDefinition } from '../types/sensor'

// Add future sensors here (imu, pressure, etc) using the same schema.
export const SENSOR_DEFINITIONS: SensorDefinition[] = [
  {
    id: 'flex-a0',
    label: 'Flex Sensor A0',
    type: 'flex',
    fieldMapping: {
      raw: {
        Raw: 'raw',
        Min: 'min',
        Max: 'max',
        BiDirectional_Value: 'biDirectional',
      },
      normalized: {},
    },
    calibrationField: 'raw',
  },
]

export const DEFAULT_BAUD_RATE = 9600
