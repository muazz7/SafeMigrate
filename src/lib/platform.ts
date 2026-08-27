/**
 * ⭐ THE NATIVE/WEB BOUNDARY — BUILD-SPEC §9.
 *
 * Every difference between the web app and the Android APK lives in this file and
 * nowhere else. No component may import a Capacitor plugin, call `speechSynthesis`,
 * `window.print()`, or `localStorage` directly.
 *
 * If a component needs a capability this file lacks, ADD A METHOD HERE. A
 * `Capacitor.isNativePlatform()` check inside a component is a defect (§9.2).
 *
 * Capacitor plugins are imported dynamically so the web bundle never loads native
 * code and server-side rendering never touches a browser-only global.
 */

export interface PickedFile {
  /** Raw base64, no `data:` prefix. */
  base64: string;
  mimeType: string;
  fileName: string;
  /** Object URL or data URL suitable for an <img src>. */
  previewUrl: string;
}

export class PlatformError extends Error {
  /** Dot-path key into data/strings.json — never a raw platform message. */
  readonly userMessageKey: string;

  constructor(userMessageKey: string, detail?: string) {
    super(detail ?? userMessageKey);
    this.name = 'PlatformError';
    this.userMessageKey = userMessageKey;
  }
}

// ---------------------------------------------------------------------------
// Platform detection
// ---------------------------------------------------------------------------

let nativeFlag: boolean | null = null;

/** True inside the Capacitor WebView. Always false during SSR and on the web. */
export function isNative(): boolean {
  if (nativeFlag !== null) return nativeFlag;
  if (typeof window === 'undefined') return false;

  // Capacitor injects this global before the web bundle runs.
  const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  nativeFlag = typeof cap?.isNativePlatform === 'function' ? cap.isNativePlatform() : false;
  return nativeFlag;
}

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------

const stripDataUrlPrefix = (value: string): string => {
  const comma = value.indexOf(',');
  return value.startsWith('data:') && comma !== -1 ? value.slice(comma + 1) : value;
};

const fileToPicked = (file: File): Promise<PickedFile> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new PlatformError('errors.generic', 'FileReader failed'));
    reader.onload = () => {
      const result = String(reader.result);
      resolve({
        base64: stripDataUrlPrefix(result),
        mimeType: file.type || 'application/octet-stream',
        fileName: file.name || 'document',
        previewUrl: result,
      });
    };
    reader.readAsDataURL(file);
  });

/** Opens a hidden <input type="file">. Web only. */
const openWebFilePicker = (accept: string, capture: boolean): Promise<PickedFile> =>
  new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    if (capture) input.setAttribute('capture', 'environment');
    input.style.display = 'none';

    // `cancel` is not universally supported; the input is removed either way.
    input.addEventListener('cancel', () => {
      input.remove();
      reject(new PlatformError('errors.cancelled', 'picker cancelled'));
    });

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) {
        reject(new PlatformError('errors.cancelled', 'no file selected'));
        return;
      }
      fileToPicked(file).then(resolve, reject);
    });

    document.body.appendChild(input);
    input.click();
  });

// ---------------------------------------------------------------------------
// Camera / file picking
// ---------------------------------------------------------------------------

const IMAGE_TYPES = 'image/jpeg,image/png,image/webp';
const DOC_TYPES = `${IMAGE_TYPES},application/pdf`;

async function capturePhoto(): Promise<PickedFile> {
  if (!isNative()) {
    // The HTML capture attribute is unreliable inside a WebView, which is exactly
    // why native takes the plugin path instead (§9.1).
    return openWebFilePicker(IMAGE_TYPES, true);
  }

  // TODO(Day 2): @capacitor/camera + Bangla pre-prompt before the system dialog.
  throw new PlatformError('errors.generic', 'native capturePhoto not implemented until Day 2');
}

async function pickFile(): Promise<PickedFile> {
  if (!isNative()) return openWebFilePicker(DOC_TYPES, false);

  // TODO(Day 2): @capacitor/camera gallery source + @capacitor/filesystem for PDFs.
  throw new PlatformError('errors.generic', 'native pickFile not implemented until Day 2');
}

// ---------------------------------------------------------------------------
// Bangla speech
// ---------------------------------------------------------------------------

const BANGLA_LANG = 'bn-BD';

const webVoices = (): SpeechSynthesisVoice[] => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  return window.speechSynthesis.getVoices();
};

const findBanglaVoice = (): SpeechSynthesisVoice | null =>
  webVoices().find((v) => v.lang.toLowerCase().startsWith('bn')) ?? null;

