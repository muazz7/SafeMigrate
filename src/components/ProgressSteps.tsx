import { t } from '@/lib/strings';

/**
 * Four-step named progress — BUILD-SPEC §10.2.
 *
 * Extraction takes up to 20 seconds. A bare spinner reads as frozen on a slow
 * connection, and a user who thinks the app has hung will close it. Naming the
 * current step is a requirement, not polish.
 */

export const UPLOAD_STEPS = ['uploading', 'reading', 'checking', 'done'] as const;

export type UploadStep = (typeof UPLOAD_STEPS)[number];

export function ProgressSteps({ current }: { current: UploadStep }) {
  const currentIndex = UPLOAD_STEPS.indexOf(current);

  return (
    <ol
      className="flex flex-col gap-3"
      aria-live="polite"
      aria-label={t(`scan.progress.${current}`)}
    >
      {UPLOAD_STEPS.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;

        return (
          <li key={step} className="flex items-center gap-3">
            <span
              aria-hidden
              className={`shrink-0 grid place-items-center w-7 h-7 rounded-full border text-[13px] font-semibold ${
                done
                  ? 'bg-brand border-brand text-white'
                  : active
                    ? 'bg-brand-soft border-brand text-brand'
                    : 'bg-surface border-border text-muted'
              }`}
            >
              {done ? '✓' : index + 1}
            </span>

            <span className={active ? 'font-semibold text-ink' : done ? 'text-ink' : 'text-muted'}>
              {t(`scan.progress.${step}`)}
            </span>

            {active ? (
              <span
                aria-hidden
                className="ml-auto w-4 h-4 rounded-full border-2 border-brand border-t-transparent animate-spin"
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
