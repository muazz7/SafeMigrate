import { t } from '@/lib/strings';

/** Vault — BUILD-SPEC §10.6. Built on Day 8. */
export default function VaultPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[24px] font-semibold">{t('nav.vault')}</h1>
      <p className="text-muted">Day 8 — document list, add, delete, delete-everything.</p>
    </div>
  );
}
