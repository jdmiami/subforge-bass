/**
 * SubForge Bass — Semantic AI Instrument Forge & Procedural Cymatics Artwork
 * Analyzes natural-language bass prompts (typed or spoken via Web Speech API),
 * derives studio DSP parameters, renders custom cymatics artwork, and exposes
 * transparent multi-stage synthesis telemetry.
 */

const STUDIO_ACCENTS = [
  '#38BDF8', '#A3E635', '#F43F5E', '#F5A623',
  '#2DD4BF', '#F24C27', '#FACC15', '#34D399', '#FB923C',
];

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function matchOrForgeFromPrompt(promptText, allInstruments) {
  const lower = (promptText || '').toLowerCase();
  if (!lower.trim()) return null;

  // Quick semantic match against existing bank if user asks for a named classic
  const matchRules = [
    { keys: ['808', 'subzero', 'trap'], id: 'orig_01_subzero_808' },
    { keys: ['303', 'acid', 'squelch'], id: 'orig_02_acid_303_squelch' },
    { keys: ['reese', 'neuro', 'dnb', 'drum and bass'], id: 'orig_03_neuro_reese' },
    { keys: ['moog', 'ladder', 'analog'], id: 'orig_04_moog_velvet' },
    { keys: ['donk', 'uk bass', 'house'], id: 'orig_05_fm_cyber_donk' },
    { keys: ['wobble', 'dubstep', 'growl'], id: 'orig_06_wobble_titan' },
    { keys: ['synthwave', 'outrun', '1984', 'retro'], id: 'orig_07_synthwave_arp' },
    { keys: ['slap', 'funk', 'thumb'], id: 'orig_08_slap_funk_thumb' },
    { keys: ['tectonic', 'infra', 'cinema', 'movie'], id: 'orig_09_tectonic_sine' },
    { keys: ['organ', 'garage', 'ukg'], id: 'orig_10_garage_warm_organ' },
    { keys: ['industrial', 'overdrive', 'cyberpunk', 'distortion'], id: 'orig_11_industrial_grit' },
    { keys: ['liquid', 'soul', 'glide', 'velvet'], id: 'orig_12_liquid_velvet_glide' },
  ];

  // If prompt explicitly requests forging/creating a custom instrument, forge new
  const wantsForge = /\b(forge|create|make|build|custom|new|synthesize|design)\b/.test(lower);
  if (!wantsForge) {
    for (const rule of matchRules) {
      if (rule.keys.some((k) => lower.includes(k))) {
        const found = allInstruments.find((inst) => inst.id === rule.id);
        if (found) return { type: 'match', instrument: found };
      }
    }
  }

  return { type: 'forge', instrument: synthesizeInstrumentSpec(promptText) };
}

