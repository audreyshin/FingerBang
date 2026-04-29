# FingerBang 🤚

**FingerBang** is a wearable DJ glove controller. You wear a sensor glove, connect it to your computer over USB, and use your hand to control music live — bend your fingers to morph the filter, flip through FX, and swing your wrist to trigger drum hits like an air drummer. Built for a class prototype, designed to feel like actual performance gear.

---

## What it does

- **Flex sensor → Filter / FX**: bending your finger(s) controls a real-time audio filter, bass shelf, reverb, or flanger effect on whatever track is playing. The further you bend, the stronger the effect.
- **Accelerometer → Drum hit**: a sharp wrist swing fires a one-shot drum sound (think: drumstick, not hand-waving). Motion magnitude is calculated every frame — cross the threshold and the sample plays. Gentle motion does nothing; hard swings hit loud.
- **Deck system**: 10 house/dance tracks, two virtual decks (A + B), cue points, waveform display, and a BPM readout.
- **Training mode**: a guided lesson that prompts you through specific bend movements while "Levels" by Avicii plays, and tells you if you hit or missed each cue.
- **Producer tags**: one-shot sound bites (Daytrip, F1lthy, etc.) you can fire as buttons.
- **Live sensor HUD**: real-time readout of all sensor values, calibration tracking, accel X/Y/Z graphs, and a drum trigger debug panel.

---

## Hardware

| Part | What it does |
|---|---|
| Arduino Uno (or compatible) | Reads sensors and sends data over USB serial |
| Flex sensor (e.g. Spectra Symbol) | Detects finger bend; wired as a voltage divider on analog pin `A0` |
| 10kΩ resistor | Voltage divider to ground for the flex sensor |
| LSM303 accelerometer/magnetometer (or similar 3-axis IMU) | Detects wrist motion for drum triggering |
| USB cable | Connects Arduino to your laptop |

**Wiring (flex sensor):**
```
3.3V or 5V → flex sensor → A0 → 10kΩ resistor → GND
```

**Serial format expected (Arduino sketch should output this):**
```
Flex:-42,X:0.12,Y:-9.81,Z:0.33
```
The parser is tolerant — it accepts `key:value` or `key=value`, lowercase `x/y/z`, and a few legacy formats. As long as those fields are somewhere in the serial line, it picks them up.

---

## Libraries used

| Library | Version | What it's for |
|---|---|---|
| **React** | 19 | UI rendering — all the panels, sliders, waveforms, and cards are React components |
| **React DOM** | 19 | Mounts the React app into the browser |
| **Vite** | 8 | Dev server and build tool — makes the whole thing fast to iterate on |
| **TypeScript** | 5.9 | Static types across everything so sensor data, audio engine state, and UI props are all type-checked |
| **Web Serial API** | (browser built-in) | Reads serial data from the Arduino over USB — no Node server needed, runs entirely in the browser |
| **Web Audio API** | (browser built-in) | The whole audio engine: filter node, reverb (convolver), flanger (delay + LFO oscillator), gain nodes, per-track analysers for waveforms, and `AudioBufferSourceNode` for drum one-shots |
| **ESLint + typescript-eslint** | 9 / 8 | Linting — catches issues while developing |

No audio processing libraries. No external UI frameworks. The filter, reverb, flanger, and LFO are all wired manually with the Web Audio API graph.

---

## Setup

### 1. Clone and install
```bash
git clone <your-repo-url>
cd FingerBang
npm install
```

### 2. Add audio files
The audio tracks live in `public/audio/`. They are **not included in the repository** (see Audio Notice below). You need to add your own versions of:

```
public/audio/Danza_Kuduro.mp3
public/audio/Toca_toca.mp3
public/audio/Y_Que_Fue.mp3
public/audio/replay.mp3
public/audio/levels.mp3
public/audio/goodFeeling.mp3
public/audio/tears.mp3
public/audio/breakfree.mp3
public/audio/daftpunk.mp3
public/audio/fisher-losing-it-extended.mp3
public/audio/drum.mp3
public/audio/daytrip.mp3
public/audio/f1lthy-producer-tag.mp3
public/audio/Voicy_Honorable C Note.mp3
public/audio/yo-pierre-or.mp3
```

