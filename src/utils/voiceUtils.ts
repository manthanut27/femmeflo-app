// Safe platform resolution without hard dependency on react-native in node test runner
let Platform: { OS: 'android' | 'ios' | 'web' | 'node' | string } = { OS: 'android' };
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  Platform = { OS: 'web' };
} else {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const rn = require('react-native');
    if (rn?.Platform) {
      Platform = rn.Platform;
    }
  } catch {
    Platform = { OS: 'node' };
  }
}

export type SupportedSpeechLanguage = 'hi-IN' | 'en-IN' | 'hi-Latn';

export interface SpeechRecognitionResult {
  transcript: string;
  isFinal: boolean;
  confidence?: number;
}

export interface VoiceListenerCallbacks {
  onStart?: () => void;
  onResult?: (result: SpeechRecognitionResult) => void;
  onError?: (errorMessage: string) => void;
  onEnd?: () => void;
  onVolumeChange?: (volume: number) => void;
}

// Safely obtain native ExpoSpeechRecognitionModule without breaking test environments
let NativeSpeechModule: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const speechPkg = require('expo-speech-recognition');
  NativeSpeechModule = speechPkg?.ExpoSpeechRecognitionModule || null;
} catch {
  NativeSpeechModule = null;
}

/**
 * Maps native and browser speech error codes to user-friendly Indian retail English messages.
 */
export function mapSpeechError(error: any): string {
  if (!error) return 'Speech recognition encountered an unexpected error.';
  const code = typeof error === 'string' ? error : error?.error || error?.message || '';

  const lower = String(code).toLowerCase();
  if (lower.includes('no-speech') || lower.includes('speech_timeout') || lower.includes('no_match')) {
    return 'No speech detected. Please speak clearly into your microphone.';
  }
  if (lower.includes('not-allowed') || lower.includes('denied') || lower.includes('permission') || lower.includes('audio_record_permission')) {
    return 'Microphone permission was denied. Please enable microphone access in your device settings.';
  }
  if (lower.includes('network') || lower.includes('server') || lower.includes('connection')) {
    return 'Speech service network error. Please verify your mobile data or Wi-Fi connection.';
  }
  if (lower.includes('language') || lower.includes('not-supported')) {
    return 'Selected language model is not supported on this device. You can type feedback manually.';
  }
  if (lower.includes('busy') || lower.includes('client')) {
    return 'Speech recognition service is busy. Please try again.';
  }

  return `Speech recognition error: ${code}`;
}

/**
 * Checks whether speech recognition is available on the current device.
 */
