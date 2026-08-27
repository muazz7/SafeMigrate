'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { t } from '@/lib/strings';

/** Agency Verifier — BUILD-SPEC §10.4. Built on Day 6. Deep-linked as /agency?q=… */

function AgencyContent() {
  const query = useSearchParams().get('q');

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[24px] font-semibold">{t('nav.agency')}</h1>
      <p className="text-muted">Day 6 — licence search, four result states, offline.</p>
      <p className="text-muted text-[14px]">q: {query ?? '—'}</p>
    </div>
  );
}

export default function AgencyPage() {
  return (
    <Suspense fallback={<p className="text-muted">…</p>}>
      <AgencyContent />
    </Suspense>
  );
}
