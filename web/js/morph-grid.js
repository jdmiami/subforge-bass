/**
 * SubForge Bass — Flagship Interface: Liquid-Metal Morph Grid
 * Fluid Thumb-Swipe × Tactile Button Hybrid Engine
 *
 * Physics & Interaction:
 * - 12 chromatic ferrofluid cells (3x4, C bottom-left -> B top-right) on damped springs
 * - Tap: crisp button-like 808 transient + spring squash/rebound + ripple shockwave to neighbors
 * - Swipe across cells: magnetic proximity swell + gooey metaball bridges + continuous portamento pitch glide
 * - Press & pull: taffy stretch cranks live Filter Cutoff, Resonance, Drive & Wobble LFO; snap-back sub-drop on release
 * - Multi-touch pointer support, bass-reactive micro screen-shake, live background oscilloscope, & mobile haptics
 */

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

// 3 columns x 4 rows: bottom row = C, C#, D (0,1,2) climbing up to A, A#, B (9,10,11)
const VERTICAL_PAD_ORDER = [9, 10, 11, 6, 7, 8, 3, 4, 5, 0, 1, 2];

export class LiquidMorphGrid {
  constructor({
    canvas,
    container,
    engine,
    getInstrument,
    getPadNotes,
    isZenMode,
    onTapNote,
    onGlideNote,
    onNoteReadout,
    onPlayActivity,
  }) {
    this.canvas = canvas;
    this.container = container;
    this.ctx = canvas.getContext('2d');
    this.engine = engine;
    this.getInstrument = getInstrument;
    this.getPadNotes = getPadNotes;
    this.isZenMode = isZenMode;
    this.onTapNote = onTapNote;
    this.onGlideNote = onGlideNote;
    this.onNoteReadout = onNoteReadout;
    this.onPlayActivity = onPlayActivity;

    this.width = 400;
    this.height = 560;
    this.dpr = 1;

    // 12 physical liquid-metal cells indexed by padIdx (0..11)
    this.cells = Array.from({ length: 12 }, (_, padIdx) => ({
      padIdx,
      gridCol: 0,
      gridRow: 0,
      restX: 0,
      restY: 0,
      baseR: 38,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      scale: 1,
      scaleV: 0,
      energy: 0,
      stretch: 0,
      magPull: 0,
      lastHitTime: 0,
      phaseSeed: padIdx * 1.37 + 0.5,
    }));

    // Active multi-touch pointers: pointerId -> session state
    this.pointers = new Map();

    // Expanding ferrofluid ripples, persistent liquid bridges, droplets/sparks
    this.ripples = [];
    this.bridges = [];
    this.sparks = [];

    // Screen micro-shake & flow energy
    this.shakeX = 0;
    this.shakeY = 0;
    this.shakeMag = 0;
    this.flowEnergy = 0;
    this.hasInteracted = false;
    this.hintAlpha = 1;
    this.lastTime = performance.now();

    this.resize();
    this.bindEvents();
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
    const padTop = zen ? 66 : 16;
    const padBottom = zen ? 22 : 16;
    const padX = zen ? 14 : 12;

    const usableW = Math.max(120, this.width - padX * 2);
    const usableH = Math.max(160, this.height - padTop - padBottom);
    const colW = usableW / 3;
    const rowH = usableH / 4;
    const baseR = Math.min(colW, rowH) * 0.365;

    VERTICAL_PAD_ORDER.forEach((padIdx, slot) => {
      const col = slot % 3;
      const row = Math.floor(slot / 3);
      const cell = this.cells[padIdx];
      cell.gridCol = col;
      cell.gridRow = row;
      cell.restX = padX + colW * (col + 0.5);
      cell.restY = padTop + rowH * (row + 0.5);
      cell.baseR = baseR;
      if (cell.x === 0 && cell.y === 0) {
        cell.x = cell.restX;
        cell.y = cell.restY;
      }
    });
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
  }

  getLocalPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  findNearestCell(x, y) {
    let best = this.cells[0];
    let bestDist = Infinity;
    for (let i = 0; i < this.cells.length; i++) {
      const c = this.cells[i];
      const dx = x - c.restX;
      const dy = y - c.restY;
      const d = Math.hypot(dx, dy);
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
    return { cell: best, dist: bestDist };
  }

  haptic(ms = 10) {
    try {
      if (navigator && typeof navigator.vibrate === 'function') {
        navigator.vibrate(ms);
      }
    } catch (_) {}
  }

  handlePointerDown(e) {
    e.preventDefault();
    this.hasInteracted = true;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch (_) {}

    const { x, y } = this.getLocalPos(e);
    const { cell } = this.findNearestCell(x, y);
    const notes = this.getPadNotes();
    const spec = notes[cell.padIdx];

    // Velocity biased by strike height inside the cell (natural thumb weight)
    const relY = clamp((y - (cell.restY - cell.baseR)) / (cell.baseR * 2), 0, 1);
    const velocity = 0.72 + relY * 0.28;

    // 1. Crisp button-like 808 PCM transient hit
    if (this.onTapNote) {
      this.onTapNote(cell.padIdx, velocity);
    }

    // 2. Spin up continuous liquid morph voice silently behind the hit, ready for pull/glide
    const cutoffNorm = clamp(x / Math.max(1, this.width), 0, 1);
    this.engine.startLiquidVoice(e.pointerId, spec.frequencyHz, {
      initialGain: 0.0001,
      cutoffNorm,
      stretchNorm: 0,
    });

    // 3. Physical squash, ripple shockwave, sparks & haptic tap
    this.slamCell(cell, velocity, x, y, true);
    this.haptic(10);

    this.pointers.set(e.pointerId, {
      pointerId: e.pointerId,
      x,
      y,
      prevX: x,
      prevY: y,
      anchorPadIdx: cell.padIdx,
      activePadIdx: cell.padIdx,
      currentFreq: spec.frequencyHz,
      stretchNorm: 0,
      isGliding: false,
      trail: [{ x, y, t: performance.now() }],
      downTime: performance.now(),
    });

    if (this.onPlayActivity) this.onPlayActivity(true);
  }

  handlePointerMove(e) {
    const ptr = this.pointers.get(e.pointerId);
    if (!ptr) return;
    e.preventDefault();

    const { x, y } = this.getLocalPos(e);
    const now = performance.now();
    const speed = Math.hypot(x - ptr.x, y - ptr.y);
    ptr.prevX = ptr.x;
    ptr.prevY = ptr.y;
    ptr.x = x;
    ptr.y = y;

    ptr.trail.push({ x, y, t: now });
    if (ptr.trail.length > 22) ptr.trail.shift();

    const notes = this.getPadNotes();
    const activeCell = this.cells[ptr.activePadIdx];
    const { cell: nearestCell, dist: nearestDist } = this.findNearestCell(x, y);

    // Distance from currently active cell center
    const dxActive = x - activeCell.restX;
    const dyActive = y - activeCell.restY;
    const distActive = Math.hypot(dxActive, dyActive);

    // Cross into a new cell when thumb enters its magnetic capture zone
    const captureRadius = nearestCell.baseR * 1.08;
    if (nearestCell.padIdx !== ptr.activePadIdx && nearestDist < captureRadius) {
      const prevCell = activeCell;
      ptr.activePadIdx = nearestCell.padIdx;
      ptr.isGliding = true;

      // Spawn glowing ferrofluid bridge fusing previous cell -> new cell
      this.bridges.push({
        fromIdx: prevCell.padIdx,
        toIdx: nearestCell.padIdx,
        life: 1.0,
        createdAt: now,
      });

      const nextSpec = notes[nearestCell.padIdx];
      ptr.currentFreq = nextSpec.frequencyHz;

      // Magnetic fret pop (subtle crisp transient while continuous synth glides seamlessly!)
      const glideVel = clamp(0.46 + speed * 0.014, 0.48, 0.86);
      if (this.onGlideNote) {
        this.onGlideNote(nearestCell.padIdx, glideVel);
      }

      this.slamCell(nearestCell, glideVel * 0.9, x, y, false);
      this.haptic(6);
      this.flowEnergy = clamp(this.flowEnergy + 0.18, 0, 1);
    }

    // Recompute stretch relative to active cell
    const curCell = this.cells[ptr.activePadIdx];
    const dx = x - curCell.restX;
    const dy = y - curCell.restY;
    const dist = Math.hypot(dx, dy);

    // Stretch starts smoothly past 22% of cell radius and maxes around 2.6x radius
    const stretchNorm = clamp((dist - curCell.baseR * 0.22) / (curCell.baseR * 2.35), 0, 1);
    ptr.stretchNorm = stretchNorm;

    // Pull the cell toward the thumb with elastic resistance
    const pullCap = curCell.baseR * 0.44;
    const pullMag = Math.min(pullCap, dist * 0.34);
    const angle = Math.atan2(dy, dx);
    curCell.vx += (curCell.restX + Math.cos(angle) * pullMag - curCell.x) * 0.32;
    curCell.vy += (curCell.restY + Math.sin(angle) * pullMag - curCell.y) * 0.32;
    curCell.stretch = Math.max(curCell.stretch, stretchNorm);
    curCell.energy = Math.max(curCell.energy, 0.42 + stretchNorm * 0.58);

    // Continuous pitch: interpolate smoothly between active cell & nearest neighbor when dragging between them,
    // or apply expressive pitch tug when stretching outward!
    const baseSpec = notes[ptr.activePadIdx];
    let targetFreq = baseSpec.frequencyHz;

    if (nearestCell.padIdx !== ptr.activePadIdx) {
      const pairDist = Math.max(1, Math.hypot(nearestCell.restX - curCell.restX, nearestCell.restY - curCell.restY));
      const blend = clamp(dist / pairDist, 0, 0.82);
      const neighborSpec = notes[nearestCell.padIdx];
      // Logarithmic pitch interpolation for musical portamento
      targetFreq = baseSpec.frequencyHz * Math.pow(neighborSpec.frequencyHz / baseSpec.frequencyHz, blend);
    } else if (stretchNorm > 0.08) {
      // Vertical tug bends pitch up to +/- 1.8 semitones for expressive bass vibrato/bend
      const verticalBend = clamp(-dy / (curCell.baseR * 2.2), -1, 1);
      targetFreq = baseSpec.frequencyHz * Math.pow(2, (verticalBend * 1.8) / 12);
    }

    ptr.currentFreq = targetFreq;

    // Swell continuous synth voice as soon as thumb glides or stretches (or holds > 90ms)
    const heldMs = now - ptr.downTime;
    const morphAmount = ptr.isGliding
      ? Math.max(0.68, 0.56 + stretchNorm * 0.32)
      : clamp(stretchNorm * 0.95 + (heldMs > 110 ? 0.38 : 0), 0, 0.84);

    const cutoffNorm = clamp(0.18 + (x / Math.max(1, this.width)) * 0.65 + stretchNorm * 0.3, 0, 1);
    this.engine.updateLiquidVoice(e.pointerId, targetFreq, {
      level: morphAmount,
      stretchNorm,
      cutoffNorm,
      glideTau: ptr.isGliding ? 0.018 : 0.024,
    });

    if (this.onNoteReadout) {
      const modeTag = stretchNorm > 0.45 ? 'WOBBLE' : ptr.isGliding ? 'GLIDE' : 'MORPH';
      this.onNoteReadout(`${baseSpec.noteName} • ${targetFreq.toFixed(1)}Hz • ${modeTag}`);
    }

    // Emit liquid chrome sparks while swiping quickly or stretching hard
    if ((speed > 8 || stretchNorm > 0.55) && Math.random() < 0.55) {
      this.spawnSparks(x, y, 2, 0.55 + stretchNorm * 0.45);
    }
  }

  handlePointerUp(e) {
    const ptr = this.pointers.get(e.pointerId);
    if (!ptr) return;

    const snapDrop = ptr.stretchNorm > 0.42;
    this.engine.stopLiquidVoice(e.pointerId, snapDrop);

    if (snapDrop) {
      // Exaggerated elastic snap-back recoil on big stretch release!
      const cell = this.cells[ptr.activePadIdx];
      cell.scaleV += 0.24;
      this.shakeMag = Math.max(this.shakeMag, 4.5);
      this.spawnSparks(ptr.x, ptr.y, 12, 1.0);
      this.ripples.push({
        x: cell.x,
        y: cell.y,
        r: cell.baseR * 0.5,
        maxR: Math.max(this.width, this.height) * 0.65,
        strength: 0.95,
        life: 1.0,
      });
      this.haptic(18);
    }

    this.pointers.delete(e.pointerId);
    if (this.pointers.size === 0 && this.onPlayActivity) {
      this.onPlayActivity(false);
    }
  }

  /**
   * External trigger hook (from 16-step sequencer, Demo Riff, or desktop keyboard)
   * so the Liquid-Metal Morph Grid physically dances with every note!
   */
  pulseCell(padIndex, velocity = 0.9) {
    const idx = clamp(padIndex, 0, 11);
    const cell = this.cells[idx];
    if (!cell) return;
    this.slamCell(cell, velocity, cell.restX, cell.restY, true);
  }

  slamCell(cell, velocity, impactX, impactY, strongWave = true) {
    cell.energy = 1.0;
    cell.lastHitTime = performance.now();
    // Juicy squash-and-rebound spring impulse
    cell.scale = 0.80;
    cell.scaleV = 0.22 + velocity * 0.14;

    // Slight directional kick away from strike point
    const kickAngle = Math.atan2(cell.y - impactY, cell.x - impactX);
    const kickDist = Math.hypot(cell.x - impactX, cell.y - impactY);
    if (kickDist > 4) {
      cell.vx += Math.cos(kickAngle) * 3.2 * velocity;
      cell.vy += Math.sin(kickAngle) * 3.2 * velocity;
    }

    // Expanding ferrofluid pressure wave pushing neighboring cells
    this.ripples.push({
      x: cell.x,
      y: cell.y,
      r: cell.baseR * 0.55,
      maxR: Math.max(this.width, this.height) * (strongWave ? 0.72 : 0.45),
      strength: velocity * (strongWave ? 1.0 : 0.55),
      life: 1.0,
    });

    // Immediate radial bump to adjacent cells for tactile chain-reaction feel
    for (let i = 0; i < this.cells.length; i++) {
      const other = this.cells[i];
      if (other.padIdx === cell.padIdx) continue;
      const dx = other.restX - cell.restX;
      const dy = other.restY - cell.restY;
      const d = Math.hypot(dx, dy);
      if (d > 1 && d < cell.baseR * 4.4) {
        const falloff = (1 - d / (cell.baseR * 4.4)) * velocity * (strongWave ? 4.8 : 2.2);
        other.vx += (dx / d) * falloff;
        other.vy += (dy / d) * falloff;
        other.scaleV += falloff * 0.012;
      }
    }

    this.spawnSparks(impactX, impactY, strongWave ? 9 : 4, velocity);
    if (strongWave) {
      this.shakeMag = Math.min(6.5, this.shakeMag + velocity * 3.4);
      this.flowEnergy = clamp(this.flowEnergy + 0.14, 0, 1);
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

  /**
   * Draws an organic catenoid / metaball liquid bridge connecting circle 1 and circle 2.
   */
  drawLiquidBridge(ctx, x1, y1, r1, x2, y2, r2, fillStyle, alpha = 1) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const d = Math.hypot(dx, dy);
    if (d < 2 || d > (r1 + r2) * 4.6) return;

    const angle = Math.atan2(dy, dx);
    const perp = angle + Math.PI / 2;

    // Waist pinches thinner as the liquid stretches further
    const stretchFactor = clamp(d / ((r1 + r2) * 3.6), 0, 1);
    const w1 = r1 * (0.78 - stretchFactor * 0.25);
    const w2 = r2 * (0.82 - stretchFactor * 0.22);
    const waistW = Math.max(3, Math.min(w1, w2) * (0.58 - stretchFactor * 0.44));

    const p1aX = x1 + Math.cos(perp) * w1;
    const p1aY = y1 + Math.sin(perp) * w1;
    const p1bX = x1 - Math.cos(perp) * w1;
    const p1bY = y1 - Math.sin(perp) * w1;

    const p2aX = x2 + Math.cos(perp) * w2;
    const p2aY = y2 + Math.sin(perp) * w2;
    const p2bX = x2 - Math.cos(perp) * w2;
    const p2bY = y2 - Math.sin(perp) * w2;

    const midX = (x1 + x2) * 0.5;
    const midY = (y1 + y2) * 0.5;
    const ctrlAX = midX + Math.cos(perp) * waistW;
    const ctrlAY = midY + Math.sin(perp) * waistW;
    const ctrlBX = midX - Math.cos(perp) * waistW;
    const ctrlBY = midY - Math.sin(perp) * waistW;

    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.fillStyle = fillStyle;
    ctx.beginPath();
    ctx.moveTo(p1aX, p1aY);
    ctx.quadraticCurveTo(ctrlAX, ctrlAY, p2aX, p2aY);
    ctx.lineTo(p2bX, p2bY);
    ctx.quadraticCurveTo(ctrlBX, ctrlBY, p1bX, p1bY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /**
   * Main 60-120fps physics update + ferrofluid Canvas render pass.
   */
  render(now) {
    const dt = Math.min(0.04, Math.max(0.004, (now - this.lastTime) / 1000));
    this.lastTime = now;
    const step = dt * 60;

    const inst = this.getInstrument();
    const notes = this.getPadNotes();
    const accentHex = inst.accentColorHex || '#38BDF8';
    const accentRgb = hexToRgb(accentHex);
    const bassAmp = this.engine.getBassAmplitude ? this.engine.getBassAmplitude() : 0;

    // Decay flow, hint & screen micro-shake
    this.flowEnergy = Math.max(0, this.flowEnergy - 0.004 * step);
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

    // Update cell spring physics + magnetic proximity pull from all active pointers
    for (let i = 0; i < this.cells.length; i++) {
      const c = this.cells[i];
      let targetX = c.restX;
      let targetY = c.restY;
      let targetScale = 1 + bassAmp * 0.045;
      let magPull = 0;

      // Magnetic attraction toward nearby moving thumbs!
      for (const ptr of this.pointers.values()) {
        const dx = ptr.x - c.restX;
        const dy = ptr.y - c.restY;
        const d = Math.hypot(dx, dy);
        const magRange = c.baseR * 3.1;
        if (d < magRange) {
          const proximity = 1 - d / magRange;
          const pullStrength = ptr.activePadIdx === c.padIdx ? 0.28 : 0.16 * proximity;
          targetX += dx * pullStrength;
          targetY += dy * pullStrength;
          targetScale += proximity * 0.14;
          magPull = Math.max(magPull, proximity);
        }
      }

      // Hooke's law spring integration
      const springK = 0.20;
      const damp = Math.pow(0.76, step);
      c.vx = (c.vx + (targetX - c.x) * springK * step) * damp;
      c.vy = (c.vy + (targetY - c.y) * springK * step) * damp;
      c.x += c.vx * step;
      c.y += c.vy * step;

      c.scaleV = (c.scaleV + (targetScale - c.scale) * 0.24 * step) * Math.pow(0.74, step);
      c.scale = clamp(c.scale + c.scaleV * step, 0.72, 1.38);

      c.energy = Math.max(0, c.energy - 0.026 * step);
      c.stretch = Math.max(0, c.stretch - 0.06 * step);
      c.magPull = magPull;
    }

    // Update ripples
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const rp = this.ripples[i];
      rp.r += (rp.maxR * 0.042 + 4.2) * step;
      rp.life -= 0.032 * step;
      if (rp.life <= 0 || rp.r > rp.maxR) {
        this.ripples.splice(i, 1);
      }
    }

    // Update bridges
    for (let i = this.bridges.length - 1; i >= 0; i--) {
      this.bridges[i].life -= 0.035 * step;
      if (this.bridges[i].life <= 0) this.bridges.splice(i, 1);
    }

    // Update sparks
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

    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    // 1. Deep Obsidian Ferrofluid Bed
    const bgGrad = ctx.createRadialGradient(w * 0.5, h * 0.45, 20, w * 0.5, h * 0.5, Math.max(w, h) * 0.85);
    bgGrad.addColorStop(0, `rgb(${13 + Math.round(accentRgb.r * 0.05 * bassAmp)}, ${15 + Math.round(accentRgb.g * 0.05 * bassAmp)}, ${20 + Math.round(accentRgb.b * 0.05 * bassAmp)})`);
    bgGrad.addColorStop(1, '#07080B');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Apply micro screen-shake to active world
    ctx.translate(this.shakeX, this.shakeY);

    // 2. Live Sub-Bass Waveform Ribbon Woven Behind the Ferrofluid Cells
    const samples = this.engine.readOscilloscope ? this.engine.readOscilloscope() : null;
    if (samples) {
      const midY = h * 0.52;
      ctx.save();
      ctx.strokeStyle = rgba(accentRgb, 0.11 + bassAmp * 0.24);
      ctx.lineWidth = 1.6 + bassAmp * 1.8;
      ctx.beginPath();
      for (let i = 0; i < samples.length; i += 2) {
        const sx = (i / (samples.length - 1)) * w;
        const sy = midY - samples[i] * (h * 0.16);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 3. Expanding Ferrofluid Shockwave Ripples
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

    // 4. Persistent Fusing Bridges Between Recently Glided Cells
    for (let i = 0; i < this.bridges.length; i++) {
      const br = this.bridges[i];
      const a = this.cells[br.fromIdx];
      const b = this.cells[br.toIdx];
      const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
      grad.addColorStop(0, rgba(accentRgb, 0.72));
      grad.addColorStop(0.5, 'rgba(235, 244, 255, 0.85)');
      grad.addColorStop(1, rgba(accentRgb, 0.72));
      this.drawLiquidBridge(ctx, a.x, a.y, a.baseR * 0.65, b.x, b.y, b.baseR * 0.65, grad, br.life * 0.78);
    }

    // 5. Live Elastic Taffy Bridges Connecting Anchored Cells -> Active Thumbs
    for (const ptr of this.pointers.values()) {
      const cell = this.cells[ptr.activePadIdx];
      const thumbR = cell.baseR * (0.34 + ptr.stretchNorm * 0.14);

      // Luminous swipe ribbon trail
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

      // Catenoid metaball neck between active cell and thumb orb
      const bGrad = ctx.createLinearGradient(cell.x, cell.y, ptr.x, ptr.y);
      bGrad.addColorStop(0, rgba(accentRgb, 0.85));
      bGrad.addColorStop(0.55, ptr.stretchNorm > 0.5 ? 'rgba(255, 232, 195, 0.92)' : rgba(accentRgb, 0.68));
      bGrad.addColorStop(1, '#ffffff');
      this.drawLiquidBridge(
        ctx,
        cell.x,
        cell.y,
        cell.baseR * cell.scale * 0.88,
        ptr.x,
        ptr.y,
        thumbR,
        bGrad,
        0.86
      );
    }

    // 6. Render All 12 Sculpted Ferrofluid Liquid-Metal Cells
    for (let i = 0; i < this.cells.length; i++) {
      const c = this.cells[i];
      const spec = notes[c.padIdx];
      const r = c.baseR * c.scale;
      const activeGlow = clamp(c.energy + c.magPull * 0.45 + c.stretch * 0.6, 0, 1);

      // Ambient Sub-Bass Glow Halo behind cell
      if (activeGlow > 0.04 || bassAmp > 0.12) {
        const haloR = r * (1.42 + activeGlow * 0.45);
        const halo = ctx.createRadialGradient(c.x, c.y, r * 0.35, c.x, c.y, haloR);
        halo.addColorStop(0, rgba(accentRgb, 0.28 * activeGlow + bassAmp * 0.08));
        halo.addColorStop(1, rgba(accentRgb, 0));
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(c.x, c.y, haloR, 0, Math.PI * 2);
        ctx.fill();
      }

      // Organic liquid-metal perimeter (subtle ferrofluid surface ripples when energized)
      ctx.save();
      ctx.beginPath();
      const wobbleAmp = (c.energy * 2.4 + c.stretch * 3.8 + bassAmp * 1.4);
      const segments = 32;
      for (let s = 0; s <= segments; s++) {
        const a = (s / segments) * Math.PI * 2;
        const microWave = wobbleAmp > 0.15
          ? Math.sin(a * 4 + now * 0.011 + c.phaseSeed) * wobbleAmp * 0.6 +
            Math.cos(a * 3 - now * 0.008) * wobbleAmp * 0.4
          : 0;
        const rad = r + microWave;
        const px = c.x + Math.cos(a) * rad;
        const py = c.y + Math.sin(a) * rad;
        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();

      // Sculpted obsidian-mercury gradient fill
      const bodyGrad = ctx.createRadialGradient(
        c.x - r * 0.28,
        c.y - r * 0.32,
        r * 0.08,
        c.x,
        c.y,
        r * 1.08
      );
      if (activeGlow > 0.15) {
        bodyGrad.addColorStop(0, `rgba(${Math.min(255, 72 + Math.round(accentRgb.r * 0.65 * activeGlow))}, ${Math.min(255, 78 + Math.round(accentRgb.g * 0.65 * activeGlow))}, ${Math.min(255, 88 + Math.round(accentRgb.b * 0.65 * activeGlow))}, 0.98)`);
        bodyGrad.addColorStop(0.58, `rgba(${24 + Math.round(accentRgb.r * 0.22 * activeGlow)}, ${27 + Math.round(accentRgb.g * 0.22 * activeGlow)}, ${34 + Math.round(accentRgb.b * 0.22 * activeGlow)}, 0.96)`);
        bodyGrad.addColorStop(1, '#0E1016');
      } else {
        bodyGrad.addColorStop(0, '#2B303B');
        bodyGrad.addColorStop(0.55, '#171A21');
        bodyGrad.addColorStop(1, '#0C0E13');
      }
      ctx.fillStyle = bodyGrad;
      ctx.fill();

      // Machined liquid rim highlight
      ctx.lineWidth = activeGlow > 0.2 ? 1.8 : 1.1;
      ctx.strokeStyle = activeGlow > 0.2
        ? rgba(accentRgb, 0.45 + activeGlow * 0.55)
        : 'rgba(255, 255, 255, 0.13)';
      ctx.stroke();

      // Top-left liquid chrome specular crescent
      ctx.beginPath();
      ctx.arc(c.x, c.y, r * 0.82, Math.PI * 1.08, Math.PI * 1.62);
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.14 + activeGlow * 0.32})`;
      ctx.lineWidth = 2.0;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();

      // Crisp Note Typography centered in each ferrofluid cell
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = activeGlow > 0.35 ? '#FFFFFF' : 'rgba(241, 238, 232, 0.9)';
      ctx.font = `700 ${Math.round(clamp(r * 0.44, 15, 24))}px "Space Grotesk", ui-sans-serif, system-ui, sans-serif`;
      ctx.fillText(spec.noteName, c.x, c.y - r * 0.1);

      ctx.fillStyle = activeGlow > 0.35 ? rgba(accentRgb, 0.95) : 'rgba(155, 162, 175, 0.68)';
      ctx.font = `600 ${Math.round(clamp(r * 0.22, 9, 11.5))}px "JetBrains Mono", ui-monospace, monospace`;
      ctx.fillText(`${Math.round(spec.frequencyHz)}Hz`, c.x, c.y + r * 0.34);
      ctx.restore();
    }

    // 7. Render Active Thumb Mercury Orbs + Tension/Wobble Arc Gauges
    for (const ptr of this.pointers.values()) {
      const cell = this.cells[ptr.activePadIdx];
      const orbR = cell.baseR * (0.30 + ptr.stretchNorm * 0.14);

      ctx.save();
      // Glowing tension arc around thumb when pulling/bending
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
        ctx.arc(
          ptr.x,
          ptr.y,
          gaugeR,
          -Math.PI / 2,
          -Math.PI / 2 + ptr.stretchNorm * Math.PI * 2
        );
        ctx.stroke();
      }

      // Chrome thumb orb
      const orbGrad = ctx.createRadialGradient(
        ptr.x - orbR * 0.3,
        ptr.y - orbR * 0.3,
        2,
        ptr.x,
        ptr.y,
        orbR
      );
      orbGrad.addColorStop(0, '#FFFFFF');
      orbGrad.addColorStop(0.55, accentHex);
      orbGrad.addColorStop(1, rgba(accentRgb, 0.65));
      ctx.fillStyle = orbGrad;
      ctx.beginPath();
      ctx.arc(ptr.x, ptr.y, orbR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 8. Metallic Impact Droplets / Sparks
    for (let i = 0; i < this.sparks.length; i++) {
      const sp = this.sparks[i];
      ctx.save();
      ctx.fillStyle = sp.life > 0.55 ? `rgba(255,255,255,${sp.life * 0.9})` : rgba(accentRgb, sp.life * 0.85);
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.r * sp.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 9. First-Touch Subtle Whisper Hint (dissolves permanently after first touch)
    if (this.hintAlpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = this.hintAlpha * 0.72;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '600 10px "JetBrains Mono", ui-monospace, monospace';
      ctx.fillStyle = 'rgba(235, 232, 224, 0.85)';
      ctx.fillText('TAP PADS  •  SWIPE TO GLIDE  •  PULL TO WOBBLE', w * 0.5, h - 14);
      ctx.restore();
    }

    ctx.restore();
  }
}