export function synthesizeInstrumentSpec(promptText) {
  const clean = (promptText || 'Deep Subterranean 808 Bass').trim();
  const lower = clean.toLowerCase();
  const seed = hashString(lower + Date.now().toString().slice(-3));

  let waveform = 'SINE';
  let category = 'AI Forged Sub';
  let baseFreqHz = 41.2;
  let subOctaveMix = 0.78;
  let cutoffHz = 560;
  let resonance = 0.36;
  let drive = 0.38;
  let attackMs = 5;
  let decayMs = 740;
  let lfoRateHz = 2.0;
  let lfoDepth = 0.18;
  let animationStyle = 'PLASMA_PULSE';
  let accentColorHex = STUDIO_ACCENTS[seed % STUDIO_ACCENTS.length];
  let titlePrefix = 'Forged';

  if (lower.includes('acid') || lower.includes('303') || lower.includes('squelch')) {
    waveform = 'SAW';
    category = 'AI Acid 303';
    baseFreqHz = 55.0;
    subOctaveMix = 0.35;
    cutoffHz = 1650;
    resonance = 0.86;
    drive = 0.62;
    attackMs = 3;
    decayMs = 330;
    lfoRateHz = 6.2;
    lfoDepth = 0.60;
    animationStyle = 'LASER_GRID';
    accentColorHex = '#A3E635';
    titlePrefix = 'Acidic';
  } else if (lower.includes('wobble') || lower.includes('dubstep') || lower.includes('growl') || lower.includes('fm') || lower.includes('metallic')) {
    waveform = 'FM_GROWL';
    category = 'AI FM Growl';
    baseFreqHz = 36.71;
    subOctaveMix = 0.82;
    cutoffHz = 1580;
    resonance = 0.70;
    drive = 0.80;
    attackMs = 8;
    decayMs = 720;
    lfoRateHz = 5.5;
    lfoDepth = 0.84;
    animationStyle = 'WAVE_TUNNEL';
    accentColorHex = '#F24C27';
    titlePrefix = 'Titan';
  } else if (lower.includes('reese') || lower.includes('neuro') || lower.includes('dark') || lower.includes('phasing')) {
    waveform = 'SAW';
    category = 'AI Neuro Reese';
    baseFreqHz = 43.65;
    subOctaveMix = 0.75;
    cutoffHz = 960;
    resonance = 0.56;
    drive = 0.76;
    attackMs = 16;
    decayMs = 960;
    lfoRateHz = 3.4;
    lfoDepth = 0.52;
    animationStyle = 'VORTEX_SPIN';
    accentColorHex = '#F43F5E';
    titlePrefix = 'Shadow';
  } else if (lower.includes('funk') || lower.includes('slap') || lower.includes('pluck') || lower.includes('snappy')) {
    waveform = 'FM_GROWL';
    category = 'AI Slap Funk';
    baseFreqHz = 61.74;
    subOctaveMix = 0.45;
    cutoffHz = 2350;
    resonance = 0.48;
    drive = 0.34;
    attackMs = 2;
    decayMs = 360;
    lfoRateHz = 4.0;
    lfoDepth = 0.22;
    animationStyle = 'PARTICLE_BURST';
    accentColorHex = '#FACC15';
    titlePrefix = 'Velvet';
  } else if (lower.includes('analog') || lower.includes('moog') || lower.includes('warm') || lower.includes('ladder')) {
    waveform = 'SUB_PULSE';
    category = 'AI Analog Sub';
    baseFreqHz = 49.0;
    subOctaveMix = 0.68;
    cutoffHz = 720;
    resonance = 0.46;
    drive = 0.42;
    attackMs = 7;
    decayMs = 540;
    lfoRateHz = 1.6;
    lfoDepth = 0.16;
    animationStyle = 'NEON_RIPPLE';
    accentColorHex = '#F5A623';
    titlePrefix = 'Analog';
  } else if (lower.includes('808') || lower.includes('sub') || lower.includes('deep') || lower.includes('tectonic')) {
    waveform = 'SINE';
    category = 'AI 808 Sub';
    baseFreqHz = 38.89;
    subOctaveMix = 0.90;
    cutoffHz = 360;
    resonance = 0.28;
    drive = 0.44;
    attackMs = 4;
    decayMs = 940;
    lfoRateHz = 0.9;
    lfoDepth = 0.10;
    animationStyle = 'PLASMA_PULSE';
    accentColorHex = '#38BDF8';
    titlePrefix = 'Tectonic';
  } else if (lower.includes('industrial') || lower.includes('grit') || lower.includes('overdrive') || lower.includes('distort')) {
    waveform = 'SQUARE';
    category = 'AI Industrial';
    baseFreqHz = 46.25;
    subOctaveMix = 0.65;
    cutoffHz = 2150;
    resonance = 0.66;
    drive = 0.92;
    attackMs = 3;
    decayMs = 480;
    lfoRateHz = 8.4;
    lfoDepth = 0.50;
    animationStyle = 'VORTEX_SPIN';
    accentColorHex = '#FB923C';
    titlePrefix = 'Overdrive';
  }

  // Fine-grained descriptor modifiers
  if (lower.includes('punch') || lower.includes('tight') || lower.includes('short')) {
    decayMs = Math.max(220, Math.round(decayMs * 0.68));
    attackMs = 2;
  }
  if (lower.includes('long') || lower.includes('sustain') || lower.includes('boomy')) {
    decayMs = Math.min(1350, Math.round(decayMs * 1.35));
  }
  if (lower.includes('gritty') || lower.includes('dirty') || lower.includes('saturated') || lower.includes('heavy')) {
    drive = Math.min(0.96, drive + 0.22);
  }
  if (lower.includes('bright') || lower.includes('crisp') || lower.includes('bite')) {
    cutoffHz = Math.min(4800, Math.round(cutoffHz * 1.45));
  }
  if (lower.includes('chop') || lower.includes('fast lfo')) {
    lfoRateHz = Math.min(14, lfoRateHz + 3.5);
    lfoDepth = Math.min(0.95, lfoDepth + 0.3);
  }

  // Construct an evocative concise studio patch name
  const words = clean
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !['with', 'and', 'the', 'make', 'forge', 'bass', 'sound', 'for', 'create'].includes(w.toLowerCase()));
  const coreWords = words.slice(0, 2).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  const name = coreWords.length >= 2 ? `${coreWords[0]} ${coreWords[1]} Bass` : `${titlePrefix} ${coreWords[0] || 'Sub'} Forge`;

  const thinkingSummary = [
    `Acoustic intent parsed: "${clean.slice(0, 72)}${clean.length > 72 ? '…' : ''}"`,
    `Selected ${waveform} topology @ ${baseFreqHz.toFixed(1)}Hz root with ${Math.round(subOctaveMix * 100)}% sub-octave sine reinforcement.`,
    `Tuned SVF resonant cutoff to ${cutoffHz}Hz (Q=${Math.round(resonance * 100)}%) with ${Math.round(drive * 100)}% tanh saturation and ${lfoRateHz.toFixed(1)}Hz LFO modulation.`,
    `Sliced fundamental and pitch-modulated across 12 chromatic MPC pads (C to B).`,
  ].join(' ');

  return {
    id: `forged_${Date.now().toString(36)}_${(seed % 999).toString(36)}`,
    name,
    category,
    description: clean,
    waveform,
    baseFreqHz,
    subOctaveMix: Number(subOctaveMix.toFixed(2)),
    cutoffHz: Math.round(cutoffHz),
    resonance: Number(resonance.toFixed(2)),
    drive: Number(drive.toFixed(2)),
    attackMs,
    decayMs,
    lfoRateHz: Number(lfoRateHz.toFixed(1)),
    lfoDepth: Number(lfoDepth.toFixed(2)),
    accentColorHex,
    animationStyle,
    padVisualPrompt: clean,
    aiThinkingSummary: thinkingSummary,
    isCustom: true,
  };
}

