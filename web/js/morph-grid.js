/**
 * SubForge Bass — Flagship Interface: Infinite Open-Octave Liquid-Metal Morph Grid
 * Fluid Thumb-Swipe × Tactile Button Hybrid Engine with Boundless Octave Scrolling
 *
 * Features:
 * - Infinite open vertical 3-column chromatic ferrofluid lattice (seamless across unlimited octaves!)
 * - Right-edge Infinite Octave Elevator Rail (drag or flick with inertia, plus mouse wheel)
 * - Auto-Climb / Auto-Dive Edge Scroll while gliding so one uninterrupted swipe can cross 4+ octaves
 * - Tap: crisp 808 transient + spring squash/rebound + pressure ripples to neighboring cells
 * - Swipe across cells: magnetic proximity swell + gooey metaball bridges + continuous portamento pitch glide
 * - Press & pull: taffy stretch cranks Filter Cutoff, Resonance, Drive & Wobble LFO; snap-back sub-drop on release
 */

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

function hexToRgb(hex) {
  const clean = String(hex || '#38BDF8').replace('#', '').trim();
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean.padEnd(6, '0').slice(0, 6);
  const num = parseInt(full, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function rgba(rgb, a) {
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${clamp(a, 0, 1).toFixed(3)})`;
}

export class LiquidMorphGrid {
  constructor({
    canvas,
    container,
    engine,
    getInstrument,
    getOctaveShift,
    isZenMode,
    onNoteReadout,
    onPlayActivity,
  }) {
    this.canvas = canvas;
    this.container = container;
    this.ctx = canvas.getContext('2d');
    this.engine = engine;
    this.getInstrument = getInstrument;
    this.getOctaveShift = getOctaveShift;
    this.isZenMode = isZenMode;
    this.onNoteReadout = onNoteReadout;
    this.onPlayActivity = onPlayActivity;

    this.width = 400;
    this.height = 500;
    this.dpr = 1;

    // Layout metrics (recomputed on resize)
    this.railWidth = 30;
    this.padTop = 14;
    this.padBottom = 14;
    this.padLeft = 10;
    this.colW = 110;
    this.rowH = 100;
    this.baseR = 36;
    this.visibleRows = 4.2;

    // Infinite vertical pitch scroll coordinate (in 3-note rows; 4 rows = 1 octave)
    // Default row 4.0 puts C1..B1 (rows 4..7) cleanly in view!
    this.scrollRow = 4.0;
    this.scrollVel = 0;

    // Active spring-physics cells keyed by infinite integer noteIdx (0 = C0, 12 = C1, 24 = C2...)
    this.cellMap = new Map();

    // Multi-touch note pointers + right-edge elevator rail pointer
    this.pointers = new Map();
    this.railPointer = null;

    // Visual FX pools
    this.ripples = [];
    this.bridges = [];
    this.sparks = [];

    this.shakeX = 0;
    this.shakeY = 0;
    this.shakeMag = 0;
    this.hasInteracted = false;
    this.hintAlpha = 1;
    this.lastTime = performance.now();

    this.resize();
    this.bindEvents();
  }

  /**
   * Maps any integer infinite noteIdx (..., -12, 0=C0, 12=C1, 24=C2, 36=C3, ...) to name & Hz.
   */
  getNoteSpec(noteIdx) {
    const inst = this.getInstrument();
    const semitone = ((noteIdx % 12) + 12) % 12;
    const octave = Math.floor(noteIdx / 12);
    const baseHz = (inst && inst.baseFreqHz) || 41.2;
    // Anchor instrument's native baseFreqHz at C1 (noteIdx 12)
    const freq = clamp(baseHz * Math.pow(2, (noteIdx - 12) / 12), 16, 4200);
    return {
      noteIdx,
      noteName: `${NOTE_NAMES[semitone]}${octave}`,
      semitone,
      octave,
      frequencyHz: freq,
    };
  }

  /**
   * Jump smoothly when user taps the OCT -/+ stepper in Studio Mode.
   */
  scrollToOctave(octaveShift) {
    const targetRow = (1 + octaveShift) * 4.0;
    this.scrollVel = (targetRow - this.scrollRow) * 0.22;
  }

  resize() {
    if (!this.container) return;
    const rect = this.container.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return;

    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);

    const zen = Boolean(this.isZenMode && this.isZenMode());
    this.railWidth = 30;
    this.padTop = zen ? 60 : 12;
    this.padBottom = 14;
    this.padLeft = 10;

    const usableW = Math.max(120, this.width - this.padLeft - this.railWidth - 8);
    const usableH = Math.max(160, this.height - this.padTop - this.padBottom);
    this.colW = usableW / 3;
    this.visibleRows = usableH > 460 ? 4.4 : 4.0;
    this.rowH = usableH / this.visibleRows;
    this.baseR = Math.min(this.colW, this.rowH) * 0.36;
  }

  getCellRestPos(noteIdx) {
    const col = ((noteIdx % 3) + 3) % 3;
    const row = Math.floor(noteIdx / 3);
    const usableH = Math.max(160, this.height - this.padTop - this.padBottom);
    const restX = this.padLeft + this.colW * (col + 0.5);
    const restY = this.padTop + usableH - (row - this.scrollRow + 0.5) * this.rowH;
    return { col, row, restX, restY };
  }

  getOrCreateCell(noteIdx) {
    let cell = this.cellMap.get(noteIdx);
    const { col, row, restX, restY } = this.getCellRestPos(noteIdx);
    if (!cell) {
      cell = {
        noteIdx,
        col,
        row,
        restX,
        restY,
        x: restX,
        y: restY,
        vx: 0,
        vy: 0,
        scale: 1,
        scaleV: 0,
        energy: 0,
        stretch: 0,
        magPull: 0,
        phaseSeed: noteIdx * 1.37 + 0.5,
      };
      this.cellMap.set(noteIdx, cell);
    } else {
      cell.restX = restX;
      cell.restY = restY;
    }
    return cell;
  }

  findNearestNoteAt(x, y) {
    const usableH = Math.max(160, this.height - this.padTop - this.padBottom);
    const floatCol = (x - this.padLeft) / this.colW - 0.5;
    const col = clamp(Math.round(floatCol), 0, 2);
    const floatRow = this.scrollRow + (this.padTop + usableH - y) / this.rowH - 0.5;
    const row = Math.round(floatRow);
    const noteIdx = row * 3 + col;
    const cell = this.getOrCreateCell(noteIdx);
    const dist = Math.hypot(x - cell.restX, y - cell.restY);
    return { cell, dist, floatRow };
  }

  bindEvents() {
    if (typeof ResizeObserver !== 'undefined') {
      this._ro = new ResizeObserver(() => this.resize());
      this._ro.observe(this.container);
    }
    window.addEventListener('resize', () => this.resize());

    this.canvas.addEventListener('pointerdown', (e) => this.handlePointerDown(e));
    this.canvas.addEventListener('pointermove', (e) => this.handlePointerMove(e));
    const endFn = (e) => this.handlePointerUp(e);
    this.canvas.addEventListener('pointerup', endFn);
    this.canvas.addEventListener('pointercancel', endFn);

    // Smooth mouse-wheel / trackpad infinite octave scrolling
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.hasInteracted = true;
      this.scrollVel += -e.deltaY * 0.0024;
    }, { passive: false });
  }

  getLocalPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  haptic(ms = 10) {
    try {
      if (navigator && typeof navigator.vibrate === 'function') {
        navigator.vibrate(ms);
      }
    } catch (_) {}
  }

  isOnOctaveRail(x) {
    return x >= this.width - this.railWidth - 6;
  }

  handlePointerDown(e) {
    e.preventDefault();
    this.hasInteracted = true;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch (_) {}

    const { x, y } = this.getLocalPos(e);

    // Check if user grabbed the Infinite Octave Elevator Rail on the right edge!
    if (this.isOnOctaveRail(x)) {
      this.railPointer = {
        pointerId: e.pointerId,
        lastY: y,
        lastTime: performance.now(),
      };
      this.scrollVel = 0;
      this.haptic(6);
      if (this.onPlayActivity) this.onPlayActivity(true);
      return;
    }

    const { cell } = this.findNearestNoteAt(x, y);
    const spec = this.getNoteSpec(cell.noteIdx);

    const relY = clamp((y - (cell.restY - this.baseR)) / (this.baseR * 2), 0, 1);
    const velocity = 0.72 + relY * 0.28;

    // 1. Crisp infinite-octave transient bass hit
    this.engine.triggerNoteFreq(spec.frequencyHz, velocity);
    if (this.onNoteReadout) {
      this.onNoteReadout(`${spec.noteName} • ${spec.frequencyHz.toFixed(1)}Hz`);
    }

    // 2. Spin up continuous liquid morph voice silently behind the hit
    const cutoffNorm = clamp(x / Math.max(1, this.width - this.railWidth), 0, 1);
    this.engine.startLiquidVoice(e.pointerId, spec.frequencyHz, {
      initialGain: 0.0001,
      cutoffNorm,
      stretchNorm: 0,
    });

    this.slamCell(cell, velocity, x, y, true);
    this.haptic(10);

    this.pointers.set(e.pointerId, {
      pointerId: e.pointerId,
      x,
      y,
      activeNoteIdx: cell.noteIdx,
      currentFreq: spec.frequencyHz,
      stretchNorm: 0,
      isGliding: false,
      trail: [{ x, y }],
      downTime: performance.now(),
    });

    if (this.onPlayActivity) this.onPlayActivity(true);
  }

  handlePointerMove(e) {
    // Handle Infinite Octave Elevator Rail drag/flick
    if (this.railPointer && this.railPointer.pointerId === e.pointerId) {
      e.preventDefault();
      const { y } = this.getLocalPos(e);
      const dy = y - this.railPointer.lastY;
      this.railPointer.lastY = y;
      // Dragging rail upward climbs octaves; dragging downward dives octaves!
      const deltaRows = (-dy / Math.max(24, this.rowH)) * 1.45;
      this.scrollRow += deltaRows;
      this.scrollVel = deltaRows * 0.65;
      const centerOct = Math.floor(((this.scrollRow + this.visibleRows * 0.5) * 3) / 12);
      if (this.onNoteReadout) {
        this.onNoteReadout(`OCTAVE ${centerOct} • INFINITE GRID`);
      }
      return;
    }

    const ptr = this.pointers.get(e.pointerId);
    if (!ptr) return;
    e.preventDefault();

    const { x, y } = this.getLocalPos(e);
    const speed = Math.hypot(x - ptr.x, y - ptr.y);
    ptr.x = x;
    ptr.y = y;

    ptr.trail.push({ x, y });
    if (ptr.trail.length > 22) ptr.trail.shift();

    this.updatePointerAudioAndPhysics(ptr, speed);
  }

  updatePointerAudioAndPhysics(ptr, speed = 0) {
    const now = performance.now();
    const x = ptr.x;
    const y = ptr.y;
    const activeCell = this.getOrCreateCell(ptr.activeNoteIdx);
    const { cell: nearestCell, dist: nearestDist } = this.findNearestNoteAt(x, y);

    // Cross into a new cell when thumb enters its magnetic capture zone
    const captureRadius = this.baseR * 1.1;
    if (nearestCell.noteIdx !== ptr.activeNoteIdx && nearestDist < captureRadius) {
      const prevIdx = ptr.activeNoteIdx;
      ptr.activeNoteIdx = nearestCell.noteIdx;
      ptr.isGliding = true;

      this.bridges.push({
        fromIdx: prevIdx,
        toIdx: nearestCell.noteIdx,
        life: 1.0,
      });

      const nextSpec = this.getNoteSpec(nearestCell.noteIdx);
      ptr.currentFreq = nextSpec.frequencyHz;

      // Subtle magnetic fret pop while continuous synth glides seamlessly
      const glideVel = clamp(0.36 + speed * 0.012, 0.36, 0.68);
      this.engine.triggerNoteFreq(nextSpec.frequencyHz, glideVel);
      this.slamCell(nearestCell, glideVel, x, y, false);
      this.haptic(6);
    }

    const curCell = this.getOrCreateCell(ptr.activeNoteIdx);
    const dx = x - curCell.restX;
    const dy = y - curCell.restY;
    const dist = Math.hypot(dx, dy);

    const stretchNorm = clamp((dist - this.baseR * 0.22) / (this.baseR * 2.35), 0, 1);
    ptr.stretchNorm = stretchNorm;

    const pullCap = this.baseR * 0.44;
    const pullMag = Math.min(pullCap, dist * 0.34);
    const angle = Math.atan2(dy, dx);
    curCell.vx += (curCell.restX + Math.cos(angle) * pullMag - curCell.x) * 0.32;
    curCell.vy += (curCell.restY + Math.sin(angle) * pullMag - curCell.y) * 0.32;
    curCell.stretch = Math.max(curCell.stretch, stretchNorm);
    curCell.energy = Math.max(curCell.energy, 0.42 + stretchNorm * 0.58);

    const baseSpec = this.getNoteSpec(ptr.activeNoteIdx);
    let targetFreq = baseSpec.frequencyHz;

    if (nearestCell.noteIdx !== ptr.activeNoteIdx) {
      const pairDist = Math.max(1, Math.hypot(nearestCell.restX - curCell.restX, nearestCell.restY - curCell.restY));
      const blend = clamp(dist / pairDist, 0, 0.85);
      const neighborSpec = this.getNoteSpec(nearestCell.noteIdx);
      targetFreq = baseSpec.frequencyHz * Math.pow(neighborSpec.frequencyHz / baseSpec.frequencyHz, blend);
    } else if (stretchNorm > 0.08) {
      const verticalBend = clamp(-dy / (this.baseR * 2.2), -1, 1);
      targetFreq = baseSpec.frequencyHz * Math.pow(2, (verticalBend * 1.8) / 12);
    }

    ptr.currentFreq = targetFreq;

    const heldMs = now - ptr.downTime;
    const morphAmount = ptr.isGliding
      ? Math.max(0.68, 0.56 + stretchNorm * 0.32)
      : clamp(stretchNorm * 0.95 + (heldMs > 105 ? 0.38 : 0), 0, 0.84);

    const cutoffNorm = clamp(0.18 + (x / Math.max(1, this.width - this.railWidth)) * 0.65 + stretchNorm * 0.3, 0, 1);
    this.engine.updateLiquidVoice(ptr.pointerId, targetFreq, {
      level: morphAmount,
      stretchNorm,
      cutoffNorm,
      glideTau: ptr.isGliding ? 0.018 : 0.024,
    });

    if (this.onNoteReadout) {
      const tag = stretchNorm > 0.45 ? 'WOBBLE' : ptr.isGliding ? 'GLIDE' : 'MORPH';
      this.onNoteReadout(`${baseSpec.noteName} • ${targetFreq.toFixed(1)}Hz • ${tag}`);
    }

    if ((speed > 8 || stretchNorm > 0.55) && Math.random() < 0.55) {
      this.spawnSparks(x, y, 2, 0.55 + stretchNorm * 0.45);
    }
  }

  handlePointerUp(e) {
    if (this.railPointer && this.railPointer.pointerId === e.pointerId) {
      this.railPointer = null;
      if (this.pointers.size === 0 && this.onPlayActivity) this.onPlayActivity(false);
      return;
    }

    const ptr = this.pointers.get(e.pointerId);
    if (!ptr) return;

    const snapDrop = ptr.stretchNorm > 0.42;
    this.engine.stopLiquidVoice(e.pointerId, snapDrop);

    if (snapDrop) {
      const cell = this.getOrCreateCell(ptr.activeNoteIdx);
      cell.scaleV += 0.24;
      this.shakeMag = Math.max(this.shakeMag, 4.5);
      this.spawnSparks(ptr.x, ptr.y, 12, 1.0);
      this.ripples.push({
        x: cell.x,
        y: cell.y,
        r: this.baseR * 0.5,
        maxR: Math.max(this.width, this.height) * 0.65,
        strength: 0.95,
        life: 1.0,
      });
      this.haptic(18);
    }

    this.pointers.delete(e.pointerId);
    if (this.pointers.size === 0 && !this.railPointer && this.onPlayActivity) {
      this.onPlayActivity(false);
    }
  }

  /**
   * External trigger hook (from 16-step sequencer, Demo Riff, or desktop keyboard).
   */
  pulseCell(padIndex, velocity = 0.9) {
    const oct = this.getOctaveShift ? this.getOctaveShift() : 0;
    const noteIdx = (1 + oct) * 12 + clamp(padIndex, 0, 11);
    const cell = this.getOrCreateCell(noteIdx);
    this.slamCell(cell, velocity, cell.restX, cell.restY, true);
  }

  slamCell(cell, velocity, impactX, impactY, strongWave = true) {
    cell.energy = 1.0;
    cell.scale = 0.80;
    cell.scaleV = 0.22 + velocity * 0.14;

    const kickAngle = Math.atan2(cell.y - impactY, cell.x - impactX);
    const kickDist = Math.hypot(cell.x - impactX, cell.y - impactY);
    if (kickDist > 4) {
      cell.vx += Math.cos(kickAngle) * 3.2 * velocity;
      cell.vy += Math.sin(kickAngle) * 3.2 * velocity;
    }

    this.ripples.push({
      x: cell.x,
      y: cell.y,
      r: this.baseR * 0.55,
      maxR: Math.max(this.width, this.height) * (strongWave ? 0.72 : 0.45),
      strength: velocity * (strongWave ? 1.0 : 0.55),
      life: 1.0,
    });

    for (const other of this.cellMap.values()) {
      if (other.noteIdx === cell.noteIdx) continue;
      const dx = other.restX - cell.restX;
      const dy = other.restY - cell.restY;
      const d = Math.hypot(dx, dy);
      if (d > 1 && d < this.baseR * 4.4) {
        const falloff = (1 - d / (this.baseR * 4.4)) * velocity * (strongWave ? 4.8 : 2.2);
        other.vx += (dx / d) * falloff;
        other.vy += (dy / d) * falloff;
        other.scaleV += falloff * 0.012;
      }
    }

    this.spawnSparks(impactX, impactY, strongWave ? 9 : 4, velocity);
    if (strongWave) {
      this.shakeMag = Math.min(6.5, this.shakeMag + velocity * 3.4);
    }
  }

  spawnSparks(x, y, count, power = 0.8) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = (1.6 + Math.random() * 4.8) * power;
      this.sparks.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        r: 1.4 + Math.random() * 2.8 * power,
        life: 1.0,
        decay: 0.025 + Math.random() * 0.03,
      });
    }
    if (this.sparks.length > 90) {
      this.sparks.splice(0, this.sparks.length - 90);
    }
  }

  drawLiquidBridge(ctx, x1, y1, r1, x2, y2, r2, fillStyle, alpha = 1) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const d = Math.hypot(dx, dy);
    if (d < 2 || d > (r1 + r2) * 4.6) return;

    const angle = Math.atan2(dy, dx);
    const perp = angle + Math.PI / 2;

    const stretchFactor = clamp(d / ((r1 + r2) * 3.6), 0, 1);
    const w1 = r1 * (0.78 - stretchFactor * 0.25);
    const w2 = r2 * (0.82 - stretchFactor * 0.22);
    const waistW = Math.max(3, Math.min(w1, w2) * (0.58 - stretchFactor * 0.44));

    const midX = (x1 + x2) * 0.5;
    const midY = (y1 + y2) * 0.5;

    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.fillStyle = fillStyle;
    ctx.beginPath();
    ctx.moveTo(x1 + Math.cos(perp) * w1, y1 + Math.sin(perp) * w1);
    ctx.quadraticCurveTo(midX + Math.cos(perp) * waistW, midY + Math.sin(perp) * waistW, x2 + Math.cos(perp) * w2, y2 + Math.sin(perp) * w2);
    ctx.lineTo(x2 - Math.cos(perp) * w2, y2 - Math.sin(perp) * w2);
    ctx.quadraticCurveTo(midX - Math.cos(perp) * waistW, midY - Math.sin(perp) * waistW, x1 - Math.cos(perp) * w1, y1 - Math.sin(perp) * w1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  render(now) {
    const dt = Math.min(0.04, Math.max(0.004, (now - this.lastTime) / 1000));
    this.lastTime = now;
    const step = dt * 60;

    const inst = this.getInstrument();
    const accentHex = inst.accentColorHex || '#38BDF8';
    const accentRgb = hexToRgb(accentHex);
    const bassAmp = this.engine.getBassAmplitude ? this.engine.getBassAmplitude() : 0;

    // 1. Auto-Climb / Auto-Dive Edge Scroll when gliding near top/bottom of the infinite lattice!
    let autoScroll = 0;
    const topZone = this.padTop + this.rowH * 0.62;
    const botZone = this.height - this.padBottom - this.rowH * 0.58;
    for (const ptr of this.pointers.values()) {
      if (ptr.y < topZone) {
        const strength = clamp((topZone - ptr.y) / (this.rowH * 0.8), 0, 1);
        autoScroll += strength * 0.085 * step;
      } else if (ptr.y > botZone) {
        const strength = clamp((ptr.y - botZone) / (this.rowH * 0.8), 0, 1);
        autoScroll -= strength * 0.085 * step;
      }
    }

    if (autoScroll !== 0) {
      this.scrollRow += autoScroll;
      this.scrollVel = 0;
      for (const ptr of this.pointers.values()) {
        this.updatePointerAudioAndPhysics(ptr, 4);
      }
    } else if (!this.railPointer) {
      // Silky inertia scroll when flicking rail or wheel
      this.scrollRow += this.scrollVel * step;
      this.scrollVel *= Math.pow(0.88, step);
      if (Math.abs(this.scrollVel) < 0.0008) this.scrollVel = 0;
    }

    // Keep within ultra-wide musical infinity (-4 octaves infrabass -> +10 octaves)
    this.scrollRow = clamp(this.scrollRow, -12, 42);

    if (this.hasInteracted && this.hintAlpha > 0) {
      this.hintAlpha = Math.max(0, this.hintAlpha - 0.045 * step);
    }

    this.shakeMag *= Math.pow(0.82, step);
    if (this.shakeMag > 0.08) {
      this.shakeX = (Math.random() - 0.5) * 2 * this.shakeMag;
      this.shakeY = (Math.random() - 0.5) * 2 * this.shakeMag;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
      this.shakeMag = 0;
    }

    // Determine currently visible row window (plus 1-row buffer above/below)
    const minRow = Math.floor(this.scrollRow) - 1;
    const maxRow = Math.ceil(this.scrollRow + this.visibleRows) + 1;
    const visibleCells = [];

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = 0; c < 3; c++) {
        const noteIdx = r * 3 + c;
        const cell = this.getOrCreateCell(noteIdx);
        visibleCells.push(cell);
      }
    }

    // Prune far off-screen dormant cells to keep memory & CPU tiny
    for (const [nIdx, cell] of this.cellMap.entries()) {
      const r = Math.floor(nIdx / 3);
      if ((r < minRow - 3 || r > maxRow + 3) && cell.energy < 0.02) {
        this.cellMap.delete(nIdx);
      }
    }

    // Integrate spring physics on visible cells
    for (let i = 0; i < visibleCells.length; i++) {
      const c = visibleCells[i];
      let targetX = c.restX;
      let targetY = c.restY;
      let targetScale = 1 + bassAmp * 0.045;
      let magPull = 0;

      for (const ptr of this.pointers.values()) {
        const dx = ptr.x - c.restX;
        const dy = ptr.y - c.restY;
        const d = Math.hypot(dx, dy);
        const magRange = this.baseR * 3.1;
        if (d < magRange) {
          const proximity = 1 - d / magRange;
          const pullStrength = ptr.activeNoteIdx === c.noteIdx ? 0.28 : 0.16 * proximity;
          targetX += dx * pullStrength;
          targetY += dy * pullStrength;
          targetScale += proximity * 0.14;
          magPull = Math.max(magPull, proximity);
        }
      }

      const damp = Math.pow(0.76, step);
      c.vx = (c.vx + (targetX - c.x) * 0.22 * step) * damp;
      c.vy = (c.vy + (targetY - c.y) * 0.22 * step) * damp;
      c.x += c.vx * step;
      c.y += c.vy * step;

      c.scaleV = (c.scaleV + (targetScale - c.scale) * 0.24 * step) * Math.pow(0.74, step);
      c.scale = clamp(c.scale + c.scaleV * step, 0.72, 1.38);

      c.energy = Math.max(0, c.energy - 0.026 * step);
      c.stretch = Math.max(0, c.stretch - 0.06 * step);
      c.magPull = magPull;
    }

    // Update ripples, bridges, sparks
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const rp = this.ripples[i];
      rp.r += (rp.maxR * 0.042 + 4.2) * step;
      rp.life -= 0.032 * step;
      if (rp.life <= 0 || rp.r > rp.maxR) this.ripples.splice(i, 1);
    }
    for (let i = this.bridges.length - 1; i >= 0; i--) {
      this.bridges[i].life -= 0.035 * step;
      if (this.bridges[i].life <= 0) this.bridges.splice(i, 1);
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const sp = this.sparks[i];
      sp.x += sp.vx * step;
      sp.y += sp.vy * step;
      sp.vx *= Math.pow(0.92, step);
      sp.vy *= Math.pow(0.92, step);
      sp.life -= sp.decay * step;
      if (sp.life <= 0) this.sparks.splice(i, 1);
    }

    // ================= RENDER PASS =================
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const fieldW = w - this.railWidth - 4;

    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    // 1. Deep Obsidian Ferrofluid Bed
    const bgGrad = ctx.createRadialGradient(fieldW * 0.5, h * 0.45, 20, fieldW * 0.5, h * 0.5, Math.max(w, h) * 0.85);
    bgGrad.addColorStop(0, `rgb(${13 + Math.round(accentRgb.r * 0.05 * bassAmp)}, ${15 + Math.round(accentRgb.g * 0.05 * bassAmp)}, ${20 + Math.round(accentRgb.b * 0.05 * bassAmp)})`);
    bgGrad.addColorStop(1, '#07080B');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Clip playable infinite lattice away from the right-side Octave Elevator Rail
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, fieldW, h);
    ctx.clip();
    ctx.translate(this.shakeX, this.shakeY);

    // 2. Octave Horizon Dividers (every 4 rows = new octave C0, C1, C2, C3...)
    const usableH = Math.max(160, h - this.padTop - this.padBottom);
    const firstOctRow = Math.floor(minRow / 4) * 4;
    for (let octRow = firstOctRow; octRow <= maxRow + 4; octRow += 4) {
      const yLine = this.padTop + usableH - (octRow - this.scrollRow) * this.rowH;
      if (yLine < -20 || yLine > h + 20) continue;
      const octNum = Math.round(octRow / 4);
      ctx.save();
      ctx.strokeStyle = rgba(accentRgb, 0.22);
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(10, yLine);
      ctx.lineTo(fieldW - 8, yLine);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = '700 9px "JetBrains Mono", ui-monospace, monospace';
      ctx.fillStyle = rgba(accentRgb, 0.72);
      ctx.textAlign = 'left';
      ctx.fillText(`OCT ${octNum}`, 12, yLine - 4);
      ctx.restore();
    }

    // 3. Live Sub-Bass Waveform Ribbon Behind Cells
    const samples = this.engine.scopeData;
    if (samples) {
      const midY = h * 0.5;
      ctx.save();
      ctx.strokeStyle = rgba(accentRgb, 0.11 + bassAmp * 0.24);
      ctx.lineWidth = 1.6 + bassAmp * 1.8;
      ctx.beginPath();
      for (let i = 0; i < samples.length; i += 2) {
        const sx = (i / (samples.length - 1)) * fieldW;
        const sy = midY - samples[i] * (h * 0.16);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 4. Ferrofluid Shockwaves
    for (let i = 0; i < this.ripples.length; i++) {
      const rp = this.ripples[i];
      ctx.save();
      ctx.strokeStyle = rgba(accentRgb, rp.life * 0.48 * rp.strength);
      ctx.lineWidth = 1.2 + rp.life * 2.4;
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 5. Persistent Glided Liquid Bridges
    for (let i = 0; i < this.bridges.length; i++) {
      const br = this.bridges[i];
      const a = this.getOrCreateCell(br.fromIdx);
      const b = this.getOrCreateCell(br.toIdx);
      const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
      grad.addColorStop(0, rgba(accentRgb, 0.72));
      grad.addColorStop(0.5, 'rgba(235, 244, 255, 0.85)');
      grad.addColorStop(1, rgba(accentRgb, 0.72));
      this.drawLiquidBridge(ctx, a.x, a.y, this.baseR * 0.65, b.x, b.y, this.baseR * 0.65, grad, br.life * 0.78);
    }

    // 6. Active Taffy Bridges + Swipe Trails
    for (const ptr of this.pointers.values()) {
      const cell = this.getOrCreateCell(ptr.activeNoteIdx);
      const thumbR = this.baseR * (0.34 + ptr.stretchNorm * 0.14);

      if (ptr.trail.length > 2) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (let t = 1; t < ptr.trail.length; t++) {
          const p0 = ptr.trail[t - 1];
          const p1 = ptr.trail[t];
          const ratio = t / ptr.trail.length;
          ctx.strokeStyle = rgba(accentRgb, ratio * (0.32 + ptr.stretchNorm * 0.42));
          ctx.lineWidth = 2 + ratio * (10 + ptr.stretchNorm * 8);
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.stroke();
        }
        ctx.restore();
      }

      const bGrad = ctx.createLinearGradient(cell.x, cell.y, ptr.x, ptr.y);
      bGrad.addColorStop(0, rgba(accentRgb, 0.85));
      bGrad.addColorStop(0.55, ptr.stretchNorm > 0.5 ? 'rgba(255, 232, 195, 0.92)' : rgba(accentRgb, 0.68));
      bGrad.addColorStop(1, '#ffffff');
      this.drawLiquidBridge(ctx, cell.x, cell.y, this.baseR * cell.scale * 0.88, ptr.x, ptr.y, thumbR, bGrad, 0.86);
    }

    // 7. Render Visible Infinite Ferrofluid Cells
    for (let i = 0; i < visibleCells.length; i++) {
      const c = visibleCells[i];
      if (c.y < -this.baseR * 1.6 || c.y > h + this.baseR * 1.6) continue;

      const spec = this.getNoteSpec(c.noteIdx);
      const r = this.baseR * c.scale;
      const isRootC = spec.semitone === 0;
      const activeGlow = clamp(c.energy + c.magPull * 0.45 + c.stretch * 0.6, 0, 1);

      if (activeGlow > 0.04 || bassAmp > 0.12) {
        const haloR = r * (1.4 + activeGlow * 0.45);
        const halo = ctx.createRadialGradient(c.x, c.y, r * 0.35, c.x, c.y, haloR);
        halo.addColorStop(0, rgba(accentRgb, 0.28 * activeGlow + bassAmp * 0.08));
        halo.addColorStop(1, rgba(accentRgb, 0));
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(c.x, c.y, haloR, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.save();
      ctx.beginPath();
      const wobbleAmp = c.energy * 2.4 + c.stretch * 3.8 + bassAmp * 1.4;
      const segments = 28;
      for (let s = 0; s <= segments; s++) {
        const a = (s / segments) * Math.PI * 2;
        const mw = wobbleAmp > 0.15
          ? Math.sin(a * 4 + now * 0.011 + c.phaseSeed) * wobbleAmp * 0.6 +
            Math.cos(a * 3 - now * 0.008) * wobbleAmp * 0.4
          : 0;
        const rad = r + mw;
        const px = c.x + Math.cos(a) * rad;
        const py = c.y + Math.sin(a) * rad;
        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();

      const bodyGrad = ctx.createRadialGradient(c.x - r * 0.28, c.y - r * 0.32, r * 0.08, c.x, c.y, r * 1.08);
      if (activeGlow > 0.15) {
        bodyGrad.addColorStop(0, `rgba(${Math.min(255, 72 + Math.round(accentRgb.r * 0.65 * activeGlow))}, ${Math.min(255, 78 + Math.round(accentRgb.g * 0.65 * activeGlow))}, ${Math.min(255, 88 + Math.round(accentRgb.b * 0.65 * activeGlow))}, 0.98)`);
        bodyGrad.addColorStop(0.58, `rgba(${24 + Math.round(accentRgb.r * 0.22 * activeGlow)}, ${27 + Math.round(accentRgb.g * 0.22 * activeGlow)}, ${34 + Math.round(accentRgb.b * 0.22 * activeGlow)}, 0.96)`);
        bodyGrad.addColorStop(1, '#0E1016');
      } else {
        bodyGrad.addColorStop(0, isRootC ? '#333A48' : '#292E38');
        bodyGrad.addColorStop(0.55, '#171A21');
        bodyGrad.addColorStop(1, '#0C0E13');
      }
      ctx.fillStyle = bodyGrad;
      ctx.fill();

      ctx.lineWidth = activeGlow > 0.2 ? 1.8 : isRootC ? 1.35 : 1.05;
      ctx.strokeStyle = activeGlow > 0.2
        ? rgba(accentRgb, 0.45 + activeGlow * 0.55)
        : isRootC
          ? rgba(accentRgb, 0.34)
          : 'rgba(255, 255, 255, 0.12)';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(c.x, c.y, r * 0.82, Math.PI * 1.08, Math.PI * 1.62);
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.14 + activeGlow * 0.32})`;
      ctx.lineWidth = 1.9;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = activeGlow > 0.35 ? '#FFFFFF' : 'rgba(241, 238, 232, 0.92)';
      ctx.font = `700 ${Math.round(clamp(r * 0.44, 14, 22))}px "Space Grotesk", ui-sans-serif, system-ui, sans-serif`;
      ctx.fillText(spec.noteName, c.x, c.y - r * 0.1);

      ctx.fillStyle = activeGlow > 0.35 ? rgba(accentRgb, 0.95) : 'rgba(155, 162, 175, 0.66)';
      ctx.font = `600 ${Math.round(clamp(r * 0.22, 8.5, 11))}px "JetBrains Mono", ui-monospace, monospace`;
      const hzText = spec.frequencyHz >= 1000 ? `${(spec.frequencyHz / 1000).toFixed(1)}k` : `${Math.round(spec.frequencyHz)}Hz`;
      ctx.fillText(hzText, c.x, c.y + r * 0.34);
      ctx.restore();
    }

    // 8. Active Thumb Mercury Orbs & Tension Arcs
    for (const ptr of this.pointers.values()) {
      const orbR = this.baseR * (0.30 + ptr.stretchNorm * 0.14);
      ctx.save();
      if (ptr.stretchNorm > 0.06) {
        const gaugeR = orbR + 10;
        ctx.strokeStyle = 'rgba(255,255,255,0.14)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(ptr.x, ptr.y, gaugeR, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = ptr.stretchNorm > 0.62 ? '#F5A623' : accentHex;
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(ptr.x, ptr.y, gaugeR, -Math.PI / 2, -Math.PI / 2 + ptr.stretchNorm * Math.PI * 2);
        ctx.stroke();
      }
      const orbGrad = ctx.createRadialGradient(ptr.x - orbR * 0.3, ptr.y - orbR * 0.3, 2, ptr.x, ptr.y, orbR);
      orbGrad.addColorStop(0, '#FFFFFF');
      orbGrad.addColorStop(0.55, accentHex);
      orbGrad.addColorStop(1, rgba(accentRgb, 0.65));
      ctx.fillStyle = orbGrad;
      ctx.beginPath();
      ctx.arc(ptr.x, ptr.y, orbR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 9. Metallic Impact Sparks
    for (let i = 0; i < this.sparks.length; i++) {
      const sp = this.sparks[i];
      ctx.save();
      ctx.fillStyle = sp.life > 0.55 ? `rgba(255,255,255,${sp.life * 0.9})` : rgba(accentRgb, sp.life * 0.85);
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.r * sp.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // First-touch subtle hint
    if (this.hintAlpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = this.hintAlpha * 0.72;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '600 9.5px "JetBrains Mono", ui-monospace, monospace';
      ctx.fillStyle = 'rgba(235, 232, 224, 0.86)';
      ctx.fillText('TAP • SWIPE EDGE FOR INFINITE OCTAVES • PULL TO WOBBLE', fieldW * 0.5, h - 10);
      ctx.restore();
    }

    ctx.restore(); // end field clip

    // 10. Right-Edge Infinite Octave Elevator Rail (always sharp & un-shaken!)
    this.drawOctaveRail(ctx, w, h, accentRgb, accentHex);

    ctx.restore();
  }

  drawOctaveRail(ctx, w, h, accentRgb, accentHex) {
    const rx = w - this.railWidth;
    const topY = this.padTop;
    const botY = h - this.padBottom;
    const railH = Math.max(80, botY - topY);

    ctx.save();
    // Recessed elevator track
    ctx.fillStyle = this.railPointer ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.035)';
    ctx.beginPath();
    ctx.roundRect(rx + 2, topY, this.railWidth - 6, railH, 11);
    ctx.fill();
    ctx.strokeStyle = this.railPointer ? rgba(accentRgb, 0.65) : 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Infinite scrolling octave ruler ticks inside the rail
    ctx.beginPath();
    ctx.roundRect(rx + 2, topY, this.railWidth - 6, railH, 11);
    ctx.clip();

    const centerOctFloat = (this.scrollRow + this.visibleRows * 0.5) / 4;
    const baseOct = Math.floor(centerOctFloat);
    const pxPerOct = railH / 4.2;

    for (let o = baseOct - 4; o <= baseOct + 4; o++) {
      const ty = topY + railH * 0.5 - (o - centerOctFloat) * pxPerOct;
      if (ty < topY - 12 || ty > botY + 12) continue;
      const distNorm = clamp(Math.abs(ty - (topY + railH * 0.5)) / (railH * 0.5), 0, 1);
      const isCenter = Math.abs(o - centerOctFloat) < 0.55;

      ctx.strokeStyle = isCenter ? accentHex : `rgba(255,255,255,${0.32 * (1 - distNorm)})`;
      ctx.lineWidth = isCenter ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(rx + 5, ty);
      ctx.lineTo(rx + (isCenter ? 11 : 9), ty);
      ctx.stroke();

      ctx.font = `${isCenter ? '700' : '600'} 8.5px "JetBrains Mono", ui-monospace, monospace`;
      ctx.fillStyle = isCenter ? '#FFFFFF' : `rgba(180,186,198,${0.7 * (1 - distNorm)})`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`C${o}`, rx + this.railWidth * 0.5 + 1, ty);
    }

    // Center glowing reticle marker
    const midY = topY + railH * 0.5;
    ctx.fillStyle = accentHex;
    ctx.beginPath();
    ctx.arc(rx + 5, midY, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Top/Bottom infinity arrows
    ctx.font = '700 8px "JetBrains Mono", ui-monospace, monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.textAlign = 'center';
    ctx.fillText('▲', rx + this.railWidth * 0.5 - 1, topY + 9);
    ctx.fillText('▼', rx + this.railWidth * 0.5 - 1, botY - 8);
    ctx.restore();
  }
}
