import type { SensorDataPacket, SensorDefinition } from '../types/sensor'

/** Key/value pairs with `:` or `=` (some sketches use equals; `=` lines used to fail the `:`-only gate) */
const SERIAL_FIELD_PATTERN = /([A-Za-z_][A-Za-z0-9_]*)\s*[:=]\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g

/** Single-letter axes with optional space: `X:1`, `X = 1`, `x=1` */
const AXIS_LETTER_PATTERN = /\b([xyzXYZ])\s*[:=]\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g

/** Map common sketch variants to the keys our sensor defs expect */
const normalizeSerialKeys = (parsed: Record<string, number>): Record<string, number> => {
  const copy = { ...parsed }
  const alias = (canonical: string, ...alternates: string[]) => {
    if (copy[canonical] !== undefined) return
    for (const alt of alternates) {
      if (copy[alt] !== undefined) {
        copy[canonical] = copy[alt]!
        return
      }
    }
  }
  alias('X', 'x', 'Ax', 'ax', 'AX', 'ACCEL_X', 'Accel_X', 'accX')
  alias('Y', 'y', 'Ay', 'ay', 'AY', 'ACCEL_Y', 'Accel_Y', 'accY')
  alias('Z', 'z', 'Az', 'az', 'AZ', 'ACCEL_Z', 'Accel_Z', 'accZ')
  alias('Flex', 'flex', 'FLEX', 'bend', 'Bend')
  alias('BiDirectional_Value', 'Centered_View')
  return copy
}

const mergeAxisLetters = (line: string, target: Record<string, number>): void => {
  for (const match of line.matchAll(AXIS_LETTER_PATTERN)) {
    const letter = match[1]!.toUpperCase()
    const parsedValue = Number.parseFloat(match[2]!)
    if (Number.isNaN(parsedValue)) continue
    if (letter === 'X') target.X = parsedValue
    if (letter === 'Y') target.Y = parsedValue
    if (letter === 'Z') target.Z = parsedValue
  }
}

export const parseKeyValueSerialLine = (line: string): Record<string, number> | null => {
  const trimmed = line.trim()
  if (!trimmed || !/[:=]/.test(trimmed)) {
    return null
  }

  const values = Array.from(trimmed.matchAll(SERIAL_FIELD_PATTERN)).reduce<Record<string, number>>((acc, match) => {
    const [, rawKey, rawValue] = match
    const parsedValue = Number.parseFloat(rawValue)
    if (Number.isNaN(parsedValue)) {
      return acc
    }

    acc[rawKey.trim()] = parsedValue
    return acc
  }, {})

  mergeAxisLetters(trimmed, values)

  if (Object.keys(values).length === 0) {
    return null
  }

  return normalizeSerialKeys(values)
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

  // Backwards-compatible fallback for flex-only Arduino sketch variants.
  // (Do not run for IMU defs — same line often includes Flex + X/Y/Z and would corrupt IMU history.)
  if (
    sensorDefinition.type === 'flex' &&
    normalizedValues.bendPercent === undefined
  ) {
    const fallbackValue =
      parsedLine.Negative_Bend ??
      parsedLine.BiDirectional_Value ??
      parsedLine.Centered_View ??
      parsedLine.Flex

    if (fallbackValue !== undefined) {
      normalizedValues.bendPercent = Math.max(0, Math.min(100, Math.abs(fallbackValue)))
    }
  }

  return { rawValues, normalizedValues }
}
