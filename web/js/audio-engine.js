/**
 * SubForge Bass — Low-Latency Web Audio API Bass Synthesizer Engine (9:16 Mobile Edition)
 * Features:
 * - 12-note pre-rendered chromatic PCM buffers (6 topologies, 808 pitch-drop, SVF LPF, tanh drive, BT exciter)
 * - Live Master X/Y Expression Filter Bus (touch-interactive oscilloscope cutoff/resonance sweep)
 * - Continuous Fretless Glide Voice (full-screen thumb portamento pitch + filter synth)
 * - Live AnalyserNode oscilloscope, WebMIDI output, and Standard MIDI (.mid) export
 */

import { generate12NotePads } from './presets.js';

function makeDistortionCurve(amount = 0.35) {
  const samples = 512;
  const curve = new Float32Array(samples);
  const k = 1 + amount * 14;
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = Math.tanh(x * k);
  }
  return curve;
}

export class WebBassAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.xyFilter = null;
    this.xyDrive = null;
    this.limiter = null;
    this.analyser = null;
    this.sampleRate = 44100;
    this.masterVolume = 0.88;
    this.btSubBoostEnabled = true;

    // Live X/Y expression state (default neutral/open)
    this.xyActive = false;
    this.xyX = 0.72; // Filter cutoff 0..1
    this.xyY = 0.25; // Resonance + drive punch 0..1

    this.currentInstrument = null;
    this.currentOctaveShift = 0;
    this.padBuffers = new Array(12).fill(null);
    this.activePadSources = new Array(12).fill(null);
    this.scopeData = new Float32Array(256);

    // Continuous Fretless Glide voice nodes
    this.glideVoice = null;

    // Optional WebMIDI access
    this.midiOutputs = [];
    this.selectedMidiOutput = null;
    this.initWebMidi();
  }

  ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx({ latencyHint: 'interactive' });
      this.sampleRate = this.ctx.sampleRate || 44100;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.masterVolume;

      // Live X/Y Expression Bus
      this.xyDrive = this.ctx.createWaveShaper();
      this.xyDrive.curve = makeDistortionCurve(0.08);
      this.xyDrive.oversample = '2x';

      this.xyFilter = this.ctx.createBiquadFilter();
      this.xyFilter.type = 'lowpass';
      this.xyFilter.frequency.value = 14000;
      this.xyFilter.Q.value = 0.8;

      this.limiter = this.ctx.createDynamicsCompressor();
      this.limiter.threshold.value = -3;
      this.limiter.knee.value = 6;
      this.limiter.ratio.value = 12;
      this.limiter.attack.value = 0.002;
      this.limiter.release.value = 0.08;

      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.74;
      this.scopeData = new Float32Array(this.analyser.fftSize);

      this.masterGain.connect(this.xyDrive);
      this.xyDrive.connect(this.xyFilter);
      this.xyFilter.connect(this.limiter);
      this.limiter.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);

      if (this.currentInstrument) {
        this.synthesizeAllPads(this.currentInstrument, this.currentOctaveShift);
      }
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Real-time X/Y expression modulation directly from touching the oscilloscope ribbon.
   */
  setXyExpression(normX, normY, active = true) {
    this.xyX = Math.max(0, Math.min(1, normX));
    this.xyY = Math.max(0, Math.min(1, normY));
    this.xyActive = active;
    if (!this.ctx || !this.xyFilter) return;

    const now = this.ctx.currentTime;
    if (active) {
      // Logarithmic cutoff sweep from 90Hz to 7200Hz
      const freq = 90 * Math.pow(80, this.xyX);
      const q = 0.7 + this.xyY * 11.5;
      this.xyFilter.frequency.setTargetAtTime(freq, now, 0.015);
      this.xyFilter.Q.setTargetAtTime(q, now, 0.015);
      this.xyDrive.curve = makeDistortionCurve(0.08 + this.xyY * 0.72);
    } else {
      this.xyFilter.frequency.setTargetAtTime(14000, now, 0.06);
      this.xyFilter.Q.setTargetAtTime(0.8, now, 0.06);
      this.xyDrive.curve = makeDistortionCurve(0.06);
    }
  }

  getStatus() {
    const rate = this.ctx ? this.ctx.sampleRate : 44100;
    const baseLat = this.ctx && typeof this.ctx.baseLatency === 'number'
      ? Math.max(2.4, this.ctx.baseLatency * 1000)
      : 4.1;
    return {
      isLive: Boolean(this.ctx && this.ctx.state === 'running'),
      sampleRateHz: rate,
      estimatedLatencyMs: baseLat,
      btSubBoostEnabled: this.btSubBoostEnabled,
      midiDeviceCount: this.midiOutputs.length,
    };
  }

  setMasterVolume(vol) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.015);
    }
  }

  setBtSubBoost(enabled) {
    this.btSubBoostEnabled = Boolean(enabled);
    if (this.currentInstrument) {
      this.synthesizeAllPads(this.currentInstrument, this.currentOctaveShift);
    }
  }

  loadInstrument(instrument, octaveShift = 0) {
    this.currentInstrument = { ...instrument };
    this.currentOctaveShift = octaveShift;
    if (this.ctx) {
      this.synthesizeAllPads(this.currentInstrument, octaveShift);
    }
  }

  synthesizeAllPads(instrument, octaveShift = 0) {
    if (!this.ctx) return;
    const pads = generate12NotePads(instrument, octaveShift);
    for (let i = 0; i < 12; i++) {
      this.padBuffers[i] = this.renderPadBuffer(instrument, pads[i]);
    }
  }

  renderPadBuffer(instrument, spec) {
    const sr = this.sampleRate;
    const attackMs = Math.max(1, instrument.attackMs || 6);
    const decayMs = Math.max(80, instrument.decayMs || 520);
    const totalDurationSec = Math.max(0.24, Math.min(1.5, (attackMs + decayMs) / 1000));
    const numSamples = Math.floor(sr * totalDurationSec);

    const buffer = this.ctx.createBuffer(1, numSamples, sr);
    const out = buffer.getChannelData(0);

    const freq = Math.max(28, Math.min(880, spec.frequencyHz));
    const subFreq = freq * 0.5;
    const detuneFreq = freq * 1.008;
    const attackSamples = Math.max(12, Math.floor((attackMs / 1000) * sr));
    const decaySamples = Math.max(64, numSamples - attackSamples);

    const baseCutoff = Math.max(90, Math.min(7500, instrument.cutoffHz * (spec.filterModMultiplier || 1)));
    const resClamped = Math.max(0, Math.min(0.92, instrument.resonance));
    const resQ = Math.max(0.18, Math.min(1.0, 1.0 - resClamped * 0.80));
    const driveGain = 1.35 + Math.max(0, Math.min(1, instrument.drive)) * 4.5;
    const subMix = Math.max(0, Math.min(1, instrument.subOctaveMix));
    const mainMix = Math.max(0.45, Math.min(1, 1 - subMix * 0.35));
    const lfoRate = instrument.lfoRateHz || 2.0;
    const lfoDepth = instrument.lfoDepth || 0.15;
    const waveform = instrument.waveform || 'SINE';
    const btBoost = this.btSubBoostEnabled;

    let phase = 0;
    let subPhase = 0;
    let detunePhase = 0;
    let low = 0;
    let band = 0;
    const TWO_PI = Math.PI * 2;

    for (let i = 0; i < numSamples; i++) {
      const t = i / sr;
      const pitchDropEnv = Math.exp(-t * 58.0);
      const instFreq = freq * (1.0 + 0.55 * pitchDropEnv);

      let ampEnv;
      if (i < attackSamples) {
        ampEnv = i / attackSamples;
      } else {
        const progress = (i - attackSamples) / decaySamples;
        ampEnv = Math.exp(-3.4 * progress);
      }

      const lfoVal = Math.sin(TWO_PI * lfoRate * t);
      const filterEnv = Math.exp(-t * 4.2);
      const modCutoff = Math.max(
        80,
        Math.min(8500, baseCutoff * (0.55 + 0.95 * filterEnv) * (1.0 + lfoDepth * 0.65 * lfoVal))
      );

      let rawOsc = 0;
      if (waveform === 'SINE') {
        rawOsc = Math.sin(TWO_PI * phase) + 0.22 * Math.sin(4 * Math.PI * phase) * filterEnv;
      } else if (waveform === 'SAW') {
        const saw1 = 2 * (phase - Math.floor(phase + 0.5));
        const saw2 = 2 * (detunePhase - Math.floor(detunePhase + 0.5));
        rawOsc = (saw1 + saw2) * 0.58;
      } else if (waveform === 'SQUARE') {
        rawOsc = Math.sin(TWO_PI * phase) >= 0 ? 0.88 : -0.88;
      } else if (waveform === 'TRIANGLE') {
        rawOsc = 2 * Math.abs(2 * (phase - Math.floor(phase + 0.5))) - 1;
      } else if (waveform === 'SUB_PULSE') {
        const pw = 0.35 + 0.25 * lfoVal;
        const pulse = (phase % 1) < pw ? 0.9 : -0.9;
        rawOsc = pulse * 0.68 + Math.sin(TWO_PI * phase) * 0.38;
      } else if (waveform === 'FM_GROWL') {
        const modIdx = 2.6 + instrument.drive * 4.2 * filterEnv;
        const modulator = Math.sin(TWO_PI * (phase * 2.0)) * modIdx;
        rawOsc = Math.sin(TWO_PI * phase + modulator);
      }

      const subOsc = Math.sin(TWO_PI * subPhase);
      const btExciter = btBoost
        ? 0.32 * Math.sin(4 * Math.PI * phase) +
          0.18 * Math.cos(6 * Math.PI * phase) +
          0.10 * Math.sin(8 * Math.PI * phase) * filterEnv
        : 0.08 * Math.sin(4 * Math.PI * phase);

      const mixedInput = rawOsc * mainMix + subOsc * subMix + btExciter;

      const f = Math.max(0.02, Math.min(0.92, 2.0 * Math.sin((Math.PI * modCutoff) / sr)));
      low += f * band;
      const high = mixedInput - low - resQ * band;
      band += f * high;

      const tailFade = i > numSamples - 256 ? (numSamples - i) / 256 : 1.0;
      const signal = low * 0.78 + mixedInput * 0.22;
      out[i] = Math.tanh(signal * driveGain) * ampEnv * tailFade * 0.88;

      phase = (phase + instFreq / sr) % 1.0;
      subPhase = (subPhase + subFreq / sr) % 1.0;
      detunePhase = (detunePhase + detuneFreq / sr) % 1.0;
    }

    return buffer;
  }

  triggerPad(padIndex, velocity = 0.92, filterMod = null, scheduledTime = null) {
    const ctx = this.ensureContext();
    const idx = Math.max(0, Math.min(11, padIndex));
    const safeVel = Math.max(0.15, Math.min(1.0, velocity));

    if (!this.padBuffers[idx] && this.currentInstrument) {
      const pads = generate12NotePads(this.currentInstrument, this.currentOctaveShift);
      this.padBuffers[idx] = this.renderPadBuffer(this.currentInstrument, pads[idx]);
    }
    const buf = this.padBuffers[idx];
    if (!buf) return;

    const startTime = scheduledTime !== null ? scheduledTime : ctx.currentTime;

    const prev = this.activePadSources[idx];
    if (prev && scheduledTime === null) {
      try {
        prev.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.006);
        prev.source.stop(ctx.currentTime + 0.025);
      } catch (_) {}
    }

    const source = ctx.createBufferSource();
    source.buffer = buf;

    if (filterMod !== null && filterMod !== undefined) {
      source.playbackRate.value = Math.max(0.92, Math.min(1.12, 0.985 + filterMod * 0.03));
    }

    const voiceGain = ctx.createGain();
    voiceGain.gain.setValueAtTime(safeVel, startTime);

    if (filterMod !== null && filterMod !== undefined) {
      const tilt = ctx.createBiquadFilter();
      tilt.type = 'lowpass';
      tilt.frequency.setValueAtTime(220 + filterMod * 5200, startTime);
      tilt.Q.setValueAtTime(1.2 + filterMod * 4.0, startTime);
      source.connect(tilt);
      tilt.connect(voiceGain);
    } else {
      source.connect(voiceGain);
    }

    voiceGain.connect(this.masterGain);
    source.start(startTime);

    this.activePadSources[idx] = { source, gain: voiceGain };
    source.onended = () => {
      if (this.activePadSources[idx] && this.activePadSources[idx].source === source) {
        this.activePadSources[idx] = null;
      }
    };
  }

  /**
   * Continuous Fretless Glide Bass Voice for Full-Screen Expressive Slide Playing!
   */
  startGlideVoice(freqHz, filterNorm = 0.5) {
    const ctx = this.ensureContext();
    this.stopGlideVoice();

    const inst = this.currentInstrument || {
      waveform: 'SAW', subOctaveMix: 0.7, cutoffHz: 900, resonance: 0.45, drive: 0.45, lfoRateHz: 2.5, lfoDepth: 0.25,
    };

    const wfMap = {
      SINE: 'sine',
      SAW: 'sawtooth',
      SQUARE: 'square',
      TRIANGLE: 'triangle',
      SUB_PULSE: 'square',
      FM_GROWL: 'sawtooth',
    };

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = wfMap[inst.waveform] || 'sawtooth';
    osc.frequency.setValueAtTime(freqHz, now);

    const oscDetune = ctx.createOscillator();
    oscDetune.type = wfMap[inst.waveform] || 'sawtooth';
    oscDetune.frequency.setValueAtTime(freqHz * 1.007, now);

    const subOsc = ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(freqHz * 0.5, now);

    const mainGain = ctx.createGain();
    mainGain.gain.value = 0.52;
    const subGain = ctx.createGain();
    subGain.gain.value = Math.max(0.2, inst.subOctaveMix * 0.75);

    const shaper = ctx.createWaveShaper();
    shaper.curve = makeDistortionCurve(0.2 + inst.drive * 0.7);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    const cut = 110 * Math.pow(52, Math.max(0, Math.min(1, filterNorm)));
    filter.frequency.setValueAtTime(cut, now);
    filter.Q.setValueAtTime(1.0 + inst.resonance * 10, now);

    const lfo = ctx.createOscillator();
    lfo.frequency.value = Math.max(0.2, inst.lfoRateHz || 2.0);
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = cut * (inst.lfoDepth || 0.2) * 0.45;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    const envGain = ctx.createGain();
    envGain.gain.setValueAtTime(0.0001, now);
    envGain.gain.exponentialRampToValueAtTime(0.75, now + 0.018);

    osc.connect(mainGain);
    oscDetune.connect(mainGain);
    subOsc.connect(subGain);
    mainGain.connect(shaper);
    subGain.connect(shaper);
    shaper.connect(filter);
    filter.connect(envGain);
    envGain.connect(this.masterGain);

    osc.start(now);
    oscDetune.start(now);
    subOsc.start(now);
    lfo.start(now);

    this.glideVoice = { osc, oscDetune, subOsc, lfo, filter, envGain };
  }

  moveGlideVoice(freqHz, filterNorm = 0.5) {
    if (!this.glideVoice || !this.ctx) return;
    const now = this.ctx.currentTime;
    const safeF = Math.max(26, Math.min(880, freqHz));
    this.glideVoice.osc.frequency.setTargetAtTime(safeF, now, 0.016);
    this.glideVoice.oscDetune.frequency.setTargetAtTime(safeF * 1.007, now, 0.016);
    this.glideVoice.subOsc.frequency.setTargetAtTime(safeF * 0.5, now, 0.016);

    const cut = 110 * Math.pow(52, Math.max(0, Math.min(1, filterNorm)));
    this.glideVoice.filter.frequency.setTargetAtTime(cut, now, 0.018);
  }

  stopGlideVoice() {
    if (!this.glideVoice || !this.ctx) return;
    const v = this.glideVoice;
    this.glideVoice = null;
    const now = this.ctx.currentTime;
    try {
      v.envGain.gain.cancelScheduledValues(now);
      v.envGain.gain.setTargetAtTime(0.0001, now, 0.032);
      setTimeout(() => {
        try {
          v.osc.stop();
          v.oscDetune.stop();
          v.subOsc.stop();
          v.lfo.stop();
        } catch (_) {}
      }, 150);
    } catch (_) {}
  }

  auditionInstrumentRiff(instrument) {
    const ctx = this.ensureContext();
    const pads = generate12NotePads(instrument, 0);
    const riff = [0, 3, 5, 7, 10, 7, 3, 0];
    const stepSec = 0.14;
    const now = ctx.currentTime + 0.02;

    riff.forEach((padIdx, step) => {
      const buf = this.renderPadBuffer(instrument, pads[padIdx]);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = step % 4 === 0 ? 0.92 : 0.76;
      src.connect(g);
      g.connect(this.masterGain);
      src.start(now + step * stepSec);
    });
  }

  auditionSingleNote(instrument, padIndex = 0) {
    const ctx = this.ensureContext();
    const pads = generate12NotePads(instrument, 0);
    const buf = this.renderPadBuffer(instrument, pads[padIndex]);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = 0.85;
    src.connect(g);
    g.connect(this.masterGain);
    src.start(ctx.currentTime + 0.01);
  }

  readOscilloscope() {
    if (!this.analyser) return null;
    this.analyser.getFloatTimeDomainData(this.scopeData);
    return this.scopeData;
  }

  async initWebMidi() {
    if (typeof navigator === 'undefined' || typeof navigator.requestMIDIAccess !== 'function') return;
    try {
      const access = await navigator.requestMIDIAccess();
      const refresh = () => {
        this.midiOutputs = Array.from(access.outputs.values());
        this.selectedMidiOutput = this.midiOutputs[0] || null;
      };
      refresh();
      access.onstatechange = refresh;
    } catch (_) {}
  }

  sendMidiNote(channel, midiNote, velocity7Bit, cutoffCc = 64) {
    if (!this.selectedMidiOutput) return;
    const ch = Math.max(0, Math.min(15, channel - 1));
    try {
      this.selectedMidiOutput.send([0xb0 | ch, 74, Math.max(0, Math.min(127, cutoffCc))]);
      this.selectedMidiOutput.send([0x90 | ch, midiNote, Math.max(1, Math.min(127, velocity7Bit))]);
      setTimeout(() => {
        try {
          this.selectedMidiOutput?.send([0x80 | ch, midiNote, 0]);
        } catch (_) {}
      }, 180);
    } catch (_) {}
  }

  buildStandardMidiBlob(steps, bpm, channel = 1, octaveShift = 0) {
    const tpq = 480;
    const stepTicks = tpq / 4;
    const ch = Math.max(0, Math.min(15, channel - 1));
    const tempoUs = Math.round(60000000 / Math.max(40, Math.min(240, bpm)));

    const writeVarLen = (val) => {
      const out = [];
      let buffer = val & 0x7f;
      while ((val >>= 7) > 0) {
        buffer <<= 8;
        buffer |= (val & 0x7f) | 0x80;
      }
      while (true) {
        out.push(buffer & 0xff);
        if (buffer & 0x80) buffer >>= 8;
        else break;
      }
      return out;
    };

    const track = [];
    track.push(0x00, 0xff, 0x51, 0x03, (tempoUs >> 16) & 0xff, (tempoUs >> 8) & 0xff, tempoUs & 0xff);

    let pendingDelta = 0;
    steps.forEach((step) => {
      if (step.active) {
        const midiNote = Math.max(12, Math.min(108, 36 + octaveShift * 12 + step.noteIndex));
        const vel = Math.max(1, Math.min(127, Math.round(step.velocity * 127)));
        const cc74 = Math.max(0, Math.min(127, Math.round((step.filterMod ?? 0.5) * 127)));
        const gateTicks = Math.max(20, Math.round(stepTicks * (step.gate || 0.75)));

        track.push(...writeVarLen(pendingDelta), 0xb0 | ch, 74, cc74);
        track.push(0x00, 0x90 | ch, midiNote, vel);
        track.push(...writeVarLen(gateTicks), 0x80 | ch, midiNote, 0x00);
        pendingDelta = stepTicks - gateTicks;
      } else {
        pendingDelta += stepTicks;
      }
    });

    track.push(...writeVarLen(pendingDelta), 0xff, 0x2f, 0x00);
    const header = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, (tpq >> 8) & 0xff, tpq & 0xff];
    const len = track.length;
    const trackHeader = [0x4d, 0x54, 0x72, 0x6b, (len >> 24) & 0xff, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff];

    return new Blob([new Uint8Array([...header, ...trackHeader, ...track])], { type: 'audio/midi' });
  }
}
