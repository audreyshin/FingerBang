import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ConnectionPanel } from './components/ConnectionPanel'
import { SensorCard } from './components/SensorCard'
import {
  DRUM_DEBOUNCE_MS,
  DRUM_DEFAULT_SENSITIVITY_PERCENT,
  DRUM_SAMPLE_PATH,
  DRUM_SETTLE_DELTA,
  DRUM_THRESHOLD_MAX,
  DRUM_THRESHOLD_MIN,
  accelDeltaMagnitude,
  drumGainFromJerk,
  playDrumOneShot,
  thresholdFromSensitivityPercent,
} from './audio/drumTrigger'
import { DEFAULT_BAUD_RATE, FLEX_SENSOR_ID, IMU_SENSOR_ID, SENSOR_DEFINITIONS } from './config/sensors'
import { mapParsedValuesToSensorPacket, parseKeyValueSerialLine } from './parsers/serialLineParser'
import { WebSerialConnection } from './services/webSerialConnection'
import { useSensorStateManager } from './state/sensorStateManager'
import './App.css'

type TrackId =
  | 'danzaKuduro'
  | 'tocaToca'
  | 'yQueFue'
  | 'replay'
  | 'levels'
  | 'goodFeeling'
  | 'tears'
  | 'breakFree'
  | 'oneMoreTime'
  | 'fisherLosingIt'

interface CuePoint {
  label: string
  ratio: number
}

interface TrackMetadata {
  title: string
  artist: string
  path: string
  bpm: number
  cues: CuePoint[]
}

const TRACK_IDS: TrackId[] = [
  'danzaKuduro',
  'tocaToca',
  'yQueFue',
  'replay',
  'levels',
  'goodFeeling',
  'tears',
  'breakFree',
  'oneMoreTime',
  'fisherLosingIt',
]

const TRACK_LIBRARY: Record<TrackId, TrackMetadata> = {
  danzaKuduro: {
    title: 'Danza Kuduro',
    artist: 'Don Omar feat. Lucenzo',
    path: '/audio/Danza_Kuduro.mp3',
    bpm: 130,
    cues: [
      { label: 'Cue 1', ratio: 0.12 },
      { label: 'Cue 2', ratio: 0.36 },
      { label: 'Cue 3', ratio: 0.64 },
    ],
  },
  tocaToca: {
    title: 'Toca Toca',
    artist: 'Fly Project',
    path: '/audio/Toca_toca.mp3',
    bpm: 128,
    cues: [
      { label: 'Cue 1', ratio: 0.14 },
      { label: 'Cue 2', ratio: 0.4 },
      { label: 'Cue 3', ratio: 0.7 },
    ],
  },
  yQueFue: {
    title: 'Y Que Fue',
    artist: 'Don Miguelo',
    path: '/audio/Y_Que_Fue.mp3',
    bpm: 124,
    cues: [
      { label: 'Cue 1', ratio: 0.1 },
      { label: 'Cue 2', ratio: 0.34 },
      { label: 'Cue 3', ratio: 0.62 },
    ],
  },
  replay: {
    title: 'Replay',
    artist: 'Iyaz',
    path: '/audio/replay.mp3',
    bpm: 91,
    cues: [
      { label: 'Cue 1', ratio: 0.1 },
      { label: 'Cue 2', ratio: 0.33 },
      { label: 'Cue 3', ratio: 0.58 },
    ],
  },
  levels: {
    title: 'Levels',
    artist: 'Avicii',
    path: '/audio/levels.mp3',
    bpm: 126,
    cues: [
      { label: 'Cue 1', ratio: 0.11 },
      { label: 'Cue 2', ratio: 0.39 },
      { label: 'Cue 3', ratio: 0.68 },
    ],
  },
  goodFeeling: {
    title: 'Good Feeling',
    artist: 'Flo Rida',
    path: '/audio/goodFeeling.mp3',
    bpm: 129,
    cues: [
      { label: 'Cue 1', ratio: 0.1 },
      { label: 'Cue 2', ratio: 0.37 },
      { label: 'Cue 3', ratio: 0.66 },
    ],
  },
  tears: {
    title: 'No Tears Left to Cry',
    artist: 'Ariana Grande',
    path: '/audio/tears.mp3',
    bpm: 122,
    cues: [
      { label: 'Cue 1', ratio: 0.1 },
      { label: 'Cue 2', ratio: 0.35 },
      { label: 'Cue 3', ratio: 0.64 },
    ],
  },
  breakFree: {
    title: 'Break Free',
    artist: 'Ariana Grande feat. Zedd',
    path: '/audio/breakfree.mp3',
    bpm: 130,
    cues: [
      { label: 'Cue 1', ratio: 0.1 },
      { label: 'Cue 2', ratio: 0.36 },
      { label: 'Cue 3', ratio: 0.63 },
    ],
  },
  oneMoreTime: {
    title: 'One More Time',
    artist: 'Daft Punk',
    path: '/audio/daftpunk.mp3',
    bpm: 123,
    cues: [
      { label: 'Cue 1', ratio: 0.12 },
      { label: 'Cue 2', ratio: 0.38 },
      { label: 'Cue 3', ratio: 0.65 },
    ],
  },
  fisherLosingIt: {
    title: 'Losing It (Extended)',
    artist: 'FISHER (OZ)',
    path: '/audio/fisher-losing-it-extended.mp3',
    bpm: 124,
    cues: [
      { label: 'Cue 1', ratio: 0.1 },
      { label: 'Cue 2', ratio: 0.35 },
      { label: 'Cue 3', ratio: 0.62 },
    ],
  },
}

const createPlaybackState = (): Record<TrackId, boolean> =>
  TRACK_IDS.reduce(
    (acc, trackId) => {
      acc[trackId] = false
      return acc
    },
    {} as Record<TrackId, boolean>,
  )

const createTimelineState = (): Record<TrackId, { currentTime: number; duration: number }> =>
  TRACK_IDS.reduce(
    (acc, trackId) => {
      acc[trackId] = { currentTime: 0, duration: 0 }
      return acc
    },
    {} as Record<TrackId, { currentTime: number; duration: number }>,
  )

const createWaveformState = (): Record<TrackId, number[]> =>
  TRACK_IDS.reduce(
    (acc, trackId) => {
      acc[trackId] = Array.from({ length: 28 }, () => 0.08)
      return acc
    },
    {} as Record<TrackId, number[]>,
  )

const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0:00'
  }

  const whole = Math.floor(seconds)
  const mins = Math.floor(whole / 60)
  const secs = whole % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

interface AudioEngine {
  context: AudioContext
  tracks: Record<TrackId, HTMLAudioElement>
  analyzers: Record<TrackId, AnalyserNode>
  filter: BiquadFilterNode
  wetGain: GainNode
  dryGain: GainNode
  reverbNode: ConvolverNode
  flangerDelay: DelayNode
  flangerFeedback: GainNode
  flangerLfo: OscillatorNode
  flangerDepth: GainNode
  fxWetGains: Record<FxType, GainNode>
  drumSample: AudioBuffer | null
}

type FxType = 'reverb' | 'flanger'
type ControlMode = 'filter' | 'bass' | FxType
type BendDirection = 'left' | 'right' | 'center'
type TrainingPrompt = {
  id: string
  time: number
  duration: number
  mode: ControlMode
  direction: BendDirection
}
type TrainingResultStatus = 'hit' | 'miss'
type ProducerTag = {
  id: 'daytrip' | 'f1lthy' | 'voicy' | 'yopierre'
  label: string
  shortLabel: string
  path: string
}

const DRIP_FRAMES_ENABLED = false

const CONTROL_MODE_OPTIONS: Array<{ id: ControlMode; title: string; detail: string }> = [
  { id: 'filter', title: 'Filter', detail: 'muffle / brighten' },
  { id: 'bass', title: 'Bass', detail: 'cut / boost lows' },
  { id: 'reverb', title: 'Reverb', detail: 'dream wash' },
  { id: 'flanger', title: 'Flanger', detail: 'swirl / jet' },
]

