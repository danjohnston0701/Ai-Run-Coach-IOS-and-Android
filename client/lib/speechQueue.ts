import * as Speech from 'expo-speech';
import { getApiUrl } from './query-client';

export type SpeechDomain = 'coach' | 'navigation' | 'system';

export interface SpeechItem {
  id: string;
  text: string;
  domain: SpeechDomain;
  priority: number;
  timestamp: number;
  onComplete?: () => void;
}

interface TTSCacheEntry {
  text: string;
  audioData?: string;
  timestamp: number;
}

const THROTTLE_MS = 3000;
const WATCHDOG_TIMEOUT_MS = 45000;
const MAX_TTS_CACHE_SIZE = 20;
const DOMAIN_PRIORITIES: Record<SpeechDomain, number> = {
  system: 3,
  navigation: 2,
  coach: 1,
};

// Strip emojis and special characters from text before TTS
function stripEmojis(text: string): string {
  // Remove emojis using a comprehensive regex pattern
  // This covers most common emoji ranges
  return text
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

class SpeechQueueManager {
  private queue: SpeechItem[] = [];
  private isPlaying = false;
  private lastPlayTime = 0;
  private watchdogTimer: NodeJS.Timeout | null = null;
  private currentItem: SpeechItem | null = null;
  private ttsCache: Map<string, TTSCacheEntry> = new Map();
  private enabled = true;
  private coachVoiceSettings = {
    gender: 'female' as 'male' | 'female',
    accent: 'american' as string,
    rate: 0.9,
    pitch: 1.0,
  };

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) {
      this.clear();
      Speech.stop();
    }
  }

  setCoachVoiceSettings(settings: {
    gender?: 'male' | 'female';
    accent?: string;
    rate?: number;
    pitch?: number;
  }) {
    this.coachVoiceSettings = { ...this.coachVoiceSettings, ...settings };
  }

  enqueue(text: string, domain: SpeechDomain, onComplete?: () => void): string {
    if (!this.enabled || !text.trim()) return '';

    // Strip emojis from text before TTS
    const cleanText = stripEmojis(text);
    if (!cleanText) return '';

    const id = `speech-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const item: SpeechItem = {
      id,
      text: cleanText,
      domain,
      priority: DOMAIN_PRIORITIES[domain],
      timestamp: Date.now(),
      onComplete,
    };

    const insertIndex = this.queue.findIndex(
      (existing) => existing.priority < item.priority
    );
    if (insertIndex === -1) {
      this.queue.push(item);
    } else {
      this.queue.splice(insertIndex, 0, item);
    }

    this.processQueue();
    return id;
  }

  enqueueNavigation(text: string, onComplete?: () => void): string {
    return this.enqueue(text, 'navigation', onComplete);
  }

  enqueueCoach(text: string, onComplete?: () => void): string {
    return this.enqueue(text, 'coach', onComplete);
  }

  enqueueSystem(text: string, onComplete?: () => void): string {
    return this.enqueue(text, 'system', onComplete);
  }

  private async processQueue() {
    if (this.isPlaying || this.queue.length === 0 || !this.enabled) return;

    const now = Date.now();
    const timeSinceLastPlay = now - this.lastPlayTime;
    if (timeSinceLastPlay < THROTTLE_MS && this.lastPlayTime > 0) {
      setTimeout(() => this.processQueue(), THROTTLE_MS - timeSinceLastPlay);
      return;
    }

    this.isPlaying = true;
    this.currentItem = this.queue.shift() || null;

    if (!this.currentItem) {
      this.isPlaying = false;
      return;
    }

    this.startWatchdog();

    try {
      await this.speak(this.currentItem);
    } catch (error) {
      console.error('Speech error:', error);
    } finally {
      this.stopWatchdog();
      this.lastPlayTime = Date.now();
      this.currentItem?.onComplete?.();
      this.currentItem = null;
      this.isPlaying = false;
      this.processQueue();
    }
  }

  private async speak(item: SpeechItem): Promise<void> {
    return new Promise((resolve) => {
      const voiceOptions = this.getVoiceOptions(item.domain);

      Speech.speak(item.text, {
        ...voiceOptions,
        onDone: () => resolve(),
        onError: (error) => {
          console.error('Speech.speak error:', error);
          resolve();
        },
        onStopped: () => resolve(),
      });
    });
  }

  private getVoiceOptions(domain: SpeechDomain) {
    const baseOptions = {
      language: 'en-US',
      pitch: 1.0,
      rate: 0.9,
    };

    switch (domain) {
      case 'navigation':
        return {
          ...baseOptions,
          rate: 1.0,
          pitch: 1.1,
        };
      case 'coach':
        return {
          ...baseOptions,
          rate: this.coachVoiceSettings.rate,
          pitch: this.coachVoiceSettings.pitch,
        };
      case 'system':
        return {
          ...baseOptions,
          rate: 0.95,
          pitch: 1.0,
        };
      default:
        return baseOptions;
    }
  }

  private startWatchdog() {
    this.stopWatchdog();
    this.watchdogTimer = setTimeout(() => {
      console.warn('Speech watchdog triggered - item stuck for 45s');
      Speech.stop();
      this.isPlaying = false;
      this.currentItem = null;
      this.processQueue();
    }, WATCHDOG_TIMEOUT_MS);
  }

  private stopWatchdog() {
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  clear() {
    this.queue = [];
    this.stopWatchdog();
    Speech.stop();
    this.isPlaying = false;
    this.currentItem = null;
  }

  clearDomain(domain: SpeechDomain) {
    this.queue = this.queue.filter((item) => item.domain !== domain);
    if (this.currentItem?.domain === domain) {
      Speech.stop();
    }
  }

  interrupt(text: string, domain: SpeechDomain = 'system'): string {
    Speech.stop();
    this.isPlaying = false;
    this.currentItem = null;
    this.stopWatchdog();
    return this.enqueue(text, domain);
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  isCurrentlyPlaying(): boolean {
    return this.isPlaying;
  }

  async fetchAndCacheAITTS(text: string, userId?: string): Promise<void> {
    const cacheKey = text.substring(0, 100);
    if (this.ttsCache.has(cacheKey)) {
      return;
    }

    if (this.ttsCache.size >= MAX_TTS_CACHE_SIZE) {
      const oldestKey = Array.from(this.ttsCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0]?.[0];
      if (oldestKey) {
        this.ttsCache.delete(oldestKey);
      }
    }

    try {
      const baseUrl = getApiUrl();
      const response = await fetch(`${baseUrl}/api/ai/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          text,
          userId,
          voice: this.coachVoiceSettings,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        this.ttsCache.set(cacheKey, {
          text,
          audioData: data.audioData,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      console.error('TTS cache fetch error:', error);
    }
  }
}

export const speechQueue = new SpeechQueueManager();
