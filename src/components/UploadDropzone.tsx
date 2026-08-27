'use client';

import { useCallback, useState } from 'react';
import { platform, PlatformError, type PickedFile } from '@/lib/platform';
import { useBackInterceptor } from '@/lib/back-stack';
import { downscaleImage, isPdf } from '@/lib/image';
import { t } from '@/lib/strings';

/**
 * Capture / pick entry point — BUILD-SPEC §10.2.
 *
 * Everything platform-specific goes through `platform`; this component never
 * checks which platform it is on (§9.2).
 *
 * On native the camera permission is explained in Bangla BEFORE the system dialog
 * fires. A system prompt with no context is how a user denies a permission the app
 * genuinely needs, and a denial is much harder to recover from than a pre-prompt.
 */

interface Props {
  onPicked: (file: PickedFile) => void;
  disabled?: boolean;
}

type Overlay = 'none' | 'pre-prompt' | 'denied';

export function UploadDropzone({ onPicked, disabled = false }: Props) {
  const [overlay, setOverlay] = useState<Overlay>('none');
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const closeOverlay = useCallback(() => setOverlay('none'), []);
  useBackInterceptor(overlay !== 'none', closeOverlay);

  const runPick = useCallback(
    async (pick: () => Promise<PickedFile>) => {
      setBusy(true);
      setErrorKey(null);
      try {
        const picked = await pick();
        // PDFs pass through; images are downscaled to 1600px / q0.8 (§7.4.2).
        onPicked(isPdf(picked.mimeType) ? picked : await downscaleImage(picked));
      } catch (error) {
        if (error instanceof PlatformError) {
          if (error.userMessageKey === 'errors.cancelled') return; // User backed out.
          if (error.userMessageKey === 'errors.camera_denied') {
            setOverlay('denied');
            return;
          }
          setErrorKey(error.userMessageKey);
          return;
        }
        setErrorKey('errors.generic');
      } finally {
        setBusy(false);
      }
    },
    [onPicked],
  );

  const handleTakePhoto = useCallback(async () => {
    const permission = await platform.getCameraPermission();

    if (permission === 'denied') {
      setOverlay('denied');
      return;
    }
    if (permission === 'prompt') {
      // Explain first, then request — see the note at the top of this file.
      setOverlay('pre-prompt');
      return;
    }

    await runPick(platform.capturePhoto);
  }, [runPick]);

  const handleGrantAndCapture = useCallback(async () => {
    setOverlay('none');
    const result = await platform.requestCameraPermission();
    if (result !== 'granted') {
      setOverlay('denied');
      return;
    }
    await runPick(platform.capturePhoto);
  }, [runPick]);

  const handlePickFile = useCallback(() => runPick(platform.pickFile), [runPick]);

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={handleTakePhoto}
        disabled={disabled || busy}
        className="btn-primary focus-ring w-full disabled:opacity-60"
      >
        {t('scan.take_photo')}
      </button>

      <button
        type="button"
        onClick={handlePickFile}
        disabled={disabled || busy}
        className="btn-secondary focus-ring w-full disabled:opacity-60"
      >
        {t('scan.pick_file')}
      </button>

      {errorKey ? (
        <p role="alert" className="text-critical bg-critical-soft rounded-[12px] px-4 py-3">
          {t(errorKey)}
        </p>
      ) : null}

      {overlay === 'pre-prompt' ? (
        <Sheet onDismiss={closeOverlay} titleKey="scan.camera_why_title">
          <p className="text-muted">{t('scan.camera_why_body')}</p>
          <div className="flex gap-3">
            <button
              type="button"
              className="btn-secondary focus-ring flex-1"
              onClick={closeOverlay}
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="btn-primary focus-ring flex-1"
              onClick={handleGrantAndCapture}
            >
              {t('common.continue')}
            </button>
          </div>
        </Sheet>
      ) : null}

      {overlay === 'denied' ? (
        <Sheet onDismiss={closeOverlay} titleKey="errors.camera_denied">
          {/* Written instructions as well as the button: the settings intent can
              fail, and the user must never be left with no way forward. */}
          <p className="text-muted">{t('scan.camera_denied_help')}</p>
          <div className="flex gap-3">
            <button
              type="button"
              className="btn-secondary focus-ring flex-1"
              onClick={closeOverlay}
            >
              {t('common.close')}
            </button>
            <button
              type="button"
              className="btn-primary focus-ring flex-1"
              onClick={() => {
                closeOverlay();
                void platform.openAppSettings();
              }}
            >
              {t('common.open_settings')}
            </button>
          </div>
        </Sheet>
      ) : null}
    </div>
  );
}

function Sheet({
  titleKey,
  onDismiss,
  children,
}: {
  titleKey: string;
  onDismiss: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t(titleKey)}
      className="fixed inset-0 z-30 bg-black/40 flex items-end justify-center"
      onClick={onDismiss}
    >
      <div
        className="bg-surface w-full max-w-[480px] rounded-t-[12px] p-4 pad-bottom-safe flex flex-col gap-3"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="font-semibold text-[19px]">{t(titleKey)}</h2>
        {children}
      </div>
    </div>
  );
}
