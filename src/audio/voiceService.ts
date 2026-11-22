import { audioManager } from '@/src/audio/audioManager';
import { getLocale, LocaleCode } from '@/src/localization/localeStore';
import { soundService } from '@/src/services/soundService';
import {
  loadVoiceSettings,
  saveVoiceSettings,
  VoiceSettings,
} from './voiceSettings';

export interface DeviceVoiceInfo {
  voiceURI: string;
  name: string;
  lang: string;
  localService: boolean;
  isVietnamese: boolean;
  isEnglish: boolean;
}

export interface SubtitleState {
  id: number;
  speaker: string;
  text: string;
  locale: LocaleCode;
  isSpeaking: boolean;
  audioSkippedReason: 'NONE' | 'NO_VIETNAMESE_VOICE' | 'UNSUPPORTED' | 'MUTED' | 'DISABLED' | 'NEEDS_INTERACTION';
}

export type VoiceTriggerCategory =
  | 'MANUAL'
  | 'TUTORIAL'
  | 'NOTIFICATION'
  | 'DIALOGUE'
  | 'OBJECTIVE'
  | 'REPORT';

export interface SpeakOptions {
  speaker: string;
  text: string;
  locale?: LocaleCode;
  category?: VoiceTriggerCategory;
  dedupeKey?: string;
  userInitiated?: boolean;
}

function isVietnameseLang(lang: string): boolean {
  const norm = lang.trim().toLowerCase().replace('_', '-');
  return norm === 'vi' || norm.startsWith('vi-');
}

function isEnglishLang(lang: string): boolean {
  const norm = lang.trim().toLowerCase().replace('_', '-');
  return norm === 'en' || norm.startsWith('en-');
}

export function pickVoiceForLocale<T extends { lang: string; voiceURI: string; name?: string; localService?: boolean }>(
  voices: T[],
  locale: LocaleCode,
  preferredVoiceURI = ''
): T | null {
  if (voices.length === 0) return null;

  if (locale === 'vi-VN') {
    const viVoices = voices.filter((v) => isVietnameseLang(v.lang));
    // CRITICAL SAFETY RULE: Never silently fall back to an English voice for Vietnamese text.
    if (viVoices.length === 0) return null;

    if (preferredVoiceURI) {
      const explicit = viVoices.find((v) => v.voiceURI === preferredVoiceURI);
      if (explicit) return explicit;
    }

    const exactViVn = viVoices.filter((v) => v.lang.trim().toLowerCase().replace('_', '-') === 'vi-vn');
    const pool = exactViVn.length > 0 ? exactViVn : viVoices;
    const natural = pool.find((v) =>
      /natural|google|microsoft|linh|hoai|nam|minh|an/i.test(v.name ?? '')
    );
    return natural ?? pool[0];
  }

  const enVoices = voices.filter((v) => isEnglishLang(v.lang));
  if (enVoices.length === 0) return null;

  if (preferredVoiceURI) {
    const explicit = enVoices.find((v) => v.voiceURI === preferredVoiceURI);
    if (explicit) return explicit;
  }

  const exactEnUs = enVoices.filter((v) => v.lang.trim().toLowerCase().replace('_', '-') === 'en-us');
  const pool = exactEnUs.length > 0 ? exactEnUs : enVoices;
  const natural = pool.find((v) => /natural|google|microsoft|aria|jenny|guy/i.test(v.name ?? ''));
  return natural ?? pool[0];
}

class VoiceService {
  private settings: VoiceSettings = loadVoiceSettings();
  private rawVoices: SpeechSynthesisVoice[] = [];
  private listeners = new Set<() => void>();
  private subtitle: SubtitleState | null = null;
  private subtitleSeq = 0;
  private isSpeakingNow = false;
  private hasUserInteracted = false;
  private lastSpokenKey = '';
  private lastSpokenTime = 0;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private initialized = false;

  constructor() {
    this.initBrowserHooks();
  }

