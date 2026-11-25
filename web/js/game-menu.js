/**
 * SubForge Bass — Liquid-Metal Game Menu Living Ferrofluid Background Engine
 * Renders an interactive, bass-reactive floating liquid-mercury core with
 * orbiting chrome droplets, magnetic pointer tendrils, and cymatic harmonic spikes.
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

export class LiquidMenuReactor {
  constructor({ canvas, container, engine, getInstrument }) {
    this.canvas = canvas;
    this.container = container;
    this.ctx = canvas.getContext('2d');
    this.engine = engine;
    this.getInstrument = getInstrument;

    this.width = 400;
    this.height = 720;
    this.dpr = 1;

    // Interactive pointer attraction for liquid-metal core
    this.ptrX = 0;
    this.ptrY = 0;
    this.ptrActive = false;

    // Core spring offset + pulse burst energy
    this.coreX = 200;
    this.coreY = 230;
    this.coreVx = 0;
    this.coreVy = 0;
    this.pulseEnergy = 0;

    // Orbiting ferrofluid mercury satellites
    this.droplets = Array.from({ length: 14 }, (_, i) => ({
      angle: (i / 14) * Math.PI * 2,
      orbitR: 88 + (i % 4) * 26 + Math.random() * 14,
      speed: (0.004 + (i % 3) * 0.0028) * (i % 2 === 0 ? 1 : -1),
      r: 3.5 + (i % 4) * 2.4,
      wobble: i * 1.1,
    }));

    this.ripples = [];
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
    this.coreX = this.width * 0.5;
    this.coreY = this.height * 0.30;
  }

  bindEvents() {
    if (typeof ResizeObserver !== 'undefined') {
      this._ro = new ResizeObserver(() => this.resize());
      this._ro.observe(this.container);
    }
    window.addEventListener('resize', () => this.resize());

    const updatePtr = (e) => {
      const rect = this.container.getBoundingClientRect();
      this.ptrX = e.clientX - rect.left;
      this.ptrY = e.clientY - rect.top;
      this.ptrActive = true;
    };
    this.container.addEventListener('pointermove', updatePtr);
    this.container.addEventListener('pointerdown', (e) => {
      updatePtr(e);
      this.triggerPulse(0.85);
    });
    this.container.addEventListener('pointerleave', () => {
      this.ptrActive = false;
    });
  }

  /**
   * Fires a dramatic ferrofluid shockwave on loadout switch or button tap.
   */
  triggerPulse(strength = 1.0) {
    this.pulseEnergy = Math.min(1.4, this.pulseEnergy + strength);
    this.ripples.push({
      x: this.coreX,
      y: this.coreY,
      r: 44,
      maxR: Math.max(this.width, this.height) * 0.68,
      life: 1.0,
      strength,
    });
  }

  drawTendril(ctx, x1, y1, r1, x2, y2, r2, fillStyle, alpha) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const d = Math.hypot(dx, dy);
    if (d < 4 || d > (r1 + r2) * 3.8) return;
    const perp = Math.atan2(dy, dx) + Math.PI / 2;
    const sf = clamp(d / ((r1 + r2) * 3.4), 0, 1);
    const w1 = r1 * (0.62 - sf * 0.2);
    const w2 = r2 * (0.76 - sf * 0.18);
    const ww = Math.max(2, Math.min(w1, w2) * (0.48 - sf * 0.38));
    const mx = (x1 + x2) * 0.5;
    const my = (y1 + y2) * 0.5;

    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.fillStyle = fillStyle;
    ctx.beginPath();
    ctx.moveTo(x1 + Math.cos(perp) * w1, y1 + Math.sin(perp) * w1);
    ctx.quadraticCurveTo(mx + Math.cos(perp) * ww, my + Math.sin(perp) * ww, x2 + Math.cos(perp) * w2, y2 + Math.sin(perp) * w2);
    ctx.lineTo(x2 - Math.cos(perp) * w2, y2 - Math.sin(perp) * w2);
    ctx.quadraticCurveTo(mx - Math.cos(perp) * ww, my - Math.sin(perp) * ww, x1 - Math.cos(perp) * w1, y1 - Math.sin(perp) * w1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  render(now) {
    const dt = Math.min(0.04, Math.max(0.004, (now - this.lastTime) / 1000));
    this.lastTime = now;
    const step = dt * 60;

    const inst = this.getInstrument();
    const accentHex = (inst && inst.accentColorHex) || '#38BDF8';
    const rgb = hexToRgb(accentHex);
    const drive = (inst && inst.drive) || 0.38;
    const reso = (inst && inst.resonance) || 0.35;
    const lfoRate = (inst && inst.lfoRateHz) || 2.2;
    const bassAmp = this.engine && this.engine.getBassAmplitude ? this.engine.getBassAmplitude() : 0;

    this.pulseEnergy = Math.max(0, this.pulseEnergy - 0.025 * step);

    const restX = this.width * 0.5;
    const restY = this.height * 0.285;
    let targetX = restX;
    let targetY = restY;

    if (this.ptrActive) {
      targetX += clamp((this.ptrX - restX) * 0.12, -28, 28);
      targetY += clamp((this.ptrY - restY) * 0.10, -24, 24);
    }

    const damp = Math.pow(0.82, step);
    this.coreVx = (this.coreVx + (targetX - this.coreX) * 0.14 * step) * damp;
    this.coreVy = (this.coreVy + (targetY - this.coreY) * 0.14 * step) * damp;
    this.coreX += this.coreVx * step;
    this.coreY += this.coreVy * step;

    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const rp = this.ripples[i];
      rp.r += (rp.maxR * 0.036 + 3.5) * step;
      rp.life -= 0.024 * step;
      if (rp.life <= 0) this.ripples.splice(i, 1);
    }

    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const baseR = Math.min(w, h) * 0.175 + bassAmp * 16 + this.pulseEnergy * 11;
    const energy = clamp(bassAmp + this.pulseEnergy * 0.65, 0, 1.3);

    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    // 1. Deep Liquid-Obsidian Backdrop
    const bg = ctx.createRadialGradient(this.coreX, this.coreY, 16, w * 0.5, h * 0.42, Math.max(w, h) * 0.85);
    bg.addColorStop(0, `rgb(${18 + Math.round(rgb.r * (0.10 + energy * 0.08))}, ${21 + Math.round(rgb.g * (0.10 + energy * 0.08))}, ${28 + Math.round(rgb.b * (0.10 + energy * 0.08))})`);
    bg.addColorStop(0.55, '#0A0C11');
    bg.addColorStop(1, '#050608');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // 2. Ambient Bass Aura Halo Behind Mercury Sphere
    const haloR = baseR * (2.5 + energy * 0.6);
    const halo = ctx.createRadialGradient(this.coreX, this.coreY, baseR * 0.4, this.coreX, this.coreY, haloR);
    halo.addColorStop(0, rgba(rgb, 0.24 + energy * 0.18));
    halo.addColorStop(0.55, rgba(rgb, 0.06 + energy * 0.05));
    halo.addColorStop(1, rgba(rgb, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(this.coreX, this.coreY, haloR, 0, Math.PI * 2);
    ctx.fill();

    // 3. Subtle Live Waveform Horizon Across the Reactor
    const samples = this.engine ? this.engine.scopeData : null;
    if (samples) {
      ctx.save();
      ctx.strokeStyle = rgba(rgb, 0.16 + bassAmp * 0.35);
      ctx.lineWidth = 1.5 + bassAmp * 1.6;
      ctx.beginPath();
      for (let i = 0; i < samples.length; i += 2) {
        const sx = (i / (samples.length - 1)) * w;
        const sy = this.coreY - samples[i] * (h * 0.11);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 4. Expanding Ferrofluid Shockwaves
    for (let i = 0; i < this.ripples.length; i++) {
      const rp = this.ripples[i];
      ctx.strokeStyle = rgba(rgb, rp.life * 0.44 * rp.strength);
      ctx.lineWidth = 1.2 + rp.life * 2.2;
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 5. Orbiting Mercury Satellites + Liquid Bridges to Core
    for (let i = 0; i < this.droplets.length; i++) {
      const d = this.droplets[i];
      d.angle += d.speed * (1 + energy * 1.4 + lfoRate * 0.08) * step;
      const rad = d.orbitR + Math.sin(now * 0.002 + d.wobble) * 14 + energy * 14;
      const dx = this.coreX + Math.cos(d.angle) * rad * 1.15;
      const dy = this.coreY + Math.sin(d.angle) * rad * 0.78;

      if (rad < baseR * 2.15) {
        const tg = ctx.createLinearGradient(this.coreX, this.coreY, dx, dy);
        tg.addColorStop(0, rgba(rgb, 0.45));
        tg.addColorStop(1, 'rgba(225, 236, 250, 0.48)');
        this.drawTendril(ctx, this.coreX, this.coreY, baseR * 0.52, dx, dy, d.r, tg, 0.55);
      }

      const dg = ctx.createRadialGradient(dx - d.r * 0.3, dy - d.r * 0.3, 1, dx, dy, d.r * 1.2);
      dg.addColorStop(0, '#FFFFFF');
      dg.addColorStop(0.55, rgba(rgb, 0.8));
      dg.addColorStop(1, '#12151C');
      ctx.fillStyle = dg;
      ctx.beginPath();
      ctx.arc(dx, dy, d.r * (1 + bassAmp * 0.3), 0, Math.PI * 2);
      ctx.fill();
    }

    // 6. Magnetic Liquid Tendril Reaching Toward User Pointer when near Core
    if (this.ptrActive) {
      const distP = Math.hypot(this.ptrX - this.coreX, this.ptrY - this.coreY);
      if (distP < baseR * 3.1) {
        const pg = ctx.createLinearGradient(this.coreX, this.coreY, this.ptrX, this.ptrY);
        pg.addColorStop(0, rgba(rgb, 0.72));
        pg.addColorStop(1, '#FFFFFF');
        this.drawTendril(ctx, this.coreX, this.coreY, baseR * 0.72, this.ptrX, this.ptrY, 10, pg, 0.65);
      }
    }

    // 7. Hero Living Liquid-Mercury Ferrofluid Core Sphere
    const petals = 4 + Math.round(drive * 6);
    const spikeAmp = 3.5 + drive * 8 + energy * 16 + reso * 4;
    const tSpin = now * 0.0011 * (0.7 + lfoRate * 0.16);

    ctx.save();
    ctx.beginPath();
    const segs = 72;
    for (let s = 0; s <= segs; s++) {
      const a = (s / segs) * Math.PI * 2;
      const wave1 = Math.sin(a * petals + tSpin) * spikeAmp * 0.55;
      const wave2 = Math.cos(a * (petals - 2) - tSpin * 1.35) * spikeAmp * 0.35;
      const wave3 = Math.sin(a * 2 + now * 0.0018) * (3 + energy * 5);
      const r = baseR + wave1 + wave2 + wave3;
      const px = this.coreX + Math.cos(a) * r;
      const py = this.coreY + Math.sin(a) * r;
      if (s === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();

    // Sculpted Liquid-Chrome Shading
    const coreGrad = ctx.createRadialGradient(
      this.coreX - baseR * 0.34,
      this.coreY - baseR * 0.36,
      baseR * 0.08,
      this.coreX,
      this.coreY,
      baseR * 1.25
    );
    coreGrad.addColorStop(0, '#F5F7FA');
    coreGrad.addColorStop(0.22, `rgba(${Math.min(255, 110 + Math.round(rgb.r * 0.55))}, ${Math.min(255, 118 + Math.round(rgb.g * 0.55))}, ${Math.min(255, 132 + Math.round(rgb.b * 0.55))}, 0.98)`);
    coreGrad.addColorStop(0.55, `rgba(${24 + Math.round(rgb.r * 0.18)}, ${28 + Math.round(rgb.g * 0.18)}, ${36 + Math.round(rgb.b * 0.18)}, 0.98)`);
    coreGrad.addColorStop(0.86, '#0E1016');
    coreGrad.addColorStop(1, rgba(rgb, 0.78));
    ctx.fillStyle = coreGrad;
    ctx.fill();

    ctx.lineWidth = 1.8;
    ctx.strokeStyle = rgba(rgb, 0.52 + energy * 0.42);
    ctx.stroke();

    // Crisp Liquid-Glass Specular Crescent Highlight
    ctx.beginPath();
    ctx.arc(this.coreX, this.coreY, baseR * 0.76, Math.PI * 1.06, Math.PI * 1.56);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.48)';
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Secondary lower rim reflection
    ctx.beginPath();
    ctx.arc(this.coreX, this.coreY, baseR * 0.82, Math.PI * 0.12, Math.PI * 0.46);
    ctx.strokeStyle = rgba(rgb, 0.55);
    ctx.lineWidth = 2.0;
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }
}