The drum sound is a short one-shot hit sample (~200ms). Any kick, clap, or rimshot will work — just name it `drum.mp3`.

### 3. Start the dev server
```bash
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`) in **Chrome or Edge** (Web Serial requires a Chromium-based browser).

### 4. Connect the glove
1. Upload your Arduino sketch so it sends serial in the format: `Flex:<value>,X:<ax>,Y:<ay>,Z:<az>` at 9600 baud.
2. Plug the Arduino into USB.
3. Click **Setup** in the app header, then **Connect Serial Device**.
4. Pick the `usbmodem` (macOS) or `COM` port (Windows) from the browser picker.
5. The status badge in the header will flip to **linked**.

> Web Serial only works over `https` or `localhost`. The Vite dev server handles this automatically. If you deploy, make sure you're on HTTPS.

---

## How to use it

### Flex sensor (left hand side of the dashboard)
- **Bend left/right** to apply the selected FX to the mix.
- Switch between **Filter**, **Bass**, **Reverb**, and **Flanger** using the four buttons on the dashboard.
- The live readout shows bend value and effect intensity in real time.

### Drum trigger (IMU, right side)
- Once the glove is linked, **swing your wrist sharply** in any direction to trigger a drum hit.
- The sensitivity slider controls how hard you need to swing — drag toward "Hair trigger" if nothing fires, toward "Solid hits" if it fires too easily.
- The panel flashes gold on each hit. The debug readout shows the raw jerk magnitude vs. threshold so you can tune it.
- Gain is velocity-sensitive: soft tap = quiet hit, hard swing = loud hit.

### Deck controls
- Click ▶ on any track in the Library to start playing it. Only one track plays at a time — it auto-routes through the audio engine so your flex FX applies to it.
- Click the numbered cue buttons to jump to marked positions.
- **Deck A** shows the playing track, **Deck B** shows what's next.

### Training mode
- Enable it from the Library section header.
- Play "Levels" and follow the on-screen prompts — they tell you which FX mode to use and which direction to bend. Hit or miss is scored automatically.

---

## Project structure

```
src/
  audio/
    drumTrigger.ts          — jerk detection, debounce, gain math, AudioBufferSourceNode oneshot
  components/
    ConnectionPanel.tsx     — serial connect/disconnect UI
    HistoryGraph.tsx        — real-time trend graph component
    LiveBar.tsx             — animated bar for bend percentage
    SensorCard.tsx          — live X/Y/Z accel display + trend graphs
  config/
    sensors.ts              — sensor definitions and field mappings
  parsers/
    serialLineParser.ts     — key:value serial line parser, tolerant of formatting variations
  services/
    webSerialConnection.ts  — Web Serial connect/disconnect/line-read service
  state/
    sensorStateManager.ts   — React reducer: sensor runtime state, accel history, calibration
  types/
    sensor.ts               — shared TypeScript types for sensor data and state
    web-serial.d.ts         — type declarations for the Web Serial browser API
  App.tsx                   — main app: audio engine, FX graph, drum trigger interval, UI
  App.css                   — all styles
public/
  audio/                    — mp3 files (not included in repo, see Audio Notice)
  drip-frames/              — animation frame images
```

---

## Audio notice

The audio files used in this prototype were downloaded from the internet for **educational and demonstration purposes only** as part of a class project. They are **not included in this repository** and should **not be redistributed**.

In a future version, the intent is to integrate with a licensed streaming service (Apple Music, Spotify, etc.) so audio comes from the user's own library and plays back through the glove effects in real time — no local files needed.

All music copyright belongs to the respective artists and rights holders. This project does not claim ownership of any audio content.

---

## Credits

**Team:** Audrey Shin, Rebecca, Erika

**External assets:**
- Drum sample: sourced from the internet for educational use
- Producer tag sounds (Daytrip, F1lthy, Voicy, Yo Pierre): sourced from the internet for educational use
- Track audio: sourced from the internet for educational use, not for distribution

**References / tools:**
- [Web Serial API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API)
- [Web Audio API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [React](https://react.dev)
- [Vite](https://vitejs.dev)
- Arduino documentation for LSM303 and analog sensor wiring
