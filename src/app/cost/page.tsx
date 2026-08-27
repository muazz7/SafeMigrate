import { t } from '@/lib/strings';

/** Cost Checker — BUILD-SPEC §10.5. Built on Day 7. Fully offline on both targets. */
export default function CostPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[24px] font-semibold">{t('nav.cost')}</h1>
      <p className="text-muted">Day 7 — ceiling comparison bars, overcharge maths.</p>
    </div>
  );
}
