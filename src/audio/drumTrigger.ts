/** Served from `public/audio/drum.mp3`. */
export const DRUM_SAMPLE_PATH = '/audio/drum.mp3'

/** Minimum ms between accepted hits (still allows overlaps via separate BufferSources). */
export const DRUM_DEBOUNCE_MS = 150

/** ‖Δa‖ between consecutive samples below this (m/s²) ⇒ motion settled → allow next strike. */
export const DRUM_SETTLE_DELTA = 1.15

/** Slider 0% ⇒ hardest (high threshold), 100% ⇒ easiest (low threshold). */
export const DRUM_THRESHOLD_MIN = 2
export const DRUM_THRESHOLD_MAX = 13

/** Default matches ~4.0 m/s² peak sensitivity (see `sensitivityPercentForThreshold(4)`). */
export const DRUM_DEFAULT_SENSITIVITY_PERCENT = 83

export function thresholdFromSensitivityPercent(percent: number): number {
  const p = Math.max(0, Math.min(100, percent)) / 100
  return DRUM_THRESHOLD_MAX - p * (DRUM_THRESHOLD_MAX - DRUM_THRESHOLD_MIN)
}

export function accelDeltaMagnitude(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
): number {
  const dx = bx - ax
  const dy = by - ay
  const dz = bz - az
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

/** Soft hit near threshold → ~0.3 gain; strong jerk → up to 1.0. */
export function drumGainFromJerk(jerkMag: number, threshold: number): number {
  const headroom = jerkMag - threshold
  if (headroom <= 0) return 0.28
  const span = Math.max(5.5, 20 - threshold)
  const t = Math.min(1, headroom / span)
  return Math.min(1, 0.28 + t * 0.72)
}

/** `volumeMult` > 1.0 boosts beyond unity — values up to 2.0 are safe on most systems. */
export function playDrumOneShot(
  context: AudioContext,
  buffer: AudioBuffer,
  gain: number,
  volumeMult = 1,
): void {
  const g = Math.max(0.06, gain) * Math.max(0, volumeMult)
  void context.resume().then(() => {
    const src = context.createBufferSource()
    const gainNode = context.createGain()
    src.buffer = buffer
    const t = context.currentTime
    gainNode.gain.setValueAtTime(g * 0.9, t)
    src.connect(gainNode)
    gainNode.connect(context.destination)
    src.start(t)
  })
}
