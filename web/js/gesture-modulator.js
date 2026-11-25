/**
 * SubForge Bass — Second-Hand 14-Gesture Modulator Deck
 * Independent Multi-Touch Ferrofluid FX Pad (Works simultaneously with Infinite Morph Grid!)
 *
 * Single-Touch Gestures:
 *  1. Single Tap         -> 808 Sub-Punch Impact Thump
 *  2. Double Tap         -> Deep 808 Sub-Octave Dive Bomb (also unlocks Latch)
 *  3. Triple Tap         -> Tempo-Synced 1/32 Glitch Stutter Burst
 *  4. Slide Up / Down    -> Master Filter Cutoff & Resonance Scream
 *  5. Slide Left / Right -> Analog Drive & Fuzz Saturation
 *  6. Circular Swirl     -> Dubstep Wobble LFO Rate Spinner (CW faster, CCW slower)
 *  7. Rapid Shake/Scrub  -> Aggressive High-Speed Filter Vibrato Thrash
 *  8. Long Press Hold    -> Harmonic Sub-Drone Swell + FX Hold Latch
 *
 * Multi-Touch Gestures (2+ Fingers, or Shift+Drag / Mouse Wheel on Desktop):
 *  9. 2-Finger Up/Down   -> Master Whammy Pitch Bend (+/- 12 semitones across all voices!)
 * 10. 2-Finger Left/Right-> Rhythmic Gate / Chopper Rate (2Hz -> 24Hz)
 * 11. 2-Finger Spread    -> Wide Reese Chorus Stereo Detune
 * 12. 2-Finger Pinch     -> Hyper-Tight Sub-Core Laser Notch
 * 13. 2-Finger Twist     -> Resonant Harmonic Phaser Vault Dial
 * 14. 2-Finger Tap / 3F  -> DJ Kill-Switch Slam (2F) / Clean Reset All FX (3F)
 */

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function hexToRgb(hex) {
  const clean = String(hex || '#38BDF8').replace('#', '').trim();
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean.padEnd(6, '0').slice(0, 6);
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function rgba(rgb, a) {
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${clamp(a, 0, 1).toFixed(3)})`;
}

export const GESTURE_GUIDE_ITEMS = [
  { tag: '1F TAP', fx: '808 Sub-Punch' },
  { tag: '1F 2× TAP', fx: 'Sub-Octave Dive / Unlock' },
  { tag: '1F 3× TAP', fx: '1/32 Glitch Stutter' },
  { tag: '1F SLIDE ↕', fx: 'Filter Cutoff + Scream' },
  { tag: '1F SLIDE ⇄', fx: 'Analog Drive Grit' },
  { tag: '1F SWIRL ↻', fx: 'Wobble LFO Spinner' },
  { tag: '1F SHAKE ⚡', fx: 'Vibrato Thrash' },
  { tag: '1F HOLD ◉', fx: 'Sub-Drone + Latch FX' },
  { tag: '2F SLIDE ↕', fx: 'Whammy Pitch ±12st' },
  { tag: '2F SLIDE ⇄', fx: 'Rhythmic Gate Chop' },
  { tag: '2F SPREAD ↔', fx: 'Wide Reese Chorus' },
  { tag: '2F PINCH ⇹', fx: 'Laser Sub-Core Notch' },
  { tag: '2F TWIST ⟳', fx: 'Harmonic Phaser Dial' },
  { tag: '2F/3F TAP', fx: 'Kill Slam / Reset FX' },
];

export class GestureModulatorDeck {
  constructor({
    canvas,
    container,
    engine,
    getInstrument,
    getBpm,
    onGestureStatus,
    onPlayActivity,
  }) {
    this.canvas = canvas;
    this.container = container;
    this.ctx = canvas.getContext('2d');
    this.engine = engine;
    this.getInstrument = getInstrument;
    this.getBpm = getBpm;
    this.onGestureStatus = onGestureStatus;
    this.onPlayActivity = onPlayActivity;

    this.width = 400;
    this.height = 150;
    this.dpr = 1;

    // Active touch points on the Modulator Deck
    this.pointers = new Map();

    // Tap cadence state (1x, 2x, 3x tap detection)
    this.tapCount = 0;
    this.lastTapTime = 0;
    this.tapResolveTimer = null;
    this.twoFingerDownTime = 0;
    this.twoFingerMoved = false;

    // Hold / Long-Press Latch state
    this.holdTimer = null;
    this.isLatched = false;
    this.droneActive = false;

    // Live FX state
    this.fx = {
      cutoffNorm: 0.72,
      driveNorm: 0.16,
      wobbleRateHz: 3.5,
      wobbleDepth: 0,
      pitchBendSemis: 0,
      chopRateHz: 8,
      chopDepth: 0,
      spreadNorm: 0.5,
      twistNorm: 0.5,
      killActive: false,
    };

    // Gesture visual telemetry
    this.activeGestureLabel = '2ND HAND MOD • TAP / SWIPE / 2F PINCH';
    this.gestureFlash = 0;
    this.swirlEnergy = 0;
    this.swirlAngle = 0;
    this.thrashEnergy = 0;
    this.ripples = [];
    this.sparks = [];
    this.trail = [];

    // Two-finger reference frame
    this.multiRef = null;
    this.wheelSpread = 0.5;
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
  }

  haptic(ms = 10) {
    try {
      if (navigator && typeof navigator.vibrate === 'function') navigator.vibrate(ms);
    } catch (_) {}
  }

  setGestureFeedback(label, flash = 1.0) {
    this.activeGestureLabel = label;
    this.gestureFlash = Math.max(this.gestureFlash, flash);
    if (this.onGestureStatus) {
      this.onGestureStatus(label, this.isLatched);
    }
  }

  resetAll(silent = false) {
    this.isLatched = false;
    this.droneActive = false;
    this.fx = {
      cutoffNorm: 0.72,
      driveNorm: 0.16,
      wobbleRateHz: 3.5,
      wobbleDepth: 0,
      pitchBendSemis: 0,
      chopRateHz: 8,
      chopDepth: 0,
      spreadNorm: 0.5,
      twistNorm: 0.5,
      killActive: false,
    };
    this.wheelSpread = 0.5;
    this.swirlEnergy = 0;
    this.thrashEnergy = 0;
    this.engine.resetGestureMod();
    if (!silent) {
      this.spawnRipple(this.width * 0.5, this.height * 0.5, 0.9);
      this.setGestureFeedback('CLEAN RESET • STUDIO NEUTRAL', 1.0);
      this.haptic(14);
    }
  }

  toggleLatch() {
    this.isLatched = !this.isLatched;
    if (!this.isLatched) {
      this.resetAll(false);
    } else {
      this.setGestureFeedback('FX LATCHED • HOLD ACTIVE', 1.0);
      this.haptic(14);
    }
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

    // Desktop convenience: Mouse Wheel over Mod Deck simulates 2-Finger Pinch/Spread!
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.wheelSpread = clamp(this.wheelSpread + (-e.deltaY * 0.0012), 0, 1);
      this.fx.spreadNorm = this.wheelSpread;
      this.engine.setGestureModState({ spreadNorm: this.wheelSpread });
      const pct = Math.round(Math.abs(this.wheelSpread - 0.5) * 200);
      this.setGestureFeedback(
        this.wheelSpread >= 0.5 ? `REESE SPREAD ${pct}%` : `LASER SUB-CORE ${pct}%`,
        0.9
      );
    }, { passive: false });
  }

  getLocalPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: clamp(e.clientX - rect.left, 0, this.width),
      y: clamp(e.clientY - rect.top, 0, this.height),
    };
  }

  spawnRipple(x, y, power = 0.85) {
    this.ripples.push({
      x,
      y,
      r: 8,
      maxR: Math.max(this.width, this.height) * (0.48 + power * 0.35),
      life: 1.0,
      power,
    });
  }

  spawnSparks(x, y, count = 8, power = 0.85) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = (1.5 + Math.random() * 4.2) * power;
      this.sparks.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        r: 1.4 + Math.random() * 2.2,
        life: 1.0,
        decay: 0.03 + Math.random() * 0.03,
      });
    }
    if (this.sparks.length > 70) this.sparks.splice(0, this.sparks.length - 70);
  }

  initTwoFingerRef() {
    const pts = Array.from(this.pointers.values());
    if (pts.length < 2) return;
    const [a, b] = pts;
    const midX = (a.x + b.x) * 0.5;
    const midY = (a.y + b.y) * 0.5;
    const dist = Math.max(12, Math.hypot(b.x - a.x, b.y - a.y));
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    this.multiRef = {
      startMidX: midX,
      startMidY: midY,
      startDist: dist,
      startAngle: angle,
      startSpread: this.fx.spreadNorm,
      startTwist: this.fx.twistNorm,
    };
    this.twoFingerDownTime = performance.now();
    this.twoFingerMoved = false;
  }

  handlePointerDown(e) {
    e.preventDefault();
    try { this.canvas.setPointerCapture(e.pointerId); } catch (_) {}

    const { x, y } = this.getLocalPos(e);
    const now = performance.now();

    // Desktop Shift+Click spawns a mirrored virtual second finger so 2-finger gestures work on desktop!
    if (e.shiftKey && this.pointers.size === 0) {
      this.pointers.set('virtual_shift', {
        id: 'virtual_shift',
        x: clamp(this.width - x, 12, this.width - 12),
        y,
        startX: clamp(this.width - x, 12, this.width - 12),
        startY: y,
        downTime: now,
        movedDist: 0,
      });
    }

    this.pointers.set(e.pointerId, {
      id: e.pointerId,
      x,
      y,
      startX: x,
      startY: y,
      prevX: x,
      prevY: y,
      prevVx: 0,
      downTime: now,
      movedDist: 0,
      // Swirl & Shake trackers
      cx: x,
      cy: y,
      lastAngle: null,
      accumAngle: 0,
      reversals: 0,
      lastRevTime: now,
    });

    if (this.onPlayActivity) this.onPlayActivity(true);

    // 3-Finger Tap -> Instant Clean Reset!
    if (this.pointers.size >= 3) {
      clearTimeout(this.holdTimer);
      this.resetAll(false);
      return;
    }

    // 2-Finger Touch Entered
    if (this.pointers.size === 2) {
      clearTimeout(this.holdTimer);
      this.initTwoFingerRef();
      this.spawnRipple(x, y, 0.7);
      this.setGestureFeedback('2F MODE • SLIDE / PINCH / TWIST', 0.9);
      return;
    }

    // Single-Finger Down: start Long-Press Hold timer (380ms -> Sub-Drone + Latch)
    clearTimeout(this.holdTimer);
    this.holdTimer = setTimeout(() => {
      const p = this.pointers.get(e.pointerId);
      if (!p || this.pointers.size !== 1 || p.movedDist > 16) return;
      this.isLatched = true;
      this.droneActive = true;
      this.engine.setGestureModState({ droneLevel: 0.82 });
      this.spawnRipple(p.x, p.y, 1.0);
      this.spawnSparks(p.x, p.y, 12, 0.9);
      this.setGestureFeedback('HOLD DRONE • FX LATCHED', 1.0);
      this.haptic(20);
    }, 380);
  }

  handlePointerMove(e) {
    const ptr = this.pointers.get(e.pointerId);
    if (!ptr) return;
    e.preventDefault();

    const { x, y } = this.getLocalPos(e);
    const now = performance.now();
    const dx = x - ptr.x;
    const dy = y - ptr.y;
    const stepDist = Math.hypot(dx, dy);

    ptr.prevX = ptr.x;
    ptr.prevY = ptr.y;
    ptr.x = x;
    ptr.y = y;
    ptr.movedDist += stepDist;

    // Keep Shift virtual finger mirrored horizontally for easy desktop testing
    const vShift = this.pointers.get('virtual_shift');
    if (vShift && e.pointerId !== 'virtual_shift') {
      vShift.x = clamp(this.width - x, 12, this.width - 12);
      vShift.y = y;
    }

    if (ptr.movedDist > 14) {
      clearTimeout(this.holdTimer);
    }

    // ========== TWO-FINGER GESTURE SOLVER ==========
    if (this.pointers.size >= 2 && this.multiRef) {
      const [a, b] = Array.from(this.pointers.values());
      const midX = (a.x + b.x) * 0.5;
      const midY = (a.y + b.y) * 0.5;
      const dist = Math.max(12, Math.hypot(b.x - a.x, b.y - a.y));
      const angle = Math.atan2(b.y - a.y, b.x - a.x);

      const dMidX = midX - this.multiRef.startMidX;
      const dMidY = midY - this.multiRef.startMidY;
      const dDist = dist - this.multiRef.startDist;
      let dAngle = angle - this.multiRef.startAngle;
      while (dAngle > Math.PI) dAngle -= Math.PI * 2;
      while (dAngle < -Math.PI) dAngle += Math.PI * 2;

      if (Math.hypot(dMidX, dMidY) > 10 || Math.abs(dDist) > 12 || Math.abs(dAngle) > 0.14) {
        this.twoFingerMoved = true;
      }

      // 1. 2F Vertical Slide -> Master Whammy Pitch Bend (+/- 12 semitones!)
      const pitchSemis = clamp((-dMidY / Math.max(55, this.height * 0.55)) * 12, -12, 12);
      this.fx.pitchBendSemis = Math.abs(dMidY) > 8 ? pitchSemis : 0;

      // 2. 2F Horizontal Slide -> Tempo-Synced Rhythmic Gate Chopper!
      const horizMag = clamp(Math.abs(dMidX) / Math.max(60, this.width * 0.42), 0, 1);
      const chopRate = 2 + clamp((midX / Math.max(1, this.width)), 0, 1) * 20;
      this.fx.chopDepth = horizMag > 0.16 ? horizMag : 0;
      this.fx.chopRateHz = chopRate;

      // 3. 2F Pinch / Spread -> Wide Reese Chorus vs Laser Sub-Core!
      const spreadDelta = dDist / Math.max(90, this.width * 0.48);
      this.fx.spreadNorm = clamp(this.multiRef.startSpread + spreadDelta, 0, 1);

      // 4. 2F Rotate / Twist -> Harmonic Phaser Vault Dial!
      const twistDelta = dAngle / (Math.PI * 0.9);
      this.fx.twistNorm = clamp(this.multiRef.startTwist + twistDelta, 0, 1);

      const modPayload = {
        pitchBendSemis: this.fx.pitchBendSemis,
        chopRateHz: this.fx.chopRateHz,
        chopDepth: this.fx.chopDepth,
        spreadNorm: this.fx.spreadNorm,
      };
      if (Math.abs(dAngle) > 0.18) {
        modPayload.twistNorm = this.fx.twistNorm;
      }
      this.engine.setGestureModState(modPayload);

      // Display dominant active 2-finger gesture badge!
      if (Math.abs(dAngle) > 0.24) {
        this.setGestureFeedback(`2F PHASER TWIST ${Math.round(this.fx.twistNorm * 100)}%`, 0.95);
      } else if (Math.abs(spreadDelta) > 0.14) {
        const pct = Math.round(Math.abs(this.fx.spreadNorm - 0.5) * 200);
        this.setGestureFeedback(
          this.fx.spreadNorm >= 0.5 ? `2F REESE SPREAD ${pct}%` : `2F LASER PINCH ${pct}%`,
          0.95
        );
      } else if (Math.abs(dMidY) >= Math.abs(dMidX) && Math.abs(dMidY) > 10) {
        const sign = this.fx.pitchBendSemis >= 0 ? '+' : '';
        this.setGestureFeedback(`2F WHAMMY ${sign}${this.fx.pitchBendSemis.toFixed(1)}st`, 0.95);
      } else if (this.fx.chopDepth > 0.16) {
        this.setGestureFeedback(`2F GATE CHOP ${this.fx.chopRateHz.toFixed(1)}Hz`, 0.95);
      }
      return;
    }

    // ========== SINGLE-FINGER GESTURE SOLVER ==========
    if (this.pointers.size === 1) {
      this.trail.push({ x, y, t: now });
      if (this.trail.length > 26) this.trail.shift();

      const nx = clamp(x / Math.max(1, this.width), 0, 1);
      const ny = clamp(1 - y / Math.max(1, this.height), 0, 1);
      this.fx.driveNorm = nx;
      this.fx.cutoffNorm = ny;

      // Circular Swirl Detector (accumulate signed angle around moving centroid)
      ptr.cx = ptr.cx * 0.9 + x * 0.1;
      ptr.cy = ptr.cy * 0.9 + y * 0.1;
      const rCent = Math.hypot(x - ptr.cx, y - ptr.cy);
      if (rCent > 10) {
        const ang = Math.atan2(y - ptr.cy, x - ptr.cx);
        if (ptr.lastAngle !== null) {
          let da = ang - ptr.lastAngle;
          while (da > Math.PI) da -= Math.PI * 2;
          while (da < -Math.PI) da += Math.PI * 2;
          ptr.accumAngle += da;
          this.swirlAngle += da;
        }
        ptr.lastAngle = ang;
      }

      // Rapid Shake / Scrub Detector (quick direction reversals)
      if (Math.abs(dx) > 3.5) {
        const dir = Math.sign(dx);
        if (ptr.prevVx !== 0 && dir !== ptr.prevVx) {
          if (now - ptr.lastRevTime < 220) {
            ptr.reversals += 1;
          } else {
            ptr.reversals = 1;
          }
          ptr.lastRevTime = now;
        }
        ptr.prevVx = dir;
      }

      const isSwirling = Math.abs(ptr.accumAngle) > 2.2;
      const isShaking = ptr.reversals >= 3 && (now - ptr.lastRevTime < 260);

      if (isShaking) {
        this.thrashEnergy = 1.0;
        this.fx.wobbleRateHz = 16 + clamp(stepDist * 0.4, 0, 10);
        this.fx.wobbleDepth = 0.92;
        this.engine.setGestureModState({
          cutoffNorm: ny,
          driveNorm: Math.max(0.55, nx),
          wobbleRateHz: this.fx.wobbleRateHz,
          wobbleDepth: this.fx.wobbleDepth,
        });
        if (Math.random() < 0.5) this.spawnSparks(x, y, 3, 0.95);
        this.setGestureFeedback(`SHAKE THRASH ${this.fx.wobbleRateHz.toFixed(0)}Hz ⚡`, 1.0);
      } else if (isSwirling) {
        this.swirlEnergy = clamp(this.swirlEnergy + 0.12, 0.35, 1.0);
        // CW increases Wobble LFO rate, CCW slows it into deep liquid swells
        const rateDelta = ptr.accumAngle > 0 ? 0.35 : -0.35;
        this.fx.wobbleRateHz = clamp(this.fx.wobbleRateHz + rateDelta * 0.25, 1.0, 18.0);
        this.fx.wobbleDepth = 0.85;
        this.engine.setGestureModState({
          cutoffNorm: ny,
          driveNorm: nx,
          wobbleRateHz: this.fx.wobbleRateHz,
          wobbleDepth: this.fx.wobbleDepth,
        });
        this.setGestureFeedback(`SWIRL WOBBLE ${this.fx.wobbleRateHz.toFixed(1)}Hz ↻`, 0.95);
      } else {
        this.engine.setGestureModState({
          cutoffNorm: ny,
          driveNorm: nx,
        });
        const cutHz = Math.round(75 * Math.pow(130, ny));
        const cutStr = cutHz >= 1000 ? `${(cutHz / 1000).toFixed(1)}k` : `${cutHz}Hz`;
        this.setGestureFeedback(`CUT ${cutStr} • GRIT ${Math.round(nx * 100)}%`, 0.72);
      }
    }
  }

  handlePointerUp(e) {
    const ptr = this.pointers.get(e.pointerId);
    if (!ptr) return;

    const now = performance.now();
    const wasMulti = this.pointers.size >= 2;
    const elapsed = now - ptr.downTime;

    this.pointers.delete(e.pointerId);
    if (this.pointers.has('virtual_shift') && this.pointers.size === 1) {
      this.pointers.delete('virtual_shift');
    }

    clearTimeout(this.holdTimer);

    // Check 2-Finger Quick Tap -> Instant DJ Kill-Switch Slam!
    if (wasMulti && !this.twoFingerMoved && (now - this.twoFingerDownTime < 260)) {
      this.engine.setGestureModState({ killActive: true });
      this.spawnRipple(this.width * 0.5, this.height * 0.5, 1.0);
      this.setGestureFeedback('2F KILL-SWITCH SLAM!', 1.0);
      this.haptic(18);
      setTimeout(() => {
        this.engine.setGestureModState({ killActive: false });
        this.engine.triggerSubPunch(1.0);
      }, 150);
    }

    // Check Single-Finger Quick Tap (1x Tap, 2x Double Tap, 3x Triple Tap!)
    if (!wasMulti && elapsed < 240 && ptr.movedDist < 16) {
      if (now - this.lastTapTime < 310) {
        this.tapCount += 1;
      } else {
        this.tapCount = 1;
      }
      this.lastTapTime = now;
      const tx = ptr.x;
      const ty = ptr.y;

      clearTimeout(this.tapResolveTimer);
      if (this.tapCount >= 3) {
        // Immediate Triple-Tap -> 1/32 Glitch Stutter Burst!
        this.tapCount = 0;
        const bpm = this.getBpm ? this.getBpm() : 124;
        this.engine.triggerStutterBurst(bpm);
        this.spawnRipple(tx, ty, 1.0);
        this.spawnSparks(tx, ty, 14, 1.0);
        this.setGestureFeedback('3× TAP • 1/32 GLITCH STUTTER!', 1.0);
        this.haptic(22);
      } else {
        // Brief window to distinguish 1x Tap vs 2x Double Tap vs 3x Triple Tap
        const capturedCount = this.tapCount;
        this.tapResolveTimer = setTimeout(() => {
          if (capturedCount === 1) {
            this.engine.triggerSubPunch(0.95);
            this.spawnRipple(tx, ty, 0.85);
            this.spawnSparks(tx, ty, 8, 0.85);
            this.setGestureFeedback('TAP • 808 SUB-PUNCH', 1.0);
            this.haptic(12);
          } else if (capturedCount === 2) {
            if (this.isLatched) {
              this.resetAll(false);
            }
            this.engine.triggerSubDive();
            this.spawnRipple(tx, ty, 1.0);
            this.spawnSparks(tx, ty, 12, 1.0);
            this.setGestureFeedback('2× TAP • SUB-OCTAVE DIVE!', 1.0);
            this.haptic(18);
          }
          this.tapCount = 0;
        }, 205);
      }
    }

    // When all fingers lift off the Mod Deck
    if (this.pointers.size === 0) {
      this.multiRef = null;
      if (this.droneActive) {
        this.droneActive = false;
        this.engine.setGestureModState({ droneLevel: 0 });
      }
      if (!this.isLatched) {
        // Smooth spring return to neutral studio tone when not latched!
        this.fx.pitchBendSemis = 0;
        this.fx.chopDepth = 0;
        this.fx.wobbleDepth = 0;
        this.engine.resetGestureMod();
      } else {
        // Even if latched, release momentary whammy pitch bend cleanly
        this.fx.pitchBendSemis = 0;
        this.engine.setMasterPitchBend(0);
      }
      if (this.onPlayActivity) this.onPlayActivity(false);
    }
  }

  render(now) {
    const dt = Math.min(0.04, Math.max(0.004, (now - this.lastTime) / 1000));
    this.lastTime = now;
    const step = dt * 60;

    const inst = this.getInstrument();
    const accentHex = inst.accentColorHex || '#38BDF8';
    const accentRgb = hexToRgb(accentHex);
    const bassAmp = this.engine.getBassAmplitude ? this.engine.getBassAmplitude() : 0;

    this.gestureFlash = Math.max(0, this.gestureFlash - 0.018 * step);
    this.swirlEnergy = Math.max(0, this.swirlEnergy - 0.025 * step);
    this.thrashEnergy = Math.max(0, this.thrashEnergy - 0.045 * step);

    // Decay trail when idle
    if (this.pointers.size === 0 && this.trail.length > 0) {
      this.trail.shift();
    }

    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const rp = this.ripples[i];
      rp.r += (rp.maxR * 0.06 + 3.2) * step;
      rp.life -= 0.036 * step;
      if (rp.life <= 0) this.ripples.splice(i, 1);
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const sp = this.sparks[i];
      sp.x += sp.vx * step;
      sp.y += sp.vy * step;
      sp.vx *= Math.pow(0.91, step);
      sp.vy *= Math.pow(0.91, step);
      sp.life -= sp.decay * step;
      if (sp.life <= 0) this.sparks.splice(i, 1);
    }

    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const cx = w * 0.5;
    const cy = h * 0.5;

    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    // 1. Sculpted Obsidian Mod Deck Surface
    const bg = ctx.createRadialGradient(cx, cy, 8, cx, cy, Math.max(w, h) * 0.72);
    bg.addColorStop(0, `rgb(${18 + Math.round(accentRgb.r * 0.08 * (bassAmp + this.gestureFlash * 0.4))}, ${21 + Math.round(accentRgb.g * 0.08 * (bassAmp + this.gestureFlash * 0.4))}, ${27 + Math.round(accentRgb.b * 0.08 * (bassAmp + this.gestureFlash * 0.4))})`);
    bg.addColorStop(1, '#090B0F');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Subtle tactile crosshair guides (Filter vertical, Drive horizontal)
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, 12); ctx.lineTo(cx, h - 12);
    ctx.moveTo(12, cy); ctx.lineTo(w - 12, cy);
    ctx.stroke();

    // Subtle axis micro-labels along edges
    ctx.font = '600 8px "JetBrains Mono", ui-monospace, monospace';
    ctx.fillStyle = 'rgba(155, 162, 175, 0.42)';
    ctx.textAlign = 'center';
    ctx.fillText('FILTER OPEN ▲', cx, 13);
    ctx.fillText('▼ DARK SUB', cx, h - 7);
    ctx.textAlign = 'left';
    ctx.fillText('CLEAN', 9, cy - 4);
    ctx.textAlign = 'right';
    ctx.fillText('GRIT', w - 9, cy - 4);

    // 2. Reactive Cymatic Forcefield Rings (breathes with bass & Latch state!)
    const ringCount = this.isLatched ? 4 : 3;
    for (let r = 1; r <= ringCount; r++) {
      const rad = 18 + r * (Math.min(w, h) * 0.14) + bassAmp * 12;
      ctx.strokeStyle = this.isLatched
        ? `rgba(245, 166, 35, ${0.14 + (1 - r / 5) * 0.25})`
        : rgba(accentRgb, 0.08 + bassAmp * 0.16);
      ctx.lineWidth = this.isLatched && r === 1 ? 1.8 : 1;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rad * 1.45, rad * 0.72, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 3. Swirl Cyclone Vortex when Circular Swirl Wobble is active!
    if (this.swirlEnergy > 0.04) {
      ctx.save();
      ctx.strokeStyle = rgba(accentRgb, this.swirlEnergy * 0.78);
      ctx.lineWidth = 2.2;
      for (let arm = 0; arm < 3; arm++) {
        const baseA = this.swirlAngle + (arm * Math.PI * 2) / 3;
        ctx.beginPath();
        for (let t = 0; t <= 22; t++) {
          const frac = t / 22;
          const a = baseA + frac * 2.4;
          const rad = 10 + frac * Math.min(w, h) * 0.45;
          const px = cx + Math.cos(a) * rad * 1.3;
          const py = cy + Math.sin(a) * rad * 0.75;
          if (t === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    // 4. Electric Thrash Lightning when Rapid Shake is active!
    if (this.thrashEnergy > 0.05) {
      ctx.save();
      ctx.strokeStyle = `rgba(245, 166, 35, ${this.thrashEnergy * 0.9})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= 14; i++) {
        const lx = (i / 14) * w;
        const ly = cy + (Math.random() - 0.5) * h * 0.58 * this.thrashEnergy;
        if (i === 0) ctx.moveTo(lx, ly);
        else ctx.lineTo(lx, ly);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 5. Gesture Trail Ribbon
    if (this.trail.length > 2) {
      ctx.save();
      ctx.lineCap = 'round';
      for (let i = 1; i < this.trail.length; i++) {
        const ratio = i / this.trail.length;
        ctx.strokeStyle = rgba(accentRgb, ratio * 0.55);
        ctx.lineWidth = 1.5 + ratio * 7;
        ctx.beginPath();
        ctx.moveTo(this.trail[i - 1].x, this.trail[i - 1].y);
        ctx.lineTo(this.trail[i].x, this.trail[i].y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 6. Expanding Impact Ripples
    for (let i = 0; i < this.ripples.length; i++) {
      const rp = this.ripples[i];
      ctx.strokeStyle = rgba(accentRgb, rp.life * 0.65 * rp.power);
      ctx.lineWidth = 1.4 + rp.life * 2.2;
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 7. Two-Finger Plasma Beam + Rotation Vault Dial!
    const activePts = Array.from(this.pointers.values());
    if (activePts.length >= 2) {
      const [a, b] = activePts;
      const mx = (a.x + b.x) * 0.5;
      const my = (a.y + b.y) * 0.5;
      const d = Math.hypot(b.x - a.x, b.y - a.y);

      ctx.save();
      // Glowing plasma bridge between both fingers
      const beam = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
      beam.addColorStop(0, accentHex);
      beam.addColorStop(0.5, '#F5A623');
      beam.addColorStop(1, accentHex);
      ctx.strokeStyle = beam;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();

      // Vault dial circle around midpoint
      ctx.strokeStyle = 'rgba(245, 166, 35, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(mx, my, Math.max(20, d * 0.5), 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // 8. Active Touch Orbs
    for (let i = 0; i < activePts.length; i++) {
      const p = activePts[i];
      const grad = ctx.createRadialGradient(p.x - 4, p.y - 4, 2, p.x, p.y, 18);
      grad.addColorStop(0, '#FFFFFF');
      grad.addColorStop(0.5, accentHex);
      grad.addColorStop(1, rgba(accentRgb, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
      ctx.fill();
    }

    // 9. Sparks
    for (let i = 0; i < this.sparks.length; i++) {
      const sp = this.sparks[i];
      ctx.fillStyle = sp.life > 0.5 ? `rgba(255,255,255,${sp.life})` : rgba(accentRgb, sp.life * 0.9);
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.r * sp.life, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
