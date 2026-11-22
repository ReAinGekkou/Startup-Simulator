import { audioManager } from '@/src/audio/audioManager';

export type SoundEffect =
  | 'CLICK'
  | 'CASH'
  | 'SUCCESS'
  | 'ERROR'
  | 'ALERT'
  | 'LEVEL_UP'
  | 'MILESTONE_CHIME'
  | 'TEST_CHIME';

export interface ChimeToneSpec {
  freq: number;
  startOffset: number;
  duration: number;
  type: OscillatorType;
  gainPeak: number;
  attackSec?: number;
}

/**
 * Gentle Cozy Pixel Art milestone chime (warm Cmaj9 celesta/bell arpeggio + soft harmonic shimmer).
 * Peak gains are intentionally modest (<= 0.05) so sound feedback feels warm rather than jarring.
 */
export const MILESTONE_CHIME_NOTES: readonly ChimeToneSpec[] = [
  { freq: 523.25, startOffset: 0.0, duration: 0.24, type: 'sine', gainPeak: 0.044, attackSec: 0.022 },
  { freq: 659.25, startOffset: 0.09, duration: 0.27, type: 'sine', gainPeak: 0.046, attackSec: 0.022 },
  { freq: 783.99, startOffset: 0.18, duration: 0.32, type: 'sine', gainPeak: 0.048, attackSec: 0.022 },
  { freq: 1174.66, startOffset: 0.28, duration: 0.44, type: 'sine', gainPeak: 0.042, attackSec: 0.024 },
  { freq: 1046.5, startOffset: 0.28, duration: 0.36, type: 'triangle', gainPeak: 0.015, attackSec: 0.024 },
];

export interface MilestoneAudioTriggerOptions {
  nowMs?: number;
  mergeWindowMs?: number;
  dedupeKey?: boolean;
}

export interface MilestoneAudioCoordinator {
  shouldTrigger: (
    triggerKey: string | undefined,
    nowMs: number,
    mergeWindowMs?: number,
    dedupeKey?: boolean
  ) => boolean;
  markTriggered: (triggerKey: string | undefined, nowMs: number, dedupeKey?: boolean) => void;
  reset: () => void;
}

export function createMilestoneAudioCoordinator(): MilestoneAudioCoordinator {
  const seenKeys = new Set<string>();
  let lastTriggeredAtMs = -Infinity;

  return {
    shouldTrigger(
      triggerKey: string | undefined,
      nowMs: number,
      mergeWindowMs = 1500,
      dedupeKey = true
    ): boolean {
      if (dedupeKey && triggerKey && seenKeys.has(triggerKey)) {
        return false;
      }
      if (triggerKey && dedupeKey) {
        seenKeys.add(triggerKey);
      }
      if (nowMs - lastTriggeredAtMs < mergeWindowMs) {
        return false;
      }
      lastTriggeredAtMs = nowMs;
      return true;
    },
    markTriggered(triggerKey: string | undefined, nowMs: number, dedupeKey = true): void {
      if (dedupeKey && triggerKey) {
        seenKeys.add(triggerKey);
      }
      lastTriggeredAtMs = nowMs;
    },
    reset(): void {
      seenKeys.clear();
      lastTriggeredAtMs = -Infinity;
    },
  };
}

function getNowMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

class SoundService {
  private milestoneCoordinator = createMilestoneAudioCoordinator();

  isMuted(): boolean {
    const s = audioManager.getSettings();
    return s.masterMuted || s.sfxMuted;
  }

  setMuted(value: boolean): void {
    audioManager.setSfxMuted(value);
  }

  toggleMute(): boolean {
    const next = !this.isMuted();
    this.setMuted(next);
    return next;
  }

  playTestSound(): boolean {
    audioManager.unlockFromUserGesture();
    if (this.isMuted()) {
      return false;
    }
    this.play('TEST_CHIME');
    return true;
  }

  resetMilestoneChimeHistory(): void {
    this.milestoneCoordinator.reset();
  }