/**
 * Renders procedural studio cymatics artwork for any forged or selected instrument.
 */
export function renderCymaticsArtwork(canvas, instrument) {
  if (!canvas || !instrument) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const accent = instrument.accentColorHex || '#F24C27';

  ctx.clearRect(0, 0, w, h);

  // Brushed obsidian base
  const bg = ctx.createRadialGradient(cx, cy, 4, cx, cy, w * 0.72);
  bg.addColorStop(0, '#1A1D24');
  bg.addColorStop(1, '#090A0D');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.strokeStyle = accent;

  const rings = 5 + Math.round((instrument.resonance || 0.4) * 6);
  const petals = 3 + Math.round((instrument.drive || 0.3) * 8);
  const maxR = Math.min(w, h) * 0.42;

  for (let r = 1; r <= rings; r++) {
    const ratio = r / rings;
    const baseR = maxR * ratio;
    ctx.beginPath();
    ctx.globalAlpha = 0.18 + (1 - ratio) * 0.65;
    ctx.lineWidth = r === 1 ? 1.8 : 1.1;

    const steps = 96;
    for (let s = 0; s <= steps; s++) {
      const a = (s / steps) * Math.PI * 2;
      const mod =
        Math.sin(a * petals + r * 0.7) * (instrument.lfoDepth * 7 + 2) +
        Math.cos(a * (petals + 2)) * (instrument.drive * 4);
      const rad = Math.max(3, baseR + mod * ratio);
      const x = cx + Math.cos(a) * rad;
      const y = cy + Math.sin(a) * rad;
      if (s === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  // Center core pip
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(cx, cy, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Browser Speech-to-Text helper with graceful fallback when SpeechRecognition is unavailable.
 */
export class VoicePromptController {
  constructor({ onInterim, onFinal, onEnd, onError }) {
    this.onInterim = onInterim;
    this.onFinal = onFinal;
    this.onEnd = onEnd;
    this.onError = onError;
    this.isRecording = false;
    this.recognition = null;
    this.demoIdx = 0;
  }

  toggle() {
    if (this.isRecording) {
      this.stop();
    } else {
      this.start();
    }
  }

  start() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      // Graceful fallback cycling curated bass voice commands
      const samples = [
        'Deep subterranean 808 sub bass with warm analog saturation',
        'Liquid 303 acid squelch with high resonance sweep',
        'Dark neuro Reese bass with gritty phasing movement',
        'Metallic FM dubstep wobble with fast LFO chop',
      ];
      const text = samples[this.demoIdx % samples.length];
      this.demoIdx++;
      this.isRecording = true;
      this.onInterim?.('Listening via studio mic simulator…');
      setTimeout(() => {
        this.isRecording = false;
        this.onFinal?.(text);
        this.onEnd?.();
      }, 900);
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.lang = 'en-US';
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      this.recognition = rec;
      this.isRecording = true;

      let finalTranscript = '';
      rec.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const t = event.results[i][0].transcript;
          if (event.results[i].isFinal) finalTranscript += t;
          else interim += t;
        }
        if (interim) this.onInterim?.(interim);
        if (finalTranscript) this.onFinal?.(finalTranscript.trim());
      };

      rec.onerror = (ev) => {
        this.isRecording = false;
        this.onError?.(ev.error || 'Voice input unavailable');
        this.onEnd?.();
      };

      rec.onend = () => {
        this.isRecording = false;
        this.onEnd?.();
      };

      rec.start();
    } catch (e) {
      this.isRecording = false;
      this.onError?.(e.message || 'Voice capture failed');
      this.onEnd?.();
    }
  }

  stop() {
    this.isRecording = false;
    try {
      this.recognition?.stop();
    } catch (_) {}
    this.onEnd?.();
  }
}