async function canSpeak(): Promise<boolean> {
  if (isNative()) {
    try {
      const { TextToSpeech } = await import('@capacitor-community/text-to-speech');
      const { languages } = await TextToSpeech.getSupportedLanguages();
      return languages.some((l) => l.toLowerCase().startsWith('bn'));
    } catch {
      return false;
    }
  }

  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;

  // Chrome populates voices asynchronously; an empty list on first call is normal.
  if (webVoices().length === 0) {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 400);
      window.speechSynthesis.addEventListener(
        'voiceschanged',
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
    });
  }

  return findBanglaVoice() !== null;
}

async function speak(text: string, lang: string = BANGLA_LANG): Promise<void> {
  if (!text.trim()) return;

  if (isNative()) {
    const { TextToSpeech } = await import('@capacitor-community/text-to-speech');
    await TextToSpeech.speak({ text, lang, rate: 0.95, pitch: 1.0, category: 'ambient' });
    return;
  }

  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    throw new PlatformError('errors.no_tts_voice', 'speechSynthesis unavailable');
  }

  window.speechSynthesis.cancel();

  await new Promise<void>((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.95;

    const voice = findBanglaVoice();
    if (voice) utterance.voice = voice;

    utterance.onend = () => resolve();
    utterance.onerror = (event) => {
      // A user-initiated stop() surfaces as an error; that is not a failure.
      if (event.error === 'interrupted' || event.error === 'canceled') resolve();
      else reject(new PlatformError('errors.no_tts_voice', event.error));
    };

    window.speechSynthesis.speak(utterance);
  });
}

async function stopSpeaking(): Promise<void> {
  if (isNative()) {
    const { TextToSpeech } = await import('@capacitor-community/text-to-speech');
    await TextToSpeech.stop();
    return;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

// ---------------------------------------------------------------------------
// Document output (complaint letter)
// ---------------------------------------------------------------------------

/**
 * `window.print()` silently does nothing inside a WebView, so native shares the
 * letter text instead — the user sends it to WhatsApp, email, or a printing shop.
 */
async function outputDocument(opts: { title: string; text: string; html: string }): Promise<void> {
  if (isNative()) {
    const { Share } = await import('@capacitor/share');
    await Share.share({ title: opts.title, text: opts.text, dialogTitle: opts.title });
    return;
  }

  if (typeof window === 'undefined') return;
  window.print();
}

async function copyToClipboard(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    return;
  }
  throw new PlatformError('errors.generic', 'clipboard unavailable');
}

// ---------------------------------------------------------------------------
// Session persistence
// ---------------------------------------------------------------------------

/** localStorage in a WebView can be evicted by the OS, so native uses Preferences. */
async function getItem(key: string): Promise<string | null> {
  if (isNative()) {
    const { Preferences } = await import('@capacitor/preferences');
    const { value } = await Preferences.get({ key });
    return value;
  }
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null; // Private mode or blocked site data.
  }
}

async function setItem(key: string, value: string): Promise<void> {
  if (isNative()) {
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.set({ key, value });
    return;
  }
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* Storage full or blocked — the app must still work. */
  }
}

async function removeItem(key: string): Promise<void> {
  if (isNative()) {
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.remove({ key });
    return;
  }
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* Nothing to do. */
  }
}

// ---------------------------------------------------------------------------
// Native chrome
// ---------------------------------------------------------------------------

/** Status bar colour + splash dismissal. No-op on web. Called once from AppShell. */
async function initNativeChrome(): Promise<void> {
  if (!isNative()) return;

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setBackgroundColor({ color: '#0F6B4F' });
    await StatusBar.setStyle({ style: Style.Dark }); // Dark style = light content.
  } catch {
    /* Status bar is cosmetic; never block startup on it. */
  }

  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();
  } catch {
    /* Splash auto-hides after launchShowDuration anyway. */
  }
}

/**
 * Hardware back button. Without this a judge pressing back once leaves the app (§9.1).
 * `handler` returns true if it consumed the press. Returns an unsubscribe function.
 */
async function onHardwareBack(handler: () => boolean): Promise<() => void> {
  if (!isNative()) return () => {};

  const { App } = await import('@capacitor/app');
  const listener = await App.addListener('backButton', ({ canGoBack }) => {
    if (handler()) return;
    if (canGoBack) window.history.back();
    else App.exitApp();
  });

  return () => void listener.remove();
}

// ---------------------------------------------------------------------------

export const platform = {
  capturePhoto,
  pickFile,
  speak,
  stopSpeaking,
  canSpeak,
  outputDocument,
  copyToClipboard,
  getItem,
  setItem,
  removeItem,
  initNativeChrome,
  onHardwareBack,
};
