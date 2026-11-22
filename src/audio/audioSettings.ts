import { clamp } from '@/src/utils/format';

export const AUDIO_SETTINGS_STORAGE_KEY = 'startup_founder_audio_v1';
const LEGACY_MUTE_KEY = 'startup_founder_muted_v1';

export interface AudioSettings {
  masterVolume: number; // 0..1 (default 1.00)
  bgmVolume: number; // 0..1 (default 0.70)
  sfxVolume: number; // 0..1 (default 0.80)
  masterMuted: boolean;
  bgmMuted: boolean;
  sfxMuted: boolean;
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  masterVolume: 1.0,
  bgmVolume: 0.7,
  sfxVolume: 0.8,
  masterMuted: false,
  bgmMuted: false,
  sfxMuted: false,
};

function normalizeUnitVolume(val: unknown, fallback: number): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) return fallback;
  return Math.round(clamp(val, 0, 1) * 100) / 100;
}

export function loadAudioSettings(): AudioSettings {
  try {
    if (typeof localStorage === 'undefined') {
      return { ...DEFAULT_AUDIO_SETTINGS };
    }
    const raw = localStorage.getItem(AUDIO_SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AudioSettings>;
      return {
        masterVolume: normalizeUnitVolume(
          parsed.masterVolume,
          DEFAULT_AUDIO_SETTINGS.masterVolume
        ),
        bgmVolume: normalizeUnitVolume(parsed.bgmVolume, DEFAULT_AUDIO_SETTINGS.bgmVolume),
        sfxVolume: normalizeUnitVolume(parsed.sfxVolume, DEFAULT_AUDIO_SETTINGS.sfxVolume),
        masterMuted:
          typeof parsed.masterMuted === 'boolean'
            ? parsed.masterMuted
            : DEFAULT_AUDIO_SETTINGS.masterMuted,
        bgmMuted:
          typeof parsed.bgmMuted === 'boolean'
            ? parsed.bgmMuted
            : DEFAULT_AUDIO_SETTINGS.bgmMuted,
        sfxMuted:
          typeof parsed.sfxMuted === 'boolean'
            ? parsed.sfxMuted
            : DEFAULT_AUDIO_SETTINGS.sfxMuted,
      };
    }

    const legacyMuted = localStorage.getItem(LEGACY_MUTE_KEY) === 'true';
    if (legacyMuted) {
      const migrated: AudioSettings = {
        ...DEFAULT_AUDIO_SETTINGS,
        bgmMuted: true,
        sfxMuted: true,
      };
      saveAudioSettings(migrated);
      return migrated;
    }

    return { ...DEFAULT_AUDIO_SETTINGS };
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
}

export function saveAudioSettings(settings: AudioSettings): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(AUDIO_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    }
  } catch {
    // Ignore storage write failures cleanly
  }
}
