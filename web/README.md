# SubForge Bass — 9:16 Vertical Full-Screen Pocket Bass Synth

A 100% mobile-responsive, zero-scroll vertical `9:16` full-screen Web Audio API bass synthesizer studio redesigned from the SubForge Bass Android app into a tactile boutique pocket hardware instrument.

## Highlights

- **Flagship Liquid-Metal Morph Grid (`MORPH`)**: A fluid, game-like ferrofluid Canvas instrument where 12 spring-physics bass cells react like tactile buttons on tap (with ripple shockwaves, micro-shake, and haptics), magnetically swell and fuse with metaball liquid bridges when you swipe across notes for continuous portamento pitch glide, and stretch like taffy to crank live Filter Cutoff, Resonance, Drive, and Wobble LFO (with elastic sub-drop snap-back on release).
- **100% Edge-to-Edge Full-Screen Performance Mode + Floating Game HUD Pill**: Full-screen mode hides all studio chrome and floats a minimal translucent Game HUD Pill that auto-dims while playing, lets you swipe left/right to hot-swap bass patches, tap to cycle play interfaces (`MORPH` ↔ `12-PAD` ↔ `GLIDE`), and toggle playback.
- **3×4 Giant Vertical Silicone Drum Pads & Fretless Glide**: Classic velocity-sensitive chromatic pads (`C`–`B`) with multi-touch slide/strum and continuous fretless sub-bass glide remain 1 tap away.
- **Interactive Oscilloscope X/Y Expression Ribbon**: Touch and drag directly across the live 60fps waveform to bend Filter Cutoff (X) and Analog Drive + Resonance (Y) in real time, with `HOLD` latch.
- **`+ CREATE` Instrument Studio → Launch Full-Screen**:
  - **2D Sonic DNA Sculptor**: Drag across a live cymatics acoustic space (`Pure Sub ↔ Metallic FM` × `Warm Analog ↔ Aggressive Grit + Wobble`) with real-time audio audition.
  - **Voice Dictation & AI Prompt Forge** + 6 instant Sonic Mood presets.
  - **Custom Name & Hardware LED Swatches** + 1-tap **`USE IN FULL SCREEN ⛶`**.
- **Low-Latency Web Audio DSP Engine**: 6 oscillator topologies (`SINE`, `SAW`, `SQUARE`, `TRIANGLE`, `SUB_PULSE`, `FM_GROWL`), 808 pitch-drop transient, multi-touch Liquid Morph continuous voices, sub-octave sine layer, Bluetooth psychoacoustic harmonic exciter, SVF resonant filter, and `tanh` analog saturation.
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
├── index.html          # 9:16 vertical full-screen studio shell, Floating Game HUD & slide-up sheets
├── styles/
│   └── index.css       # Boutique hardware Vanilla CSS design system & edge-to-edge Zen HUD
└── js/
    ├── presets.js      # 12 original instruments, seed grooves & community patches
    ├── audio-engine.js # Low-latency Web Audio API synth, multi-touch Liquid Morph voices, XY FX & .mid export
    ├── morph-grid.js   # Flagship Liquid-Metal Morph Grid physics, metaball bridges & ferrofluid renderer
    ├── ai-forge.js     # Semantic prompt synthesizer, cymatics renderer & voice controller
    └── app.js          # Full-screen vertical controller, Game HUD, multi-touch pads & 2D Sonic DNA creator
```
