import type { SensorDataPacket, SensorDefinition } from '../types/sensor'

const FIELD_DELIMITER = ','
const KEY_VALUE_DELIMITER = ':'

export const parseKeyValueSerialLine = (line: string): Record<string, number> | null => {
  const trimmed = line.trim()
  if (!trimmed.includes(KEY_VALUE_DELIMITER)) {
    return null
  }

  const values = trimmed
    .split(FIELD_DELIMITER)
    .map((part) => part.trim())
    .reduce<Record<string, number>>((acc, entry) => {
      const [rawKey, rawValue] = entry.split(KEY_VALUE_DELIMITER)
      if (!rawKey || rawValue === undefined) {
        return acc
      }

      const parsedValue = Number.parseFloat(rawValue)
      if (Number.isNaN(parsedValue)) {
        return acc
      }

      acc[rawKey.trim()] = parsedValue
      return acc
    }, {})

  return Object.keys(values).length > 0 ? values : null
}

export const mapParsedValuesToSensorPacket = (
  parsedLine: Record<string, number>,
  sensorDefinition: SensorDefinition,
): SensorDataPacket => {
  const rawValues = Object.entries(sensorDefinition.fieldMapping.raw).reduce<Record<string, number>>(
    (acc, [serialKey, sensorKey]) => {
      if (parsedLine[serialKey] !== undefined) {
        acc[sensorKey] = parsedLine[serialKey]
      }
      return acc
    },
    {},
  )

  const normalizedValues = Object.entries(sensorDefinition.fieldMapping.normalized).reduce<
    Record<string, number>
  >((acc, [serialKey, sensorKey]) => {
    if (parsedLine[serialKey] !== undefined) {
      acc[sensorKey] = parsedLine[serialKey]
    }
    return acc
  }, {})

  // Backwards-compatible fallback for Arduino sketch variants.
  // If Bend_Percent is not present, derive 0-100 bendPercent from known signed outputs.
  if (normalizedValues.bendPercent === undefined) {
    const fallbackValue =
      parsedLine.Negative_Bend ?? parsedLine.BiDirectional_Value ?? parsedLine.Centered_View

    if (fallbackValue !== undefined) {
      normalizedValues.bendPercent = Math.max(0, Math.min(100, Math.abs(fallbackValue)))
    }
  }

  return { rawValues, normalizedValues }
}
