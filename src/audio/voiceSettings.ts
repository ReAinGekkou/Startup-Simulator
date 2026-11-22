import { clamp } from '@/src/utils/format';

export const VOICE_SETTINGS_STORAGE_KEY = 'startup_founder_voice_v2';
const LEGACY_VOICE_SETTINGS_KEY = 'startup_founder_voice_v1';

export interface VoiceSettings {
  enabled: boolean;
  rate: number; // 0.7 - 1.3 (default 0.95)
  volume: number; // 0 - 1 (default 0.85)
  voiceURI: string; // '' means auto-select best matching voice for locale
  autoReadTutorial: boolean;
  autoReadNotifications: boolean;
  autoReadDialogue: boolean;
  autoReadObjectives: boolean;
  autoReadReports: boolean;
}

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  enabled: true,
  rate: 0.95,
  volume: 0.85,
  voiceURI: '',
  autoReadTutorial: false,
  autoReadNotifications: false,
  autoReadDialogue: false,
  autoReadObjectives: false,
  autoReadReports: true,
};

function parseVoiceSettingsJson(raw: string, forceTutorialOff = false): VoiceSettings {
  const parsed = JSON.parse(raw) as Partial<VoiceSettings>;
  return {
    enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULT_VOICE_SETTINGS.enabled,
    rate: clamp(Number(parsed.rate ?? DEFAULT_VOICE_SETTINGS.rate), 0.7, 1.3),
    volume: clamp(Number(parsed.volume ?? DEFAULT_VOICE_SETTINGS.volume), 0, 1),
    voiceURI: typeof parsed.voiceURI === 'string' ? parsed.voiceURI : '',
    autoReadTutorial: forceTutorialOff
      ? false
      : typeof parsed.autoReadTutorial === 'boolean'
        ? parsed.autoReadTutorial
        : DEFAULT_VOICE_SETTINGS.autoReadTutorial,
    autoReadNotifications:
      typeof parsed.autoReadNotifications === 'boolean'
        ? parsed.autoReadNotifications
        : DEFAULT_VOICE_SETTINGS.autoReadNotifications,
    autoReadDialogue:
      typeof parsed.autoReadDialogue === 'boolean'
        ? parsed.autoReadDialogue
        : DEFAULT_VOICE_SETTINGS.autoReadDialogue,
    autoReadObjectives:
      typeof parsed.autoReadObjectives === 'boolean'
        ? parsed.autoReadObjectives
        : DEFAULT_VOICE_SETTINGS.autoReadObjectives,
    autoReadReports:
      typeof parsed.autoReadReports === 'boolean'
        ? parsed.autoReadReports
        : DEFAULT_VOICE_SETTINGS.autoReadReports,
  };
}

export function loadVoiceSettings(): VoiceSettings {
  try {
    if (typeof localStorage === 'undefined') {
      return { ...DEFAULT_VOICE_SETTINGS };
    }
    const raw = localStorage.getItem(VOICE_SETTINGS_STORAGE_KEY);
    if (raw) {
      return parseVoiceSettingsJson(raw, false);
    }
    const legacyRaw = localStorage.getItem(LEGACY_VOICE_SETTINGS_KEY);
    if (legacyRaw) {
      const migrated = parseVoiceSettingsJson(legacyRaw, true);
      saveVoiceSettings(migrated);
      return migrated;
    }
    return { ...DEFAULT_VOICE_SETTINGS };
  } catch {
    return { ...DEFAULT_VOICE_SETTINGS };
  }
}

export function saveVoiceSettings(settings: VoiceSettings): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(VOICE_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    }
  } catch {
    // Ignore storage write errors
  }
}
