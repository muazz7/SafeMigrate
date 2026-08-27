import { t } from '@/lib/strings';

/** Scan — BUILD-SPEC §10.2. Wired on Day 2 (upload pipeline). */
export default function ScanPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[24px] font-semibold">{t('nav.scan')}</h1>
      <p className="text-muted">Day 2 — upload pipeline.</p>
    </div>
  );
}
