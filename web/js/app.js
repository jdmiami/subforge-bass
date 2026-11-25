/**
 * SubForge Bass — 9:16 Vertical Full-Screen Mobile Hardware Instrument Controller
 * Features:
 * - Zero-scroll 9:16 vertical stage with 3x4 giant silicone multi-touch slide pads
 * - Full-screen continuous Fretless Glide sub-bass surface
 * - Interactive Oscilloscope X/Y Expression Ribbon (live cutoff + drive/resonance)
 * - Swipeable top patch switcher + 1-tap Full-Screen Zen Performance Mode
 * - "+ CREATE" Bottom Sheet with live 2D Sonic DNA Sculptor + Voice/AI Forge → Launch Full-Screen!
 * - Slide-up Sculpt DSP, 4x4 16-Step Sequencer (.mid export), Bank, and Community Hub sheets
 */

import {
  ORIGINAL_INSTRUMENTS,
  WAVEFORM_TYPES,
  PAD_ANIMATION_STYLES,
  PAD_HOTKEYS,
  SEED_MIDI_PATTERNS,
  SEED_COMMUNITY_INSTRUMENTS,
  generate12NotePads,
  createDefaultGrooveSteps,
} from './presets.js';
import { WebBassAudioEngine } from './audio-engine.js';
import { LiquidMorphGrid } from './morph-grid.js';
import { GestureModulatorDeck, GESTURE_GUIDE_ITEMS } from './gesture-modulator.js';
import { LiquidMenuReactor } from './game-menu.js';
import {
  synthesizeInstrumentSpec,
  VoicePromptController,
} from './ai-forge.js';

const PLAY_SURFACES = [
  { id: 'morph', label: 'MORPH', title: 'Liquid-Metal Morph Grid' },
  { id: 'pads', label: '12-PAD', title: '3x4 Tactile Drum Pads' },
  { id: 'glide', label: 'GLIDE', title: 'Fretless Sub Glide' },
];

const STORAGE_KEYS = {
  CUSTOM_INSTRUMENTS: 'subforge_mobile_custom_v2',
  MIDI_PATTERNS: 'subforge_mobile_patterns_v2',
  COMMUNITY: 'subforge_mobile_comm_v2',
};

const STUDIO_SWATCHES = [
  '#38BDF8', '#F24C27', '#A3E635', '#F5A623',
  '#F43F5E', '#2DD4BF', '#FACC15', '#34D399', '#FB923C',
];

const CREATE_MOODS = [
  { label: '808 SUB', x: 0.14, y: 0.28, prompt: 'Deep chest-hitting subterranean 808 sub bass with warm saturation' },
  { label: '303 ACID', x: 0.56, y: 0.78, prompt: 'Liquid 303 acid squelch with high resonant filter sweep' },
  { label: 'REESE', x: 0.48, y: 0.62, prompt: 'Dark neuro Reese bass with wide phasing midrange growl' },
  { label: 'FM WOBBLE', x: 0.88, y: 0.86, prompt: 'Metallic FM dubstep wobble bass with 5.5Hz LFO chop' },
  { label: 'SLAP FUNK', x: 0.76, y: 0.36, prompt: 'Snappy 70s funk thumb slap bass with crisp harmonic pop' },
  { label: 'INFRABASS', x: 0.08, y: 0.14, prompt: 'Tectonic ultra-deep cinema sub infrabass with long sustain' },
];

const FADER_SPECS = [
  { key: 'cutoffHz', label: 'Cutoff', min: 90, max: 6000, step: 10, format: (v) => (v >= 1000 ? `${(v / 1000).toFixed(2)}k` : `${Math.round(v)}Hz`) },
  { key: 'resonance', label: 'Reso Q', min: 0, max: 0.92, step: 0.01, format: (v) => `${Math.round(v * 100)}%` },
  { key: 'drive', label: 'Drive', min: 0, max: 1.0, step: 0.01, format: (v) => `${Math.round(v * 100)}%` },
  { key: 'subOctaveMix', label: 'Sub Mix', min: 0, max: 1.0, step: 0.01, format: (v) => `${Math.round(v * 100)}%` },
  { key: 'lfoRateHz', label: 'LFO Rate', min: 0.2, max: 16, step: 0.1, format: (v) => `${v.toFixed(1)}Hz` },
  { key: 'lfoDepth', label: 'LFO Amt', min: 0, max: 1.0, step: 0.01, format: (v) => `${Math.round(v * 100)}%` },
  { key: 'decayMs', label: 'Decay', min: 140, max: 1400, step: 10, format: (v) => `${Math.round(v)}ms` },
  { key: 'attackMs', label: 'Attack', min: 1, max: 80, step: 1, format: (v) => `${Math.round(v)}ms` },
];

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (_) {
    return fallback;
  }
}

function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (_) {}
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

class SubForgeMobileStudio {
  constructor() {
    this.engine = new WebBassAudioEngine();

    this.state = {
      customInstruments: loadJson(STORAGE_KEYS.CUSTOM_INSTRUMENTS, []),
      selectedInstrument: { ...ORIGINAL_INSTRUMENTS[0] },
      octaveShift: 0,
      lastTriggeredPad: 0,
      btSubBoost: true,
      playSurface: 'morph', // 'morph' | 'pads' | 'glide'
      isZenFullscreen: true,
      isGameMenuOpen: true,
      hasEnteredStage: false,
      openSheet: null,

      // XY Oscilloscope Expression
      xyHold: false,
      xyDragging: false,
      xyX: 0.72,
      xyY: 0.22,

      // Fretless Glide Visual State
      glideActive: false,
      glideX: 0.5,
      glideY: 0.75,
      glideNoteLabel: 'C1 • 41.2Hz',

      // Sequencer
      midiSteps: createDefaultGrooveSteps(),
      inspectedStep: 0,
      isPlaying: false,
      currentStep: -1,
      bpm: 124,
      swingPercent: 14,
      midiPatterns: loadJson(STORAGE_KEYS.MIDI_PATTERNS, SEED_MIDI_PATTERNS),

      // 2D Sonic DNA Instrument Creator Draft
      dnaX: 0.35,
      dnaY: 0.45,
      creatorDraft: this.buildDraftFromDna(0.35, 0.45, 'Obsidian Pulse Sub', '#F24C27'),

      // Community Hub
      communityPatches: loadJson(STORAGE_KEYS.COMMUNITY, SEED_COMMUNITY_INSTRUMENTS),
    };

    // Per-pad hit visual energy & multi-touch slide tracking
    this.padFx = Array.from({ length: 12 }, () => ({ energy: 0, hitTime: 0 }));
    this.padCanvases = [];
    this.pointerActivePad = new Map();
    this.demoTimers = [];
    this.seqTimerId = null;
    this.nextNoteTime = 0;
    this.scheduleStep = 0;
    this.dnaLastAudition = 0;
    this.voiceController = null;
    this.morphGrid = null;
    this.modDeck = null;
    this.menuReactor = null;
    this.zenHudDimTimer = null;

    this.init();
  }

  getAllInstruments() {
    return [...this.state.customInstruments, ...ORIGINAL_INSTRUMENTS];
  }

  getActivePadNotes() {
    return generate12NotePads(this.state.selectedInstrument, this.state.octaveShift);
  }

  /**
   * Maps 2D Sonic DNA coordinates (x: Sub->FM, y: Clean->Aggressive) to a playable bass spec.
   */
  buildDraftFromDna(x, y, name = 'Custom Bass', colorHex = '#F24C27') {
    const cx = Math.max(0, Math.min(1, x));
    const cy = Math.max(0, Math.min(1, y));

    let waveform = 'SINE';
    let category = 'Custom Sub';
    let anim = 'PLASMA_PULSE';
    if (cx < 0.22) {
      waveform = cy > 0.55 ? 'TRIANGLE' : 'SINE';
      category = '808 / Sub';
      anim = 'PLASMA_PULSE';
    } else if (cx < 0.46) {
      waveform = 'SUB_PULSE';
      category = 'Analog Pulse';
      anim = 'NEON_RIPPLE';
    } else if (cx < 0.72) {
      waveform = cy > 0.6 ? 'SAW' : 'SQUARE';
      category = cy > 0.6 ? 'Acid / Reese' : 'Synth Bass';
      anim = cy > 0.6 ? 'LASER_GRID' : 'VORTEX_SPIN';
    } else {
      waveform = 'FM_GROWL';
      category = 'FM Growl';
      anim = cy > 0.5 ? 'WAVE_TUNNEL' : 'PARTICLE_BURST';
    }

    const baseFreqHz = Number((34 + (1 - cy * 0.35) * 18 + cx * 12).toFixed(2));
    const cutoffHz = Math.round(240 + cx * 1800 + cy * 1900);
    const resonance = Number((0.18 + cy * 0.68).toFixed(2));
    const drive = Number((0.18 + cy * 0.76).toFixed(2));
    const subOctaveMix = Number((0.92 - cx * 0.42).toFixed(2));
    const lfoRateHz = Number((0.8 + cy * 8.2).toFixed(1));
    const lfoDepth = Number((0.08 + cy * 0.76).toFixed(2));
    const decayMs = Math.round(980 - cx * 340 - cy * 260);
    const attackMs = Math.round(4 + (1 - cy) * 8);

    return {
      id: `created_${Date.now().toString(36)}`,
      name: name || 'Custom Bass',
      category,
      description: `Sculpted via 2D Sonic DNA (${waveform}, Cutoff ${cutoffHz}Hz, Drive ${Math.round(drive * 100)}%).`,
      waveform,
      baseFreqHz,
      subOctaveMix,
      cutoffHz,
      resonance,
      drive,
      attackMs,
      decayMs,
      lfoRateHz,
      lfoDepth,
      accentColorHex: colorHex,
      animationStyle: anim,
      isCustom: true,
    };
  }

