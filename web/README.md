# SubForge Bass — 9:16 Vertical Full-Screen Pocket Bass Synth

A 100% mobile-responsive, zero-scroll vertical `9:16` full-screen Web Audio API bass synthesizer studio redesigned from the SubForge Bass Android app into a tactile boutique pocket hardware instrument.

## Highlights

- **Zero-Scroll `9:16` Full-Screen Stage**: Edge-to-edge `100dvh × 100vw` layout on mobile devices (and centered `9:16` handheld proportion on wider screens) with a 1-tap **Full-Screen Zen Performance Mode** (`⛶`).
- **3×4 Giant Vertical Silicone Drum Pads**: Velocity-sensitive chromatic pads (`C`–`B`) with multi-touch **slide/strum** support and 6 procedural Canvas hit visualizers.
- **Dual Full-Screen Play Surfaces (`12-PAD` ↔ `GLIDE`)**: Switch between the 12-pad matrix and a **Full-Screen Continuous Fretless Sub-Bass Glide Surface** (vertical pitch slide + horizontal resonant filter sweep).
- **Interactive Oscilloscope X/Y Expression Ribbon**: Touch and drag directly across the live 60fps waveform to bend Filter Cutoff (X) and Analog Drive + Resonance (Y) in real time, with `HOLD` latch.
- **`+ CREATE` Instrument Studio → Launch Full-Screen**:
  - **2D Sonic DNA Sculptor**: Drag across a live cymatics acoustic space (`Pure Sub ↔ Metallic FM` × `Warm Analog ↔ Aggressive Grit + Wobble`) with real-time audio audition.
  - **Voice Dictation & AI Prompt Forge** + 6 instant Sonic Mood presets.
  - **Custom Name & Hardware LED Swatches** + 1-tap **`USE IN FULL SCREEN ⛶`**.
- **Low-Latency Web Audio DSP Engine**: 6 oscillator topologies (`SINE`, `SAW`, `SQUARE`, `TRIANGLE`, `SUB_PULSE`, `FM_GROWL`), 808 pitch-drop transient, sub-octave sine layer, Bluetooth psychoacoustic harmonic exciter, SVF resonant filter, and `tanh` analog saturation.
- **Slide-Up Studio Drawers**: Real-time **Sculpt DSP** faders, **4×4 16-Step Sequencer** (with swing, CC#74 filter automation, AI Groove generator, and Standard `.mid` file export), **Instrument Bank** (12 originals + custom forged patches), and **Community Bass Hub**.

## Run Locally

Open `index.html` through any local static server (required for ES modules):

```bash
npx serve .
# or
python3 -m http.server 8080
```

Then open `http://localhost:8080` on desktop or mobile.

## Project Structure

```text
├── index.html          # 9:16 vertical full-screen studio shell & slide-up sheets
├── styles/
│   └── index.css       # Boutique hardware Vanilla CSS design system
└── js/
    ├── presets.js      # 12 original instruments, seed grooves & community patches
    ├── audio-engine.js # Low-latency Web Audio API synth, XY FX bus, Fretless Glide & .mid export
    ├── ai-forge.js     # Semantic prompt synthesizer, cymatics renderer & voice controller
    └── app.js          # Full-screen vertical controller, multi-touch pads & 2D Sonic DNA creator
```
