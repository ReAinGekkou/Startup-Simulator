import {
  AudioSettings,
  loadAudioSettings,
  saveAudioSettings,
} from './audioSettings.ts';

export type BgmScene = 'MENU' | 'OFFICE' | 'EVENT';

export interface BgmAssetConfig {
  url?: string;
  gainTrim: number;
}

/**
 * Optional asset manifest for licensed/public-domain audio files (e.g. /audio/office.ogg).
 * When no external file URL is configured or loading fails, AudioManager falls back
 * smoothly to the procedural cozy lo-fi felt-piano synthesizer without console errors.
 */
export const BGM_TRACK_ASSETS: Record<BgmScene, BgmAssetConfig> = {
  MENU: { gainTrim: 0.78 },
  OFFICE: { gainTrim: 0.85 },
  EVENT: { gainTrim: 0.75 },
};

interface ChordStep {
  bass: number;
  chords: number[];
  melodyA: Array<number | null>; // 8 eighth-notes per bar (phrase A)
  melodyB: Array<number | null>; // 8 eighth-notes per bar (phrase B)
}

// MIDI note to Hz helper
function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Warm major-7 / add9 progressions for cozy indie simulation feel (no jarring dissonance)
const SCENE_PROGRESSIONS: Record<BgmScene, { stepMs: number; bars: ChordStep[] }> = {
  MENU: {
    stepMs: 440, // ~68 BPM eighth-note grid
    bars: [
      {
        // Fmaj9
        bass: 41,
        chords: [53, 57, 60, 64, 67],
        melodyA: [72, null, 74, null, 76, null, 72, null],
        melodyB: [76, null, 74, null, 72, null, 69, null],
      },
      {
        // G6/B -> G6
        bass: 43,
        chords: [55, 59, 62, 64, 67],
        melodyA: [74, null, 76, null, 79, null, null, null],
        melodyB: [74, null, 71, null, 74, null, 76, null],
      },
      {
        // Cmaj9
        bass: 36,
        chords: [52, 55, 59, 62, 64],
        melodyA: [76, null, 74, null, 72, null, 71, null],
        melodyB: [79, null, 76, null, 74, null, 72, null],
      },
      {
        // Am9
        bass: 45,
        chords: [52, 55, 57, 60, 64],
        melodyA: [72, null, 69, null, 71, null, 72, null],
        melodyB: [72, null, null, 74, 72, null, 67, null],
      },
    ],
  },
  OFFICE: {
    stepMs: 395, // ~76 BPM relaxed lo-fi groove
    bars: [
      {
        // Dm9
        bass: 38,
        chords: [53, 57, 60, 64],
        melodyA: [69, null, 72, 74, null, 72, 69, null],
        melodyB: [74, null, 72, null, 69, 67, 69, null],
      },
      {
        // G13
        bass: 43,
        chords: [53, 55, 59, 64],
        melodyA: [71, null, 74, null, 76, null, 74, null],
        melodyB: [76, null, 74, 71, null, 69, 67, null],
      },
      {
        // Cmaj9
        bass: 36,
        chords: [52, 55, 59, 62],
        melodyA: [72, null, null, 76, 74, null, 72, null],
        melodyB: [79, null, 76, null, 74, null, 72, null],
      },
      {
        // A7sus4 -> Am9
        bass: 45,
        chords: [52, 55, 60, 62],
        melodyA: [72, null, 69, null, 67, null, 69, null],
        melodyB: [72, null, 74, null, 76, null, null, null],
      },
      {
        // Fmaj7
        bass: 41,
        chords: [53, 57, 60, 64],
        melodyA: [76, null, 74, null, 72, null, 69, null],
        melodyB: [72, null, 76, null, 77, null, 76, null],
      },
      {
        // Fm6 (warm lo-fi borrowing)
        bass: 41,
        chords: [53, 56, 60, 62],
        melodyA: [74, null, 72, null, 68, null, 67, null],
        melodyB: [74, null, null, 72, 69, null, 67, null],
      },
      {
        // Em7
        bass: 40,
        chords: [52, 55, 59, 62],
        melodyA: [71, null, 72, null, 74, null, 71, null],
        melodyB: [74, null, 76, null, 72, null, 71, null],
      },
      {
        // G6sus4 (turnaround)
        bass: 43,
        chords: [55, 60, 62, 64],
        melodyA: [69, null, 72, null, 74, null, null, null],
        melodyB: [72, null, 71, null, 69, null, 67, null],
      },
    ],
  },
  EVENT: {
    stepMs: 420, // ~71 BPM gentle reflective chime atmosphere
    bars: [
      {
        // Cmaj9
        bass: 36,
        chords: [55, 59, 62, 64],
        melodyA: [76, null, null, 79, null, 76, null, 74],
        melodyB: [72, null, 76, null, 79, null, null, null],
      },
      {
        // Fmaj7#11 -> Fmaj7
        bass: 41,
        chords: [57, 60, 64, 67],
        melodyA: [72, null, 74, null, 76, null, 72, null],
        melodyB: [77, null, 76, null, 74, null, 72, null],
      },
      {
        // Am9
        bass: 45,
        chords: [55, 60, 64, 67],
        melodyA: [76, null, 72, null, 69, null, 72, null],
        melodyB: [74, null, 72, null, 71, null, 69, null],
      },
      {
        // G6
        bass: 43,
        chords: [55, 59, 62, 64],
        melodyA: [74, null, 71, null, 67, null, null, null],
        melodyB: [71, null, 72, null, 74, null, null, null],
      },
    ],
  },
};

