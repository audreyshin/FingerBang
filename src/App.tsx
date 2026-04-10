import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ConnectionPanel } from './components/ConnectionPanel'
import { SensorCard } from './components/SensorCard'
import { DEFAULT_BAUD_RATE, SENSOR_DEFINITIONS } from './config/sensors'
import { mapParsedValuesToSensorPacket, parseKeyValueSerialLine } from './parsers/serialLineParser'
import { WebSerialConnection } from './services/webSerialConnection'
import { useSensorStateManager } from './state/sensorStateManager'
import './App.css'

type TrackId = 'danzaKuduro' | 'tocaToca' | 'yQueFue' | 'replay' | 'levels' | 'goodFeeling'

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

const TRACK_IDS: TrackId[] = ['danzaKuduro', 'tocaToca', 'yQueFue', 'replay', 'levels', 'goodFeeling']

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
}

type FxType = 'reverb' | 'flanger'
type ControlMode = 'filter' | 'bass' | FxType

const CONTROL_MODE_OPTIONS: Array<{ id: ControlMode; title: string; detail: string }> = [
  { id: 'filter', title: 'Filter', detail: 'muffle / brighten' },
  { id: 'bass', title: 'Bass', detail: 'cut / boost lows' },
  { id: 'reverb', title: 'Reverb', detail: 'dream wash' },
  { id: 'flanger', title: 'Flanger', detail: 'swirl / jet' },
]

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
  const [filterStatus, setFilterStatus] = useState('Dry zone')
  const [debugEvents, setDebugEvents] = useState<string[]>([])
  const serialConnectionRef = useRef<WebSerialConnection | null>(null)
  const audioEngineRef = useRef<AudioEngine | null>(null)
  const waveformFrameRef = useRef<number | null>(null)
  const waveformLastPaintRef = useRef(0)
  const smoothedBendRef = useRef(0)
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

  const hasWebSerial = typeof navigator !== 'undefined' && Boolean(navigator.serial)
  const { state, setSensorConnectionStatus, updateSensorData, resetSensorData } = useSensorStateManager(
    SENSOR_DEFINITIONS,
  )

  const primarySensor = useMemo(() => SENSOR_DEFINITIONS[0], [])
  const primarySensorState = state.sensors[primarySensor.id]
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
      setSensorConnectionStatus(primarySensor.id, status)
      if (status === 'disconnected') {
        clearNoDataTimeout()
        hasReceivedSerialRef.current = false
        resetSensorData(primarySensor.id)
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

      const packet = mapParsedValuesToSensorPacket(parsed, primarySensor)
      if (Object.keys(packet.rawValues).length === 0 && Object.keys(packet.normalizedValues).length === 0) {
        pushDebugEvent('Parsed line had no mapped sensor fields')
        return
      }

      // Future mapping layer should subscribe to sensor state, not serial lines.
      updateSensorData(primarySensor.id, packet, primarySensor.calibrationField)
    })

    return () => {
      clearNoDataTimeout()
      disposeStatus()
      disposeLine()
      void serialConnection.disconnect()
      serialConnectionRef.current = null
    }
  }, [primarySensor, resetSensorData, setSensorConnectionStatus, updateSensorData])

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
    resetSensorData(primarySensor.id)
    pushDebugEvent('Disconnected and sensor state reset')
  }

  const appConnectionStatus = primarySensorState?.connectionStatus ?? 'disconnected'
  const bendValue = primarySensorState?.rawValues.biDirectional ?? 0
  const activeTrackId = TRACK_IDS.find((trackId) => trackPlaybackState[trackId]) ?? null
  const nextTrackId = activeTrackId
    ? TRACK_IDS[(TRACK_IDS.indexOf(activeTrackId) + 1) % TRACK_IDS.length]
    : TRACK_IDS[0]
  const primaryDeckId = activeTrackId ?? TRACK_IDS[0]
  const secondaryDeckId = nextTrackId

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

  // Called whenever new bend data arrives to keep the selected bend effect in sync.
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
    const tick = (now: number) => {
      const engine = audioEngineRef.current
      if (engine && now - waveformLastPaintRef.current > 90) {
        const waveformSnapshot = {} as Record<TrackId, number[]>
        TRACK_IDS.forEach((trackId) => {
          const analyzer = engine.analyzers[trackId]
          const data = new Uint8Array(analyzer.fftSize)
          analyzer.getByteTimeDomainData(data)

          const bars = 28
          const step = Math.max(1, Math.floor(data.length / bars))
          const levels: number[] = []
          for (let i = 0; i < bars; i++) {
            const sample = data[Math.min(data.length - 1, i * step)] ?? 128
            levels.push(Math.max(0.05, Math.abs(sample - 128) / 128))
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

          // Lerp toward target scale: big attack, slow decay
          const targetScale = 1 + bassEnergy * 0.09
          const currentScale = platterScaleRef.current[trackId] ?? 1
          const alpha = bassEnergy > currentScale - 1 ? 0.4 : 0.08
          platterScaleRef.current[trackId] = currentScale + (targetScale - currentScale) * alpha

          platter.style.transform = `scale(${platterScaleRef.current[trackId].toFixed(4)})`

          // Drip crossfade animation using individual frame PNGs
          const dripWrap = dripWrapRefs.current[trackId]
          const imgs = dripImgPairRef.current[trackId]
          if (dripWrap && imgs) {
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

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">experience euphoria</p>
        </div>
        <div className="header-meta">
          <span className={`status-badge status-${appConnectionStatus}`}>
            {appConnectionStatus === 'connected' ? 'linked' : appConnectionStatus === 'connecting' ? 'linking...' : 'unlinked'}
          </span>
          <button className="secondary" onClick={() => setShowConnectionPanel((v) => !v)}>
            {showConnectionPanel ? 'Hide Setup ↑' : 'Setup ↓'}
          </button>
        </div>
      </header>

      <section className="panel notes-panel">
        <h2>DJ Booth</h2>
        <div className="booth-meta row">
          <span className="booth-filter-status">{filterStatus}</span>
          <span className="booth-deck-status">
            {activeTrackId ? `▶ ${TRACK_LIBRARY[activeTrackId].title}` : '— stopped —'}
            {' '}· up next: {TRACK_LIBRARY[nextTrackId].title}
          </span>
        </div>
        {audioError ? <p className="error">{audioError}</p> : null}
        <div className="deck-stage">
          {[primaryDeckId, secondaryDeckId].map((trackId, index) => {
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
                  {/* Drip crossfade layer — behind the platter via z-index */}
                  <div
                    ref={(el) => {
                      dripWrapRefs.current[trackId] = el ?? undefined
                    }}
                    className="deck-drip-wrap"
                  >
                    {/* Two images alternate opacity for smooth crossfade */}
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
                  className={`selector-tile ${controlMode === option.id ? 'is-active' : ''}`}
                  onClick={() => setControlMode(option.id)}
                >
                  <span className="selector-title">{option.title}</span>
                  <span className="selector-detail">{option.detail}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
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
          <div className="track-library-header">
            <span></span>
            <span>Title</span>
            <span>Artist</span>
            <span>BPM</span>
            <span>Time</span>
            <span>Cues</span>
          </div>
          {TRACK_IDS.map((trackId, i) => {
            const info = TRACK_LIBRARY[trackId]
            const timeline = trackTimeline[trackId]
            const isPlaying = trackPlaybackState[trackId]
            const elapsed = timeline?.currentTime ?? 0
            const duration = timeline?.duration ?? 0
            const remaining = Math.max(0, duration - elapsed)
            const progress = duration > 0 ? Math.min(100, (elapsed / duration) * 100) : 0

            return (
              <article key={trackId} className={`track-library-row${isPlaying ? ' is-playing' : ''}`}>
                <button className="track-play-btn" onClick={() => void toggleTrackPlayback(trackId)}>
                  {isPlaying ? '❚❚' : '▶'}
                </button>
                <div className="track-library-title">
                  <span className="track-num">{String(i + 1).padStart(2, '0')}</span>
                  {info.title}
                  <div className="track-progress track-progress-inline">
                    <div className="track-progress-fill" style={{ width: `${progress}%` }} />
                  </div>
                </div>
                <span className="track-library-artist">{info.artist}</span>
                <span className="track-library-bpm">{info.bpm}</span>
                <span className="track-library-time">
                  {formatTime(elapsed)}<span className="track-time-sep"> / </span>-{formatTime(remaining)}
                </span>
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
              </article>
            )
          })}
        </div>
      </section>

      <section className="sensor-grid">
        {Object.values(state.sensors).map((sensor) => (
          <SensorCard key={sensor.id} sensor={sensor} />
        ))}
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
            <pre className="muted">{debugEvents.length > 0 ? debugEvents.join('\n') : 'No debug events yet.'}</pre>
          </section>
        </div>
      )}
    </main>
  )
}

export default App
