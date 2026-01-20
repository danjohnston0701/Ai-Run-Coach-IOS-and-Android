import * as Speech from 'expo-speech';
import { createAudioPlayer, AudioPlayer } from 'expo-audio';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import { getApiUrl } from './query-client';
import { getStoredToken } from './token-storage';

const { cacheDirectory, writeAsStringAsync, deleteAsync } = FileSystemLegacy;

export type SpeechDomain = 'coach' | 'navigation' | 'system';

export interface SpeechItem {
  id: string;
  text: string;
  domain: SpeechDomain;
  priority: number;
  timestamp: number;
  onComplete?: () => void;
  useOpenAI?: boolean;
}

interface TTSCacheEntry {
  text: string;
  audioData?: string;
  filePath?: string;
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

function stripEmojis(text: string): string {
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
  private currentPlayer: AudioPlayer | null = null;
  private useOpenAITTS = true;
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
      this.stopCurrentPlayer();
    }
  }

  setUseOpenAITTS(useOpenAI: boolean) {
    this.useOpenAITTS = useOpenAI;
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
      useOpenAI: this.useOpenAITTS,
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

  async playOpenAIAudio(params: {
    text?: string;
    distance?: number;
    elevationGain?: number;
    elevationLoss?: number;
    difficulty?: string;
    activityType?: string;
    weather?: any;
    targetPace?: string;
    wellness?: any;
    turnInstructions?: Array<{ instruction: string; distance: number }>;
  }, onComplete?: () => void): Promise<void> {
    if (!this.enabled) return;

    try {
      const baseUrl = getApiUrl();
      const token = await getStoredToken();
      
      const response = await fetch(`${baseUrl}/api/coaching/pre-run-briefing-audio`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        throw new Error(`TTS request failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.audio) {
        throw new Error('No audio data received');
      }

      const fileUri = `${cacheDirectory}briefing_${Date.now()}.mp3`;
      await writeAsStringAsync(fileUri, data.audio, {
        encoding: 'base64',
      });

      await this.stopCurrentPlayer();
      
      const player = createAudioPlayer({ uri: fileUri });
      this.currentPlayer = player;
      
      player.addListener('playbackStatusUpdate', (status: any) => {
        if (status.didJustFinish) {
          this.stopCurrentPlayer();
          onComplete?.();
          deleteAsync(fileUri, { idempotent: true }).catch(() => {});
        }
      });
      
      player.play();
      
    } catch (error) {
      console.error('OpenAI TTS playback error:', error);
      if (params.text) {
        this.speakWithDeviceTTS(params.text, onComplete);
      } else {
        const fallbackText = "Let's have a great run. Remember to enjoy it!";
        this.speakWithDeviceTTS(fallbackText, onComplete);
      }
    }
  }

  async generateAndPlayTTS(text: string, onComplete?: () => void): Promise<void> {
    if (!this.enabled || !text.trim()) {
      onComplete?.();
      return;
    }

    const cleanText = stripEmojis(text);
    if (!cleanText) {
      onComplete?.();
      return;
    }

    try {
      const baseUrl = getApiUrl();
      const token = await getStoredToken();
      
      const response = await fetch(`${baseUrl}/api/tts/generate`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ text: cleanText }),
      });

      if (!response.ok) {
        throw new Error(`TTS request failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.audio) {
        throw new Error('No audio data received');
      }

      const fileUri = `${cacheDirectory}tts_${Date.now()}.mp3`;
      await writeAsStringAsync(fileUri, data.audio, {
        encoding: 'base64',
      });

      await this.stopCurrentPlayer();
      
      const player = createAudioPlayer({ uri: fileUri });
      this.currentPlayer = player;
      
      player.addListener('playbackStatusUpdate', (status: any) => {
        if (status.didJustFinish) {
          this.stopCurrentPlayer();
          onComplete?.();
          deleteAsync(fileUri, { idempotent: true }).catch(() => {});
        }
      });
      
      player.play();
      
    } catch (error) {
      console.error('OpenAI TTS error, falling back to device TTS:', error);
      this.speakWithDeviceTTS(cleanText, onComplete);
    }
  }

  private speakWithDeviceTTS(text: string, onComplete?: () => void): void {
    Speech.speak(text, {
      language: 'en-US',
      pitch: this.coachVoiceSettings.pitch,
      rate: this.coachVoiceSettings.rate,
      onDone: () => onComplete?.(),
      onError: () => onComplete?.(),
      onStopped: () => onComplete?.(),
    });
  }

  private async stopCurrentPlayer(): Promise<void> {
    if (this.currentPlayer) {
      try {
        this.currentPlayer.release();
      } catch (error) {
        // Ignore errors when stopping
      }
      this.currentPlayer = null;
    }
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
      if (this.currentItem.useOpenAI) {
        await this.generateAndPlayTTS(this.currentItem.text);
      } else {
        await this.speak(this.currentItem);
      }
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
      this.stopCurrentPlayer();
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
    this.stopCurrentPlayer();
    this.isPlaying = false;
    this.currentItem = null;
  }

  clearDomain(domain: SpeechDomain) {
    this.queue = this.queue.filter((item) => item.domain !== domain);
    if (this.currentItem?.domain === domain) {
      Speech.stop();
      this.stopCurrentPlayer();
    }
  }

  interrupt(text: string, domain: SpeechDomain = 'system'): string {
    Speech.stop();
    this.stopCurrentPlayer();
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
}

export const speechQueue = new SpeechQueueManager();
