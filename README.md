# Fingerbang Sensor Foundation (v1)

React + TypeScript + Vite foundation for wearable interaction input systems.

This version intentionally does only:
- serial connection
- sensor data ingestion/parsing
- live visualization
- sensor state + calibration tracking

This version intentionally does **not** do:
- sensor-to-behavior mapping
- sound, visuals, triggers, effects

## Hardware Input (Current)

- Arduino Uno
- Flex sensor connected to an analog pin (for example: `A0`)
- 10k resistor as voltage divider (`A0` to resistor to `GND`)
- Uno connected to the computer via USB
- Serial data is sent over USB (not Bluetooth, not WiFi)
- Serial format:

`Raw:523,Min:498,Max:611,BiDirectional_Value:-37`

## Connection Model

- The app connects through the browser Web Serial API over USB.
- The device is treated as a generic serial device.
- The browser port picker can select any available serial port (for example: `usbmodem*` or `COM*`).
- No board-name hardcoding is required.
- The app derives `Bend %` from the absolute value of signed bend fields.

## Run Locally

1. Install dependencies:
   - `npm install`
2. Start dev server:
   - `npm run dev`
3. Open the URL printed by Vite in a Chromium-based browser.
4. Connect your Uno (or another serial microcontroller) by USB.
5. Click **Connect Serial Device** in the app and select the serial port.

> Web Serial requires a secure context (`https` or `localhost`) and a compatible browser.

## Project Structure

```txt
src/
  components/
    ConnectionPanel.tsx
    HistoryGraph.tsx
    LiveBar.tsx
    SensorCard.tsx
  config/
    sensors.ts
  parsers/
    serialLineParser.ts
  services/
    webSerialConnection.ts
  state/
    sensorStateManager.ts
  types/
    sensor.ts
    web-serial.d.ts
  App.tsx
```

## Architecture Layers

### 1) Serial Connection Layer
- `src/services/webSerialConnection.ts`
- Handles Web Serial connect/disconnect lifecycle.
- Reads streaming serial text and emits lines to subscribers.

### 2) Data Parser Layer
- `src/parsers/serialLineParser.ts`
- Parses generic `key:value,key:value` serial lines.
- Maps parsed keys into sensor-level raw and normalized fields using sensor definitions.

### 3) Sensor State Manager
- `src/state/sensorStateManager.ts`
- Stores runtime state by sensor id:
  - id
  - type
  - raw values
  - normalized values
  - connection status
  - calibration min/max
  - recent history for visualization

### 4) UI Components
- `src/components/ConnectionPanel.tsx`: status + connect/disconnect controls
- `src/components/SensorCard.tsx`: live values + calibration
- `src/components/LiveBar.tsx`: animated bend percentage bar (0-100)
- `src/components/HistoryGraph.tsx`: real-time trend graph

## How to Add More Sensors Later

1. Add a new definition in `src/config/sensors.ts`:
   - unique `id`
   - `type` (`flex`, `imu`, etc)
   - serial field mapping (`raw` and `normalized`)
   - optional calibration source field
2. Add any new UI representation in `src/components/`.
3. If incoming format changes, extend parsing logic in `src/parsers/serialLineParser.ts`.

The state manager and UI rendering already iterate by sensor id, so this is prepared for multi-sensor growth.

## How to Add Mapping Layer Later (Intentionally Deferred)

When you are ready to map sensor input to behaviors:
1. Add a new module (e.g. `src/mappings/`).
2. Subscribe to sensor state updates (from the state manager).
3. Keep mapping logic isolated from serial/parser/state layers.

This separation preserves the architecture and prevents input transport concerns from being coupled to behavior logic.