export function isSpeechRecognitionSupported(): boolean {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      return Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    }
    return false;
  }

  if (NativeSpeechModule) {
    try {
      if (typeof NativeSpeechModule.isRecognitionAvailable === 'function') {
        return NativeSpeechModule.isRecognitionAvailable();
      }
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Requests speech recognition and microphone permissions from the operating system.
 */
export async function requestSpeechPermissions(): Promise<{ granted: boolean; error?: string }> {
  if (Platform.OS === 'web') {
    // Web permissions are requested implicitly on first user interaction with getUserMedia or SpeechRecognition
    return { granted: true };
  }

  if (NativeSpeechModule && typeof NativeSpeechModule.requestPermissionsAsync === 'function') {
    try {
      const res = await NativeSpeechModule.requestPermissionsAsync();
      if (res.granted) {
        return { granted: true };
      }
      return {
        granted: false,
        error: 'Microphone and speech recognition permissions are required to record voice feedback.',
      };
    } catch (err: any) {
      return {
        granted: false,
        error: err.message || 'Permission request failed',
      };
    }
  }

  return { granted: true };
}

/**
 * Universal SpeechRecognizer wrapping Native Expo Speech Recognition on iOS/Android
 * and Web Speech API on browsers with full Hindi, Hinglish, and English support.
 */
export class SpeechRecognizer {
  private isListening = false;
  private currentLanguage: SupportedSpeechLanguage = 'hi-IN';
  private removeListeners: Array<() => void> = [];
  private webRecognitionInstance: any = null;

  isSupported(): boolean {
    return isSpeechRecognitionSupported();
  }

  async start(callbacks: VoiceListenerCallbacks, lang: SupportedSpeechLanguage = 'hi-IN'): Promise<void> {
    if (this.isListening) {
      this.stop();
    }

    this.currentLanguage = lang;

    // 1. Check Permissions
    const perm = await requestSpeechPermissions();
    if (!perm.granted) {
      callbacks.onError?.(perm.error || 'Microphone access denied.');
      return;
    }

    // 2. Native Path (Android / iOS)
    if (Platform.OS !== 'web' && NativeSpeechModule) {
      try {
        this.cleanupListeners();

        // Listen for start
        const startSub = NativeSpeechModule.addListener('start', () => {
          this.isListening = true;
          callbacks.onStart?.();
        });
        if (startSub?.remove) this.removeListeners.push(() => startSub.remove());

        // Listen for results (live interim and final)
        const resultSub = NativeSpeechModule.addListener('result', (event: any) => {
          const results = event?.results || [];
          const best = results[0]?.transcript || '';
          if (best) {
            callbacks.onResult?.({
              transcript: best,
              isFinal: Boolean(event?.isFinal),
              confidence: results[0]?.confidence ?? 0.95,
            });
          }
        });
        if (resultSub?.remove) this.removeListeners.push(() => resultSub.remove());

        // Listen for audio pulse / volume changes
        const volumeSub = NativeSpeechModule.addListener('volumechange', (event: any) => {
          if (typeof event?.value === 'number') {
            callbacks.onVolumeChange?.(event.value);
          }
        });
        if (volumeSub?.remove) this.removeListeners.push(() => volumeSub.remove());

        // Listen for errors
        const errorSub = NativeSpeechModule.addListener('error', (event: any) => {
          this.isListening = false;
          callbacks.onError?.(mapSpeechError(event));
        });
        if (errorSub?.remove) this.removeListeners.push(() => errorSub.remove());

        // Listen for end
        const endSub = NativeSpeechModule.addListener('end', () => {
          this.isListening = false;
          callbacks.onEnd?.();
        });
        if (endSub?.remove) this.removeListeners.push(() => endSub.remove());

        // Start native recognition
        NativeSpeechModule.start({
          lang: lang === 'hi-Latn' ? 'hi-IN' : lang,
          interimResults: true,
          maxAlternatives: 1,
          continuous: false,
          recordingOptions: {
            persist: false,
          },
        });
        this.isListening = true;
        return;
      } catch (err: any) {
        this.isListening = false;
        callbacks.onError?.(mapSpeechError(err));
        return;
      }
    }

    // 3. Web Path (Fallback on web browser)
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (!SpeechRecognition) {
        callbacks.onError?.('Speech recognition is not supported in this browser. Please type feedback manually.');
        return;
      }

      try {
        const recognition = new SpeechRecognition();
        recognition.lang = lang === 'hi-Latn' ? 'hi-IN' : lang;
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          this.isListening = true;
          callbacks.onStart?.();
        };

        recognition.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const res = event.results[i];
            if (res.isFinal) {
              finalTranscript += res[0].transcript;
            } else {
              interimTranscript += res[0].transcript;
            }
          }
          const text = finalTranscript || interimTranscript;
          callbacks.onResult?.({
            transcript: text,
            isFinal: Boolean(finalTranscript),
          });
        };

        recognition.onerror = (event: any) => {
          this.isListening = false;
          callbacks.onError?.(mapSpeechError(event?.error || 'Speech error'));
        };

        recognition.onend = () => {
          this.isListening = false;
          callbacks.onEnd?.();
        };

        this.webRecognitionInstance = recognition;
        recognition.start();
        this.isListening = true;
        return;
      } catch (err: any) {
        this.isListening = false;
        callbacks.onError?.(mapSpeechError(err));
        return;
      }
    }

    callbacks.onError?.('Speech recognition is not supported on this platform.');
  }

  stop(): void {
    if (!this.isListening) return;

    if (Platform.OS !== 'web' && NativeSpeechModule) {
      try {
        NativeSpeechModule.stop();
      } catch {
        // Safe ignore
      }
    } else if (this.webRecognitionInstance) {
      try {
        this.webRecognitionInstance.stop();
      } catch {
        // Safe ignore
      }
    }

    this.isListening = false;
    this.cleanupListeners();
  }

  abort(): void {
    if (Platform.OS !== 'web' && NativeSpeechModule) {
      try {
        NativeSpeechModule.abort();
      } catch {
        // Safe ignore
      }
    } else if (this.webRecognitionInstance) {
      try {
        this.webRecognitionInstance.abort();
      } catch {
        // Safe ignore
      }
    }

    this.isListening = false;
    this.cleanupListeners();
  }

  private cleanupListeners(): void {
    this.removeListeners.forEach((fn) => {
      try {
        fn();
      } catch {
        // Safe ignore
      }
    });
    this.removeListeners = [];
  }
}