export const AUDIO_FADE_DURATIONS = {
  masterVolumeChange: 0.5,
  masterMuteFade: 0.5,
  bgmStart: 0.5,
  bgmVolumeChange: 0.5,
  bgmMuteFade: 0.5,
  bgmPauseStop: 0.5,
  bgmSceneOut: 0.25,
  bgmSceneIn: 0.25,
  sfxVolumeChange: 0.5,
  sfxMuteFade: 0.5,
} as const;

export interface LinearRampState {
  startTime: number;
  startValue: number;
  endTime: number;
  targetValue: number;
}

export function evaluateLinearRamp(state: LinearRampState, now: number): number {
  if (now <= state.startTime || state.endTime <= state.startTime) {
    return state.targetValue;
  }
  if (now >= state.endTime) {
    return state.targetValue;
  }
  const t = (now - state.startTime) / (state.endTime - state.startTime);
  return state.startValue + (state.targetValue - state.startValue) * t;
}

/**
 * Interrupts any in-flight gain automation without snapping and smoothly linearly
 * interpolates from the current gain to `target` over `durationSec` (default 500ms).
 * Returns the updated LinearRampState so callers can accurately track mid-flight values.
 */
export function scheduleSmoothGainRamp(
  param: AudioParam,
  target: number,
  now: number,
  durationSec: number = AUDIO_FADE_DURATIONS.bgmVolumeChange,
  prevRamp?: LinearRampState | null
): LinearRampState {
  const safeTarget = Math.max(0, Number.isFinite(target) ? target : 0);
  const currentValue = prevRamp ? evaluateLinearRamp(prevRamp, now) : param.value;

  const paramWithHold = param as AudioParam & {
    cancelAndHoldAtTime?: (cancelTime: number) => AudioParam;
  };
  if (typeof paramWithHold.cancelAndHoldAtTime === 'function') {
    paramWithHold.cancelAndHoldAtTime(now);
  } else {
    param.cancelScheduledValues(now);
    param.setValueAtTime(currentValue, now);
  }

  if (durationSec <= 0.002) {
    param.setValueAtTime(safeTarget, now);
    return {
      startTime: now,
      startValue: safeTarget,
      endTime: now,
      targetValue: safeTarget,
    };
  }

  const endTime = now + durationSec;
  param.linearRampToValueAtTime(safeTarget, endTime);
  return {
    startTime: now,
    startValue: currentValue,
    endTime,
    targetValue: safeTarget,
  };
}