  init() {
    if (window.SubForgeAndroid && typeof window.SubForgeAndroid.isAndroidApp === 'function' && window.SubForgeAndroid.isAndroidApp()) {
      document.documentElement.classList.add('is-android-app');
    }
    this.cacheDom();
    this.morphGrid = new LiquidMorphGrid({
      canvas: this.dom.morphCanvas,
      container: this.dom.morphGridWrap,
      engine: this.engine,
      getInstrument: () => this.state.selectedInstrument,
      getOctaveShift: () => this.state.octaveShift,
      isZenMode: () => this.state.isZenFullscreen,
      onNoteReadout: (label) => {
        this.dom.xyHudTr.textContent = label;
        if (this.dom.zenPatchMeta) this.dom.zenPatchMeta.textContent = label;
      },
      onPlayActivity: (active) => this.setZenHudDimmed(active),
    });
    this.modDeck = new GestureModulatorDeck({
      canvas: this.dom.modCanvas,
      container: this.dom.modPadWell,
      engine: this.engine,
      getInstrument: () => this.state.selectedInstrument,
      getBpm: () => this.state.bpm,
      onGestureStatus: (label, latched) => {
        if (this.dom.modStatusLabel) this.dom.modStatusLabel.textContent = label;
        if (this.dom.modLatchBtn) this.dom.modLatchBtn.classList.toggle('is-active', Boolean(latched));
      },
      onPlayActivity: (active) => this.setZenHudDimmed(active),
    });
    this.menuReactor = new LiquidMenuReactor({
      canvas: this.dom.menuReactorCanvas,
      container: this.dom.gameMenuScreen,
      engine: this.engine,
      getInstrument: () => this.state.selectedInstrument,
    });
    if (this.dom.modGuideGrid) {
      this.dom.modGuideGrid.innerHTML = GESTURE_GUIDE_ITEMS.map(
        (g) => `<div class="mod-guide-item"><span class="mod-guide-tag">${esc(g.tag)}</span><span class="mod-guide-fx">${esc(g.fx)}</span></div>`
      ).join('');
    }
    this.bindEvents();
    this.selectInstrument(this.state.selectedInstrument, false);
    this.setPlaySurface(this.state.playSurface);
    this.renderCreateSheet();
    this.renderSculptSheet();
    this.renderSeqSheet();
    this.renderBankSheet();
    this.renderHubSheet();
    this.startRenderLoop();
  }

  cacheDom() {
    const $ = (id) => document.getElementById(id);
    this.dom = {
      stage: $('handheld-stage'),
      btnExitZen: $('btn-exit-zen'),
      btnEnterZen: $('btn-enter-zen'),
      btnStudioMenu: $('btn-studio-menu'),

      // Liquid-Metal Game Start / Pause Menu
      gameMenuScreen: $('game-menu-screen'),
      menuReactorCanvas: $('menu-reactor-canvas'),
      menuLoadoutCard: $('menu-loadout-card'),
      menuPrevPatch: $('menu-prev-patch'),
      menuNextPatch: $('menu-next-patch'),
      menuAuditionBtn: $('menu-audition-btn'),
      menuPatchLed: $('menu-patch-led'),
      menuPatchName: $('menu-patch-name'),
      menuPatchMeta: $('menu-patch-meta'),
      menuStatSub: $('menu-stat-sub'),
      menuStatGrit: $('menu-stat-grit'),
      menuStatCut: $('menu-stat-cut'),
      menuStatWob: $('menu-stat-wob'),
      menuModePills: document.querySelectorAll('[data-menu-surface]'),
      menuPlayBtn: $('menu-play-btn'),
      menuPlayLabel: $('menu-play-label'),
      menuSheetTiles: document.querySelectorAll('[data-menu-sheet]'),
      menuBankBtn: $('menu-bank-btn'),
      menuStudioBtn: $('menu-studio-btn'),

      zenHudPill: $('zen-hud-pill'),
      zenPatchBtn: $('zen-patch-btn'),
      zenPatchLed: $('zen-patch-led'),
      zenPatchName: $('zen-patch-name'),
      zenPatchMeta: $('zen-patch-meta'),
      zenModeBtn: $('zen-mode-btn'),
      zenModeLabel: $('zen-mode-label'),
      zenPlayBtn: $('zen-play-btn'),
      zenPlayIcon: $('zen-play-icon'),
      toast: $('mobile-toast'),
      toastText: $('mobile-toast-text'),
      toastClose: $('mobile-toast-close'),

      // Header
      btnOpenBank: $('btn-open-bank'),
      topPatchLed: $('top-patch-led'),
      topPatchName: $('top-patch-name'),
      topPatchSub: $('top-patch-sub'),
      btnTopPlay: $('btn-top-play'),
      topPlayIcon: $('top-play-icon'),
      topBpmNum: $('top-bpm-num'),
      btnTopRiff: $('btn-top-riff'),

      // Oscilloscope XY & Micro Controls
      xyDeck: $('xy-scope-deck'),
      xyCanvas: $('xy-scope-canvas'),
      xyHudTl: $('xy-hud-tl'),
      xyHudTr: $('xy-hud-tr'),
      xyHudBl: $('xy-hud-bl'),
      btnXyHold: $('btn-xy-hold'),
      modeMorphBtn: $('mode-morph-btn'),
      modePadsBtn: $('mode-pads-btn'),
      modeGlideBtn: $('mode-glide-btn'),
      octDecBtn: $('oct-dec-btn'),
      octIncBtn: $('oct-inc-btn'),
      octValLabel: $('oct-val-label'),
      btnBtBoost: $('btn-bt-boost'),

      // Play Surfaces & Second-Hand Modulator Deck
      morphSurface: $('morph-surface'),
      morphGridWrap: $('morph-grid-wrap'),
      morphCanvas: $('morph-canvas'),
      modDeckWrap: $('mod-deck-wrap'),
      modPadWell: $('mod-pad-well'),
      modCanvas: $('mod-canvas'),
      modStatusLabel: $('mod-status-label'),
      modLatchBtn: $('mod-latch-btn'),
      modResetBtn: $('mod-reset-btn'),
      modGuideBtn: $('mod-guide-btn'),
      modGuideOverlay: $('mod-guide-overlay'),
      modGuideClose: $('mod-guide-close'),
      modGuideGrid: $('mod-guide-grid'),
      padGrid: $('vertical-pad-grid'),
      glideSurface: $('glide-surface'),
      glideCanvas: $('glide-canvas'),
      glideReadout: $('glide-readout'),

      // Dock & Sheets
      dockBtns: document.querySelectorAll('.dock-btn'),
      backdrop: $('sheet-backdrop'),
      sheets: document.querySelectorAll('.bottom-sheet'),
      closeSheetBtns: document.querySelectorAll('[data-close-sheet]'),

      // Create Sheet
      createLedPreview: $('create-led-preview'),
      dnaWell: $('dna-sculpt-well'),
      dnaCanvas: $('dna-canvas'),
      dnaLiveSpecs: $('dna-live-specs'),
      createMicBtn: $('create-mic-btn'),
      createPromptInput: $('create-prompt-input'),
      createAiParseBtn: $('create-ai-parse-btn'),
      createMoodRow: $('create-mood-row'),
      createNameInput: $('create-name-input'),
      createSwatchRow: $('create-swatch-row'),
      createAuditionBtn: $('create-audition-btn'),
      createLaunchFsBtn: $('create-launch-fs-btn'),

      // Sculpt Sheet
      sculptWfGrid: $('sculpt-wf-grid'),
      sculptFaderStack: $('sculpt-fader-stack'),
      sculptAnimRow: $('sculpt-anim-row'),
      btnSculptSave: $('btn-sculpt-save'),

      // Sequencer Sheet
      seqSheetPlay: $('seq-sheet-play'),
      seqAiGrooveBtn: $('seq-ai-groove-btn'),
      seqClearBtn: $('seq-clear-btn'),
      seqExportMidBtn: $('seq-export-mid-btn'),
      seqBpmSlider: $('seq-bpm-slider'),
      seqBpmVal: $('seq-bpm-val'),
      seqSwingSlider: $('seq-swing-slider'),
      seqSwingVal: $('seq-swing-val'),
      seq4x4Grid: $('seq-4x4-grid'),
      seqStepLabel: $('seq-step-label'),
      seqNoteGrid: $('seq-note-grid'),
      seqVelSlider: $('seq-vel-slider'),
      seqVelVal: $('seq-vel-val'),
      seqCcSlider: $('seq-cc-slider'),
      seqCcVal: $('seq-cc-val'),
      seqPatternList: $('seq-pattern-list'),

      // Bank & Hub Sheets
      bankSheetTitle: $('bank-sheet-title'),
      bankList: $('bank-list'),
      hubPublishBtn: $('hub-publish-btn'),
      hubList: $('hub-list'),
    };
  }

