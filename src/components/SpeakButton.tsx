'use client';

import { useCallback, useEffect, useState } from 'react';
import { platform } from '@/lib/platform';
import { canSpeak } from '@/lib/tts';
import { t } from '@/lib/strings';

/**
 * Reads text aloud through `platform.speak` — BUILD-SPEC §10.3.
 *
 * Never touches speechSynthesis or a Capacitor plugin directly (§9.2).
 * If the device has no Bangla voice the button hides itself and the caller shows
 * the fallback line instead (§15) — a button that silently does nothing is worse
 * than no button for a user who cannot read the screen.
 */

interface Props {
  /** The text to speak. Composed by lib/tts.ts, never assembled in the view. */
  text: string;
  /** `primary` is the prominent speak-all under the verdict; `quiet` sits on a card. */
  variant?: 'primary' | 'quiet';
  labelKey?: string;
  className?: string;
}

export function SpeakButton({
  text,
  variant = 'quiet',
  labelKey = 'result.speak_all',
  className = '',
}: Props) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    let alive = true;
    void canSpeak().then((ok) => {
      if (alive) setAvailable(ok);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Stop speech when the component goes away, or the voice keeps reading a screen
  // the user has already left.
  useEffect(() => () => void platform.stopSpeaking(), []);

  const toggle = useCallback(async () => {
    if (speaking) {
      await platform.stopSpeaking();
      setSpeaking(false);
      return;
    }

    setSpeaking(true);
    try {
      await platform.speak(text);
    } catch {
      setAvailable(false); // The voice vanished mid-session; stop offering it.
    } finally {
      setSpeaking(false);
    }
  }, [speaking, text]);

  // Unknown availability renders nothing rather than flashing a button that may
  // disappear a moment later.
  if (available !== true) return null;

  const primary = variant === 'primary';

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      aria-pressed={speaking}
      className={`${primary ? 'btn-primary w-full' : 'btn-secondary'} tap focus-ring inline-flex items-center justify-center gap-2 ${
        primary ? '' : 'px-3 text-[15px]'
      } ${className}`}
    >
      <SpeakerIcon speaking={speaking} />
      <span>{speaking ? t('result.stop_speaking') : t(labelKey)}</span>
    </button>
  );
}

function SpeakerIcon({ speaking }: { speaking: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {speaking ? (
        <>
          <rect x="6" y="5" width="4" height="14" rx="1" />
          <rect x="14" y="5" width="4" height="14" rx="1" />
        </>
      ) : (
        <>
          <path d="M11 5 6 9H3v6h3l5 4Z" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M18.5 5.5a9 9 0 0 1 0 13" />
        </>
      )}
    </svg>
  );
}

/** The line shown in place of the button when the phone has no Bangla voice (§15). */
export function NoVoiceNotice() {
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    void canSpeak().then((ok) => {
      if (alive) setAvailable(ok);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (available !== false) return null;

  return <p className="text-muted text-[15px]">{t('errors.no_tts_voice')}</p>;
}