  /**
   * Plays the gentle milestone chime cue when unmuted and not suppressed by
   * key deduplication or the 1500ms simultaneous celebration merge window.
   */
  playMilestoneChime(
    triggerKey?: string,
    options: MilestoneAudioTriggerOptions = {}
  ): boolean {
    const {
      nowMs = getNowMs(),
      mergeWindowMs = 1500,
      dedupeKey = true,
    } = options;

    if (this.isMuted()) {
      return false;
    }

    const allowed = this.milestoneCoordinator.shouldTrigger(
      triggerKey,
      nowMs,
      mergeWindowMs,
      dedupeKey
    );
    if (!allowed) {
      return false;
    }

    this.scheduleEffect('MILESTONE_CHIME');
    return true;
  }

  play(effect: SoundEffect): void {
    if (effect === 'MILESTONE_CHIME') {
      if (this.isMuted()) return;
      this.milestoneCoordinator.markTriggered(undefined, getNowMs(), false);
    }
    this.scheduleEffect(effect);
  }

  private scheduleEffect(effect: SoundEffect): void {
    const bus = audioManager.getSfxContextAndBus();
    if (!bus) return;

    const { ctx, destination } = bus;

    const scheduleTones = () => {
      try {
        const now = ctx.currentTime;
        const playTone = (
          freq: number,
          startOffset: number,
          duration: number,
          type: OscillatorType = 'triangle',
          gainPeak = 0.06,
          attackSec = 0.015
        ) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = type;
          osc.frequency.setValueAtTime(freq, now + startOffset);
          gain.gain.setValueAtTime(0.0001, now + startOffset);
          gain.gain.exponentialRampToValueAtTime(gainPeak, now + startOffset + attackSec);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + duration);
          osc.connect(gain);
          gain.connect(destination);
          osc.start(now + startOffset);
          osc.stop(now + startOffset + duration + 0.02);
        };

        switch (effect) {
          case 'CLICK':
            playTone(540, 0, 0.05, 'triangle', 0.045);
            break;
          case 'CASH':
            playTone(740, 0, 0.08, 'sine', 0.06);
            playTone(988, 0.06, 0.14, 'sine', 0.065);
            break;
          case 'SUCCESS':
            playTone(523.25, 0, 0.08, 'triangle', 0.055);
            playTone(659.25, 0.07, 0.12, 'triangle', 0.06);
            break;
          case 'TEST_CHIME':
            // Warm cozy UI chime (E5 -> G5 -> B5) for verifying SFX volume and mute state
            playTone(659.25, 0, 0.09, 'sine', 0.055);
            playTone(783.99, 0.065, 0.11, 'sine', 0.06);
            playTone(987.77, 0.13, 0.16, 'triangle', 0.045);
            break;
          case 'MILESTONE_CHIME':
            for (const note of MILESTONE_CHIME_NOTES) {
              playTone(
                note.freq,
                note.startOffset,
                note.duration,
                note.type,
                note.gainPeak,
                note.attackSec ?? 0.02
              );
            }
            break;
          case 'ERROR':
            playTone(220, 0, 0.09, 'triangle', 0.05);
            playTone(170, 0.07, 0.12, 'triangle', 0.045);
            break;
          case 'ALERT':
            playTone(440, 0, 0.09, 'triangle', 0.045);
            playTone(587.33, 0.1, 0.12, 'triangle', 0.05);
            break;
          case 'LEVEL_UP':
            playTone(523.25, 0, 0.08, 'triangle', 0.055);
            playTone(659.25, 0.07, 0.08, 'triangle', 0.055);
            playTone(783.99, 0.14, 0.09, 'triangle', 0.06);
            playTone(1046.5, 0.22, 0.2, 'triangle', 0.065);
            break;
        }
      } catch {
        // Non-blocking audio failure
      }
    };

    if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
      void ctx
        .resume()
        .then(() => {
          scheduleTones();
        })
        .catch(() => undefined);
      return;
    }

    scheduleTones();
  }
}

export const soundService = new SoundService();