  bindEvents() {
    // Toast dismiss
    this.dom.toastClose.addEventListener('click', () => this.hideToast());

    // Header: Tap to open Bank, OR Swipe left/right to hot-swap instruments!
    let swipeStartX = 0;
    let swipeHandled = false;
    this.dom.btnOpenBank.addEventListener('pointerdown', (e) => {
      swipeStartX = e.clientX;
      swipeHandled = false;
    });
    this.dom.btnOpenBank.addEventListener('pointerup', (e) => {
      const dx = e.clientX - swipeStartX;
      if (Math.abs(dx) > 36) {
        swipeHandled = true;
        this.cycleInstrument(dx < 0 ? 1 : -1);
      }
    });
    this.dom.btnOpenBank.addEventListener('click', () => {
      if (!swipeHandled) this.openSheet('bank');
    });

    // Transport, Demo Riff & Full-Screen / Game Menu
    this.dom.btnTopPlay.addEventListener('click', () => this.toggleSequencer());
    this.dom.seqSheetPlay.addEventListener('click', () => this.toggleSequencer());
    this.dom.zenPlayBtn.addEventListener('click', () => this.toggleSequencer());
    this.dom.btnTopRiff.addEventListener('click', () => this.playDemoRiff());
    this.dom.btnEnterZen.addEventListener('click', () => this.setZenFullscreen(true));
    this.dom.btnExitZen.addEventListener('click', () => this.setGameMenuOpen(true));
    this.dom.btnStudioMenu?.addEventListener('click', () => this.setGameMenuOpen(true));

    // ================= LIQUID-METAL GAME MENU CONTROLS =================
    this.dom.menuPlayBtn?.addEventListener('click', () => {
      this.engine.ensureContext();
      this.engine.triggerSubPunch(0.72);
      this.state.hasEnteredStage = true;
      if (this.dom.menuPlayLabel) this.dom.menuPlayLabel.textContent = 'RESUME INSTRUMENT';
      this.setZenFullscreen(true, false);
      this.setGameMenuOpen(false);
    });

    this.dom.menuPrevPatch?.addEventListener('click', () => {
      this.cycleInstrument(-1);
      this.menuReactor?.triggerPulse(1.0);
    });
    this.dom.menuNextPatch?.addEventListener('click', () => {
      this.cycleInstrument(1);
      this.menuReactor?.triggerPulse(1.0);
    });
    this.dom.menuAuditionBtn?.addEventListener('click', () => {
      this.engine.auditionInstrumentRiff(this.state.selectedInstrument);
      this.menuReactor?.triggerPulse(1.1);
    });

    // Swipe left/right on the Game Menu Loadout Card to cycle basses like a game character select!
    let menuSwipeX = 0;
    this.dom.menuLoadoutCard?.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      menuSwipeX = e.clientX;
    });
    this.dom.menuLoadoutCard?.addEventListener('pointerup', (e) => {
      if (e.target.closest('button')) return;
      const dx = e.clientX - menuSwipeX;
      if (Math.abs(dx) > 34) {
        this.cycleInstrument(dx < 0 ? 1 : -1);
        this.menuReactor?.triggerPulse(1.0);
      }
    });

    // Play Arena selector pills on Game Menu
    this.dom.menuModePills?.forEach((pill) => {
      pill.addEventListener('click', () => {
        const mode = pill.dataset.menuSurface;
        this.setPlaySurface(mode);
        this.menuReactor?.triggerPulse(0.7);
      });
    });

    // 2x2 Liquid-Metal Menu Cards (FORGE, SCULPT, GROOVE, HUB) & Bank / Studio View
    this.dom.menuSheetTiles?.forEach((tile) => {
      tile.addEventListener('click', () => {
        const sheet = tile.dataset.menuSheet;
        if (sheet) this.openSheet(sheet);
      });
    });
    this.dom.menuBankBtn?.addEventListener('click', () => this.openSheet('bank'));
    this.dom.menuStudioBtn?.addEventListener('click', () => {
      this.engine.ensureContext();
      this.state.hasEnteredStage = true;
      if (this.dom.menuPlayLabel) this.dom.menuPlayLabel.textContent = 'RESUME INSTRUMENT';
      this.setZenFullscreen(false);
      this.setGameMenuOpen(false);
    });

    // Floating Minimal Game HUD Pill: Swipe left/right to hot-swap bass, tap to open Bank
    let zenSwipeX = 0;
    let zenSwipeHandled = false;
    this.dom.zenPatchBtn.addEventListener('pointerdown', (e) => {
      zenSwipeX = e.clientX;
      zenSwipeHandled = false;
    });
    this.dom.zenPatchBtn.addEventListener('pointerup', (e) => {
      const dx = e.clientX - zenSwipeX;
      if (Math.abs(dx) > 32) {
        zenSwipeHandled = true;
        this.cycleInstrument(dx < 0 ? 1 : -1);
      }
    });
    this.dom.zenPatchBtn.addEventListener('click', () => {
      if (!zenSwipeHandled) this.openSheet('bank');
    });

    // Floating Game HUD Pill: 1-tap cycle through play interfaces (MORPH -> 12-PAD -> GLIDE)
    this.dom.zenModeBtn.addEventListener('click', () => this.cyclePlaySurface(1));

    // Keep Infinite Morph Grid + Second-Hand Modulator Deck sized cleanly on fullscreen changes
    document.addEventListener('fullscreenchange', () => {
      requestAnimationFrame(() => {
        this.morphGrid?.resize();
        this.modDeck?.resize();
      });
    });

    // Second-Hand Modulator Deck quick controls (Latch, Clear, 14-Gesture Guide)
    this.dom.modLatchBtn?.addEventListener('click', () => {
      this.modDeck?.toggleLatch();
      this.dom.modLatchBtn.classList.toggle('is-active', Boolean(this.modDeck?.isLatched));
    });
    this.dom.modResetBtn?.addEventListener('click', () => {
      this.modDeck?.resetAll(false);
      this.dom.modLatchBtn?.classList.remove('is-active');
    });
    this.dom.modGuideBtn?.addEventListener('click', () => {
      this.dom.modGuideOverlay?.classList.toggle('is-hidden');
    });
    this.dom.modGuideClose?.addEventListener('click', () => {
      this.dom.modGuideOverlay?.classList.add('is-hidden');
    });

    // Surface switcher (MORPH vs 12-PAD vs FRETLESS GLIDE)
    this.dom.modeMorphBtn.addEventListener('click', () => this.setPlaySurface('morph'));
    this.dom.modePadsBtn.addEventListener('click', () => this.setPlaySurface('pads'));
    this.dom.modeGlideBtn.addEventListener('click', () => this.setPlaySurface('glide'));

    // Octave & BT Sub Exciter
    this.dom.octDecBtn.addEventListener('click', () => this.setOctaveShift(this.state.octaveShift - 1));
    this.dom.octIncBtn.addEventListener('click', () => this.setOctaveShift(this.state.octaveShift + 1));
    this.dom.btnBtBoost.addEventListener('click', () => {
      this.state.btSubBoost = !this.state.btSubBoost;
      this.dom.btnBtBoost.classList.toggle('is-on', this.state.btSubBoost);
      this.engine.setBtSubBoost(this.state.btSubBoost);
      this.triggerPad(0, 0.85);
      this.showToast(this.state.btSubBoost ? 'BT Sub-Harmonic Exciter ON' : 'Pure Sub Fundamental Mode');
    });

    // Interactive Oscilloscope X/Y Expression Ribbon
    const updateXy = (e) => {
      const rect = this.dom.xyDeck.getBoundingClientRect();
      const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const ny = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
      this.state.xyX = nx;
      this.state.xyY = ny;
      this.engine.ensureContext();
      this.engine.setXyExpression(nx, ny, true);
      const cutHz = Math.round(90 * Math.pow(80, nx));
      this.dom.xyHudBl.textContent = `CUT ${cutHz >= 1000 ? (cutHz / 1000).toFixed(1) + 'k' : cutHz + 'Hz'} • GRIT ${Math.round(ny * 100)}%`;
    };

    this.dom.xyDeck.addEventListener('pointerdown', (e) => {
      if (e.target === this.dom.btnXyHold) return;
      this.state.xyDragging = true;
      this.dom.xyDeck.setPointerCapture(e.pointerId);
      updateXy(e);
    });
    this.dom.xyDeck.addEventListener('pointermove', (e) => {
      if (!this.state.xyDragging) return;
      updateXy(e);
    });
    this.dom.xyDeck.addEventListener('pointerup', () => {
      if (!this.state.xyDragging) return;
      this.state.xyDragging = false;
      if (!this.state.xyHold) {
        this.engine.setXyExpression(this.state.xyX, this.state.xyY, false);
        this.dom.xyHudBl.textContent = `CUT OPEN • DRV ${Math.round(this.state.selectedInstrument.drive * 100)}%`;
      }
    });
    this.dom.btnXyHold.addEventListener('click', (e) => {
      e.stopPropagation();
      this.state.xyHold = !this.state.xyHold;
      this.dom.btnXyHold.classList.toggle('is-active', this.state.xyHold);
      if (!this.state.xyHold) {
        this.engine.setXyExpression(this.state.xyX, this.state.xyY, false);
        this.dom.xyHudBl.textContent = `CUT OPEN • DRV ${Math.round(this.state.selectedInstrument.drive * 100)}%`;
      } else {
        this.engine.setXyExpression(this.state.xyX, this.state.xyY, true);
      }
    });

    // Multi-Touch Slide-Strum on 3x4 Pad Grid
    this.dom.padGrid.addEventListener('pointermove', (e) => {
      if (e.buttons === 0 && e.pointerType === 'mouse') return;
      if (!this.pointerActivePad.has(e.pointerId)) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const pad = el?.closest?.('.bass-pad');
      if (!pad) return;
      const idx = parseInt(pad.dataset.padIndex, 10);
      if (this.pointerActivePad.get(e.pointerId) !== idx) {
        this.pointerActivePad.set(e.pointerId, idx);
        const rect = pad.getBoundingClientRect();
        const relY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
        this.triggerPad(idx, 0.65 + relY * 0.35);
      }
    });
    const clearPtr = (e) => {
      if (this.pointerActivePad.delete(e.pointerId) && this.pointerActivePad.size === 0) {
        this.setZenHudDimmed(false);
      }
    };
    window.addEventListener('pointerup', clearPtr);
    window.addEventListener('pointercancel', clearPtr);

    // Full-Screen Continuous Fretless Glide Surface
    const calcGlide = (e) => {
      const rect = this.dom.glideSurface.getBoundingClientRect();
      const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const ny = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
      const semitones = ny * 11.99;
      const base = this.state.selectedInstrument.baseFreqHz * Math.pow(2, this.state.octaveShift);
      const freq = base * Math.pow(2, semitones / 12);
      const notes = this.getActivePadNotes();
      const nearest = notes[Math.min(11, Math.round(semitones))];
      this.state.glideX = nx;
      this.state.glideY = ny;
      this.state.glideNoteLabel = `${nearest.noteName} • ${freq.toFixed(1)}Hz`;
      this.dom.glideReadout.innerHTML = `<strong>${nearest.noteName}</strong> • ${freq.toFixed(1)}Hz`;
      this.dom.xyHudTr.textContent = this.state.glideNoteLabel;
      if (this.dom.zenPatchMeta) this.dom.zenPatchMeta.textContent = this.state.glideNoteLabel;
      return { freq, filterNorm: nx };
    };

    this.dom.glideSurface.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.state.glideActive = true;
      this.setZenHudDimmed(true);
      this.dom.glideSurface.setPointerCapture(e.pointerId);
      const { freq, filterNorm } = calcGlide(e);
      this.engine.startGlideVoice(freq, filterNorm);
    });
    this.dom.glideSurface.addEventListener('pointermove', (e) => {
      if (!this.state.glideActive) return;
      const { freq, filterNorm } = calcGlide(e);
      this.engine.moveGlideVoice(freq, filterNorm);
    });
    const stopGlide = () => {
      if (!this.state.glideActive) return;
      this.state.glideActive = false;
      this.setZenHudDimmed(false);
      this.engine.stopGlideVoice();
    };
    this.dom.glideSurface.addEventListener('pointerup', stopGlide);
    this.dom.glideSurface.addEventListener('pointercancel', stopGlide);

    // Bottom Dock Sheets
    this.dom.dockBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.sheet;
        if (this.state.openSheet === target) this.closeAllSheets();
        else this.openSheet(target);
      });
    });
    this.dom.backdrop.addEventListener('click', () => this.closeAllSheets());
    this.dom.closeSheetBtns.forEach((b) => b.addEventListener('click', () => this.closeAllSheets()));

    // "+ CREATE INSTRUMENT" 2D Sonic DNA Sculptor
    let dnaDragging = false;
    const handleDnaPointer = (e, forceAudition = false) => {
      const rect = this.dom.dnaWell.getBoundingClientRect();
      const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const ny = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
      this.state.dnaX = nx;
      this.state.dnaY = ny;
      const name = this.dom.createNameInput.value.trim() || 'Sculpted Sub Bass';
      const col = this.state.creatorDraft.accentColorHex;
      this.state.creatorDraft = this.buildDraftFromDna(nx, ny, name, col);
      this.renderDnaSpecs();

      const now = performance.now();
      if (forceAudition || now - this.dnaLastAudition > 210) {
        this.dnaLastAudition = now;
        this.engine.auditionSingleNote(this.state.creatorDraft, 0);
      }
    };

    this.dom.dnaWell.addEventListener('pointerdown', (e) => {
      dnaDragging = true;
      this.dom.dnaWell.setPointerCapture(e.pointerId);
      handleDnaPointer(e, true);
    });
    this.dom.dnaWell.addEventListener('pointermove', (e) => {
      if (!dnaDragging) return;
      handleDnaPointer(e, false);
    });
    this.dom.dnaWell.addEventListener('pointerup', () => { dnaDragging = false; });

    this.dom.createAiParseBtn.addEventListener('click', () => {
      const prompt = this.dom.createPromptInput.value.trim();
      if (!prompt) return;
      const forged = synthesizeInstrumentSpec(prompt);
      this.state.creatorDraft = forged;
      this.dom.createNameInput.value = forged.name;
      this.state.dnaX = forged.waveform === 'FM_GROWL' ? 0.86 : forged.waveform === 'SAW' ? 0.62 : 0.22;
      this.state.dnaY = forged.drive;
      this.renderCreateSheet();
      this.engine.auditionInstrumentRiff(forged);
      this.showToast(`Forged "${forged.name}" — tap USE IN FULL SCREEN to play!`);
    });

    this.dom.createMicBtn.addEventListener('click', () => {
      if (this.voiceController && this.voiceController.isRecording) {
        this.voiceController.stop();
        return;
      }
      this.dom.createMicBtn.classList.add('is-recording');
      this.voiceController = new VoicePromptController({
        onInterim: (t) => { this.dom.createPromptInput.value = t; },
        onFinal: (t) => {
          this.dom.createPromptInput.value = t;
          this.dom.createAiParseBtn.click();
        },
        onEnd: () => this.dom.createMicBtn.classList.remove('is-recording'),
        onError: () => this.dom.createMicBtn.classList.remove('is-recording'),
      });
      this.voiceController.start();
    });

    this.dom.createNameInput.addEventListener('input', (e) => {
      this.state.creatorDraft.name = e.target.value.trim() || 'Custom Bass';
    });

    this.dom.createAuditionBtn.addEventListener('click', () => {
      this.engine.auditionInstrumentRiff(this.state.creatorDraft);
    });

    // HERO ACTION: Launch newly created instrument straight into Full-Screen Performance Mode!
    this.dom.createLaunchFsBtn.addEventListener('click', () => {
      const created = {
        ...this.state.creatorDraft,
        id: `created_${Date.now().toString(36)}`,
        name: this.dom.createNameInput.value.trim() || this.state.creatorDraft.name || 'Custom Sub',
        isCustom: true,
      };
      this.state.customInstruments = [created, ...this.state.customInstruments];
      saveJson(STORAGE_KEYS.CUSTOM_INSTRUMENTS, this.state.customInstruments);
      this.selectInstrument(created, true);
      this.renderBankSheet();
      this.closeAllSheets();
      this.state.hasEnteredStage = true;
      if (this.dom.menuPlayLabel) this.dom.menuPlayLabel.textContent = 'RESUME INSTRUMENT';
      this.setZenFullscreen(true, false);
      this.setGameMenuOpen(false);
      this.showToast(`"${created.name}" active in Full-Screen Performance Mode!`);
    });

    // Sculpt Sheet Save Copy
    this.dom.btnSculptSave.addEventListener('click', () => {
      const copy = {
        ...this.state.selectedInstrument,
        id: `custom_${Date.now().toString(36)}`,
        name: `${this.state.selectedInstrument.name.replace(/^\d+\.\s*/, '')} (Mod)`,
        isCustom: true,
      };
      this.state.customInstruments = [copy, ...this.state.customInstruments];
      saveJson(STORAGE_KEYS.CUSTOM_INSTRUMENTS, this.state.customInstruments);
      this.selectInstrument(copy, false);
      this.renderBankSheet();
      this.showToast(`Saved "${copy.name}" to Bank.`);
    });

    // Sequencer Controls
    this.dom.seqAiGrooveBtn.addEventListener('click', () => this.randomizeGroove());
    this.dom.seqClearBtn.addEventListener('click', () => {
      this.state.midiSteps.forEach((s) => { s.active = false; });
      this.renderSeqSheet();
    });
    this.dom.seqExportMidBtn.addEventListener('click', () => this.exportMidiFile());
    this.dom.seqBpmSlider.addEventListener('input', (e) => this.setBpm(parseInt(e.target.value, 10)));
    this.dom.seqSwingSlider.addEventListener('input', (e) => {
      this.state.swingPercent = parseInt(e.target.value, 10);
      this.dom.seqSwingVal.textContent = `${this.state.swingPercent}%`;
    });
    this.dom.seqVelSlider.addEventListener('input', (e) => {
      const st = this.state.midiSteps[this.state.inspectedStep];
      st.velocity = parseFloat(e.target.value);
      st.active = true;
      this.dom.seqVelVal.textContent = String(Math.round(st.velocity * 127));
      this.renderSeqGrid();
    });
    this.dom.seqCcSlider.addEventListener('input', (e) => {
      const st = this.state.midiSteps[this.state.inspectedStep];
      st.filterMod = parseFloat(e.target.value);
      st.active = true;
      this.dom.seqCcVal.textContent = `${Math.round(st.filterMod * 100)}%`;
      this.renderSeqGrid();
    });

    // Community Publish
    this.dom.hubPublishBtn.addEventListener('click', () => this.publishCurrentInstrument());

    // Keyboard shortcuts (great when testing on desktop too!)
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target && e.target.tagName) || '') || e.repeat) return;
      if (e.key === 'Escape') {
        if (this.state.openSheet) this.closeAllSheets();
        else this.setGameMenuOpen(!this.state.isGameMenuOpen);
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        this.toggleSequencer();
        return;
      }
      const pIdx = PAD_HOTKEYS.indexOf(e.key.toUpperCase());
      if (pIdx !== -1) {
        e.preventDefault();
        this.triggerPad(pIdx, 0.94);
      }
    });
  }

  /* ========================================================================
     LIQUID-METAL GAME MENU, FULL-SCREEN ZEN MODE, PLAY SURFACES & SHEETS
     ======================================================================== */

  setGameMenuOpen(open) {
    this.state.isGameMenuOpen = Boolean(open);
    this.dom.gameMenuScreen?.classList.toggle('is-open', this.state.isGameMenuOpen);
    if (this.state.isGameMenuOpen) {
      this.engine.stopAllLiquidVoices();
      this.engine.stopGlideVoice();
      this.updateMenuLoadout(this.state.selectedInstrument);
      requestAnimationFrame(() => this.menuReactor?.resize());
    } else {
      requestAnimationFrame(() => {
        this.morphGrid?.resize();
        this.modDeck?.resize();
      });
    }
  }

  updateMenuLoadout(inst) {
    if (!inst) return;
    if (this.dom.menuPatchName) this.dom.menuPatchName.textContent = inst.name;
    if (this.dom.menuPatchMeta) {
      this.dom.menuPatchMeta.textContent = `${(inst.category || 'BASS').toUpperCase()} • ${inst.waveform} • ${Number(inst.baseFreqHz).toFixed(1)}Hz`;
    }
    if (this.dom.menuStatSub) this.dom.menuStatSub.style.width = `${Math.round((inst.subOctaveMix ?? 0.7) * 100)}%`;
    if (this.dom.menuStatGrit) this.dom.menuStatGrit.style.width = `${Math.round((inst.drive ?? 0.35) * 100)}%`;
    if (this.dom.menuStatCut) {
      const cutPct = Math.max(8, Math.min(100, Math.round(((inst.cutoffHz || 800) / 3600) * 100)));
      this.dom.menuStatCut.style.width = `${cutPct}%`;
    }
    if (this.dom.menuStatWob) {
      const wobPct = Math.max(8, Math.min(100, Math.round((inst.lfoDepth ?? 0.2) * 100)));
      this.dom.menuStatWob.style.width = `${wobPct}%`;
    }
    if (this.dom.menuBankBtn) {
      this.dom.menuBankBtn.textContent = `INSTRUMENT BANK (${this.getAllInstruments().length})`;
    }
  }

  setZenFullscreen(enabled, requestBrowserFs = true) {
    this.state.isZenFullscreen = Boolean(enabled);
    this.dom.stage.classList.toggle('is-zen', this.state.isZenFullscreen);
    if (this.state.isZenFullscreen) {
      this.closeAllSheets();
      this.setZenHudDimmed(false);
      if (requestBrowserFs && document.documentElement.requestFullscreen && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } else {
      this.setZenHudDimmed(false);
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
    requestAnimationFrame(() => {
      this.morphGrid?.resize();
      this.modDeck?.resize();
    });
  }

  setZenHudDimmed(active) {
    if (!this.dom.zenHudPill) return;
    clearTimeout(this.zenHudDimTimer);
    if (active && this.state.isZenFullscreen) {
      this.dom.zenHudPill.classList.add('is-dimmed');
    } else {
      this.zenHudDimTimer = setTimeout(() => {
        this.dom.zenHudPill?.classList.remove('is-dimmed');
      }, active ? 0 : 1200);
    }
  }

  cyclePlaySurface(dir = 1) {
    const curIdx = PLAY_SURFACES.findIndex((s) => s.id === this.state.playSurface);
    const next = PLAY_SURFACES[(curIdx + dir + PLAY_SURFACES.length) % PLAY_SURFACES.length];
    this.setPlaySurface(next.id);
    this.showToast(`Interface: ${next.title}`);
  }

  setPlaySurface(mode) {
    const valid = PLAY_SURFACES.find((s) => s.id === mode) ? mode : 'morph';
    this.state.playSurface = valid;

    const isMorph = valid === 'morph';
    const isPads = valid === 'pads';
    const isGlide = valid === 'glide';

    this.dom.modeMorphBtn.classList.toggle('is-active', isMorph);
    this.dom.modeMorphBtn.setAttribute('aria-selected', String(isMorph));
    this.dom.modePadsBtn.classList.toggle('is-active', isPads);
    this.dom.modePadsBtn.setAttribute('aria-selected', String(isPads));
    this.dom.modeGlideBtn.classList.toggle('is-active', isGlide);
    this.dom.modeGlideBtn.setAttribute('aria-selected', String(isGlide));

    this.dom.menuModePills?.forEach((pill) => {
      const act = pill.dataset.menuSurface === valid;
      pill.classList.toggle('is-active', act);
      pill.setAttribute('aria-selected', String(act));
    });

    this.dom.morphSurface.classList.toggle('is-hidden', !isMorph);
    this.dom.padGrid.classList.toggle('is-hidden', !isPads);
    this.dom.glideSurface.classList.toggle('is-hidden', !isGlide);

    const meta = PLAY_SURFACES.find((s) => s.id === valid);
    if (this.dom.zenModeLabel && meta) {
      this.dom.zenModeLabel.textContent = meta.label;
    }

    if (!isGlide) this.engine.stopGlideVoice();
    if (!isMorph) this.engine.stopAllLiquidVoices();
    if (isMorph) {
      requestAnimationFrame(() => {
        this.morphGrid?.resize();
        this.modDeck?.resize();
      });
    }
  }

  openSheet(name) {
    this.state.openSheet = name;
    this.dom.backdrop.classList.add('is-open');
    this.dom.sheets.forEach((s) => s.classList.toggle('is-open', s.id === `sheet-${name}`));
    this.dom.dockBtns.forEach((b) => b.classList.toggle('is-active', b.dataset.sheet === name));
    if (name === 'sculpt') this.renderSculptSheet();
    if (name === 'seq') this.renderSeqSheet();
    if (name === 'bank') this.renderBankSheet();
    if (name === 'hub') this.renderHubSheet();
    if (name === 'create') this.renderCreateSheet();
  }

  closeAllSheets() {
    this.state.openSheet = null;
    this.dom.backdrop.classList.remove('is-open');
    this.dom.sheets.forEach((s) => s.classList.remove('is-open'));
    this.dom.dockBtns.forEach((b) => b.classList.remove('is-active'));
  }

  showToast(msg) {
    this.dom.toastText.textContent = msg;
    this.dom.toast.classList.remove('is-hidden');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.hideToast(), 3200);
  }

  hideToast() {
    this.dom.toast.classList.add('is-hidden');
  }

  /* ========================================================================
     INSTRUMENT SELECTION & 3x4 VERTICAL PAD MATRIX
     ======================================================================== */

  cycleInstrument(dir) {
    const all = this.getAllInstruments();
    const curIdx = all.findIndex((i) => i.id === this.state.selectedInstrument.id);
    const nextIdx = (curIdx + dir + all.length) % all.length;
    this.selectInstrument(all[nextIdx], true);
  }

  selectInstrument(inst, audition = true) {
    this.state.selectedInstrument = { ...inst };
    document.documentElement.style.setProperty('--inst-led', inst.accentColorHex || '#38BDF8');
    this.engine.loadInstrument(this.state.selectedInstrument, this.state.octaveShift);

    this.dom.topPatchName.textContent = inst.name;
    this.dom.topPatchSub.textContent = `${inst.waveform} • ${inst.baseFreqHz.toFixed(1)}Hz • SWIPE ⇄`;
    this.dom.xyHudBl.textContent = `CUT OPEN • DRV ${Math.round(inst.drive * 100)}%`;
    this.updateMenuLoadout(inst);

    if (this.dom.zenPatchName) this.dom.zenPatchName.textContent = inst.name;
    if (this.dom.zenPatchMeta) {
      this.dom.zenPatchMeta.textContent = `${inst.waveform} • ${inst.baseFreqHz.toFixed(1)}Hz • SWIPE ⇄`;
    }

    this.renderPadGrid();
    if (this.state.openSheet === 'sculpt') this.renderSculptSheet();
    if (this.state.openSheet === 'bank') this.renderBankSheet();
    if (this.state.openSheet === 'seq') this.renderSeqSheet();

    if (audition) this.triggerPad(0, 0.9);
  }

  setOctaveShift(shift) {
    this.state.octaveShift = Math.max(-2, Math.min(5, shift));
    const label = this.state.octaveShift > 0 ? `+${this.state.octaveShift}` : String(this.state.octaveShift);
    this.dom.octValLabel.textContent = `OCT ${label}`;
    this.engine.loadInstrument(this.state.selectedInstrument, this.state.octaveShift);
    this.morphGrid?.scrollToOctave(this.state.octaveShift);
    this.renderPadGrid();
    this.triggerPad(0, 0.88);
  }

  renderPadGrid() {
    const notes = this.getActivePadNotes();
    this.dom.padGrid.innerHTML = '';
    this.padCanvases = new Array(12);

    // 3 columns x 4 rows: bottom row = C, C#, D (0,1,2) climbing up to A, A#, B (9,10,11)
    const verticalOrder = [9, 10, 11, 6, 7, 8, 3, 4, 5, 0, 1, 2];

    verticalOrder.forEach((padIdx) => {
      const spec = notes[padIdx];
      const pad = document.createElement('button');
      pad.type = 'button';
      pad.id = `bass-pad-${padIdx}`;
      pad.className = `bass-pad${this.state.lastTriggeredPad === padIdx ? ' is-last' : ''}`;
      pad.dataset.padIndex = String(padIdx);

      pad.innerHTML = `
        <canvas class="pad-fx-canvas" width="150" height="150"></canvas>
        <div class="pad-led-bar"></div>
        <div class="pad-top-row">
          <span class="pad-num">P${String(padIdx + 1).padStart(2, '0')}</span>
          <span class="pad-key">${spec.hotkey}</span>
        </div>
        <div class="pad-bottom-row">
          <span class="pad-note">${spec.noteName}</span>
          <span class="pad-hz">${spec.frequencyHz.toFixed(0)}Hz</span>
        </div>
      `;

      this.padCanvases[padIdx] = pad.querySelector('canvas');

      pad.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.pointerActivePad.set(e.pointerId, padIdx);
        this.setZenHudDimmed(true);
        const rect = pad.getBoundingClientRect();
        const relY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
        this.triggerPad(padIdx, 0.65 + relY * 0.35);
      });

      this.dom.padGrid.appendChild(pad);
    });
  }

  triggerPad(padIndex, velocity = 0.94, filterMod = null, scheduledTime = null, pulseMorph = true) {
    const idx = Math.max(0, Math.min(11, padIndex));
    this.engine.triggerPad(idx, velocity, filterMod, scheduledTime);

    const applyVisual = () => {
      this.state.lastTriggeredPad = idx;
      const spec = this.getActivePadNotes()[idx];
      const noteText = `${spec.noteName} • ${spec.frequencyHz.toFixed(1)}Hz`;
      this.dom.xyHudTr.textContent = noteText;
      if (this.dom.zenPatchMeta) this.dom.zenPatchMeta.textContent = noteText;
      this.padFx[idx] = { energy: 1, hitTime: performance.now() };

      if (this.state.isGameMenuOpen && this.menuReactor) {
        this.menuReactor.triggerPulse(velocity * 0.72);
      } else if (pulseMorph && this.state.playSurface === 'morph' && this.morphGrid) {
        this.morphGrid.pulseCell(idx, velocity);
      }

      const prev = this.dom.padGrid.querySelector('.bass-pad.is-last');
      if (prev) prev.classList.remove('is-last');
      const el = document.getElementById(`bass-pad-${idx}`);
      if (el) {
        el.classList.add('is-triggered', 'is-last');
        clearTimeout(el._rt);
        el._rt = setTimeout(() => el.classList.remove('is-triggered'), 115);
      }
    };

    if (scheduledTime !== null && this.engine.ctx) {
      setTimeout(applyVisual, Math.max(0, (scheduledTime - this.engine.ctx.currentTime) * 1000));
    } else {
      applyVisual();
    }
  }

  playDemoRiff() {
    this.demoTimers.forEach(clearTimeout);
    this.demoTimers = [
      { p: 0, d: 0 }, { p: 0, d: 210 }, { p: 3, d: 330 }, { p: 5, d: 540 },
      { p: 7, d: 740 }, { p: 10, d: 900 }, { p: 7, d: 1080 }, { p: 3, d: 1240 }, { p: 0, d: 1410 },
    ].map((h) => setTimeout(() => this.triggerPad(h.p, 0.94), h.d));
  }

  /* ========================================================================
     SHEET 1: "+ CREATE INSTRUMENT" (2D SONIC DNA + VOICE/AI)
     ======================================================================== */

  renderCreateSheet() {
    const draft = this.state.creatorDraft;
    this.dom.createLedPreview.style.background = draft.accentColorHex;
    this.dom.createLedPreview.style.boxShadow = `0 0 8px ${draft.accentColorHex}`;
    this.renderDnaSpecs();

    // Sonic Mood Quick Chips
    this.dom.createMoodRow.innerHTML = '';
    CREATE_MOODS.forEach((m) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mood-chip';
      btn.textContent = m.label;
      btn.addEventListener('click', () => {
        this.state.dnaX = m.x;
        this.state.dnaY = m.y;
        this.dom.createPromptInput.value = m.prompt;
        const forged = synthesizeInstrumentSpec(m.prompt);
        this.state.creatorDraft = forged;
        this.dom.createNameInput.value = forged.name;
        this.renderCreateSheet();
        this.engine.auditionSingleNote(forged, 0);
      });
      this.dom.createMoodRow.appendChild(btn);
    });

    // LED Swatches
    this.dom.createSwatchRow.innerHTML = '';
    STUDIO_SWATCHES.forEach((hex) => {
      const sw = document.createElement('button');
      sw.type = 'button';
      sw.className = `led-swatch${draft.accentColorHex === hex ? ' is-selected' : ''}`;
      sw.style.background = hex;
      sw.addEventListener('click', () => {
        this.state.creatorDraft.accentColorHex = hex;
        this.renderCreateSheet();
      });
      this.dom.createSwatchRow.appendChild(sw);
    });
  }

  renderDnaSpecs() {
    const d = this.state.creatorDraft;
    this.dom.dnaLiveSpecs.innerHTML = `
      <div class="dna-spec-box"><span>WAVE</span><strong>${d.waveform.replace('_', ' ')}</strong></div>
      <div class="dna-spec-box"><span>CUTOFF</span><strong>${d.cutoffHz >= 1000 ? (d.cutoffHz / 1000).toFixed(1) + 'k' : d.cutoffHz + 'Hz'}</strong></div>
      <div class="dna-spec-box"><span>DRIVE</span><strong>${Math.round(d.drive * 100)}%</strong></div>
      <div class="dna-spec-box"><span>SUB MIX</span><strong>${Math.round(d.subOctaveMix * 100)}%</strong></div>
    `;
  }

  /* ========================================================================
     SHEET 2: SCULPT DSP RACK
     ======================================================================== */

  renderSculptSheet() {
    const inst = this.state.selectedInstrument;

    this.dom.sculptWfGrid.innerHTML = '';
    WAVEFORM_TYPES.forEach((wf) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `wf-chip${inst.waveform === wf.id ? ' is-active' : ''}`;
      btn.textContent = wf.shortTag;
      btn.addEventListener('click', () => {
        this.state.selectedInstrument.waveform = wf.id;
        this.engine.loadInstrument(this.state.selectedInstrument, this.state.octaveShift);
        this.dom.topPatchSub.textContent = `${wf.id} • ${inst.baseFreqHz.toFixed(1)}Hz • SWIPE ⇄`;
        this.renderSculptSheet();
        this.triggerPad(this.state.lastTriggeredPad, 0.9);
      });
      this.dom.sculptWfGrid.appendChild(btn);
    });

    this.dom.sculptFaderStack.innerHTML = '';
    FADER_SPECS.forEach((sp) => {
      const val = inst[sp.key] ?? sp.min;
      const wrap = document.createElement('div');
      wrap.className = 'fader-item';
      wrap.innerHTML = `
        <div class="fader-head"><span>${sp.label}</span><strong data-val>${sp.format(val)}</strong></div>
        <input class="hw-range" type="range" min="${sp.min}" max="${sp.max}" step="${sp.step}" value="${val}" />
      `;
      const input = wrap.querySelector('input');
      const valEl = wrap.querySelector('[data-val]');
      input.addEventListener('input', (e) => {
        const num = parseFloat(e.target.value);
        this.state.selectedInstrument[sp.key] = num;
        valEl.textContent = sp.format(num);
        this.engine.loadInstrument(this.state.selectedInstrument, this.state.octaveShift);
      });
      input.addEventListener('change', () => this.triggerPad(this.state.lastTriggeredPad, 0.88));
      this.dom.sculptFaderStack.appendChild(wrap);
    });

    this.dom.sculptAnimRow.innerHTML = '';
    PAD_ANIMATION_STYLES.forEach((st) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `mood-chip${inst.animationStyle === st.id ? ' is-active' : ''}`;
      btn.textContent = st.label;
      btn.addEventListener('click', () => {
        this.state.selectedInstrument.animationStyle = st.id;
        this.renderSculptSheet();
        this.triggerPad(this.state.lastTriggeredPad, 0.9);
      });
      this.dom.sculptAnimRow.appendChild(btn);
    });
  }

  /* ========================================================================
     SHEET 3: 16-STEP MOBILE SEQUENCER (4x4 THUMB GRID)
     ======================================================================== */

  setBpm(val) {
    this.state.bpm = Math.max(60, Math.min(200, val));
    this.dom.topBpmNum.textContent = String(this.state.bpm);
    this.dom.seqBpmVal.textContent = `${this.state.bpm} BPM`;
    this.dom.seqBpmSlider.value = String(this.state.bpm);
  }

  toggleSequencer() {
    if (this.state.isPlaying) {
      this.state.isPlaying = false;
      this.state.currentStep = -1;
      clearInterval(this.seqTimerId);
      this.dom.btnTopPlay.classList.remove('is-playing');
      this.dom.topPlayIcon.textContent = '▶';
      this.dom.seqSheetPlay.textContent = '▶ PLAY';
      if (this.dom.zenPlayBtn) this.dom.zenPlayBtn.classList.remove('is-playing');
      if (this.dom.zenPlayIcon) this.dom.zenPlayIcon.textContent = '▶';
      this.highlightPlayhead(-1);
      return;
    }

    const ctx = this.engine.ensureContext();
    this.state.isPlaying = true;
    this.scheduleStep = 0;
    this.nextNoteTime = ctx.currentTime + 0.04;
    this.dom.btnTopPlay.classList.add('is-playing');
    this.dom.topPlayIcon.textContent = '■';
    this.dom.seqSheetPlay.textContent = '■ STOP';
    if (this.dom.zenPlayBtn) this.dom.zenPlayBtn.classList.add('is-playing');
    if (this.dom.zenPlayIcon) this.dom.zenPlayIcon.textContent = '■';

    this.seqTimerId = setInterval(() => {
      while (this.nextNoteTime < ctx.currentTime + 0.11) {
        const idx = this.scheduleStep;
        const st = this.state.midiSteps[idx];
        const t = this.nextNoteTime;

        if (st && st.active) {
          this.triggerPad(st.noteIndex, st.velocity, st.filterMod, t);
        }

        setTimeout(() => {
          if (!this.state.isPlaying) return;
          this.state.currentStep = idx;
          this.highlightPlayhead(idx);
        }, Math.max(0, (t - ctx.currentTime) * 1000));

        const base16 = 60 / this.state.bpm / 4;
        const sw = (this.state.swingPercent / 100) * 0.45;
        this.nextNoteTime += Math.max(0.04, idx % 2 === 0 ? base16 * (1 + sw) : base16 * (1 - sw));
        this.scheduleStep = (this.scheduleStep + 1) % 16;
      }
    }, 25);
  }

  highlightPlayhead(stepIdx) {
    this.dom.seq4x4Grid.querySelectorAll('.step-tile').forEach((tile, i) => {
      tile.classList.toggle('is-playhead', i === stepIdx);
    });
  }

  renderSeqSheet() {
    this.renderSeqGrid();
    this.renderStepInspector();

    this.dom.seqPatternList.innerHTML = '';
    this.state.midiPatterns.forEach((p) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'bank-row';
      row.innerHTML = `
        <div>
          <div style="font-family:var(--font-display);font-size:13px;font-weight:700;">${esc(p.name)}</div>
          <div style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);">${esc(p.instrumentName)} • ${p.bpm} BPM</div>
        </div>
        <span style="font-family:var(--font-mono);font-size:10px;color:var(--accent-emerald);font-weight:700;">LOAD ▶</span>
      `;
      row.addEventListener('click', () => {
        this.setBpm(p.bpm);
        this.state.swingPercent = p.swingPercent;
        this.dom.seqSwingSlider.value = String(p.swingPercent);
        this.dom.seqSwingVal.textContent = `${p.swingPercent}%`;
        this.state.midiSteps = p.steps.map((s) => ({ ...s }));
        const inst = this.getAllInstruments().find((i) => i.id === p.instrumentId);
        if (inst) this.selectInstrument(inst, false);
        this.renderSeqSheet();
        if (!this.state.isPlaying) this.toggleSequencer();
        this.showToast(`Loaded groove "${p.name}"`);
      });
      this.dom.seqPatternList.appendChild(row);
    });
  }

  renderSeqGrid() {
    const notes = this.getActivePadNotes();
    this.dom.seq4x4Grid.innerHTML = '';

    this.state.midiSteps.forEach((st, idx) => {
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = [
        'step-tile',
        st.active ? 'is-on' : '',
        this.state.inspectedStep === idx ? 'is-inspected' : '',
        this.state.currentStep === idx ? 'is-playhead' : '',
      ].filter(Boolean).join(' ');

      tile.innerHTML = `
        <span class="step-tile-led"></span>
        <span class="step-tile-note">${st.active ? notes[st.noteIndex].noteName : '—'}</span>
        <span class="step-tile-idx">${String(idx + 1).padStart(2, '0')}</span>
      `;

      tile.addEventListener('click', () => {
        if (this.state.inspectedStep === idx) st.active = !st.active;
        else {
          this.state.inspectedStep = idx;
          if (!st.active) st.active = true;
        }
        if (st.active) this.triggerPad(st.noteIndex, st.velocity, st.filterMod);
        this.renderSeqGrid();
        this.renderStepInspector();
      });

      this.dom.seq4x4Grid.appendChild(tile);
    });
  }

  renderStepInspector() {
    const st = this.state.midiSteps[this.state.inspectedStep];
    const notes = this.getActivePadNotes();
    this.dom.seqStepLabel.textContent = `STEP ${String(this.state.inspectedStep + 1).padStart(2, '0')} — NOTE PITCH & AUTOMATION`;
    this.dom.seqVelSlider.value = String(st.velocity);
    this.dom.seqVelVal.textContent = String(Math.round(st.velocity * 127));
    this.dom.seqCcSlider.value = String(st.filterMod);
    this.dom.seqCcVal.textContent = `${Math.round(st.filterMod * 100)}%`;

    this.dom.seqNoteGrid.innerHTML = '';
    notes.forEach((sp) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `note-btn${st.active && st.noteIndex === sp.noteIndex ? ' is-active' : ''}`;
      btn.textContent = sp.noteName;
      btn.addEventListener('click', () => {
        st.active = true;
        st.noteIndex = sp.noteIndex;
        this.triggerPad(sp.noteIndex, st.velocity, st.filterMod);
        this.renderSeqGrid();
        this.renderStepInspector();
      });
      this.dom.seqNoteGrid.appendChild(btn);
    });
  }

  randomizeGroove() {
    const scale = [0, 3, 5, 7, 10, 11];
    this.state.midiSteps = Array.from({ length: 16 }, (_, idx) => ({
      stepIndex: idx,
      active: idx % 4 === 0 || Math.random() < 0.44 || idx === 15,
      noteIndex: idx % 4 === 0 ? 0 : scale[Math.floor(Math.random() * scale.length)],
      velocity: idx % 4 === 0 ? 0.96 : 0.78,
      gate: 0.78,
      filterMod: idx % 3 === 0 ? 0.85 : 0.44,
    }));
    this.renderSeqSheet();
    if (!this.state.isPlaying) this.toggleSequencer();
  }

  exportMidiFile() {
    const blob = this.engine.buildStandardMidiBlob(this.state.midiSteps, this.state.bpm, 1, this.state.octaveShift);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'subforge_bass_groove.mid';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 800);
    this.showToast('Exported subforge_bass_groove.mid');
  }

  /* ========================================================================
     SHEET 4 & 5: INSTRUMENT BANK & COMMUNITY HUB
     ======================================================================== */

  renderBankSheet() {
    const all = this.getAllInstruments();
    this.dom.bankSheetTitle.textContent = `Instrument Bank (${all.length})`;
    this.dom.bankList.innerHTML = '';

    all.forEach((inst) => {
      const sel = inst.id === this.state.selectedInstrument.id;
      const row = document.createElement('button');
      row.type = 'button';
      row.className = `bank-row${sel ? ' is-selected' : ''}`;
      row.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;min-width:0;">
          <span class="patch-led-dot" style="background:${esc(inst.accentColorHex)};box-shadow:0 0 6px ${esc(inst.accentColorHex)};"></span>
          <div style="min-width:0;">
            <div style="font-family:var(--font-display);font-size:13.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(inst.name)}</div>
            <div style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);">${esc(inst.category)} • ${inst.waveform} • ${Math.round(inst.cutoffHz)}Hz</div>
          </div>
        </div>
        <span style="font-family:var(--font-mono);font-size:10px;color:${sel ? 'var(--accent-amber)' : 'var(--text-muted)'};font-weight:700;">${sel ? 'ACTIVE' : 'LOAD'}</span>
      `;
      row.addEventListener('click', () => {
        this.selectInstrument(inst, true);
        this.closeAllSheets();
      });
      this.dom.bankList.appendChild(row);
    });
  }

  publishCurrentInstrument() {
    const inst = this.state.selectedInstrument;
    const shared = {
      ...inst,
      id: `pub_${Date.now().toString(36)}`,
      authorName: 'StudioProducer',
      likesCount: 1,
      downloadsCount: 1,
      likedByUser: true,
      lastFeedbackText: 'Published from SubForge 9:16 Pocket Synth.',
      lastFeedbackAuthor: 'StudioProducer',
    };
    this.state.communityPatches = [shared, ...this.state.communityPatches];
    saveJson(STORAGE_KEYS.COMMUNITY, this.state.communityPatches);
    this.renderHubSheet();
    this.showToast(`Published "${inst.name}" to Community Hub.`);
  }

  renderHubSheet() {
    this.dom.hubList.innerHTML = '';
    this.state.communityPatches.forEach((p) => {
      const card = document.createElement('article');
      card.className = 'comm-card';
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
          <div>
            <div style="display:flex;align-items:center;gap:7px;">
              <span class="patch-led-dot" style="background:${esc(p.accentColorHex)};box-shadow:none;"></span>
              <strong style="font-family:var(--font-display);font-size:14px;">${esc(p.name)}</strong>
            </div>
            <div style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);margin-top:2px;">By ${esc(p.authorName)} • ${esc(p.category)}</div>
          </div>
          <button type="button" class="hw-btn" style="height:30px;padding:0 10px;" data-a="aud">▶</button>
        </div>
        <p style="font-size:12px;color:var(--text-secondary);">${esc(p.description)}</p>
        <div class="comm-spec-row">
          <span class="comm-tag">${p.waveform}</span>
          <span class="comm-tag">${Number(p.baseFreqHz).toFixed(1)}Hz</span>
          <span class="comm-tag">Cut ${Math.round(p.cutoffHz)}Hz</span>
          <span class="comm-tag">Drv ${Math.round(p.drive * 100)}%</span>
        </div>
        <div style="display:flex;justify-content:space-between;gap:8px;padding-top:4px;">
          <button type="button" class="hw-btn ${p.likedByUser ? 'is-primary' : 'is-ghost'}" style="height:32px;" data-a="like">♥ ${p.likesCount}</button>
          <button type="button" class="hw-btn is-emerald" style="height:32px;flex:1;" data-a="imp">USE FULL SCREEN (${p.downloadsCount})</button>
        </div>
      `;

      card.querySelector('[data-a="aud"]').addEventListener('click', () => this.engine.auditionInstrumentRiff(p));
      card.querySelector('[data-a="like"]').addEventListener('click', () => {
        p.likedByUser = !p.likedByUser;
        p.likesCount += p.likedByUser ? 1 : -1;
        saveJson(STORAGE_KEYS.COMMUNITY, this.state.communityPatches);
        this.renderHubSheet();
      });
      card.querySelector('[data-a="imp"]').addEventListener('click', () => {
        p.downloadsCount += 1;
        saveJson(STORAGE_KEYS.COMMUNITY, this.state.communityPatches);
        const imported = { ...p, id: `imp_${Date.now().toString(36)}`, isCustom: true };
        this.state.customInstruments = [imported, ...this.state.customInstruments];
        saveJson(STORAGE_KEYS.CUSTOM_INSTRUMENTS, this.state.customInstruments);
        this.selectInstrument(imported, true);
        this.renderBankSheet();
        this.closeAllSheets();
        this.showToast(`Loaded "${p.name}" onto your 12 pads!`);
      });

      this.dom.hubList.appendChild(card);
    });
  }

  /* ========================================================================
     60FPS VISUAL ENGINE: OSCILLOSCOPE XY + PAD FX + GLIDE + 2D SONIC DNA
     ======================================================================== */

  startRenderLoop() {
    const scopeCtx = this.dom.xyCanvas.getContext('2d');
    const glideCtx = this.dom.glideCanvas.getContext('2d');
    const dnaCtx = this.dom.dnaCanvas.getContext('2d');

    const draw = (now) => {
      const inst = this.state.selectedInstrument;
      const accent = inst.accentColorHex || '#38BDF8';

      // 0. Refresh live audio analyser frame & render active Liquid-Metal Canvas
      const samples = this.engine.readOscilloscope();
      if (this.state.isGameMenuOpen) {
        if (this.menuReactor) this.menuReactor.render(now);
      } else if (this.state.playSurface === 'morph') {
        if (this.morphGrid) this.morphGrid.render(now);
        if (this.modDeck) this.modDeck.render(now);
      }

      // 1. Live Oscilloscope + XY Reticle (skip redundant off-screen draw in Zen mode or Game Menu)
      if (!this.state.isZenFullscreen && !this.state.isGameMenuOpen) {
        const sw = this.dom.xyCanvas.width;
        const sh = this.dom.xyCanvas.height;
        const mid = sh / 2;
        scopeCtx.fillStyle = '#090A0D';
        scopeCtx.fillRect(0, 0, sw, sh);

        scopeCtx.strokeStyle = 'rgba(255,255,255,0.06)';
        scopeCtx.lineWidth = 1;
        scopeCtx.beginPath();
        scopeCtx.moveTo(0, mid);
        scopeCtx.lineTo(sw, mid);
        scopeCtx.stroke();

        let hasLive = false;
        if (samples) {
          for (let i = 0; i < samples.length; i += 4) {
            if (Math.abs(samples[i]) > 0.004) { hasLive = true; break; }
          }
        }

        scopeCtx.strokeStyle = accent;
        scopeCtx.lineWidth = hasLive ? 2.2 : 1.5;
        scopeCtx.globalAlpha = hasLive ? 1 : 0.48;
        scopeCtx.beginPath();
        if (hasLive) {
          for (let i = 0; i < samples.length; i++) {
            const x = (i / (samples.length - 1)) * sw;
            const y = mid - samples[i] * (mid * 0.85);
            if (i === 0) scopeCtx.moveTo(x, y); else scopeCtx.lineTo(x, y);
          }
        } else {
          const wf = inst.waveform;
          const dr = 1 + (inst.drive || 0.3) * 3.0;
          const smx = inst.subOctaveMix || 0.6;
          const scr = now * 0.0014;
          for (let i = 0; i < 120; i++) {
            const x = (i / 119) * sw;
            const p = (i / 119) * 3 + scr;
            const fr = p - Math.floor(p);
            let v = Math.sin(p * Math.PI * 2);
            if (wf === 'SAW') v = 2 * fr - 1;
            else if (wf === 'SQUARE') v = Math.sin(p * Math.PI * 2) >= 0 ? 0.85 : -0.85;
            else if (wf === 'TRIANGLE') v = 2 * Math.abs(2 * fr - 1) - 1;
            else if (wf === 'SUB_PULSE') v = (fr < 0.38 ? 0.8 : -0.8) * 0.6 + Math.sin(p * Math.PI * 2) * 0.4;
            else if (wf === 'FM_GROWL') v = Math.sin(p * Math.PI * 2 + Math.sin(p * Math.PI * 4) * (1.8 + inst.drive * 2.4));
            const y = mid - Math.tanh((v * (1 - smx * 0.35) + Math.sin(p * Math.PI) * smx * 0.55) * dr * 0.65) * (mid * 0.48);
            if (i === 0) scopeCtx.moveTo(x, y); else scopeCtx.lineTo(x, y);
          }
        }
        scopeCtx.stroke();
        scopeCtx.globalAlpha = 1;

        if (this.state.xyDragging || this.state.xyHold) {
          const rx = this.state.xyX * sw;
          const ry = (1 - this.state.xyY) * sh;
          scopeCtx.strokeStyle = 'rgba(245, 166, 35, 0.45)';
          scopeCtx.lineWidth = 1;
          scopeCtx.beginPath();
          scopeCtx.moveTo(rx, 0); scopeCtx.lineTo(rx, sh);
          scopeCtx.moveTo(0, ry); scopeCtx.lineTo(sw, ry);
          scopeCtx.stroke();
          scopeCtx.fillStyle = '#F5A623';
          scopeCtx.beginPath();
          scopeCtx.arc(rx, ry, 5, 0, Math.PI * 2);
          scopeCtx.fill();
        }
      }

      // 2. Per-Pad Hit Animations
      const style = inst.animationStyle || 'PLASMA_PULSE';
      for (let i = 0; i < 12; i++) {
        const fx = this.padFx[i];
        const cv = this.padCanvases[i];
        if (!cv || fx.energy <= 0.005) continue;
        fx.energy = Math.max(0, 1 - (now - fx.hitTime) / 400);
        const pctx = cv.getContext('2d');
        const pw = cv.width; const ph = cv.height;
        const cx = pw / 2; const cy = ph / 2;
        pctx.clearRect(0, 0, pw, ph);
        if (fx.energy <= 0.005) continue;
        const pr = 1 - fx.energy;
        pctx.save();
        pctx.strokeStyle = accent;
        pctx.fillStyle = accent;
        if (style === 'PLASMA_PULSE' || style === 'NEON_RIPPLE') {
          const rings = style === 'NEON_RIPPLE' ? 3 : 2;
          for (let r = 0; r < rings; r++) {
            const rp = Math.max(0, pr - r * 0.14);
            pctx.globalAlpha = fx.energy * (0.58 - r * 0.14);
            pctx.lineWidth = 2 - r * 0.4;
            pctx.beginPath();
            pctx.arc(cx, cy, 8 + rp * pw * 0.56, 0, Math.PI * 2);
            pctx.stroke();
          }
        } else if (style === 'LASER_GRID') {
          pctx.globalAlpha = fx.energy * 0.36;
          pctx.lineWidth = 1;
          for (let y = ph * 0.32; y < ph; y += 18 + pr * 10) {
            pctx.beginPath(); pctx.moveTo(0, y); pctx.lineTo(pw, y); pctx.stroke();
          }
          for (let x = -pw * 0.2; x <= pw * 1.2; x += 26) {
            pctx.beginPath(); pctx.moveTo(cx + (x - cx) * 0.25, ph * 0.32); pctx.lineTo(x, ph); pctx.stroke();
          }
        } else if (style === 'PARTICLE_BURST') {
          pctx.globalAlpha = fx.energy * 0.72;
          for (let k = 0; k < 10; k++) {
            const a = (k / 10) * Math.PI * 2 + 0.3;
            const d = 10 + pr * 60;
            pctx.beginPath();
            pctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 2.2 * fx.energy + 0.8, 0, Math.PI * 2);
            pctx.fill();
          }
        } else if (style === 'WAVE_TUNNEL') {
          for (let q = 0; q < 3; q++) {
            const sz = 16 + (pr + q * 0.25) * pw * 0.65;
            pctx.globalAlpha = fx.energy * 0.4;
            pctx.lineWidth = 1.4;
            pctx.strokeRect(cx - sz / 2, cy - sz / 2, sz, sz);
          }
        } else {
          pctx.globalAlpha = fx.energy * 0.52;
          pctx.lineWidth = 1.8;
          for (let a = 0; a < 3; a++) {
            const s = pr * 4 + (a * Math.PI * 2) / 3;
            pctx.beginPath();
            pctx.arc(cx, cy, 14 + pr * 44, s, s + 1.15);
            pctx.stroke();
          }
        }
        pctx.restore();
      }

      // 3. Fretless Glide Surface Render
      if (this.state.playSurface === 'glide') {
        const gw = this.dom.glideCanvas.width;
        const gh = this.dom.glideCanvas.height;
        glideCtx.fillStyle = '#090A0D';
        glideCtx.fillRect(0, 0, gw, gh);

        const notes = this.getActivePadNotes();
        glideCtx.font = '600 11px ui-monospace, monospace';
        for (let n = 0; n < 12; n++) {
          const y = gh - ((n + 0.5) / 12) * gh;
          const isSharp = notes[n].noteName.includes('#');
          glideCtx.strokeStyle = isSharp ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.11)';
          glideCtx.lineWidth = 1;
          glideCtx.beginPath();
          glideCtx.moveTo(0, y);
          glideCtx.lineTo(gw, y);
          glideCtx.stroke();
          glideCtx.fillStyle = isSharp ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.55)';
          glideCtx.fillText(notes[n].noteName, 12, y - 4);
        }

        if (this.state.glideActive) {
          const gx = this.state.glideX * gw;
          const gy = (1 - this.state.glideY) * gh;
          const grad = glideCtx.createRadialGradient(gx, gy, 4, gx, gy, 95);
          grad.addColorStop(0, accent);
          grad.addColorStop(1, 'transparent');
          glideCtx.globalAlpha = 0.28;
          glideCtx.fillStyle = grad;
          glideCtx.fillRect(0, 0, gw, gh);
          glideCtx.globalAlpha = 1;

          glideCtx.strokeStyle = accent;
          glideCtx.lineWidth = 1.5;
          glideCtx.beginPath();
          glideCtx.moveTo(0, gy); glideCtx.lineTo(gw, gy);
          glideCtx.moveTo(gx, 0); glideCtx.lineTo(gx, gh);
          glideCtx.stroke();

          glideCtx.fillStyle = '#fff';
          glideCtx.beginPath();
          glideCtx.arc(gx, gy, 8, 0, Math.PI * 2);
          glideCtx.fill();
        }
      }

      // 4. 2D Sonic DNA Sculptor Canvas (when Create sheet is open)
      if (this.state.openSheet === 'create') {
        const dw = this.dom.dnaCanvas.width;
        const dh = this.dom.dnaCanvas.height;
        const draft = this.state.creatorDraft;
        const px = this.state.dnaX * dw;
        const py = (1 - this.state.dnaY) * dh;
        const col = draft.accentColorHex || '#F24C27';

        dnaCtx.fillStyle = '#08090C';
        dnaCtx.fillRect(0, 0, dw, dh);

        // Subtle quadrant hairlines
        dnaCtx.strokeStyle = 'rgba(255,255,255,0.06)';
        dnaCtx.lineWidth = 1;
        dnaCtx.beginPath();
        dnaCtx.moveTo(dw / 2, 0); dnaCtx.lineTo(dw / 2, dh);
        dnaCtx.moveTo(0, dh / 2); dnaCtx.lineTo(dw, dh / 2);
        dnaCtx.stroke();

        // Live cymatics rings orbiting the puck
        const rings = 4 + Math.round(draft.resonance * 4);
        const petals = 3 + Math.round(draft.drive * 7);
        dnaCtx.save();
        dnaCtx.strokeStyle = col;
        for (let r = 1; r <= rings; r++) {
          const radBase = r * 14;
          dnaCtx.globalAlpha = 0.14 + (1 - r / (rings + 1)) * 0.45;
          dnaCtx.lineWidth = r === 1 ? 1.8 : 1.1;
          dnaCtx.beginPath();
          for (let s = 0; s <= 72; s++) {
            const a = (s / 72) * Math.PI * 2 + now * 0.0005 * (draft.lfoRateHz * 0.35);
            const mod = Math.sin(a * petals) * (draft.drive * 7 + 1.5);
            const rx = px + Math.cos(a) * (radBase + mod);
            const ry = py + Math.sin(a) * (radBase + mod);
            if (s === 0) dnaCtx.moveTo(rx, ry); else dnaCtx.lineTo(rx, ry);
          }
          dnaCtx.closePath();
          dnaCtx.stroke();
        }
        dnaCtx.globalAlpha = 1;
        dnaCtx.fillStyle = col;
        dnaCtx.beginPath();
        dnaCtx.arc(px, py, 7, 0, Math.PI * 2);
        dnaCtx.fill();
        dnaCtx.strokeStyle = '#fff';
        dnaCtx.lineWidth = 2;
        dnaCtx.stroke();
        dnaCtx.restore();
      }

      requestAnimationFrame(draw);
    };

    requestAnimationFrame(draw);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.subforgeMobile = new SubForgeMobileStudio();
});