export class AudioManager {
  private settings: AudioSettings = loadAudioSettings();
  private listeners = new Set<() => void>();

  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmBusGain: GainNode | null = null;
  private bgmWarmFilter: BiquadFilterNode | null = null;
  private sfxBusGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private activeScene: BgmScene = 'MENU';
  private desiredPlaying = false;
  private isPaused = false;
  private unlocked = false;
  private stepTimer: ReturnType<typeof setInterval> | null = null;
  private stepIndex = 0;

  private externalElement: HTMLAudioElement | null = null;
  private externalSource: MediaElementAudioSourceNode | null = null;
  private externalTrackScene: BgmScene | null = null;
  private usingExternalTrack = false;

  private masterRampState: LinearRampState | null = null;
  private bgmRampState: LinearRampState | null = null;
  private sfxRampState: LinearRampState | null = null;

  private externalFadeTimer: ReturnType<typeof setTimeout> | null = null;
  private sceneTransitionTimer: ReturnType<typeof setTimeout> | null = null;
  private gestureCleanup: (() => void) | null = null;

  constructor() {
    this.installAutoplayUnlockHooks();
  }

  private installAutoplayUnlockHooks(): void {
    if (typeof window === 'undefined' || this.gestureCleanup) return;

    const onGesture = () => {
      this.unlockFromUserGesture();
    };
    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchstart'];
    for (const ev of events) {
      window.addEventListener(ev, onGesture, { passive: true, capture: true });
    }

    this.gestureCleanup = () => {
      for (const ev of events) {
        window.removeEventListener(ev, onGesture, { capture: true });
      }
      this.gestureCleanup = null;
    };
  }

  private removeAutoplayUnlockHooks(): void {
    this.gestureCleanup?.();
  }

  private clearFadeTimers(): void {
    if (this.externalFadeTimer !== null) {
      clearTimeout(this.externalFadeTimer);
      this.externalFadeTimer = null;
    }
    if (this.sceneTransitionTimer !== null) {
      clearTimeout(this.sceneTransitionTimer);
      this.sceneTransitionTimer = null;
    }
  }