const PRODUCER_TAGS: ProducerTag[] = [
  { id: 'daytrip', label: 'Daytrip', shortLabel: 'DT', path: '/audio/daytrip.mp3' },
  { id: 'f1lthy', label: 'F1lthy', shortLabel: 'F1', path: '/audio/f1lthy-producer-tag.mp3' },
  { id: 'voicy', label: 'Voicy', shortLabel: 'VC', path: '/audio/Voicy_Honorable C Note.mp3' },
  { id: 'yopierre', label: 'Yo Pierre', shortLabel: 'YP', path: '/audio/yo-pierre-or.mp3' },
]

const LEVELS_TRAINING_PROMPTS: TrainingPrompt[] = [
  { id: 'levels-01', time: 18, duration: 6, mode: 'filter', direction: 'left' },
  { id: 'levels-02', time: 28, duration: 7, mode: 'filter', direction: 'right' },
  { id: 'levels-03', time: 41, duration: 6, mode: 'bass', direction: 'right' },
  { id: 'levels-04', time: 54, duration: 8, mode: 'reverb', direction: 'right' },
  { id: 'levels-05', time: 68, duration: 5, mode: 'filter', direction: 'center' },
  { id: 'levels-06', time: 81, duration: 7, mode: 'flanger', direction: 'left' },
  { id: 'levels-07', time: 94, duration: 6, mode: 'bass', direction: 'right' },
  { id: 'levels-08', time: 106, duration: 7, mode: 'filter', direction: 'right' },
  { id: 'levels-09', time: 121, duration: 8, mode: 'reverb', direction: 'right' },
  { id: 'levels-10', time: 135, duration: 6, mode: 'filter', direction: 'left' },
  { id: 'levels-11', time: 148, duration: 6, mode: 'bass', direction: 'left' },
  { id: 'levels-12', time: 162, duration: 7, mode: 'flanger', direction: 'right' },
  { id: 'levels-13', time: 175, duration: 8, mode: 'reverb', direction: 'right' },
  { id: 'levels-14', time: 189, duration: 5, mode: 'filter', direction: 'center' },
  { id: 'levels-15', time: 203, duration: 6, mode: 'bass', direction: 'right' },
  { id: 'levels-16', time: 217, duration: 8, mode: 'reverb', direction: 'right' },
]

const TRAINING_TRACK_ID: TrackId = 'levels'
const TRAINING_WINDOW_SECONDS = 3

const getBendDirection = (value: number): BendDirection => {
  if (value < -22) return 'left'
  if (value > 22) return 'right'
  return 'center'
}

const getModeTitle = (mode: ControlMode): string =>
  CONTROL_MODE_OPTIONS.find((option) => option.id === mode)?.title ?? mode

const getTrainingPromptEnd = (prompt: TrainingPrompt): number => prompt.time + prompt.duration

const formatTrainingPrompt = (prompt: TrainingPrompt, compact = false): string => {
  const modeTitle = getModeTitle(prompt.mode)
  const directionLabel =
    prompt.direction === 'left' ? 'bend left' : prompt.direction === 'right' ? 'bend right' : 'center reset'

  if (compact) {
    const directionMark = prompt.direction === 'left' ? '◀' : prompt.direction === 'right' ? '▶' : '•'
    return `${modeTitle} ${directionMark}`
  }

  return `${modeTitle} · ${directionLabel}`
}

const formatTrainingInstruction = (prompt: TrainingPrompt): string =>
  `${formatTrainingPrompt(prompt)} · hold until ${formatTime(getTrainingPromptEnd(prompt))}`

const getControlScaleLabels = (
  mode: ControlMode,
): { negative: string; positive: string } => {
  if (mode === 'filter') {
    return {
      positive: '+100 brighten',
      negative: '-100 muffle',
    }
  }

  if (mode === 'bass') {
    return {
      positive: '+100 bass boost',
      negative: '-100 bass cut',
    }
  }

  if (mode === 'reverb') {
    return {
      positive: '+100 big wash',
      negative: '-100 soft room',
    }
  }

  return {
    positive: '+100 deep sweep',
    negative: '-100 light swirl',
  }
}

const createImpulseResponse = (context: AudioContext, duration = 2.2, decay = 2.6): AudioBuffer => {
  const length = Math.floor(context.sampleRate * duration)
  const impulse = context.createBuffer(2, length, context.sampleRate)

  for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
    const data = impulse.getChannelData(channel)
    for (let i = 0; i < length; i += 1) {
      const t = 1 - i / length
      data[i] = (Math.random() * 2 - 1) * Math.pow(t, decay)
    }
  }

  return impulse
}

