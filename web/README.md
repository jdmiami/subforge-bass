# SubForge Bass — 9:16 Vertical Full-Screen Pocket Bass Synth

A 100% mobile-responsive, zero-scroll vertical `9:16` full-screen Web Audio API bass synthesizer studio redesigned from the SubForge Bass Android app into a tactile boutique pocket hardware instrument.

## Highlights

- **Liquid-Metal Game Start & Pause Menu**: Launches into an interactive 60fps living ferrofluid mercury reactor screen with swipeable Bass Loadout selection (live `SUB`, `GRIT`, `CUT`, `WOB` stat meters + instant audio preview), Play Arena switcher, sculpted liquid-chrome **`▶ PLAY INSTRUMENT`** CTA, and 2×2 liquid-metal cards for `FORGE BASS`, `SCULPT RACK`, `GROOVE LAB`, and `BASS HUB`. Tap `☰` in the floating Game HUD anytime to return to the menu.
- **Flagship Infinite Open-Octave Liquid-Metal Morph Grid (`MORPH`)**: A boundless vertical ferrofluid lattice spanning infinite octaves (`C0` → `C7+`) with a right-edge **Infinite Octave Elevator Rail** (flick/drag with inertia), auto-climb/auto-dive edge scrolling during glides, tactile spring-physics taps, metaball liquid bridges, and taffy pull-to-wobble with snap-back sub-drop.
- **Second-Hand 14-Gesture Modulator Deck**: Dedicated independent multi-touch FX pad docked beneath the grid supporting 14 single-touch and multi-touch gestures simultaneously while you play—including Tap (`Sub-Punch`), Double Tap (`Sub-Dive`), Triple Tap (`1/32 Stutter`), Slide ↕ (`Filter Scream`), Slide ⇄ (`Analog Drive`), Circular Swirl (`Wobble LFO Spinner`), Shake (`Vibrato Thrash`), Hold (`Sub-Drone + Latch`), 2F Slide ↕ (`Whammy Pitch ±12st`), 2F Slide ⇄ (`Gate Chopper`), 2F Spread/Pinch (`Reese Chorus` vs `Laser Sub-Core`), 2F Twist (`Harmonic Phaser Dial`), and 2F/3F Tap (`Kill Slam` / `Clean Reset`).
- **100% Edge-to-Edge Full-Screen Performance Mode + Floating Game HUD Pill**: Full-screen mode hides all studio chrome and floats a minimal translucent Game HUD Pill that auto-dims while playing, lets you swipe left/right to hot-swap bass patches, tap to cycle play interfaces (`MORPH` ↔ `12-PAD` ↔ `GLIDE`), toggle playback, and open the Liquid-Metal Game Menu (`☰`).
- **3×4 Giant Vertical Silicone Drum Pads & Fretless Glide**: Classic velocity-sensitive chromatic pads (`C`–`B`) with multi-touch slide/strum and continuous fretless sub-bass glide remain 1 tap away.
- **Interactive Oscilloscope X/Y Expression Ribbon**: Touch and drag directly across the live 60fps waveform to bend Filter Cutoff (X) and Analog Drive + Resonance (Y) in real time, with `HOLD` latch.
- **`+ CREATE` Instrument Studio → Launch Full-Screen**:
  - **2D Sonic DNA Sculptor**: Drag across a live cymatics acoustic space (`Pure Sub ↔ Metallic FM` × `Warm Analog ↔ Aggressive Grit + Wobble`) with real-time audio audition.
  - **Voice Dictation & AI Prompt Forge** + 6 instant Sonic Mood presets.
  - **Custom Name & Hardware LED Swatches** + 1-tap **`USE IN FULL SCREEN ⛶`**.
- **Low-Latency Web Audio DSP Engine**: 6 oscillator topologies (`SINE`, `SAW`, `SQUARE`, `TRIANGLE`, `SUB_PULSE`, `FM_GROWL`), infinite-octave real-time synth triggers, multi-touch Liquid Morph continuous voices, master Gesture FX bus (phaser, Reese chorus, wobble LFO, rhythmic chopper, whammy pitch bend), and `tanh` analog saturation.
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
├── index.html               # 9:16 vertical full-screen studio shell, Liquid-Metal Game Menu, Game HUD & sheets
├── styles/
│   └── index.css            # Liquid-Metal & boutique obsidian hardware Vanilla CSS design system
└── js/
    ├── presets.js           # 12 original instruments, seed grooves & community patches
    ├── audio-engine.js      # Low-latency Web Audio API synth, infinite-octave engine & master Gesture FX bus
    ├── game-menu.js         # Living 60fps ferrofluid mercury reactor background for Liquid-Metal Game Menu
    ├── morph-grid.js        # Infinite Open-Octave Liquid-Metal Morph Grid physics & metaball renderer
    ├── gesture-modulator.js # Second-Hand 14-Gesture Multi-Touch FX Modulator Deck
    ├── ai-forge.js          # Semantic prompt synthesizer, cymatics renderer & voice controller
    └── app.js               # Full-screen vertical controller, Game Menu, Game HUD, pads & 2D Sonic DNA creator
```