  private emit(): void {
    this.listeners.forEach((fn) => fn());
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSettings(): AudioSettings {
    return { ...this.settings };
  }

  getActiveScene(): BgmScene {
    return this.activeScene;
  }

  isBgmActive(): boolean {
    return (
      this.desiredPlaying &&
      !this.isPaused &&
      this.unlocked &&
      !this.settings.masterMuted &&
      !this.settings.bgmMuted
    );
  }

  private ensureGraph(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      if (!this.ctx) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return null;

        const ctx = new AudioCtx();
        const master = ctx.createGain();
        master.gain.value = 1;
        master.connect(ctx.destination);

        const bgmBus = ctx.createGain();
        const bgmComp = ctx.createDynamicsCompressor();
        bgmComp.threshold.value = -18;
        bgmComp.knee.value = 18;
        bgmComp.ratio.value = 3;
        bgmComp.attack.value = 0.02;
        bgmComp.release.value = 0.25;

        const warmFilter = ctx.createBiquadFilter();
        warmFilter.type = 'lowpass';
        warmFilter.frequency.value = 2400;
        warmFilter.Q.value = 0.65;

        warmFilter.connect(bgmComp);
        bgmComp.connect(bgmBus);
        bgmBus.connect(master);

        const sfxBus = ctx.createGain();
        sfxBus.connect(master);

        this.ctx = ctx;
        this.masterGain = master;
        this.bgmWarmFilter = warmFilter;
        this.bgmBusGain = bgmBus;
        this.sfxBusGain = sfxBus;

        // Start BGM bus at 0 so playback fades in smoothly instead of popping;
        // initialize Master and SFX buses cleanly to configured effective gains.
        const initMaster = this.computeEffectiveMasterGain();
        const initBgm = 0;
        const initSfx = this.computeEffectiveSfxGain();
        master.gain.setValueAtTime(initMaster, ctx.currentTime);
        bgmBus.gain.setValueAtTime(initBgm, ctx.currentTime);
        sfxBus.gain.setValueAtTime(initSfx, ctx.currentTime);
        this.masterRampState = {
          startTime: ctx.currentTime,
          startValue: initMaster,
          endTime: ctx.currentTime,
          targetValue: initMaster,
        };
        this.bgmRampState = {
          startTime: ctx.currentTime,
          startValue: initBgm,
          endTime: ctx.currentTime,
          targetValue: initBgm,
        };
        this.sfxRampState = {
          startTime: ctx.currentTime,
          startValue: initSfx,
          endTime: ctx.currentTime,
          targetValue: initSfx,
        };

        this.buildSoftNoiseBuffer(ctx);
      }

      return this.ctx;
    } catch {
      return null;
    }
  }

  private buildSoftNoiseBuffer(ctx: AudioContext): void {
    try {
      const length = Math.floor(ctx.sampleRate * 0.2);
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.997 * b0 + white * 0.029;
        b1 = 0.985 * b1 + white * 0.032;
        b2 = 0.95 * b2 + white * 0.048;
        data[i] = (b0 + b1 + b2 + white * 0.08) * 0.25;
      }
      this.noiseBuffer = buffer;
    } catch {
      this.noiseBuffer = null;
    }
  }

  private computeEffectiveMasterGain(): number {
    if (this.settings.masterMuted) return 0;
    return Math.pow(this.settings.masterVolume, 1.35);
  }

  private computeEffectiveBgmGain(): number {
    if (this.settings.bgmMuted || !this.desiredPlaying || this.isPaused) return 0;
    const trim = BGM_TRACK_ASSETS[this.activeScene]?.gainTrim ?? 0.85;
    // Perceptual curve feels natural across volume slider steps
    return Math.pow(this.settings.bgmVolume, 1.5) * 0.42 * trim;
  }

  private computeEffectiveSfxGain(): number {
    if (this.settings.sfxMuted) return 0;
    return Math.pow(this.settings.sfxVolume, 1.35) * 1.1;
  }

  private fadeMasterGainTo(targetGain: number, durationSec: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.masterGain) return;
    this.masterRampState = scheduleSmoothGainRamp(
      this.masterGain.gain,
      targetGain,
      ctx.currentTime,
      durationSec,
      this.masterRampState
    );
  }

  private fadeBgmGainTo(targetGain: number, durationSec: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.bgmBusGain) return;
    this.bgmRampState = scheduleSmoothGainRamp(
      this.bgmBusGain.gain,
      targetGain,
      ctx.currentTime,
      durationSec,
      this.bgmRampState
    );
  }

  private fadeSfxGainTo(targetGain: number, durationSec: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBusGain) return;
    this.sfxRampState = scheduleSmoothGainRamp(
      this.sfxBusGain.gain,
      targetGain,
      ctx.currentTime,
      durationSec,
      this.sfxRampState
    );
  }

  private applyBusGainsSmooth(
    bgmFadeSec: number = AUDIO_FADE_DURATIONS.bgmVolumeChange,
    sfxFadeSec: number = AUDIO_FADE_DURATIONS.sfxVolumeChange
  ): void {
    this.fadeMasterGainTo(this.computeEffectiveMasterGain(), AUDIO_FADE_DURATIONS.masterVolumeChange);
    this.fadeBgmGainTo(this.computeEffectiveBgmGain(), bgmFadeSec);
    this.fadeSfxGainTo(this.computeEffectiveSfxGain(), sfxFadeSec);
  }

  unlockFromUserGesture(): void {
    if (this.unlocked && this.ctx?.state === 'running') {
      this.removeAutoplayUnlockHooks();
      return;
    }
    const ctx = this.ensureGraph();
    if (!ctx) return;

    const finalizeUnlock = () => {
      if (ctx.state === 'running') {
        this.unlocked = true;
        this.removeAutoplayUnlockHooks();
        if (this.desiredPlaying && !this.isPaused) {
          this.startPlaybackLoop();
          this.fadeBgmGainTo(this.computeEffectiveBgmGain(), AUDIO_FADE_DURATIONS.bgmStart);
        }
        this.emit();
      }
    };

    if (ctx.state === 'suspended') {
      ctx
        .resume()
        .then(finalizeUnlock)
        .catch(() => {
          // Autoplay still gated; wait quietly for next valid gesture
        });
    } else {
      finalizeUnlock();
    }
  }

  /**
   * Returns an active AudioContext & SFX output node for soundService.ts.
   * Respects sfxMuted and browser autoplay restrictions cleanly.
   */
  getSfxContextAndBus(): { ctx: AudioContext; destination: AudioNode } | null {
    if (this.settings.masterMuted || this.settings.sfxMuted) return null;
    const ctx = this.ensureGraph();
    if (!ctx || !this.sfxBusGain) return null;
    if (ctx.state === 'suspended') {
      void ctx
        .resume()
        .then(() => {
          if (ctx.state === 'running') {
            this.unlocked = true;
            this.removeAutoplayUnlockHooks();
          }
        })
        .catch(() => undefined);
    }
    return { ctx, destination: this.sfxBusGain };
  }

  setMasterVolume(volume: number): void {
    const clamped = Math.round(Math.max(0, Math.min(1, volume)) * 100) / 100;
    this.settings = { ...this.settings, masterVolume: clamped };
    saveAudioSettings(this.settings);
    this.fadeMasterGainTo(
      this.computeEffectiveMasterGain(),
      AUDIO_FADE_DURATIONS.masterVolumeChange
    );
    this.emit();
  }

  setMasterMuted(muted: boolean): void {
    this.settings = { ...this.settings, masterMuted: muted };
    saveAudioSettings(this.settings);
    if (!muted && !this.settings.bgmMuted && this.desiredPlaying && !this.isPaused && this.unlocked) {
      this.startPlaybackLoop();
    }
    this.fadeMasterGainTo(this.computeEffectiveMasterGain(), AUDIO_FADE_DURATIONS.masterMuteFade);
    this.emit();
  }

  toggleMasterMute(): boolean {
    const nextMuted = !this.settings.masterMuted;
    this.setMasterMuted(nextMuted);
    return nextMuted;
  }

  setBgmVolume(volume: number): void {
    const clamped = Math.round(Math.max(0, Math.min(1, volume)) * 100) / 100;
    this.settings = { ...this.settings, bgmVolume: clamped };
    saveAudioSettings(this.settings);
    this.fadeBgmGainTo(this.computeEffectiveBgmGain(), AUDIO_FADE_DURATIONS.bgmVolumeChange);
    this.emit();
  }

  setSfxVolume(volume: number): void {
    const clamped = Math.round(Math.max(0, Math.min(1, volume)) * 100) / 100;
    this.settings = { ...this.settings, sfxVolume: clamped };
    saveAudioSettings(this.settings);
    this.fadeSfxGainTo(this.computeEffectiveSfxGain(), AUDIO_FADE_DURATIONS.sfxVolumeChange);
    this.emit();
  }

  setBgmMuted(muted: boolean): void {
    this.settings = { ...this.settings, bgmMuted: muted };
    saveAudioSettings(this.settings);
    if (!muted && this.desiredPlaying && !this.isPaused && this.unlocked) {
      this.startPlaybackLoop();
    }
    this.fadeBgmGainTo(this.computeEffectiveBgmGain(), AUDIO_FADE_DURATIONS.bgmMuteFade);
    this.emit();
  }

  setSfxMuted(muted: boolean): void {
    this.settings = { ...this.settings, sfxMuted: muted };
    saveAudioSettings(this.settings);
    this.fadeSfxGainTo(this.computeEffectiveSfxGain(), AUDIO_FADE_DURATIONS.sfxMuteFade);
    this.emit();
  }

  playBgm(scene: BgmScene = this.activeScene): void {
    const sceneChanged = scene !== this.activeScene;
    if (
      this.desiredPlaying &&
      !this.isPaused &&
      !sceneChanged &&
      (this.stepTimer || this.usingExternalTrack)
    ) {
      return;
    }

    this.clearFadeTimers();
    const wasActivelyPlaying =
      this.desiredPlaying && !this.isPaused && this.unlocked && this.ctx?.state === 'running';

    this.activeScene = scene;
    this.desiredPlaying = true;
    this.isPaused = false;

    if (sceneChanged) {
      this.stepIndex = 0;
    }

    if (this.unlocked && this.ctx?.state === 'running') {
      if (sceneChanged && wasActivelyPlaying && !this.settings.bgmMuted) {
        // Gentle fade-out -> switch track -> smooth fade-in on scene transitions
        this.fadeBgmGainTo(0, AUDIO_FADE_DURATIONS.bgmSceneOut);
        this.sceneTransitionTimer = setTimeout(() => {
          this.sceneTransitionTimer = null;
          if (!this.desiredPlaying || this.isPaused) return;
          this.startPlaybackLoop();
          this.fadeBgmGainTo(this.computeEffectiveBgmGain(), AUDIO_FADE_DURATIONS.bgmSceneIn);
        }, Math.round(AUDIO_FADE_DURATIONS.bgmSceneOut * 1000));
      } else {
        this.startPlaybackLoop();
        this.fadeBgmGainTo(this.computeEffectiveBgmGain(), AUDIO_FADE_DURATIONS.bgmStart);
      }
    } else {
      // Wait gracefully for first user gesture without creating duplicate contexts
      this.installAutoplayUnlockHooks();
    }
    this.emit();
  }

  setScene(scene: BgmScene): void {
    if (scene === this.activeScene && this.desiredPlaying) return;
    this.playBgm(scene);
  }

  pauseBgm(): void {
    if (!this.desiredPlaying || this.isPaused) return;
    this.clearFadeTimers();
    this.isPaused = true;
    this.stopProceduralScheduler();

    if (this.ctx && this.bgmBusGain) {
      this.fadeBgmGainTo(0, AUDIO_FADE_DURATIONS.bgmPauseStop);
      if (this.externalElement && !this.externalElement.paused) {
        const el = this.externalElement;
        this.externalFadeTimer = setTimeout(() => {
          this.externalFadeTimer = null;
          if (this.isPaused && !el.paused) {
            el.pause();
          }
        }, Math.round(AUDIO_FADE_DURATIONS.bgmPauseStop * 1000));
      }
    } else if (this.externalElement && !this.externalElement.paused) {
      this.externalElement.pause();
    }

    this.emit();
  }

  resumeBgm(): void {
    if (!this.desiredPlaying || !this.isPaused) return;
    this.clearFadeTimers();
    this.isPaused = false;
    if (this.unlocked) {
      this.startPlaybackLoop();
      this.fadeBgmGainTo(this.computeEffectiveBgmGain(), AUDIO_FADE_DURATIONS.bgmPauseStop);
    }
    this.emit();
  }

  stopBgm(): void {
    this.clearFadeTimers();
    this.desiredPlaying = false;
    this.isPaused = false;
    this.stepIndex = 0;
    this.stopProceduralScheduler();

    if (this.ctx && this.bgmBusGain && this.usingExternalTrack) {
      this.fadeBgmGainTo(0, AUDIO_FADE_DURATIONS.bgmPauseStop);
      this.externalFadeTimer = setTimeout(() => {
        this.externalFadeTimer = null;
        if (!this.desiredPlaying) {
          this.teardownExternalTrack();
        }
      }, Math.round(AUDIO_FADE_DURATIONS.bgmPauseStop * 1000));
    } else {
      this.applyBusGainsSmooth(
        AUDIO_FADE_DURATIONS.bgmPauseStop,
        AUDIO_FADE_DURATIONS.sfxMuteFade
      );
      this.teardownExternalTrack();
    }
    this.emit();
  }

  private stopProceduralScheduler(): void {
    if (this.stepTimer !== null) {
      clearInterval(this.stepTimer);
      this.stepTimer = null;
    }
  }

  private teardownExternalTrack(): void {
    if (this.externalElement) {
      try {
        this.externalElement.pause();
        this.externalElement.src = '';
      } catch {
        // ignore cleanup errors
      }
      this.externalElement = null;
    }
    if (this.externalSource) {
      try {
        this.externalSource.disconnect();
      } catch {
        // ignore
      }
      this.externalSource = null;
    }
    this.externalTrackScene = null;
    this.usingExternalTrack = false;
  }

  private startPlaybackLoop(): void {
    if (!this.ctx || !this.bgmWarmFilter) return;

    const asset = BGM_TRACK_ASSETS[this.activeScene];
    if (asset?.url) {
      if (
        this.usingExternalTrack &&
        this.externalTrackScene === this.activeScene &&
        this.externalElement
      ) {
        if (this.externalElement.paused) {
          void this.externalElement.play().catch(() => {
            this.teardownExternalTrack();
            this.startProceduralScheduler();
          });
        }
        return;
      }

      this.stopProceduralScheduler();
      this.teardownExternalTrack();
      try {
        const audio = new Audio(asset.url);
        audio.loop = true;
        audio.crossOrigin = 'anonymous';
        const src = this.ctx.createMediaElementSource(audio);
        src.connect(this.bgmWarmFilter);
        this.externalElement = audio;
        this.externalSource = src;
        this.externalTrackScene = this.activeScene;
        this.usingExternalTrack = true;

        audio.addEventListener('error', () => {
          this.teardownExternalTrack();
          if (this.desiredPlaying && !this.isPaused) {
            this.startProceduralScheduler();
          }
        });

        void audio.play().catch(() => {
          this.teardownExternalTrack();
          if (this.desiredPlaying && !this.isPaused) {
            this.startProceduralScheduler();
          }
        });
        return;
      } catch {
        this.teardownExternalTrack();
      }
    }

    // Procedural cozy lo-fi fallback (guaranteed single active scheduler)
    this.startProceduralScheduler();
  }

  private startProceduralScheduler(): void {
    this.stopProceduralScheduler();
    const prog = SCENE_PROGRESSIONS[this.activeScene];
    if (!prog) return;

    // Trigger initial step cleanly, then tick at steady musical tempo
    this.scheduleMusicalStep();
    this.stepTimer = setInterval(() => {
      if (!this.desiredPlaying || this.isPaused || !this.unlocked) return;
      this.scheduleMusicalStep();
    }, prog.stepMs);
  }

  private scheduleMusicalStep(): void {
    const ctx = this.ctx;
    const bus = this.bgmWarmFilter;
    if (!ctx || !bus || ctx.state !== 'running' || this.settings.bgmMuted) return;

    const prog = SCENE_PROGRESSIONS[this.activeScene];
    const totalBars = prog.bars.length;
    const stepInBar = this.stepIndex % 8;
    const barNumber = Math.floor(this.stepIndex / 8);
    const barIdx = barNumber % totalBars;
    const isPhraseB = Math.floor(barNumber / totalBars) % 2 === 1;
    const bar = prog.bars[barIdx];

    // Gentle human swing on odd eighth-notes (~18ms)
    const swingOffset = stepInBar % 2 === 1 ? 0.018 : 0;
    const t = ctx.currentTime + 0.03 + swingOffset;

    // Bar downbeat: warm felt chord + soft bass foundation
    if (stepInBar === 0) {
      this.playWarmBass(ctx, bus, midiToFreq(bar.bass), t, (prog.stepMs * 6.5) / 1000, 0.24);
      bar.chords.forEach((midi, idx) => {
        // Gentle harp/piano roll stagger (~18ms per voice)
        this.playFeltChordTone(
          ctx,
          bus,
          midiToFreq(midi),
          t + idx * 0.022,
          (prog.stepMs * 7.2) / 1000,
          0.075
        );
      });
    }

    // Soft mid-bar chord re-bloom on beat 3 (step 4)
    if (stepInBar === 4) {
      const upperVoice = bar.chords[bar.chords.length - 1];
      const innerVoice = bar.chords[Math.max(0, bar.chords.length - 2)];
      this.playFeltChordTone(ctx, bus, midiToFreq(innerVoice), t, (prog.stepMs * 3.5) / 1000, 0.042);
      this.playFeltChordTone(ctx, bus, midiToFreq(upperVoice), t + 0.02, (prog.stepMs * 3.5) / 1000, 0.045);
    }

    // Subtle lo-fi brush texture in OFFICE groove (light kick/shaker feel)
    if (this.activeScene === 'OFFICE') {
      if (stepInBar === 0 || stepInBar === 5) {
        this.playSoftPulseKick(ctx, bus, t, 0.09);
      }
      if (stepInBar === 2 || stepInBar === 6) {
        this.playBrushedShaker(ctx, bus, t, 0.022);
      } else if (stepInBar % 2 === 1) {
        this.playBrushedShaker(ctx, bus, t, 0.008);
      }
    }

    // Gentle melody voice
    const melodyLine = isPhraseB ? bar.melodyB : bar.melodyA;
    const note = melodyLine[stepInBar];
    if (note !== null) {
      this.playCozyMelodyNote(ctx, bus, midiToFreq(note), t, (prog.stepMs * 2.4) / 1000, 0.085);
    }

    this.stepIndex = (this.stepIndex + 1) % (totalBars * 16);
  }

  private playWarmBass(
    ctx: AudioContext,
    dest: AudioNode,
    freq: number,
    startTime: number,
    duration: number,
    peak: number
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peak, startTime + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.04);
  }

  private playFeltChordTone(
    ctx: AudioContext,
    dest: AudioNode,
    freq: number,
    startTime: number,
    duration: number,
    peak: number
  ): void {
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const lpf = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, startTime);
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 1.0015, startTime);

    lpf.type = 'lowpass';
    lpf.frequency.setValueAtTime(1150, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peak, startTime + 0.055);
    gain.gain.exponentialRampToValueAtTime(peak * 0.45, startTime + duration * 0.45);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc1.connect(lpf);
    osc2.connect(lpf);
    lpf.connect(gain);
    gain.connect(dest);

    osc1.start(startTime);
    osc2.start(startTime);
    osc1.stop(startTime + duration + 0.04);
    osc2.stop(startTime + duration + 0.04);
  }

  private playCozyMelodyNote(
    ctx: AudioContext,
    dest: AudioNode,
    freq: number,
    startTime: number,
    duration: number,
    peak: number
  ): void {
    const fundamental = ctx.createOscillator();
    const harmonic = ctx.createOscillator();
    const harmGain = ctx.createGain();
    const env = ctx.createGain();

    fundamental.type = 'sine';
    fundamental.frequency.setValueAtTime(freq, startTime);

    harmonic.type = 'triangle';
    harmonic.frequency.setValueAtTime(freq * 2, startTime);
    harmGain.gain.setValueAtTime(0.16, startTime);

    env.gain.setValueAtTime(0.0001, startTime);
    env.gain.linearRampToValueAtTime(peak, startTime + 0.025);
    env.gain.exponentialRampToValueAtTime(peak * 0.35, startTime + duration * 0.35);
    env.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    fundamental.connect(env);
    harmonic.connect(harmGain);
    harmGain.connect(env);
    env.connect(dest);

    fundamental.start(startTime);
    harmonic.start(startTime);
    fundamental.stop(startTime + duration + 0.04);
    harmonic.stop(startTime + duration + 0.04);
  }

  private playSoftPulseKick(
    ctx: AudioContext,
    dest: AudioNode,
    startTime: number,
    peak: number
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(98, startTime);
    osc.frequency.exponentialRampToValueAtTime(46, startTime + 0.09);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peak, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.14);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(startTime);
    osc.stop(startTime + 0.16);
  }

  private playBrushedShaker(
    ctx: AudioContext,
    dest: AudioNode,
    startTime: number,
    peak: number
  ): void {
    if (!this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const bpf = ctx.createBiquadFilter();
    bpf.type = 'bandpass';
    bpf.frequency.setValueAtTime(2800, startTime);
    bpf.Q.setValueAtTime(1.4, startTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peak, startTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.08);

    src.connect(bpf);
    bpf.connect(gain);
    gain.connect(dest);
    src.start(startTime);
    src.stop(startTime + 0.1);
  }

  destroy(): void {
    this.stopBgm();
    this.clearFadeTimers();
    this.teardownExternalTrack();
    this.removeAutoplayUnlockHooks();
    if (this.ctx) {
      try {
        void this.ctx.close();
      } catch {
        // ignore close errors
      }
      this.ctx = null;
    }
    this.masterGain = null;
    this.bgmBusGain = null;
    this.bgmWarmFilter = null;
    this.sfxBusGain = null;
    this.unlocked = false;
  }
}

export const audioManager = new AudioManager();
