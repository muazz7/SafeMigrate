import { t } from '@/lib/strings';

/**
 * BUILD-SPEC §16.5 / §16.8 — shown on every results view, never behind a link.
 * The wording never claims the app "detects fraud"; it flags risk indicators
 * for a human to check.
 */
export function Disclaimer() {
  return (
    <p
      role="note"
      className="text-muted text-[14px] leading-relaxed border-t border-border pt-3"
    >
      {t('common.disclaimer')}
    </p>
  );
}