function App() {
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [showConnectionPanel, setShowConnectionPanel] = useState(false)
  const [audioError, setAudioError] = useState<string | null>(null)
  const [trackPlaybackState, setTrackPlaybackState] = useState<Record<TrackId, boolean>>(createPlaybackState)
  const [trackTimeline, setTrackTimeline] = useState<Record<TrackId, { currentTime: number; duration: number }>>(
    createTimelineState,
  )
  const [trackWaveform, setTrackWaveform] = useState<Record<TrackId, number[]>>(createWaveformState)
  const [controlMode, setControlMode] = useState<ControlMode>('filter')
  const [trainingModeEnabled, setTrainingModeEnabled] = useState(false)
  const [trainingResults, setTrainingResults] = useState<Record<string, TrainingResultStatus>>({})
  const [trainingFeedback, setTrainingFeedback] = useState<{ message: string; kind: TrainingResultStatus } | null>(null)
  const [filterStatus, setFilterStatus] = useState('Dry zone')
  const [debugEvents, setDebugEvents] = useState<string[]>([])
  const [drumSensitivityPercent, setDrumSensitivityPercent] = useState(DRUM_DEFAULT_SENSITIVITY_PERCENT)
  const drumSensitivityPercentRef = useRef(DRUM_DEFAULT_SENSITIVITY_PERCENT)
  const [drumVolumePercent, setDrumVolumePercent] = useState(100)
  const drumVolumePercentRef = useRef(100)
  const [drumHud, setDrumHud] = useState({
    jerkMag: 0,
    threshold: thresholdFromSensitivityPercent(DRUM_DEFAULT_SENSITIVITY_PERCENT),
    lastGain: 0,
  })
  const [drumHitFlash, setDrumHitFlash] = useState(false)
  const [drumPulseSerial, setDrumPulseSerial] = useState(0)
  const drumFlashClearRef = useRef<number | null>(null)
  const serialConnectionRef = useRef<WebSerialConnection | null>(null)
  const audioEngineRef = useRef<AudioEngine | null>(null)
  const waveformFrameRef = useRef<number | null>(null)
  const waveformLastPaintRef = useRef(0)
  const smoothedBendRef = useRef(0)
  const imuLatestAccelRef = useRef<{ accelX?: number; accelY?: number; accelZ?: number }>({})
  const imuConnectedRef = useRef(false)
  const prevAccelSampleRef = useRef<{ x: number; y: number; z: number } | null>(null)
  const drumArmedRef = useRef(true)
  const lastDrumFireMsRef = useRef(0)
  const platterRefs = useRef<Partial<Record<TrackId, HTMLDivElement>>>({})
  const platterScaleRef = useRef<Record<string, number>>(
    TRACK_IDS.reduce<Record<string, number>>((a, id) => ({ ...a, [id]: 1 }), {}),
  )
  // Row-2 individual frames for crossfade (drip mid-fall loop)
  const DRIP_ROW2 = [
    '/drip-frames/drip_05.png',
    '/drip-frames/drip_06.png',
    '/drip-frames/drip_07.png',
    '/drip-frames/drip_08.png',
  ]
  const dripWrapRefs = useRef<Partial<Record<TrackId, HTMLDivElement>>>({})
  // Two <img> elements per track for crossfade; [0]=A, [1]=B
  const dripImgPairRef = useRef<Partial<Record<TrackId, [HTMLImageElement | null, HTMLImageElement | null]>>>({})
  // Which img is currently fully visible (0=A, 1=B)
  const dripActiveRef = useRef<Record<string, number>>(
    TRACK_IDS.reduce<Record<string, number>>((a, id) => ({ ...a, [id]: 0 }), {}),
  )
  const dripFrameRef = useRef<Record<string, number>>(
    TRACK_IDS.reduce<Record<string, number>>((a, id) => ({ ...a, [id]: 0 }), {}),
  )
  const dripLastTimeRef = useRef<Record<string, number>>(
    TRACK_IDS.reduce<Record<string, number>>((a, id) => ({ ...a, [id]: 0 }), {}),
  )
  const noDataTimeoutRef = useRef<number | null>(null)
  const hasReceivedSerialRef = useRef(false)
  const trainingFeedbackTimeoutRef = useRef<number | null>(null)
  const trainingLastTimeRef = useRef(0)

  const hasWebSerial = typeof navigator !== 'undefined' && Boolean(navigator.serial)
  const { state, setSensorConnectionStatus, updateSensorData, resetSensorData } = useSensorStateManager(
    SENSOR_DEFINITIONS,
  )

  const flexSensor = useMemo(
    () => SENSOR_DEFINITIONS.find((definition) => definition.id === FLEX_SENSOR_ID) ?? SENSOR_DEFINITIONS[0]!,
    [],
  )
  const imuSensor = useMemo(
    () => SENSOR_DEFINITIONS.find((definition) => definition.id === IMU_SENSOR_ID) ?? null,
    [],
  )
  const flexSensorState = state.sensors[flexSensor.id]
  const imuSensorState = imuSensor ? state.sensors[imuSensor.id] : undefined

  useEffect(() => {
    drumSensitivityPercentRef.current = drumSensitivityPercent
  }, [drumSensitivityPercent])

  useEffect(() => {
    drumVolumePercentRef.current = drumVolumePercent
  }, [drumVolumePercent])

  useEffect(() => {
    imuConnectedRef.current = imuSensorState?.connectionStatus === 'connected'
  }, [imuSensorState?.connectionStatus])

  useEffect(() => {
    const rv = imuSensorState?.rawValues
    if (!rv) return
    imuLatestAccelRef.current = {
      accelX: rv.accelX,
      accelY: rv.accelY,
      accelZ: rv.accelZ,
    }
  }, [imuSensorState?.rawValues])

  useEffect(() => {
    const intervalMs = 40
    let debugSkip = 0
    const id = window.setInterval(() => {
      const engine = audioEngineRef.current
      const imuOk = imuConnectedRef.current
      const raw = imuLatestAccelRef.current
      const ax = raw.accelX
      const ay = raw.accelY
      const az = raw.accelZ

      if (!imuOk || ax === undefined || ay === undefined || az === undefined || !Number.isFinite(ax + ay + az)) {
        prevAccelSampleRef.current = null
        drumArmedRef.current = true
        debugSkip += 1
        if (debugSkip >= 2) {
          debugSkip = 0
          const thr = thresholdFromSensitivityPercent(drumSensitivityPercentRef.current)
          setDrumHud((prev) =>
            prev.jerkMag === 0 && prev.threshold === thr ? prev : { jerkMag: 0, threshold: thr, lastGain: prev.lastGain },
          )
        }
        return
      }

      const prev = prevAccelSampleRef.current
      prevAccelSampleRef.current = { x: ax, y: ay, z: az }

      const jerkMag = prev ? accelDeltaMagnitude(prev.x, prev.y, prev.z, ax, ay, az) : 0
      const threshold = thresholdFromSensitivityPercent(drumSensitivityPercentRef.current)
      const now = performance.now()

      if (jerkMag < DRUM_SETTLE_DELTA) {
        drumArmedRef.current = true
      }

      let firedGain = 0
      if (
        drumArmedRef.current &&
        jerkMag >= threshold &&
        now - lastDrumFireMsRef.current >= DRUM_DEBOUNCE_MS &&
        engine?.drumSample
      ) {
        const gain = drumGainFromJerk(jerkMag, threshold)
        playDrumOneShot(engine.context, engine.drumSample, gain, drumVolumePercentRef.current / 100)
        drumArmedRef.current = false
        lastDrumFireMsRef.current = now
        firedGain = gain
        setDrumPulseSerial((n) => n + 1)
        if (drumFlashClearRef.current !== null) {
          window.clearTimeout(drumFlashClearRef.current)
        }
        setDrumHitFlash(true)
        drumFlashClearRef.current = window.setTimeout(() => {
          setDrumHitFlash(false)
          drumFlashClearRef.current = null
        }, 140)
      }

      debugSkip += 1
      if (debugSkip >= 2) {
        debugSkip = 0
        setDrumHud((prev) => ({
          jerkMag,
          threshold,
          lastGain: firedGain > 0 ? firedGain : prev.lastGain,
        }))
      }
    }, intervalMs)
    return () => {
      window.clearInterval(id)
      if (drumFlashClearRef.current !== null) {
        window.clearTimeout(drumFlashClearRef.current)
        drumFlashClearRef.current = null
      }
    }
  }, [])
  const pushDebugEvent = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setDebugEvents((prev) => [...prev.slice(-11), `${timestamp} - ${message}`])
  }
  const clearNoDataTimeout = () => {
    if (noDataTimeoutRef.current !== null) {
      window.clearTimeout(noDataTimeoutRef.current)
      noDataTimeoutRef.current = null
    }
  }
  const armNoDataTimeout = () => {
    clearNoDataTimeout()
    hasReceivedSerialRef.current = false
    noDataTimeoutRef.current = window.setTimeout(() => {
      if (hasReceivedSerialRef.current) {
        return
      }

      const warning =
        'Connected, but no serial lines after 15s. Usually wrong serial interface or another app still holding the port.'
      setConnectionError(warning)
      pushDebugEvent(warning)
    }, 15000)
  }

  useEffect(() => {
    const serialConnection = new WebSerialConnection()
    serialConnectionRef.current = serialConnection

    const disposeStatus = serialConnection.onStatusChange((status) => {
      pushDebugEvent(`Status changed to ${status}`)
      setSensorConnectionStatus(flexSensor.id, status)
      if (imuSensor) {
        setSensorConnectionStatus(imuSensor.id, status)
      }
      if (status === 'disconnected') {
        clearNoDataTimeout()
        hasReceivedSerialRef.current = false
        resetSensorData(flexSensor.id)
        if (imuSensor) {
          resetSensorData(imuSensor.id)
        }
      }
    })

    const disposeLine = serialConnection.onLine((line) => {
      if (!hasReceivedSerialRef.current) {
        hasReceivedSerialRef.current = true
        clearNoDataTimeout()
        pushDebugEvent('First serial line received')
      }

      if (line.trim()) {
        pushDebugEvent(`Serial line: ${line.trim()}`)
      }

      const parsed = parseKeyValueSerialLine(line)
      if (!parsed) {
        pushDebugEvent('Ignored line (not key:value format)')
        return
      }

      const flexPacket = mapParsedValuesToSensorPacket(parsed, flexSensor)
      const imuPacket = imuSensor ? mapParsedValuesToSensorPacket(parsed, imuSensor) : null

      const flexHasData =
        Object.keys(flexPacket.rawValues).length > 0 || Object.keys(flexPacket.normalizedValues).length > 0
      const imuHasData =
        imuPacket !== null &&
        (Object.keys(imuPacket.rawValues).length > 0 || Object.keys(imuPacket.normalizedValues).length > 0)

      if (!flexHasData && !imuHasData) {
        pushDebugEvent('Parsed line had no mapped sensor fields')
        return
      }

      if (flexHasData) {
        updateSensorData(flexSensor.id, flexPacket, flexSensor.calibrationField)
      }
      if (imuHasData && imuSensor && imuPacket) {
        updateSensorData(imuSensor.id, imuPacket)
      }
    })

    return () => {
      clearNoDataTimeout()
      disposeStatus()
      disposeLine()
      void serialConnection.disconnect()
      serialConnectionRef.current = null
    }
  }, [flexSensor, imuSensor, resetSensorData, setSensorConnectionStatus, updateSensorData])

  const connect = async () => {
    setConnectionError(null)
    pushDebugEvent('Connect button pressed')
    const serialConnection = serialConnectionRef.current
    if (!serialConnection) {
      pushDebugEvent('No serial connection instance available')
      return
    }

    try {
      await serialConnection.connect(DEFAULT_BAUD_RATE)
      armNoDataTimeout()
      pushDebugEvent(`Port open at ${DEFAULT_BAUD_RATE} baud`)
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : 'Unable to connect to serial device.')
      pushDebugEvent(error instanceof Error ? `Connect failed: ${error.message}` : 'Connect failed')
    }
  }

  const disconnect = async () => {
    setConnectionError(null)
    pushDebugEvent('Disconnect button pressed')
    const serialConnection = serialConnectionRef.current
    if (!serialConnection) {
      pushDebugEvent('No serial connection instance available')
      return
    }

    clearNoDataTimeout()
    hasReceivedSerialRef.current = false
    await serialConnection.disconnect()
    resetSensorData(flexSensor.id)
    if (imuSensor) {
      resetSensorData(imuSensor.id)
    }
    prevAccelSampleRef.current = null
    drumArmedRef.current = true
    lastDrumFireMsRef.current = 0
    pushDebugEvent('Disconnected and sensor state reset')
  }

  const appConnectionStatus = flexSensorState?.connectionStatus ?? 'disconnected'
  const bendValue = flexSensorState?.rawValues.biDirectional ?? 0
  const activeTrackId = TRACK_IDS.find((trackId) => trackPlaybackState[trackId]) ?? null
  const nextTrackId = activeTrackId
    ? TRACK_IDS[(TRACK_IDS.indexOf(activeTrackId) + 1) % TRACK_IDS.length]
    : TRACK_IDS[0]
  const primaryDeckId = activeTrackId ?? TRACK_IDS[0]
  const orderedTrackIds = useMemo(
    () =>
      [...TRACK_IDS].sort((a, b) => {
        const aPlaying = trackPlaybackState[a] ? 1 : 0
        const bPlaying = trackPlaybackState[b] ? 1 : 0
        if (aPlaying !== bPlaying) return bPlaying - aPlaying
        return TRACK_IDS.indexOf(a) - TRACK_IDS.indexOf(b)
      }),
    [trackPlaybackState],
  )
  const bendDirection = useMemo(() => getBendDirection(bendValue), [bendValue])
  const trainingTrackTimeline = trackTimeline[TRAINING_TRACK_ID]
  const trainingTrackElapsed = trainingTrackTimeline?.currentTime ?? 0
  const trainingTrackDuration = trainingTrackTimeline?.duration ?? 0
  const trainingTrackIsPlaying = trackPlaybackState[TRAINING_TRACK_ID]
  const trainingPrompts = LEVELS_TRAINING_PROMPTS
  const trainingTimelineDuration =
    trainingTrackDuration > 0 ? trainingTrackDuration : getTrainingPromptEnd(trainingPrompts[trainingPrompts.length - 1]!) + 12
  const activeTrainingPrompt = useMemo(() => {
    if (!trainingModeEnabled) return null

    return (
      trainingPrompts.find((prompt) => {
        const result = trainingResults[prompt.id]
        if (result) return false
        const promptEnd = getTrainingPromptEnd(prompt)
        return trainingTrackElapsed >= prompt.time && trainingTrackElapsed <= promptEnd + TRAINING_WINDOW_SECONDS
      }) ?? null
    )
  }, [trainingModeEnabled, trainingPrompts, trainingResults, trainingTrackElapsed])
  const nextTrainingPrompt = useMemo(
    () =>
      trainingModeEnabled
        ? trainingPrompts.find((prompt) => !trainingResults[prompt.id] && prompt.time > trainingTrackElapsed) ?? null
        : null,
    [trainingModeEnabled, trainingPrompts, trainingResults, trainingTrackElapsed],
  )
  const upcomingTrainingPrompts = useMemo(
    () =>
      trainingModeEnabled
        ? trainingPrompts.filter(
            (prompt) =>
              !trainingResults[prompt.id] &&
              prompt.time >= trainingTrackElapsed &&
              prompt.time <= trainingTrackElapsed + 20,
          ).slice(0, 5)
        : [],
    [trainingModeEnabled, trainingPrompts, trainingResults, trainingTrackElapsed],
  )
  const trainingScore = useMemo(() => {
    const hits = Object.values(trainingResults).filter((value) => value === 'hit').length
    const misses = Object.values(trainingResults).filter((value) => value === 'miss').length
    return { hits, misses, total: trainingPrompts.length }
  }, [trainingPrompts.length, trainingResults])
  const stageTrendPoints = useMemo(() => {
    const values = flexSensorState?.history ?? []
    if (values.length < 2) return null

    const width = 1200
    const height = 240
    const amplitude = 96
    const centerY = height / 2
    return values
      .map((value, index) => {
        const x = (index / (values.length - 1)) * width
        const clamped = Math.max(-100, Math.min(100, value))
        const y = centerY - (clamped / 100) * amplitude
        return `${x},${y}`
      })
      .join(' ')
  }, [flexSensorState?.history])

  const syncPlaybackState = useCallback((engine: AudioEngine) => {
    setTrackPlaybackState(
      TRACK_IDS.reduce(
        (acc, trackId) => {
          acc[trackId] = !engine.tracks[trackId].paused
          return acc
        },
        {} as Record<TrackId, boolean>,
      ),
    )
  }, [])

  const ensureAudioEngine = useCallback(async (): Promise<AudioEngine | null> => {
    if (audioEngineRef.current) {
      return audioEngineRef.current
    }

    if (typeof window === 'undefined' || !window.AudioContext) {
      setAudioError('Web Audio API is not available in this browser.')
      return null
    }

    const context = new window.AudioContext()
    const filter = context.createBiquadFilter()
    const wetGain = context.createGain()
    const dryGain = context.createGain()
    const masterGain = context.createGain()
    const reverbNode = context.createConvolver()
    const reverbWetGain = context.createGain()
    const flangerDelay = context.createDelay(0.03)
    const flangerFeedback = context.createGain()
    const flangerWetGain = context.createGain()
    const flangerLfo = context.createOscillator()
    const flangerDepth = context.createGain()
    const tracks = {} as Record<TrackId, HTMLAudioElement>
    const analyzers = {} as Record<TrackId, AnalyserNode>

    filter.type = 'lowpass'
    filter.frequency.value = 20000
    filter.Q.value = 0.707
    filter.gain.value = 0
    wetGain.gain.value = 0
    dryGain.gain.value = 1
    masterGain.gain.value = 0.9
    reverbNode.buffer = createImpulseResponse(context)
    reverbWetGain.gain.value = 0
    flangerDelay.delayTime.value = 0.005
    flangerFeedback.gain.value = 0.16
    flangerWetGain.gain.value = 0
    flangerLfo.frequency.value = 0.22
    flangerDepth.gain.value = 0.0025

    const fxWetGains: Record<FxType, GainNode> = {
      reverb: reverbWetGain,
      flanger: flangerWetGain,
    }

    const loadError = `Could not load track audio. Add files in public/audio/: ${TRACK_IDS.map((id) => TRACK_LIBRARY[id].path.split('/').pop()).join(', ')}.`

    TRACK_IDS.forEach((trackId) => {
      const track = new Audio(TRACK_LIBRARY[trackId].path)
      track.loop = true
      track.preload = 'auto'
      tracks[trackId] = track

      const source = context.createMediaElementSource(track)
      const analyzer = context.createAnalyser()
      analyzer.fftSize = 128
      analyzers[trackId] = analyzer

      source.connect(dryGain)
      source.connect(filter)
      source.connect(analyzer)
      source.connect(reverbNode)
      source.connect(flangerDelay)

      track.addEventListener('error', () => setAudioError(loadError))
      track.addEventListener('play', () => {
        const engine = audioEngineRef.current
        if (engine) syncPlaybackState(engine)
      })
      track.addEventListener('pause', () => {
        const engine = audioEngineRef.current
        if (engine) syncPlaybackState(engine)
      })
      track.addEventListener('timeupdate', () => {
        setTrackTimeline((prev) => ({
          ...prev,
          [trackId]: {
            currentTime: track.currentTime,
            duration: Number.isFinite(track.duration) ? track.duration : 0,
          },
        }))
      })
      track.addEventListener('loadedmetadata', () => {
        setTrackTimeline((prev) => ({
          ...prev,
          [trackId]: {
            currentTime: track.currentTime,
            duration: Number.isFinite(track.duration) ? track.duration : 0,
          },
        }))
      })
    })

    reverbNode.connect(reverbWetGain)
    flangerDelay.connect(flangerWetGain)
    flangerDelay.connect(flangerFeedback)
    flangerFeedback.connect(flangerDelay)
    flangerLfo.connect(flangerDepth)
    flangerDepth.connect(flangerDelay.delayTime)
    filter.connect(wetGain)
    dryGain.connect(masterGain)
    wetGain.connect(masterGain)
    reverbWetGain.connect(masterGain)
    flangerWetGain.connect(masterGain)
    masterGain.connect(context.destination)

    let drumSample: AudioBuffer | null = null
    try {
      const drumRes = await fetch(DRUM_SAMPLE_PATH)
      if (drumRes.ok) {
        const drumBytes = await drumRes.arrayBuffer()
        drumSample = await context.decodeAudioData(drumBytes.slice(0))
      }
    } catch {
      drumSample = null
    }

    flangerLfo.start()

    const engine: AudioEngine = {
      context,
      tracks,
      analyzers,
      filter,
      wetGain,
      dryGain,
      reverbNode,
      flangerDelay,
      flangerFeedback,
      flangerLfo,
      flangerDepth,
      fxWetGains,
      drumSample,
    }
    audioEngineRef.current = engine
    return engine
  }, [syncPlaybackState])

  const getFxGuide = useCallback((mode: ControlMode) => {
    if (mode === 'filter') {
      return {
        left: '◀ low-pass (muffled)',
        center: 'dry',
        right: 'high-pass (bright) ▶',
      }
    }

    if (mode === 'bass') {
      return {
        left: '◀ bass cut',
        center: 'neutral',
        right: 'bass boost ▶',
      }
    }

    if (mode === 'reverb') {
      return {
        left: '◀ room / soft',
        center: 'dry',
        right: 'wash / dreamy ▶',
      }
    }

    if (mode === 'flanger') {
      return {
        left: '◀ light swirl',
        center: 'dry',
        right: 'deep sweep ▶',
      }
    }

    return {
      left: '◀ light swirl',
      center: 'dry',
      right: 'deep sweep ▶',
    }
  }, [])

  // Bend drives filter / FX; IMU jerk triggers one-shot drum hits (parallel to the mix).
  const updateFilterFromBend = useCallback((rawBendValue: number) => {
    const engine = audioEngineRef.current
    if (!engine) return

    const clamped = Math.max(-100, Math.min(100, rawBendValue))
    smoothedBendRef.current += (clamped - smoothedBendRef.current) * 0.2
    const bend = smoothedBendRef.current
    const deadZone = 10
    const now = engine.context.currentTime

    let cutoff = 20000
    let wet = 0
    let dry = 1
    let q = 0.9
    let gain = 0
    let status = 'Dry zone'
    const setFxMix = (selected: FxType | null, selectedWet: number) => {
      ;(Object.keys(engine.fxWetGains) as FxType[]).forEach((type) => {
        engine.fxWetGains[type].gain.setTargetAtTime(type === selected ? selectedWet : 0, now, 0.04)
      })
    }

    if (controlMode === 'reverb' || controlMode === 'flanger') {
      engine.filter.type = 'lowpass'
      q = 0.707

      const magnitude = Math.max(0, Math.abs(bend) - deadZone)
      const intensity = Math.min(1, magnitude / (100 - deadZone))
      const direction = bend < 0 ? -1 : bend > 0 ? 1 : 0
      const fxType = controlMode

      wet = 0
      dry = 1 - intensity * 0.28
      setFxMix(null, 0)

      if (intensity === 0 || direction === 0) {
        status = `${CONTROL_MODE_OPTIONS.find((option) => option.id === fxType)?.title ?? 'FX'} dry`
      } else if (fxType === 'reverb') {
        const selectedWet = direction < 0 ? 0.28 + intensity * 0.52 : 0.48 + intensity * 0.92
        dry = direction < 0 ? 1 - intensity * 0.42 : 1 - intensity * 0.72
        setFxMix('reverb', selectedWet)
        status = direction < 0 ? `Reverb room ${Math.round(intensity * 100)}%` : `Reverb wash ${Math.round(intensity * 100)}%`
      } else if (fxType === 'flanger') {
        const selectedWet = 0.14 + intensity * 0.54
        engine.flangerLfo.frequency.setTargetAtTime(direction < 0 ? 0.12 + intensity * 0.26 : 0.28 + intensity * 0.8, now, 0.04)
        engine.flangerDepth.gain.setTargetAtTime(direction < 0 ? 0.0014 + intensity * 0.0016 : 0.0022 + intensity * 0.004, now, 0.04)
        engine.flangerFeedback.gain.setTargetAtTime(direction < 0 ? 0.08 + intensity * 0.1 : 0.16 + intensity * 0.2, now, 0.04)
        setFxMix('flanger', selectedWet)
        status = direction < 0 ? `Flanger glide ${Math.round(intensity * 100)}%` : `Flanger deep ${Math.round(intensity * 100)}%`
      }
    } else if (controlMode === 'bass') {
      setFxMix(null, 0)
      engine.filter.type = 'lowshelf'
      cutoff = 220
      wet = 1
      dry = 0
      q = 0.8

      if (bend < -deadZone) {
        const intensity = Math.min(1, (-bend - deadZone) / (100 - deadZone))
        gain = -(4 + intensity * 18)
        status = `Bass cut ${Math.round(intensity * 100)}%`
      } else if (bend > deadZone) {
        const intensity = Math.min(1, (bend - deadZone) / (100 - deadZone))
        gain = 3 + intensity * 15
        status = `Bass boost ${Math.round(intensity * 100)}%`
      } else {
        status = 'Bass neutral'
      }
    } else {
      setFxMix(null, 0)
      if (bend < -deadZone) {
        const intensity = Math.min(1, (-bend - deadZone) / (100 - deadZone))
        // Push the low-pass much lower so negative bends get obviously muffled.
        cutoff = 16000 * Math.pow(70 / 16000, intensity)
        wet = 0.3 + intensity * 0.7
        dry = 1 - intensity
        q = 1 + intensity * 2.2
        engine.filter.type = 'lowpass'
        status = `Low-pass ${Math.round(intensity * 100)}%`
      } else if (bend > deadZone) {
        const intensity = Math.min(1, (bend - deadZone) / (100 - deadZone))
        // Push the high-pass much higher so positive bends sound thin/bright fast.
        cutoff = 30 * Math.pow(9000 / 30, intensity)
        wet = 0.3 + intensity * 0.7
        dry = 1 - intensity
        q = 1 + intensity * 1.8
        engine.filter.type = 'highpass'
        status = `High-pass ${Math.round(intensity * 100)}%`
      } else {
        engine.filter.type = 'lowpass'
      }
    }

    engine.filter.frequency.setTargetAtTime(cutoff, now, 0.03)
    engine.filter.Q.setTargetAtTime(q, now, 0.03)
    engine.filter.gain.setTargetAtTime(gain, now, 0.03)
    engine.wetGain.gain.setTargetAtTime(wet, now, 0.03)
    engine.dryGain.gain.setTargetAtTime(dry, now, 0.03)

    setFilterStatus(`${status} | bend ${bend.toFixed(1)}`)
  }, [controlMode])

  useEffect(() => {
    updateFilterFromBend(bendValue)
  }, [bendValue, updateFilterFromBend])

  useEffect(() => {
    if (!trainingModeEnabled) {
      setTrainingResults({})
      setTrainingFeedback(null)
      trainingLastTimeRef.current = 0
      if (trainingFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(trainingFeedbackTimeoutRef.current)
        trainingFeedbackTimeoutRef.current = null
      }
      return
    }

    const rewound = trainingTrackElapsed < 1.5 || trainingTrackElapsed + 2 < trainingLastTimeRef.current
    if (rewound) {
      setTrainingResults({})
      setTrainingFeedback(null)
    }

    trainingLastTimeRef.current = trainingTrackElapsed
  }, [trainingModeEnabled, trainingTrackElapsed])

  useEffect(() => {
    if (!trainingModeEnabled || !trainingTrackIsPlaying) return

    const missedPrompts = trainingPrompts.filter(
      (prompt) => !trainingResults[prompt.id] && trainingTrackElapsed > getTrainingPromptEnd(prompt) + TRAINING_WINDOW_SECONDS,
    )
    if (missedPrompts.length === 0) return

    setTrainingResults((prev) => {
      const next = { ...prev }
      missedPrompts.forEach((prompt) => {
        next[prompt.id] = 'miss'
      })
      return next
    })

    const latestMiss = missedPrompts[missedPrompts.length - 1]
    if (latestMiss) {
      setTrainingFeedback({ message: 'Miss', kind: 'miss' })
      if (trainingFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(trainingFeedbackTimeoutRef.current)
      }
      trainingFeedbackTimeoutRef.current = window.setTimeout(() => {
        setTrainingFeedback(null)
        trainingFeedbackTimeoutRef.current = null
      }, 3000)
    }
  }, [trainingModeEnabled, trainingPrompts, trainingResults, trainingTrackElapsed, trainingTrackIsPlaying])

  useEffect(() => {
    if (!trainingModeEnabled || !trainingTrackIsPlaying || !activeTrainingPrompt) return

    if (controlMode !== activeTrainingPrompt.mode || bendDirection !== activeTrainingPrompt.direction) {
      return
    }

    setTrainingResults((prev) => {
      if (prev[activeTrainingPrompt.id]) return prev
      return { ...prev, [activeTrainingPrompt.id]: 'hit' }
    })
    setTrainingFeedback({ message: 'GOOD!!', kind: 'hit' })

    if (trainingFeedbackTimeoutRef.current !== null) {
      window.clearTimeout(trainingFeedbackTimeoutRef.current)
    }

    trainingFeedbackTimeoutRef.current = window.setTimeout(() => {
      setTrainingFeedback(null)
      trainingFeedbackTimeoutRef.current = null
    }, 3000)
  }, [activeTrainingPrompt, bendDirection, controlMode, trainingModeEnabled, trainingTrackIsPlaying])

  useEffect(() => {
    return () => {
      const engine = audioEngineRef.current
      if (!engine) return

      TRACK_IDS.forEach((trackId) => {
        engine.tracks[trackId].pause()
      })

      if (waveformFrameRef.current !== null) {
        window.cancelAnimationFrame(waveformFrameRef.current)
        waveformFrameRef.current = null
      }

      try {
        engine.flangerLfo.stop()
      } catch {
        // oscillator may already be stopped when context is closing
      }

      void engine.context.close()
      audioEngineRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      if (trainingFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(trainingFeedbackTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const tick = (now: number) => {
      const engine = audioEngineRef.current
      if (engine && now - waveformLastPaintRef.current > 90) {
        const waveformSnapshot = {} as Record<TrackId, number[]>
        TRACK_IDS.forEach((trackId) => {
          const analyzer = engine.analyzers[trackId]
          const data = new Uint8Array(analyzer.frequencyBinCount)
          analyzer.getByteFrequencyData(data)

          const bars = 28
          const levels: number[] = []
          for (let i = 0; i < bars; i++) {
            const start = Math.floor(Math.pow(i / bars, 1.7) * data.length * 0.92)
            const end = Math.max(start + 1, Math.floor(Math.pow((i + 1) / bars, 1.7) * data.length * 0.92))
            let sum = 0
            let peak = 0
            for (let j = start; j < end; j++) {
              const value = (data[j] ?? 0) / 255
              sum += value
              peak = Math.max(peak, value)
            }
            const average = sum / Math.max(1, end - start)
            const mixed = average * 0.6 + peak * 0.4
            const spectralWeight = 0.78 + (i / (bars - 1)) * 0.85
            const contrasted = Math.pow(mixed, 1.2) * 2.6 * spectralWeight
            levels.push(Math.max(0.03, Math.min(1.9, contrasted)))
          }
          waveformSnapshot[trackId] = levels
        })

        setTrackWaveform(waveformSnapshot)
        waveformLastPaintRef.current = now
      }

      // Beat-pulse: runs every frame regardless of waveform throttle
      const eng = audioEngineRef.current
      if (eng) {
        TRACK_IDS.forEach((trackId) => {
          const platter = platterRefs.current[trackId]
          if (!platter) return

          const isPlaying = !eng.tracks[trackId].paused
          const analyzer = eng.analyzers[trackId]
          const freq = new Uint8Array(analyzer.frequencyBinCount)
          analyzer.getByteFrequencyData(freq)

          // Average the bass bins (lowest ~5% of the frequency range)
          const bassEnd = Math.max(1, Math.floor(freq.length * 0.05))
          let bassSum = 0
          for (let i = 0; i < bassEnd; i++) bassSum += freq[i] ?? 0
          const bassEnergy = isPlaying ? bassSum / bassEnd / 255 : 0

          // Push the platter pulse much harder and add a vertical punch on bass hits.
          const emphasizedBass = Math.pow(bassEnergy, 0.72)
          const targetScale = 1 + emphasizedBass * 0.24
          const targetLift = emphasizedBass * -14
          const currentScale = platterScaleRef.current[trackId] ?? 1
          const currentLift = Number(platter.dataset.lift ?? '0')
          const alpha = emphasizedBass > currentScale - 1 ? 0.68 : 0.16
          platterScaleRef.current[trackId] = currentScale + (targetScale - currentScale) * alpha
          const nextLift = currentLift + (targetLift - currentLift) * alpha
          platter.dataset.lift = nextLift.toFixed(4)

          platter.style.transform = `translateY(${nextLift.toFixed(2)}px) scale(${platterScaleRef.current[trackId].toFixed(4)})`

          // Drip crossfade animation using individual frame PNGs
          const dripWrap = dripWrapRefs.current[trackId]
          const imgs = dripImgPairRef.current[trackId]
          if (DRIP_FRAMES_ENABLED && dripWrap && imgs) {
            dripWrap.style.opacity = isPlaying ? '1' : '0'

            if (isPlaying) {
              // 12–20 fps range; bass hits speed it up for beat-sync feel
              const dripFps = 12 + bassEnergy * 8
              const lastTime = dripLastTimeRef.current[trackId] ?? now
              if (now - lastTime >= 1000 / dripFps) {
                dripLastTimeRef.current[trackId] = now

                const nextFrame = ((dripFrameRef.current[trackId] ?? 0) + 1) % DRIP_ROW2.length
                dripFrameRef.current[trackId] = nextFrame

                const activeIdx = dripActiveRef.current[trackId] ?? 0
                const nextIdx = activeIdx === 0 ? 1 : 0
                const incoming = imgs[nextIdx]
                const outgoing = imgs[activeIdx]

                if (incoming && outgoing) {
                  incoming.src = DRIP_ROW2[nextFrame] ?? DRIP_ROW2[0]
                  incoming.style.opacity = '1'
                  outgoing.style.opacity = '0'
                  dripActiveRef.current[trackId] = nextIdx
                }
              }
            }
          }
        })
      }

      waveformFrameRef.current = window.requestAnimationFrame(tick)
    }

    waveformFrameRef.current = window.requestAnimationFrame(tick)
    return () => {
      if (waveformFrameRef.current !== null) {
        window.cancelAnimationFrame(waveformFrameRef.current)
        waveformFrameRef.current = null
      }
    }
  }, [])

  const toggleTrackPlayback = async (track: TrackId) => {
    setAudioError(null)
    const engine = await ensureAudioEngine()
    if (!engine) return

    await engine.context.resume()
    const element = engine.tracks[track]

    try {
      if (element.paused) {
        await element.play()
      } else {
        element.pause()
      }
      syncPlaybackState(engine)
    } catch {
      setAudioError(
        'Unable to play track. Confirm Danza_Kuduro.mp3, Toca_toca.mp3, Y_Que_Fue.mp3, and replay.mp3 exist in public/audio/.',
      )
    }
  }

  const jumpToCue = async (track: TrackId, cue: CuePoint) => {
    const engine = await ensureAudioEngine()
    if (!engine) return

    const element = engine.tracks[track]
    const duration = Number.isFinite(element.duration) ? element.duration : 0
    if (duration <= 0) return

    element.currentTime = duration * cue.ratio
    setTrackTimeline((prev) => ({
      ...prev,
      [track]: { currentTime: element.currentTime, duration },
    }))
  }

  const playProducerTag = (tag: ProducerTag) => {
    const clip = new Audio(tag.path)
    clip.preload = 'auto'
    clip.volume = 0.95
    void clip.play().catch(() => {
      setAudioError(`Could not play producer tag: ${tag.label}.`)
    })
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">experience euphoria</p>
        </div>
        <div className="header-meta">
          <a
            className="header-website-link"
            href="#about"
          >
            website ↗
          </a>
          <span className={`status-badge status-${appConnectionStatus}`}>
            {appConnectionStatus === 'connected' ? 'linked 👅' : appConnectionStatus === 'connecting' ? 'linking...' : 'unlinked'}
          </span>
          <button className="secondary" onClick={() => setShowConnectionPanel((v) => !v)}>
            {showConnectionPanel ? 'Hide Setup ↑' : 'Setup ↓'}
          </button>
        </div>
      </header>

      <section className="panel notes-panel">
        <h2>Producers: Audrey, Rebecca, Erika</h2>
        <div className="booth-meta row">
          <span className="booth-filter-status">{filterStatus}</span>
          <span className="booth-deck-status">
            {activeTrackId ? `▶ ${TRACK_LIBRARY[activeTrackId].title}` : '— stopped —'}
            {' '}· up next: {TRACK_LIBRARY[nextTrackId].title}
          </span>
        </div>
        {audioError ? <p className="error">{audioError}</p> : null}
        <div className="deck-drum-row">
        <div className="deck-main-col">
        <div className="deck-stage">
          <div className="deck-trend-backdrop" aria-hidden="true">
            <div className="deck-trend-axis-label deck-trend-axis-top">+100</div>
            <div className="deck-trend-axis-label deck-trend-axis-center">0</div>
            <div className="deck-trend-axis-label deck-trend-axis-bottom">-100</div>
            <svg className="deck-trend-graph" viewBox="0 0 1200 240" preserveAspectRatio="none">
              <line className="deck-trend-midline" x1="0" y1="120" x2="1200" y2="120" />
              {stageTrendPoints ? <polyline className="deck-trend-line" points={stageTrendPoints} /> : null}
            </svg>
          </div>
          {trainingModeEnabled ? (
            <div className="deck-training-backdrop">
              <div className="training-lane training-lane-stage">
                <div
                  className="training-lane-progress"
                  style={{ width: `${Math.min(100, (trainingTrackElapsed / trainingTimelineDuration) * 100)}%` }}
                />
                {trainingPrompts.map((prompt) => {
                  const left = (prompt.time / trainingTimelineDuration) * 100
                  const width = (prompt.duration / trainingTimelineDuration) * 100
                  const result = trainingResults[prompt.id]
                  const isHit = result === 'hit'
                  const isMiss = result === 'miss'
                  const isCurrent = activeTrainingPrompt?.id === prompt.id
                  const isUpcoming = !result && prompt.time > trainingTrackElapsed && prompt.time <= trainingTrackElapsed + 10

                  return (
                    <div
                      key={prompt.id}
                      className={`training-marker training-marker--${prompt.mode}${isHit ? ' is-hit' : ''}${
                        isMiss ? ' is-miss' : ''
                      }${isCurrent ? ' is-current' : ''}${isUpcoming ? ' is-upcoming' : ''}`}
                      style={{ left: `${left}%`, width: `${width}%` }}
                      title={`${formatTrainingInstruction(prompt)} · start ${formatTime(prompt.time)}`}
                    >
                      <span className="training-marker-fill" />
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}
          {[primaryDeckId].map((trackId, index) => {
            const info = TRACK_LIBRARY[trackId]
            const timeline = trackTimeline[trackId]
            const isPlaying = trackPlaybackState[trackId]
            const elapsed = timeline?.currentTime ?? 0
            const duration = timeline?.duration ?? 0
            const remaining = Math.max(0, duration - elapsed)
            const progress = duration > 0 ? Math.min(100, (elapsed / duration) * 100) : 0

            return (
              <article key={`${trackId}-${index}`} className="deck-display">
                <div className="deck-display-top row">
                  <span className="deck-label">{index === 0 ? 'Deck A' : 'Deck B'}</span>
                  <span className={`status-dot ${isPlaying ? 'status-connected' : 'status-disconnected'}`}>
                    {isPlaying ? 'live' : index === 0 ? 'cued' : 'next'}
                  </span>
                </div>
                <div className="deck-platter-wrap">
                  {DRIP_FRAMES_ENABLED ? (
                    <div
                      ref={(el) => {
                        dripWrapRefs.current[trackId] = el ?? undefined
                      }}
                      className="deck-drip-wrap"
                    >
                      <img
                        ref={(el) => {
                          const pair = dripImgPairRef.current[trackId] ?? [null, null]
                          pair[0] = el
                          dripImgPairRef.current[trackId] = pair
                        }}
                        className="deck-drip-frame"
                        src="/drip-frames/drip_05.png"
                        alt=""
                      />
                      <img
                        ref={(el) => {
                          const pair = dripImgPairRef.current[trackId] ?? [null, null]
                          pair[1] = el
                          dripImgPairRef.current[trackId] = pair
                        }}
                        className="deck-drip-frame"
                        src="/drip-frames/drip_06.png"
                        style={{ opacity: 0 }}
                        alt=""
                      />
                    </div>
                  ) : null}
                  <div
                    ref={(el) => {
                      platterRefs.current[trackId] = el ?? undefined
                    }}
                    className="deck-platter"
                    style={{
                      background: `conic-gradient(#ff72c8 ${progress * 3.6}deg, rgba(255,255,255,0.08) 0deg)`,
                    }}
                  >
                    <div className="deck-platter-inner">
                      <p className="deck-title">{info.title}</p>
                      <p className="deck-artist">{info.artist}</p>
                      <p className="deck-bpm">{info.bpm} BPM</p>
                    </div>
                  </div>
                </div>
                <div className="row track-time-row">
                  <span>{formatTime(elapsed)}</span>
                  <span>-{formatTime(remaining)}</span>
                </div>
                <div className="waveform-strip compact">
                  {trackWaveform[trackId].map((level, index) => (
                    <span
                      key={`${trackId}-wave-${index}`}
                      className="waveform-bar"
                      style={{ height: `${Math.round(level * 100)}%` }}
                    />
                  ))}
                </div>
              </article>
            )
          })}
        </div>
        <div className="control-rack">
          <section className="control-bank" aria-label="Bend control bank">
            <p className="control-bank-label">Bend control</p>
            <div className="selector-grid selector-grid-controls" role="group" aria-label="Bend control select">
              {CONTROL_MODE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  className={`selector-tile selector-tile--${option.id} ${controlMode === option.id ? 'is-active' : ''} ${
                    trainingModeEnabled && activeTrainingPrompt?.mode === option.id ? 'is-training-target' : ''
                  }`}
                  onClick={() => setControlMode(option.id)}
                >
                  <span className="selector-copy">
                    <span className="selector-title">{option.title}</span>
                  </span>
                  <span className="selector-scale-stack" aria-hidden="true">
                    <span className="selector-scale-top">{getControlScaleLabels(option.id).positive}</span>
                    <span className="selector-scale-bottom">{getControlScaleLabels(option.id).negative}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>
          <section className="control-bank producer-tag-bank" aria-label="Producer tags">
            <p className="control-bank-label">Producer tags</p>
            <div className="producer-tag-grid">
              {PRODUCER_TAGS.map((tag) => (
                <button
                  key={tag.id}
                  className="producer-tag-btn"
                  title={tag.label}
                  aria-label={tag.label}
                  onClick={() => playProducerTag(tag)}
                >
                  {tag.shortLabel}
                </button>
              ))}
            </div>
          </section>
        </div>
        </div>{/* end deck-main-col */}
        {/* drum column — sits to the right of the deck stage */}
        <div className="drum-col">
          <p className="muted booth-imu-note">
            <strong>Air drum:</strong> sharp wrist swings fire a one-shot sample through your speakers, layered on top of the deck mix.
          </p>
          <div
            className={`drum-hit-panel${drumHitFlash ? ' drum-hit-panel--flash' : ''}`}
            aria-label="Drum hit trigger sensitivity"
          >
            <div className="drum-hit-panel-top row">
              <span className="drum-hit-panel-title">Swing → drum hit</span>
              <span className="drum-hit-panel-pct">{drumSensitivityPercent}%</span>
            </div>
            <div className="drum-hit-panel-visual" aria-hidden="true">
              {drumPulseSerial > 0 ? <span key={drumPulseSerial} className="drum-hit-pulse-ring" /> : null}
            </div>
            <div className="drum-hit-slider-wrap">
              <span className="drum-hit-slider-cap">Solid hits</span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={drumSensitivityPercent}
                className="drum-hit-slider"
                onChange={(event) => setDrumSensitivityPercent(Number(event.target.value))}
              />
              <span className="drum-hit-slider-cap">Hair trigger</span>
            </div>
            <div className="drum-hit-slider-wrap drum-volume-wrap">
              <span className="drum-hit-slider-cap">🔈</span>
              <input
                type="range"
                min={0}
                max={200}
                step={1}
                value={drumVolumePercent}
                className="drum-hit-slider drum-volume-slider"
                onChange={(event) => setDrumVolumePercent(Number(event.target.value))}
              />
              <span className="drum-hit-slider-cap">🔊</span>
              <span className="drum-hit-slider-cap drum-volume-readout">{drumVolumePercent}%</span>
            </div>
            <p className="drum-hit-live-line muted">
              <span>‖Δa‖ (last frame): {drumHud.jerkMag.toFixed(2)}</span>
              <span className="drum-hit-live-sep">|</span>
              <span>Threshold: {drumHud.threshold.toFixed(2)}</span>
              <span className="drum-hit-live-sep">|</span>
              <span className="drum-hit-last-gain">Last gain: {drumHud.lastGain.toFixed(2)}</span>
            </p>
            <p className="muted drum-hit-hint">
              Jerk = magnitude of change between consecutive accel samples (any direction). Threshold span {DRUM_THRESHOLD_MIN}–{DRUM_THRESHOLD_MAX} m/s² when sensitivity is 0–100%. Debounce {DRUM_DEBOUNCE_MS} ms + settle ‖Δa‖ &lt; {DRUM_SETTLE_DELTA} before re-arm.
            </p>
          </div>
        </div>
        </div>{/* end deck-drum-row */}
        <p className="filter-guide">
          {(() => {
            const guide = getFxGuide(controlMode)
            return (
              <>
                <span className="filter-left">{guide.left}</span>
                <span className="filter-center">{guide.center}</span>
                <span className="filter-right">{guide.right}</span>
              </>
            )
          })()}
        </p>
        <div className="track-library">
          <div className="track-library-top">
            <div>
              <p className="track-library-kicker">Track crate</p>
              <h3 className="track-library-heading">Library</h3>
            </div>
            <div className="track-library-top-actions">
              <span className="track-library-summary">
                {activeTrackId ? `Now playing: ${TRACK_LIBRARY[activeTrackId].title}` : 'Ready to cue'}
              </span>
              <button
                className={`secondary training-toggle ${trainingModeEnabled ? 'is-active' : ''}`}
                onClick={() => setTrainingModeEnabled((value) => !value)}
              >
                {trainingModeEnabled ? 'Training on' : 'Training off'}
              </button>
            </div>
          </div>
          <div className="track-library-body">
          {orderedTrackIds.map((trackId, i) => {
            const info = TRACK_LIBRARY[trackId]
            const timeline = trackTimeline[trackId]
            const isPlaying = trackPlaybackState[trackId]
            const elapsed = timeline?.currentTime ?? 0
            const duration = timeline?.duration ?? 0
            const remaining = Math.max(0, duration - elapsed)
            const progress = duration > 0 ? Math.min(100, (elapsed / duration) * 100) : 0
            const isTrainingTrack = trainingModeEnabled && trackId === TRAINING_TRACK_ID

            return (
              <article key={trackId} className={`track-library-row${isPlaying ? ' is-playing' : ''}`}>
                <div className="track-library-row-top">
                  <button className="track-play-btn" onClick={() => void toggleTrackPlayback(trackId)}>
                    {isPlaying ? '❚❚' : '▶'}
                  </button>
                  <div className="track-library-title">
                    <span className="track-num">{String(i + 1).padStart(2, '0')}</span>
                    {info.title}
                    <span className="track-library-artist">{info.artist}</span>
                  </div>
                  <span className={`track-live-indicator${isPlaying ? ' is-live' : ''}`}>
                    {isPlaying ? 'live' : 'queued'}
                  </span>
                </div>
                <div className="track-progress track-progress-inline">
                  <div className="track-progress-fill" style={{ width: `${progress}%` }} />
                </div>
                {isTrainingTrack ? (
                  <div className="training-panel">
                    <div className="training-panel-top">
                      <span className="training-label">Training mode · Levels</span>
                      <div className="training-scoreboard">
                        <span className="training-score-chip is-hit">Hits {trainingScore.hits}</span>
                        <span className="training-score-chip is-miss">Misses {trainingScore.misses}</span>
                        <span className="training-score-chip">Left {trainingScore.total - trainingScore.hits - trainingScore.misses}</span>
                      </div>
                      <span className="training-current">
                        {activeTrainingPrompt
                          ? formatTrainingInstruction(activeTrainingPrompt)
                          : nextTrainingPrompt
                            ? `Next: ${formatTrainingInstruction(nextTrainingPrompt)}`
                          : isPlaying
                            ? 'Ride back to neutral and wait for the next hold bar'
                            : 'Press play to start the lesson'}
                      </span>
                      <span className={`training-feedback${trainingFeedback ? ` is-${trainingFeedback.kind}` : ''}`}>
                        {trainingFeedback?.message ?? ''}
                      </span>
                    </div>
                    <div className="training-upcoming">
                      {upcomingTrainingPrompts.length > 0 ? (
                        upcomingTrainingPrompts.map((prompt) => (
                          <span
                            key={prompt.id}
                            className={`training-chip training-chip--${prompt.mode}${activeTrainingPrompt?.id === prompt.id ? ' is-current' : ''}`}
                          >
                            {formatTime(prompt.time)}-{formatTime(getTrainingPromptEnd(prompt))} · {formatTrainingPrompt(prompt, true)}
                          </span>
                        ))
                      ) : (
                        <span className="training-chip is-muted">More cues will appear as the song moves</span>
                      )}
                    </div>
                  </div>
                ) : null}
                <div className="track-library-meta">
                  <span className="track-library-bpm">{info.bpm} BPM</span>
                  <span className="track-library-time">
                    {formatTime(elapsed)}<span className="track-time-sep"> / </span>-{formatTime(remaining)}
                  </span>
                </div>
                <div className="track-library-actions">
                  <div className="cue-row">
                    {info.cues.map((cue, ci) => (
                      <button
                        key={`${trackId}-${cue.label}`}
                        className={`cue-dot cue-color-${ci}`}
                        title={cue.label}
                        onClick={() => void jumpToCue(trackId, cue)}
                      >
                        {ci + 1}
                      </button>
                    ))}
                  </div>
                </div>
              </article>
            )
          })}
          </div>
        </div>

      </section>

      <section className="sensor-grid">
        {SENSOR_DEFINITIONS.map((definition) => {
          const sensor = state.sensors[definition.id]
          return sensor ? <SensorCard key={definition.id} sensor={sensor} /> : null
        })}
      </section>

      {showConnectionPanel && (
        <div className="collapsible-section">
          <ConnectionPanel
            status={appConnectionStatus}
            canUseWebSerial={hasWebSerial}
            baudRate={DEFAULT_BAUD_RATE}
            onConnect={connect}
            onDisconnect={disconnect}
          />
          {connectionError ? <p className="error">{connectionError}</p> : null}
          <section className="panel notes-panel">
            <h2>Connection Debug</h2>
            <p className="muted">
              If connection is stuck, confirm Arduino Serial Monitor is closed and select the usbmodem port.
            </p>
            <div className="drum-debug-panel muted">
              <p className="drum-debug-title">Drum trigger (‖Δa‖ jerk)</p>
              <pre className="drum-debug-readout">{`‖Δa‖: ${drumHud.jerkMag.toFixed(3)}  ·  threshold (slider): ${drumHud.threshold.toFixed(2)}  ·  sensitivity: ${drumSensitivityPercent}%
last hit gain: ${drumHud.lastGain.toFixed(3)}  ·  debounce ${DRUM_DEBOUNCE_MS} ms  ·  settle < ${DRUM_SETTLE_DELTA}
sample: ${DRUM_SAMPLE_PATH}  ·  tweak maps in src/audio/drumTrigger.ts`}</pre>
            </div>
            <pre className="muted">{debugEvents.length > 0 ? debugEvents.join('\n') : 'No debug events yet.'}</pre>
          </section>
        </div>
      )}
    </main>
  )
}

export default App
