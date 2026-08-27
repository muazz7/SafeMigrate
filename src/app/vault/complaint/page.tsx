'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * Complaint Generator — BUILD-SPEC §10.7. Built on Day 8.
 * Query parameter, not a dynamic segment (§4.1).
 */

function ComplaintContent() {
  const analysisId = useSearchParams().get('id');

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[24px] font-semibold">Complaint</h1>
      <p className="text-muted">Day 8 — letter generation, print on web, share on Android.</p>
      <p className="text-muted text-[14px]">analysisId: {analysisId ?? '—'}</p>
    </div>
  );
}

export default function ComplaintPage() {
  return (
    <Suspense fallback={<p className="text-muted">…</p>}>
      <ComplaintContent />
    </Suspense>
  );
}
