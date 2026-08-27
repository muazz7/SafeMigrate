'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Disclaimer } from '@/components/Disclaimer';

/**
 * Results — BUILD-SPEC §10.3. Built on Day 5.
 *
 * Query parameter, NOT a dynamic segment: `output: 'export'` cannot prerender
 * /scan/[id] without generateStaticParams, and the id is a runtime value (§4.1).
 * useSearchParams must sit inside Suspense or the static export build fails.
 */

function ResultContent() {
  const analysisId = useSearchParams().get('id');

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[24px] font-semibold">Result</h1>
      <p className="text-muted">Day 5 — verdict banner, findings, speech.</p>
      <p className="text-muted text-[14px]">analysisId: {analysisId ?? '—'}</p>
      <Disclaimer />
    </div>
  );
}

export default function ResultPage() {
  return (
    <Suspense fallback={<p className="text-muted">…</p>}>
      <ResultContent />
    </Suspense>
  );
}