  private initBrowserHooks(): void {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;

    const markInteracted = () => {
      this.hasUserInteracted = true;
    };
    window.addEventListener('pointerdown', markInteracted, { once: true, passive: true });
    window.addEventListener('keydown', markInteracted, { once: true, passive: true });

    if ('speechSynthesis' in window && window.speechSynthesis) {
      this.refreshVoices();
      const synth = window.speechSynthesis;
      if (typeof synth.addEventListener === 'function') {
        synth.addEventListener('voiceschanged', () => this.refreshVoices());
      } else {
        synth.onvoiceschanged = () => this.refreshVoices();
      }
    }
  }

  isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      typeof SpeechSynthesisUtterance !== 'undefined'
    );
  }

  refreshVoices(): void {
    if (!this.isSupported()) {
      this.rawVoices = [];
      this.emit();
      return;
    }
    try {
      this.rawVoices = window.speechSynthesis.getVoices() ?? [];
    } catch {
      this.rawVoices = [];
    }
    this.emit();
  }

  getAvailableVoices(): DeviceVoiceInfo[] {
    return this.rawVoices.map((v) => ({
      voiceURI: v.voiceURI,
      name: v.name,
      lang: v.lang,
      localService: v.localService,
      isVietnamese: isVietnameseLang(v.lang),
      isEnglish: isEnglishLang(v.lang),
    }));
  }

  getVoicesForLocale(locale: LocaleCode): DeviceVoiceInfo[] {
    const all = this.getAvailableVoices();
    return locale === 'vi-VN'
      ? all.filter((v) => v.isVietnamese)
      : all.filter((v) => v.isEnglish);
  }

  hasVietnameseVoice(): boolean {
    return this.rawVoices.some((v) => isVietnameseLang(v.lang));
  }

  getSettings(): VoiceSettings {
    return { ...this.settings };
  }

  updateSettings(patch: Partial<VoiceSettings>): void {
    const next: VoiceSettings = {
      ...this.settings,
      ...patch,
      rate:
        patch.rate !== undefined
          ? Math.max(0.7, Math.min(1.3, Number(patch.rate)))
          : this.settings.rate,
      volume:
        patch.volume !== undefined
          ? Math.max(0, Math.min(1, Number(patch.volume)))
          : this.settings.volume,
    };
    this.settings = next;
    saveVoiceSettings(next);
    if (!next.enabled) {
      this.stop(false);
    }
    this.emit();
  }

  getSubtitle(): SubtitleState | null {
    return this.subtitle ? { ...this.subtitle } : null;
  }

  isSpeaking(): boolean {
    return this.isSpeakingNow;
  }

  dismissSubtitle(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    this.stop(true);
  }

  stop(clearSubtitle = false): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    if (this.isSupported()) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore cancel errors
      }
    }
    this.isSpeakingNow = false;
    if (clearSubtitle) {
      this.subtitle = null;
    } else if (this.subtitle) {
      this.subtitle = { ...this.subtitle, isSpeaking: false };
    }
    this.emit();
  }

  private shouldTriggerCategory(category: VoiceTriggerCategory): boolean {
    if (category === 'MANUAL') return true;
    if (!this.settings.enabled) return false;
    switch (category) {
      case 'TUTORIAL':
        return this.settings.autoReadTutorial;
      case 'NOTIFICATION':
        return this.settings.autoReadNotifications;
      case 'DIALOGUE':
        return this.settings.autoReadDialogue;
      case 'OBJECTIVE':
        return this.settings.autoReadObjectives;
      case 'REPORT':
        return this.settings.autoReadReports;
      default:
        return false;
    }
  }

  speak(options: SpeakOptions): void {
    const cleanText = options.text.trim();
    if (!cleanText) return;

    const category = options.category ?? 'MANUAL';
    if (options.userInitiated) {
      this.hasUserInteracted = true;
    }

    if (!this.shouldTriggerCategory(category)) {
      return;
    }

    const dedupeKey = options.dedupeKey ?? `${options.speaker}:${cleanText}`;
    const now = Date.now();
    if (!options.userInitiated && dedupeKey === this.lastSpokenKey && now - this.lastSpokenTime < 3500) {
      return;
    }
    this.lastSpokenKey = dedupeKey;
    this.lastSpokenTime = now;

    const locale = options.locale ?? getLocale();
    const seq = ++this.subtitleSeq;

    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }

    const scheduleSubtitleFade = (ms: number) => {
      this.hideTimer = setTimeout(() => {
        if (this.subtitle?.id === seq && !this.isSpeakingNow) {
          this.subtitle = null;
          this.emit();
        }
      }, ms);
    };

    if (!this.settings.enabled && !options.userInitiated) {
      return;
    }

    if (!this.isSupported()) {
      this.isSpeakingNow = false;
      this.subtitle = {
        id: seq,
        speaker: options.speaker,
        text: cleanText,
        locale,
        isSpeaking: false,
        audioSkippedReason: 'UNSUPPORTED',
      };
      this.emit();
      scheduleSubtitleFade(7000);
      return;
    }

    if (soundService.isMuted()) {
      this.isSpeakingNow = false;
      this.subtitle = {
        id: seq,
        speaker: options.speaker,
        text: cleanText,
        locale,
        isSpeaking: false,
        audioSkippedReason: 'MUTED',
      };
      this.emit();
      scheduleSubtitleFade(6500);
      return;
    }

    if (!this.settings.enabled) {
      this.isSpeakingNow = false;
      this.subtitle = {
        id: seq,
        speaker: options.speaker,
        text: cleanText,
        locale,
        isSpeaking: false,
        audioSkippedReason: 'DISABLED',
      };
      this.emit();
      scheduleSubtitleFade(6500);
      return;
    }

    if (!this.hasUserInteracted && !options.userInitiated) {
      this.isSpeakingNow = false;
      this.subtitle = {
        id: seq,
        speaker: options.speaker,
        text: cleanText,
        locale,
        isSpeaking: false,
        audioSkippedReason: 'NEEDS_INTERACTION',
      };
      this.emit();
      scheduleSubtitleFade(6500);
      return;
    }

    if (this.rawVoices.length === 0) {
      try {
        this.rawVoices = window.speechSynthesis.getVoices() ?? [];
      } catch {
        this.rawVoices = [];
      }
    }

    const matchedVoice = pickVoiceForLocale(
      this.rawVoices,
      locale,
      this.settings.voiceURI
    );

    if (locale === 'vi-VN' && !matchedVoice) {
      // Strictly avoid English voice speaking Vietnamese text
      this.stop(false);
      this.isSpeakingNow = false;
      this.subtitle = {
        id: seq,
        speaker: options.speaker,
        text: cleanText,
        locale,
        isSpeaking: false,
        audioSkippedReason: 'NO_VIETNAMESE_VOICE',
      };
      this.emit();
      scheduleSubtitleFade(8000);
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = matchedVoice?.lang ?? locale;
      if (matchedVoice) {
        utterance.voice = matchedVoice;
      }
      const masterVol = audioManager.getSettings().masterVolume;
      utterance.rate = this.settings.rate;
      utterance.volume = Math.max(0, Math.min(1, this.settings.volume * masterVol));
      utterance.pitch = 1;

      this.isSpeakingNow = true;
      this.subtitle = {
        id: seq,
        speaker: options.speaker,
        text: cleanText,
        locale,
        isSpeaking: true,
        audioSkippedReason: 'NONE',
      };
      this.emit();

      utterance.onend = () => {
        if (this.subtitle?.id === seq) {
          this.isSpeakingNow = false;
          this.subtitle = { ...this.subtitle, isSpeaking: false };
          this.emit();
          scheduleSubtitleFade(4500);
        }
      };

      utterance.onerror = () => {
        if (this.subtitle?.id === seq) {
          this.isSpeakingNow = false;
          this.subtitle = { ...this.subtitle, isSpeaking: false };
          this.emit();
          scheduleSubtitleFade(5000);
        }
      };

      window.speechSynthesis.speak(utterance);
    } catch {
      this.isSpeakingNow = false;
      this.subtitle = {
        id: seq,
        speaker: options.speaker,
        text: cleanText,
        locale,
        isSpeaking: false,
        audioSkippedReason: 'UNSUPPORTED',
      };
      this.emit();
      scheduleSubtitleFade(6500);
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    this.listeners.forEach((fn) => fn());
  }
}

export const voiceService = new VoiceService();
