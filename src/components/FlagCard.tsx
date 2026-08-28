'use client';

import { useState } from 'react';
import { SeverityBadge, severityStyles } from '@/components/SeverityBadge';
import { SpeakButton } from '@/components/SpeakButton';
import { findingSpeech } from '@/lib/tts';
import { t } from '@/lib/strings';
import type { Finding } from '@/types';

/**
 * One finding — BUILD-SPEC §10.3.4.
 *
 * Layout: severity badge (colour + icon + word), title, one-sentence explanation,
 * a collapsed "what the contract says" holding the VERBATIM clause, the action,
 * a per-card speak button, and the legal reference in small text.
 *
 * The verbatim clause is the load-bearing part. It is what lets the worker hold
 * the screen next to their own paper and check the claim themselves, and it is the
 * answer to a judge asking why any of this should be believed. A card with no
 * evidence says so plainly rather than quietly omitting the section.
 *
 * `info` cards are visually distinct — no alarm colouring, a calm left border, and
 * a neutral badge — so an I02 safekeeping note can never read as a problem.
 */
export function FlagCard({ finding }: { finding: Finding }) {
  const [showEvidence, setShowEvidence] = useState(false);
  const isInfo = finding.severity === 'info';
  const style = severityStyles[finding.severity];

  return (
    <article
      className={`card p-4 flex flex-col gap-2.5 border-l-4 ${style.border} ${
        isInfo ? 'bg-info-soft/40' : ''
      }`}
    >
      <SeverityBadge severity={finding.severity} />

      <h3 className="font-semibold text-[19px] leading-snug">{t(finding.titleKey)}</h3>

      <p className="text-ink">{t(finding.explainKey)}</p>

      {finding.computed ? <ComputedFacts computed={finding.computed} /> : null}

      <div>
        <button
          type="button"
          onClick={() => setShowEvidence((open) => !open)}
          aria-expanded={showEvidence}
          className="tap focus-ring text-brand font-semibold text-[15px] inline-flex items-center gap-1.5"
        >
          <Chevron open={showEvidence} />
          {t('result.evidence_label')}
        </button>

        {showEvidence ? (
          finding.evidence ? (
            // `selectable` so the worker can copy the clause into a complaint.
            <blockquote className="selectable mt-2 border-l-2 border-border pl-3 text-muted italic">
              “{finding.evidence}”
            </blockquote>
          ) : (
            <p className="mt-2 text-muted text-[15px]">{t('result.no_evidence')}</p>
          )
        ) : null}
      </div>

      <div className="bg-brand-soft rounded-[12px] px-3 py-2.5">
        <p className="font-semibold text-[15px] text-brand">{t('result.action_label')}</p>
        <p className="text-ink">{t(finding.actionKey)}</p>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <SpeakButton text={findingSpeech(finding)} labelKey="result.speak_this" />
        {finding.legalRef ? (
          // The frame never exceeds 480px, so this sits on its own line rather
          // than being squeezed against the speak button.
          <p className="text-muted text-[13px] leading-snug min-w-0 basis-full">
            {finding.legalRef}
          </p>
        ) : null}
      </div>
    </article>
  );
}

/**
 * The computed numbers behind a finding — the overcharge amount, the weekly hours,
 * the wage shortfall. Shown so the arithmetic is inspectable rather than asserted.
 */
function ComputedFacts({ computed }: { computed: Record<string, string | number> }) {
  const entries = Object.entries(computed);
  if (entries.length === 0) return null;

  return (
    <dl className="flex flex-wrap gap-x-4 gap-y-1 text-[14px] text-muted">
      {entries.map(([key, value]) => (
        <div key={key} className="flex gap-1.5">
          <dt>{t(`computed.${key}`)}:</dt>
          <dd className="text-ink font-semibold">{String(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-transform ${open ? 'rotate-90' : ''}`}
      aria-hidden
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}
